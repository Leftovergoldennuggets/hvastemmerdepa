"""Compute party positions and pairwise agreement from the raw API data.

Reads data/raw/ (see fetch.py) and writes data/computed/:

  sessions.json           index of processed sessions with counts and parties
  positions/<sesjon>.json one row per recorded vote: date, case, each party's
                          internal for/mot tally and derived position
  matrix/<sesjon>.json    pairwise agreement counts derived from positions

Method (documented publicly on the website's method page, #/metodikk):
- A party's position on a vote is the majority among its representatives who
  voted; an exact tie counts as no position ("delt").
- Two parties agree on a vote when they took the same position.
- Votes on "lovens overskrift og loven i sin helhet" are excluded, following
  Stortinget's own guidance (formal confirmation votes without political
  meaning). They remain in positions/ with an excluded-flag for transparency.
- Alternativ votering (the chamber choosing between two alternatives) is
  exported by the API as TWO mirrored voteringer linked via
  alternativ_votering_id (e.g. 63-38 vedtatt + 38-63 forkastet, same
  representatives flipped). That is one decision, not two: the twin with the
  higher votering_id is excluded ("alternativ_speil") so the event is counted
  exactly once. Verified July 2026: all 1,297 pairs in the data mirror
  perfectly, so which twin is kept does not affect any agree/disagree outcome.
- Verification: for every vote, the sum of individual votes must reproduce the
  official antall_for/antall_mot exactly; mismatches are reported.

Vote codes in voteringsresultat (verified against official counts):
1 = ikke tilstede, 2 = for, 3 = mot.
"""

import datetime
import gzip
import json
import re
import sys
import zoneinfo
from collections import Counter, defaultdict
from pathlib import Path

OSLO = zoneinfo.ZoneInfo("Europe/Oslo")

ROOT = Path(__file__).resolve().parent.parent / "data"
RAW = ROOT / "raw"
OUT = ROOT / "computed"

EXCLUDE_TEMA = re.compile(r"lovens?\s+overskrift", re.I)

# Government constellations live in regjeringer.json (data, not logic) so a
# government change means editing a config file, not this code. Dates in the
# file are verified against regjeringen.no / no.wikipedia.org; extend it
# manually at every change of government.
GOVERNMENTS = json.loads(
    (Path(__file__).resolve().parent / "regjeringer.json").read_text())["regjeringer"]


def read(path: Path):
    return json.loads(gzip.decompress(path.read_bytes()))


def date_of(ms_string):
    """Timestamp -> the vote's date in NORWEGIAN local time. Formatting in UTC
    would date a vote taken just after midnight one day too early (found by
    the external review, Sept 2026) — Stortinget's late-night sittings do
    cross midnight, and session/government boundaries compare dates."""
    if not ms_string:
        return None
    ms = int(re.search(r"-?\d+", ms_string).group())
    return datetime.datetime.fromtimestamp(ms / 1000, OSLO).strftime("%Y-%m-%d")


def session_bounds(sesjon: str):
    for s in read(RAW / "sesjoner.json.gz")["sesjoner_liste"]:
        if s["id"] == sesjon:
            return date_of(s["fra"]), date_of(s["til"])
    raise KeyError(sesjon)


def pairwise(rows):
    """Pairwise agreement counts over non-excluded votes with party positions."""
    agree, total = Counter(), Counter()
    for row in rows:
        if row["excluded"]:
            continue
        stances = []
        for parti, (f, m) in row["partier"].items():
            if parti != "Uav" and f != m:
                stances.append((parti, f > m))
        stances.sort()
        for i in range(len(stances)):
            for j in range(i + 1, len(stances)):
                (pa, sa), (pb, sb) = stances[i], stances[j]
                key = f"{pa}|{pb}"
                total[key] += 1
                agree[key] += (sa == sb)
    return agree, total


def analyse_session(sesjon: str):
    """Return (session_summary, positions, matrix) or None if data incomplete."""
    saker = {s["id"]: s for s in read(RAW / "saker" / f"{sesjon}.json.gz")["saker_liste"]}
    partier = read(RAW / "partier" / f"{sesjon}.json.gz")["partier_liste"]

    voteringer, missing_sak = [], 0
    for sid, sak in saker.items():
        p = RAW / "voteringer" / f"{sid}.json.gz"
        if not p.exists():
            missing_sak += 1
            continue
        for v in read(p).get("sak_votering_liste") or []:
            v["_sak"] = sak
            voteringer.append(v)
    if missing_sak:
        print(f"[{sesjon}] SKIPPED: {missing_sak} saker not yet downloaded")
        return None

    # Saker can span sessions and would repeat their voteringer in every
    # session they touch. Assign each votering to the session in which it
    # actually took place, by date, and drop duplicates within the session.
    fra, til = session_bounds(sesjon)
    seen = set()
    unique = []
    for v in sorted(voteringer, key=lambda v: v["votering_id"]):
        dato = date_of(v.get("votering_tid"))
        if v["votering_id"] not in seen and dato and fra <= dato <= til:
            seen.add(v["votering_id"])
            unique.append(v)
    voteringer = unique

    recorded = [v for v in voteringer
                if v.get("antall_for", -1) >= 0 and v.get("antall_mot", -1) >= 0]
    enstemmig = sum(1 for v in voteringer if v.get("votering_resultat_type") == 5)

    # One alternativ votering = two mirrored voteringer in the API (see module
    # docstring). Mark the higher-id twin for exclusion when both are present.
    recorded_ids = {v["votering_id"] for v in recorded}
    speil = {v["votering_id"] for v in recorded
             if v.get("alternativ_votering_id") in recorded_ids
             and v["votering_id"] > v["alternativ_votering_id"]}

    positions, mismatches, pending = [], 0, 0
    for v in recorded:
        vid = v["votering_id"]
        p = RAW / "stemmer" / f"{vid}.json.gz"
        if not p.exists():
            pending += 1  # unanimous votes await backfill; keep row, no positions
            stemmer = []
        else:
            stemmer = read(p).get("voteringsresultat_liste") or []

        per_party = {}
        for s in stemmer:
            parti = (s["representant"].get("parti") or {}).get("id") or "Uav"
            f, m = per_party.get(parti, (0, 0))
            if s["votering"] == 2:
                per_party[parti] = (f + 1, m)
            elif s["votering"] == 3:
                per_party[parti] = (f, m + 1)

        verified = None
        if stemmer:
            tot_f = sum(f for f, _ in per_party.values())
            tot_m = sum(m for _, m in per_party.values())
            verified = (tot_f == v["antall_for"] and tot_m == v["antall_mot"])
            if not verified:
                mismatches += 1

        excluded = None
        if EXCLUDE_TEMA.search(v.get("votering_tema") or ""):
            excluded = "lovteknisk"
        elif vid in speil:
            excluded = "alternativ_speil"
        elif not stemmer:
            excluded = "data_pending"

        positions.append({
            "vid": vid,
            "alt": v.get("alternativ_votering_id")
                   if v.get("alternativ_votering_id") in recorded_ids else None,
            "sak": v["_sak"]["id"],
            "tittel": v["_sak"].get("korttittel"),
            "komite": (v["_sak"].get("komite") or {}).get("id"),
            "dato": date_of(v.get("votering_tid")),
            "tema": v.get("votering_tema"),
            "vedtatt": v.get("vedtatt"),
            # Stortinget's own flag: party discipline formally lifted
            # (conscience votes) — displayed, never used to exclude anything.
            "fri": bool(v.get("fri_votering")),
            "for": v["antall_for"],
            "mot": v["antall_mot"],
            "verified": verified,
            "excluded": excluded,
            "partier": {p: [f, m] for p, (f, m) in sorted(per_party.items())},
        })

    agree, total = pairwise(positions)

    # Agreement per committee ("tema"): Stortinget's own guidance says the
    # committee handling a case is the reliable subject-area signal (sak-level
    # topic tags are not, especially for budgets).
    by_komite = defaultdict(list)
    for row in positions:
        if row["komite"] and not row["excluded"]:
            by_komite[row["komite"]].append(row)
    komite_data = {"counts": {}, "pairs": []}
    for kid, rows in sorted(by_komite.items()):
        komite_data["counts"][kid] = len(rows)
        k_agree, k_total = pairwise(rows)
        komite_data["pairs"] += [
            {"komite": kid, "pair": k, "agree": k_agree[k], "total": t}
            for k, t in sorted(k_total.items())
        ]

    # Internal party splits: at least two representatives voting against
    # their own party's majority. Single dissenters are excluded — mis-presses
    # are never corrected in the source data and would dominate the list.
    splits = []
    for row in positions:
        if row["excluded"]:
            continue
        for parti, (f, m) in row["partier"].items():
            if parti != "Uav" and min(f, m) >= 2:
                splits.append({
                    "sesjon": sesjon, "vid": row["vid"], "sak": row["sak"],
                    "tittel": row["tittel"], "dato": row["dato"], "tema": row["tema"],
                    "parti": parti, "for": f, "mot": m, "fri": row["fri"],
                })

    summary = {
        "sesjon": sesjon,
        "saker": len(saker),
        "voteringer": len(voteringer),
        "recorded": len(recorded),
        # counted = rows that actually enter the agreement statistics
        # (recorded minus lovteknisk/alternativ_speil/data_pending)
        "counted": sum(1 for r in positions if not r["excluded"]),
        "alternativ_speil": len(speil),
        "enstemmig": enstemmig,
        # Decisions taken without the electronic count: mostly "enstemmig
        # vedtatt" (type 5), plus "vedtatt mot 1 stemme"/"forkastet mot 0
        # stemmer" etc. — none of these have per-representative data.
        "uten_anlegg": len(voteringer) - len(recorded),
        "pending_backfill": pending,
        "verify_mismatches": mismatches,
        "partier": [{"id": p["id"], "navn": p["navn"]} for p in partier],
    }
    matrix = [{"pair": k, "agree": agree[k], "total": t} for k, t in sorted(total.items())]
    return summary, positions, matrix, komite_data, splits


def main():
    (OUT / "positions").mkdir(parents=True, exist_ok=True)
    (OUT / "matrix").mkdir(parents=True, exist_ok=True)
    (OUT / "matrix_komite").mkdir(parents=True, exist_ok=True)
    sessions = sys.argv[1:] or sorted(p.stem.replace(".json", "")
                                      for p in (RAW / "saker").glob("*.json.gz"))
    index = []
    all_positions = []
    all_splits = []
    used_komiteer = set()
    for sesjon in sessions:
        result = analyse_session(sesjon)
        if result is None:
            continue
        summary, positions, matrix, komite_data, splits = result
        (OUT / "positions" / f"{sesjon}.json").write_text(
            json.dumps(positions, ensure_ascii=False))
        (OUT / "matrix" / f"{sesjon}.json").write_text(
            json.dumps(matrix, ensure_ascii=False))
        (OUT / "matrix_komite" / f"{sesjon}.json").write_text(
            json.dumps(komite_data, ensure_ascii=False))
        used_komiteer.update(komite_data["counts"])
        index.append(summary)
        all_positions.extend(positions)
        all_splits.extend(splits)
        print(f"[{sesjon}] {summary['recorded']} recorded votes, "
              f"{summary['verify_mismatches']} verify mismatches, "
              f"{summary['pending_backfill']} pending backfill")
    (OUT / "sessions.json").write_text(json.dumps(index, ensure_ascii=False, indent=1))

    all_splits.sort(key=lambda s: s["dato"] or "", reverse=True)
    (OUT / "splits.json").write_text(json.dumps(all_splits, ensure_ascii=False))
    print(f"[splits] {len(all_splits)} party splits (>=2 dissenters)")

    # Committee id -> official name, for the ids that actually occur.
    alle = read(RAW / "allekomiteer.json.gz")["komiteer_liste"]
    komiteer = {k["id"]: k["navn"] for k in alle if k["id"] in used_komiteer}
    (OUT / "komiteer.json").write_text(json.dumps(komiteer, ensure_ascii=False))

    # Agreement per government constellation (era), from the same positions.
    eras = []
    for gov in GOVERNMENTS:
        rows = [r for r in all_positions
                if r["dato"] and r["dato"] >= gov["fra"]
                and (gov["til"] is None or r["dato"] < gov["til"])]
        agree, total = pairwise(rows)
        eras.append({**gov,
                     "voteringer": len([r for r in rows if not r["excluded"]]),
                     "matrix": [{"pair": k, "agree": agree[k], "total": t}
                                for k, t in sorted(total.items())]})
        print(f"[era] {gov['navn']} {gov['fra']}–{gov['til'] or 'nå'}: {eras[-1]['voteringer']} voteringer")
    (OUT / "eras.json").write_text(json.dumps(eras, ensure_ascii=False))
    print(f"Wrote {len(index)} sessions + {len(eras)} eras to {OUT}")


if __name__ == "__main__":
    main()

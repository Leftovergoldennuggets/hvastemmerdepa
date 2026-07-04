"""Compute party positions and pairwise agreement from the raw API data.

Reads data/raw/ (see fetch.py) and writes data/computed/:

  sessions.json           index of processed sessions with counts and parties
  positions/<sesjon>.json one row per recorded vote: date, case, each party's
                          internal for/mot tally and derived position
  matrix/<sesjon>.json    pairwise agreement counts derived from positions

Method (documented publicly in METODIKK.md):
- A party's position on a vote is the majority among its representatives who
  voted; an exact tie counts as no position ("delt").
- Two parties agree on a vote when they took the same position.
- Votes on "lovens overskrift og loven i sin helhet" are excluded, following
  Stortinget's own guidance (formal confirmation votes without political
  meaning). They remain in positions/ with an excluded-flag for transparency.
- Verification: for every vote, the sum of individual votes must reproduce the
  official antall_for/antall_mot exactly; mismatches are reported.

Vote codes in voteringsresultat (verified against official counts):
1 = ikke tilstede, 2 = for, 3 = mot.
"""

import gzip
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "data"
RAW = ROOT / "raw"
OUT = ROOT / "computed"

EXCLUDE_TEMA = re.compile(r"lovens?\s+overskrift", re.I)

# Government constellations within the data range (electronic votes start
# Oct 2011). Dates verified against regjeringen.no / no.wikipedia.org
# (Erna Solbergs regjering, Jonas Gahr Støres regjering), July 2026:
# Solberg took office 16 Oct 2013; V joined 17 Jan 2018; KrF joined
# 22 Jan 2019; FrP left 24 Jan 2020; Støre took office 14 Oct 2021;
# Sp left 4 Feb 2025; Ap continued alone (also after the Sept 2025 election).
GOVERNMENTS = [
    {"navn": "Stoltenberg II", "fra": "2011-10-01", "til": "2013-10-16", "partier": ["A", "SV", "Sp"]},
    {"navn": "Solberg",        "fra": "2013-10-16", "til": "2018-01-17", "partier": ["H", "FrP"]},
    {"navn": "Solberg",        "fra": "2018-01-17", "til": "2019-01-22", "partier": ["H", "FrP", "V"]},
    {"navn": "Solberg",        "fra": "2019-01-22", "til": "2020-01-24", "partier": ["H", "FrP", "V", "KrF"]},
    {"navn": "Solberg",        "fra": "2020-01-24", "til": "2021-10-14", "partier": ["H", "V", "KrF"]},
    {"navn": "Støre",          "fra": "2021-10-14", "til": "2025-02-04", "partier": ["A", "Sp"]},
    {"navn": "Støre",          "fra": "2025-02-04", "til": None,          "partier": ["A"]},
]


def read(path: Path):
    return json.loads(gzip.decompress(path.read_bytes()))


def date_of(ms_string):
    if not ms_string:
        return None
    ms = int(re.search(r"-?\d+", ms_string).group())
    import datetime
    return datetime.datetime.fromtimestamp(ms / 1000, datetime.timezone.utc).strftime("%Y-%m-%d")


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
        elif not stemmer:
            excluded = "data_pending"

        positions.append({
            "vid": vid,
            "sak": v["_sak"]["id"],
            "tittel": v["_sak"].get("korttittel"),
            "komite": (v["_sak"].get("komite") or {}).get("id"),
            "dato": date_of(v.get("votering_tid")),
            "tema": v.get("votering_tema"),
            "vedtatt": v.get("vedtatt"),
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

    summary = {
        "sesjon": sesjon,
        "saker": len(saker),
        "voteringer": len(voteringer),
        "recorded": len(recorded),
        "enstemmig": enstemmig,
        "pending_backfill": pending,
        "verify_mismatches": mismatches,
        "partier": [{"id": p["id"], "navn": p["navn"]} for p in partier],
    }
    matrix = [{"pair": k, "agree": agree[k], "total": t} for k, t in sorted(total.items())]
    return summary, positions, matrix, komite_data


def main():
    (OUT / "positions").mkdir(parents=True, exist_ok=True)
    (OUT / "matrix").mkdir(parents=True, exist_ok=True)
    (OUT / "matrix_komite").mkdir(parents=True, exist_ok=True)
    sessions = sys.argv[1:] or sorted(p.stem.replace(".json", "")
                                      for p in (RAW / "saker").glob("*.json.gz"))
    index = []
    all_positions = []
    used_komiteer = set()
    for sesjon in sessions:
        result = analyse_session(sesjon)
        if result is None:
            continue
        summary, positions, matrix, komite_data = result
        (OUT / "positions" / f"{sesjon}.json").write_text(
            json.dumps(positions, ensure_ascii=False))
        (OUT / "matrix" / f"{sesjon}.json").write_text(
            json.dumps(matrix, ensure_ascii=False))
        (OUT / "matrix_komite" / f"{sesjon}.json").write_text(
            json.dumps(komite_data, ensure_ascii=False))
        used_komiteer.update(komite_data["counts"])
        index.append(summary)
        all_positions.extend(positions)
        print(f"[{sesjon}] {summary['recorded']} recorded votes, "
              f"{summary['verify_mismatches']} verify mismatches, "
              f"{summary['pending_backfill']} pending backfill")
    (OUT / "sessions.json").write_text(json.dumps(index, ensure_ascii=False, indent=1))

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

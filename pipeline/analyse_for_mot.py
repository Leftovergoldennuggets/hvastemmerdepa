"""«Stemte likt», brutt ned: stemte partiene likt ved å stemme FOR eller MOT?

Background (reader feedback, November 2026): two parties «stemte likt» both
when both voted for and when both voted against. Most counted votes are on
proposals from minority parties, which the large parties routinely vote down
together. So a high «stemte likt» can mostly mean «voted down the same
proposals», not «supported the same policy». This step splits every pair's
agreement into begge for / begge mot / ulikt, per vote type, so the site can
show all three readings.

Reads data/computed/positions/ (written by analyse.py) and writes:

  for_mot/<sesjon>.json
    {"antall": {type: number of counted votes of that type},
     "typer":  {type: [votering ids]} — every counted vote's type, so the
               classification can be inspected (and the pair page's vote list
               can filter on it without re-implementing it),
     "pairs": [{"pair": "A|H",
                "innstilling": [begge_for, begge_mot, ulikt],
                "forslag":     [begge_for, begge_mot, ulikt],
                "annet":       [begge_for, begge_mot, ulikt],
                "alternativ":  [likt, ulikt]}, ...]}
  for_mot_komite/<sesjon>.json
    {"antall": {komite: {type: n}}, "pairs": [{"komite": ..., same fields}]}

Vote types (votetype() below):
  forslag      a vote on a party proposal named in the description
               («Forslag nr. 3 på vegne av FrP», «forslag 1 fra Sp og SV»).
               Parsed with analyse_gjennomslag's own functions, so these are
               exactly the proposals counted on the gjennomslag page.
  innstilling  the committee's recommendation or a part of it: «Innstillingens
               tilråding», romertall, bokstavpunkter, lovparagrafer,
               budsjettrammer — every vote that names no proposer and is not
               procedural.
  annet        procedural votes (behandlingsmåte, tilbakesending, utsettelse),
               direct votes on a representantforslag, proposals from individual
               representatives or the presidency, empty descriptions. About 0.6 %
               of counted votes. They appear only in the «alle» totals.
  alternativ   head-to-head votes between two alternatives. Here both sides vote
               FOR something (the recommendation or the proposal), and which side
               the API calls «for» varies from vote to vote (measured Nov 2026:
               the kept twin is the winning side in 929 and the losing side in
               368 of 1,297). Only [likt, ulikt] is stored: these votes count in
               «stemte likt», never in «for det samme» or «mot det samme».

Stance rule is identical to analyse.pairwise: a party's stance is the majority
of its voting representatives; a tie gives no stance; «Uav» is never a party;
excluded rows are skipped.

INVARIANT (checked on every run; the script exits non-zero if it fails, so the
daily job stops before publishing): per session and per committee, for every
pair, begge_for + begge_mot over the three directional types plus likt in
alternativ equals analyse.py's «agree», and the sum of all cells equals its
«total». The type counts sum to the session's «counted» and to each
committee's count. The new numbers are therefore a pure breakdown of the
already verified ones — nothing in the existing matrix can change.
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import analyse_gjennomslag as gj  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent / "data"
COMPUTED = ROOT / "computed"

DIRECTIONAL = ("innstilling", "forslag", "annet")
TYPES = DIRECTIONAL + ("alternativ",)

# Descriptions that name no proposer but are not part of the committee's
# recommendation either. Found by listing every such description in the data
# (Nov 2026): «Behandlingsmåte», «Tilbakesending til komite»,
# «Utsettelsesforslag sakene 7, 8 og 9.», «Representantforslaget pkt. 2»,
# «Dokument 8:236 S», «Forslag nr. 1» (no proposer), «Sak 3», «Redegjørelse …».
ANNET = re.compile(
    r"forslag|behandlingsmåte|tilbakesend|sendes tilbake|utsettelse"
    r"|redegjørelse|dokument\s*8|^\s*sak\s+\d", re.IGNORECASE)


def votetype(row):
    """One of TYPES for a positions row."""
    if gj.is_alternative(row):
        return "alternativ"
    kind, parties = gj.proposers(row)
    if kind is not None:
        return "forslag" if parties else "annet"
    tema = (row.get("tema") or "").strip()
    if not tema or ANNET.search(tema):
        return "annet"
    return "innstilling"


def tally(rows):
    """Per pair and vote type: [begge_for, begge_mot, ulikt] ([likt, ulikt]
    for alternativ), plus the number of counted votes per type."""
    pairs = defaultdict(lambda: {"innstilling": [0, 0, 0], "forslag": [0, 0, 0],
                                 "annet": [0, 0, 0], "alternativ": [0, 0]})
    antall = Counter()
    typer = {t: [] for t in TYPES}
    for row in rows:
        if row["excluded"]:
            continue
        t = votetype(row)
        antall[t] += 1
        typer[t].append(row["vid"])
        stances = sorted((p, f > m) for p, (f, m) in row["partier"].items()
                         if p != "Uav" and f != m)
        for i in range(len(stances)):
            for j in range(i + 1, len(stances)):
                (pa, sa), (pb, sb) = stances[i], stances[j]
                cell = pairs[f"{pa}|{pb}"][t]
                if t == "alternativ":
                    cell[0 if sa == sb else 1] += 1
                elif sa and sb:
                    cell[0] += 1
                elif not sa and not sb:
                    cell[1] += 1
                else:
                    cell[2] += 1
    return pairs, {t: antall.get(t, 0) for t in TYPES}, typer


def likt_total(cells):
    """(agree, total) in analyse.py's sense, recomputed from the breakdown."""
    likt = sum(cells[t][0] + cells[t][1] for t in DIRECTIONAL) + cells["alternativ"][0]
    total = sum(sum(cells[t]) for t in DIRECTIONAL) + sum(cells["alternativ"])
    return likt, total


def check(pairs, matrix_rows, label):
    """Compare the breakdown with analyse.py's verified counts."""
    old = {r["pair"]: (r["agree"], r["total"]) for r in matrix_rows}
    new = {k: likt_total(v) for k, v in pairs.items()}
    if old == new:
        return []
    diff = sorted(k for k in set(old) | set(new) if old.get(k) != new.get(k))
    return [f"{label}: {len(diff)} par avviker fra matrisen, f.eks. {diff[0]}: "
            f"matrise {old.get(diff[0])} vs for/mot {new.get(diff[0])}"]


def as_rows(pairs, **extra):
    return [{**extra, "pair": k, **v} for k, v in sorted(pairs.items())]


def main():
    (COMPUTED / "for_mot").mkdir(parents=True, exist_ok=True)
    (COMPUTED / "for_mot_komite").mkdir(parents=True, exist_ok=True)
    counted = {s["sesjon"]: s.get("counted")
               for s in json.loads((COMPUTED / "sessions.json").read_text())}
    errors = []
    totals = Counter()
    for f in sorted((COMPUTED / "positions").glob("*.json")):
        sesjon = f.stem
        rows = json.loads(f.read_text())

        pairs, antall, typer = tally(rows)
        errors += check(pairs, json.loads((COMPUTED / "matrix" / f.name).read_text()),
                        f"matrix/{sesjon}")
        if sum(antall.values()) != counted.get(sesjon):
            errors.append(f"{sesjon}: {sum(antall.values())} voteringer fordelt på typer, "
                          f"men sessions.json sier counted={counted.get(sesjon)}")
        totals.update(antall)

        # Per committee, exactly like analyse.py's matrix_komite: rows with a
        # committee that are not excluded.
        by_komite = defaultdict(list)
        for r in rows:
            if r["komite"] and not r["excluded"]:
                by_komite[r["komite"]].append(r)
        mk = json.loads((COMPUTED / "matrix_komite" / f.name).read_text())
        komite_out = {"antall": {}, "pairs": []}
        for kid, krows in sorted(by_komite.items()):
            kpairs, kantall, _ = tally(krows)
            komite_out["antall"][kid] = kantall
            komite_out["pairs"] += as_rows(kpairs, komite=kid)
            errors += check(kpairs, [r for r in mk["pairs"] if r["komite"] == kid],
                            f"matrix_komite/{sesjon}/{kid}")
            if sum(kantall.values()) != mk["counts"].get(kid):
                errors.append(f"{sesjon}/{kid}: typene summerer til {sum(kantall.values())}, "
                              f"matrix_komite sier {mk['counts'].get(kid)}")

        (COMPUTED / "for_mot" / f.name).write_text(json.dumps(
            {"antall": antall, "typer": typer, "pairs": as_rows(pairs)},
            ensure_ascii=False))
        (COMPUTED / "for_mot_komite" / f.name).write_text(
            json.dumps(komite_out, ensure_ascii=False))
        print(f"[{sesjon}] " + ", ".join(f"{t} {antall[t]}" for t in TYPES))

    print("totalt: " + ", ".join(f"{t} {totals[t]}" for t in TYPES))
    if errors:
        for e in errors[:20]:
            print(f"analyse_for_mot: FAIL {e}")
        sys.exit(1)
    print("analyse_for_mot: OK — begge for + begge mot + likt i alternative "
          "voteringer = «stemte likt» for alle par, sesjoner og komiteer")


if __name__ == "__main__":
    main()

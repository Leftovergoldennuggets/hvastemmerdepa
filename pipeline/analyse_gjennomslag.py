"""Gjennomslag: how often each party's own proposals are adopted.

Stortinget's vote descriptions name the proposers of every proposal that
comes to a vote, in two phrasings:

  1. "Forslag nr. 17 på vegne av SV og R."          (ordinary up/down vote)
  2. "Alternativ votering mellom innstillingen og
      forslagene 1-3 fra Sp, SV, R og MDG."          (head-to-head vote)

Both are counted. For phrasing 2 the vote's vedtatt-flag refers to the row's
own perspective (the API exports one alternative vote as two mirrored rows;
analyse.py keeps one, see excluded="alternativ_speil"), so whether the
PROPOSAL won is decided by which side the proposing parties themselves voted
for: proposers always vote for their own proposal, so the proposal was
adopted exactly when the proposers' side won.

Excluded: proposals made on behalf of individual representatives or the
presidency rather than a party group, and descriptions with no proposer
clause (votes on committee recommendations, law sections etc. — those are
not party proposals). The skipped counts are printed and disclosed on the
method page.

Run after analyse.py. Output: data/computed/gjennomslag.json
  { sesjon: { parti: {"fremmet": n, "vedtatt": k} } }
"""
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "data"
COMPUTED = ROOT / "computed"

# The API's vote descriptions almost always use the party ids themselves
# (A, FrP, ...); a handful of old descriptions spell names out.
ALIAS = {
    "Rødt": "R", "Høyre": "H", "Kristelig Folkeparti": "KrF", "Venstre": "V",
    "Fremskrittspartiet": "FrP", "Ap": "A", "Frp": "FrP", "MDG;": "MDG",
}
PARTY_IDS = {"A", "H", "FrP", "SV", "Sp", "R", "MDG", "KrF", "V", "PF"}
PAA_VEGNE = re.compile(r"på vegne av\s+(.+?)\s*[.:]?\s*$", re.IGNORECASE)
# Final "fra <navn>[.]" clause; [^.:] keeps the match inside the last clause.
FRA = re.compile(r"\bfra\s+([^.:]+?)\s*[.:]?\s*$", re.IGNORECASE)


def parse_parties(text):
    """Party ids from a proposer list like 'Sp, SV, R og MDG', or None if
    any token is not a party (named representatives, presidency etc.)."""
    parties = set()
    for tok in re.split(r",\s*|\s+og\s+", text):
        tok = tok.strip()
        if tok.startswith("og "):
            tok = tok[3:].strip()
        tok = ALIAS.get(tok, tok)
        if tok in PARTY_IDS:
            parties.add(tok)
        else:
            return None
    return parties or None


def main():
    out = {}
    skipped_vegne = skipped_fra = 0
    n_vegne = n_fra = 0
    for f in sorted((COMPUTED / "positions").glob("*.json")):
        per_parti = defaultdict(lambda: {"fremmet": 0, "vedtatt": 0})
        for row in json.loads(f.read_text()):
            # One alternativ votering is exported as two mirrored voteringer;
            # analyse.py marks the twin — never count the same event twice.
            if row.get("excluded") == "alternativ_speil":
                continue
            tema = row.get("tema") or ""
            low = tema.lower()

            if "på vegne av" in low:
                m = PAA_VEGNE.search(tema)
                parties = parse_parties(m.group(1)) if m else None
                if parties is None:
                    skipped_vegne += 1
                    continue
                won = bool(row.get("vedtatt"))
                n_vegne += 1
            elif "forslag" in low and " fra " in low:
                m = FRA.search(tema)
                parties = parse_parties(m.group(1)) if m else None
                if parties is None:
                    skipped_fra += 1
                    continue
                # Head-to-head votes are recognised by the description, not
                # only by the alt-link: the API sometimes exports an
                # alternativ votering as a single unlinked row (e.g. votering
                # 3541), where the vedtatt-flag refers to the row's own
                # perspective — NOT to the proposal.
                if row.get("alt") or "alternativ" in low:
                    # In the row's framing, for/mot mean "this alternative" /
                    # "the other alternative". Proposers vote for their own
                    # proposal, so the proposal was adopted exactly when the
                    # proposers' side won.
                    f_sum = sum(row["partier"].get(p, [0, 0])[0] for p in parties)
                    m_sum = sum(row["partier"].get(p, [0, 0])[1] for p in parties)
                    if f_sum == m_sum:  # proposers absent/tied: side unknowable
                        skipped_fra += 1
                        continue
                    # Guard against degenerate 0-N rows: verified against
                    # stortinget.no (sak 55618, votering 3381: recorded 0-94,
                    # official outcome "forslaget ble forkastet") that a
                    # one-sided tally does NOT mean the proposal won — a real
                    # head-to-head win always leaves votes on both sides.
                    contested = row["for"] > 0 and row["mot"] > 0
                    won = contested and (f_sum > m_sum) == bool(row.get("vedtatt"))
                else:
                    won = bool(row.get("vedtatt"))
                n_fra += 1
            else:
                continue

            for p in parties:
                per_parti[p]["fremmet"] += 1
                per_parti[p]["vedtatt"] += won

        out[f.stem] = dict(sorted(per_parti.items()))
        total = sum(v["fremmet"] for v in per_parti.values())
        print(f"[{f.stem}] {total} parti-forslag til votering")

    (COMPUTED / "gjennomslag.json").write_text(json.dumps(out, ensure_ascii=False))
    print(f"Wrote {COMPUTED / 'gjennomslag.json'}")
    print(f"counted: {n_vegne} 'på vegne av' + {n_fra} 'fra' (alternativ votering m.m.)")
    print(f"skipped: {skipped_vegne} ikke-parti 'på vegne av', {skipped_fra} uparserbare 'fra'")


if __name__ == "__main__":
    main()

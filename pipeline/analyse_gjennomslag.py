"""Gjennomslag: how often each party's own proposals are adopted.

Stortinget's vote descriptions name the proposers of every mindretalls- and
løst forslag that comes to a vote ("Forslag nr. 17 på vegne av SV og R").
This script parses those descriptions from the already-computed per-session
positions files and counts, per party per session, how many proposals made
on the party's behalf came to a vote and how many were adopted.

Excluded: proposals made on behalf of individual representatives or the
presidency rather than a party group (~70 of ~13 000), and descriptions
with no "på vegne av" clause (votes on committee recommendations, law
sections etc. — those are not party proposals).

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


def proposers(tema):
    """Party ids a proposal was made on behalf of, or None if the vote is
    not a party-group proposal (no clause, or individual/presidency)."""
    if "på vegne av" not in tema.lower():
        return None
    m = PAA_VEGNE.search(tema)
    if not m:
        return None
    parties = set()
    for tok in re.split(r",\s*|\s+og\s+", m.group(1)):
        tok = tok.strip()
        if tok.startswith("og "):
            tok = tok[3:].strip()
        tok = ALIAS.get(tok, tok)
        if tok in PARTY_IDS:
            parties.add(tok)
        else:
            return None  # named representatives, presidency etc.
    return parties or None


def main():
    out = {}
    skipped = 0
    for f in sorted((COMPUTED / "positions").glob("*.json")):
        per_parti = defaultdict(lambda: {"fremmet": 0, "vedtatt": 0})
        for row in json.loads(f.read_text()):
            parties = proposers(row.get("tema") or "")
            if parties is None:
                if "på vegne av" in (row.get("tema") or "").lower():
                    skipped += 1
                continue
            for p in parties:
                per_parti[p]["fremmet"] += 1
                per_parti[p]["vedtatt"] += bool(row.get("vedtatt"))
        out[f.stem] = dict(sorted(per_parti.items()))
        total = sum(v["fremmet"] for v in per_parti.values())
        print(f"[{f.stem}] {total} parti-forslag til votering")

    (COMPUTED / "gjennomslag.json").write_text(json.dumps(out, ensure_ascii=False))
    print(f"Wrote {COMPUTED / 'gjennomslag.json'} (skipped {skipped} ikke-parti-forslag)")


if __name__ == "__main__":
    main()

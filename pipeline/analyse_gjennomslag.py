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

Run after analyse.py. Output in data/computed/:
  gjennomslag.json          { sesjon: { parti: {"fremmet": n, "vedtatt": k} } }
  gjennomslag_komite.json   { sesjon: { komite: { parti: {...} } } } — the same
                            counts per committee; summed over committees they
                            equal gjennomslag.json minus votes without a
                            committee (checked in the tests)
  gjennomslag_vedtatt.json  [ one row per adopted proposal: sesjon, vid, dato,
                            sak, tittel, tema, komite, partier ], newest first
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


def proposers(row):
    """Which phrasing names the proposers, and which parties they are.

    Returns (kind, parties): kind is "vegne" or "fra" for a vote on a named
    proposal and None otherwise; parties is the set of party ids, or None
    when the proposers are not (only) party groups. Also used by
    analyse_for_mot.py, so «forslag fra partiene» means the same proposals
    on every page."""
    tema = row.get("tema") or ""
    low = tema.lower()
    if "på vegne av" in low:
        m = PAA_VEGNE.search(tema)
        return "vegne", (parse_parties(m.group(1)) if m else None)
    if "forslag" in low and " fra " in low:
        m = FRA.search(tema)
        return "fra", (parse_parties(m.group(1)) if m else None)
    return None, None


def is_alternative(row):
    """Head-to-head vote between two alternatives. Recognised by the
    description, not only by the alt-link: the API sometimes exports an
    alternativ votering as a single unlinked row (e.g. votering 3541)."""
    return bool(row.get("alt")) or "alternativ" in (row.get("tema") or "").lower()


def proposal_won(row, parties):
    """True if the proposal was adopted, False if not, None if unknowable.

    In an alternativ votering the vedtatt-flag refers to the row's own
    perspective, NOT to the proposal: for/mot mean "this alternative" / "the
    other alternative". Proposers vote for their own proposal, so the
    proposal was adopted exactly when the proposers' side won.

    This applies whichever phrasing names the proposers. Until November 2026
    the check only ran for the «fra» phrasing. Two head-to-head votes that
    say «på vegne av» were therefore read off the vedtatt-flag and credited
    as adopted, although the proposal fell. Both were checked on
    stortinget.no: votering 17718 (sak 86275, 28 Oct 2021, «forslaget i
    proposisjonen bifalt med 69 mot 28 stemmer» over the H/V proposal) and
    votering 25700 (sak 103154, 6 Jun 2025, «Representantforslaget ble ikke
    vedtatt»)."""
    if not is_alternative(row):
        return bool(row.get("vedtatt"))
    f_sum = sum(row["partier"].get(p, [0, 0])[0] for p in parties)
    m_sum = sum(row["partier"].get(p, [0, 0])[1] for p in parties)
    if f_sum == m_sum:  # proposers absent/tied: side unknowable
        return None
    # Guard against degenerate 0-N rows: verified against stortinget.no
    # (sak 55618, votering 3381: recorded 0-94, official outcome "forslaget
    # ble forkastet") that a one-sided tally does NOT mean the proposal won —
    # a real head-to-head win always leaves votes on both sides.
    contested = row["for"] > 0 and row["mot"] > 0
    return contested and (f_sum > m_sum) == bool(row.get("vedtatt"))


def main():
    out = {}
    per_komite_out = {}
    vedtatte = []
    skipped_vegne = skipped_fra = 0
    n_vegne = n_fra = 0
    for f in sorted((COMPUTED / "positions").glob("*.json")):
        per_parti = defaultdict(lambda: {"fremmet": 0, "vedtatt": 0})
        per_komite = defaultdict(lambda: defaultdict(lambda: {"fremmet": 0, "vedtatt": 0}))
        for row in json.loads(f.read_text()):
            # One alternativ votering is exported as two mirrored voteringer;
            # analyse.py marks the twin — never count the same event twice.
            if row.get("excluded") == "alternativ_speil":
                continue
            kind, parties = proposers(row)
            if kind is None:
                continue
            won = proposal_won(row, parties) if parties else None
            if won is None:
                if kind == "vegne":
                    skipped_vegne += 1
                else:
                    skipped_fra += 1
                continue
            if kind == "vegne":
                n_vegne += 1
            else:
                n_fra += 1

            komite = row.get("komite")
            for p in parties:
                per_parti[p]["fremmet"] += 1
                per_parti[p]["vedtatt"] += won
                # Same counts per committee (tema filter on the site). Votes
                # without a committee only appear under «alle temaer», as in
                # the agreement matrix.
                if komite:
                    per_komite[komite][p]["fremmet"] += 1
                    per_komite[komite][p]["vedtatt"] += won
            if won:
                # Every adopted proposal, so readers can see (and check on
                # stortinget.no) exactly what the counts consist of.
                vedtatte.append({
                    "sesjon": f.stem, "vid": row["vid"], "dato": row["dato"],
                    "sak": row["sak"], "tittel": row["tittel"], "tema": row["tema"],
                    "komite": komite, "partier": sorted(parties),
                })

        out[f.stem] = dict(sorted(per_parti.items()))
        per_komite_out[f.stem] = {k: dict(sorted(v.items()))
                                  for k, v in sorted(per_komite.items())}
        total = sum(v["fremmet"] for v in per_parti.values())
        print(f"[{f.stem}] {total} parti-forslag til votering")

    (COMPUTED / "gjennomslag.json").write_text(json.dumps(out, ensure_ascii=False))
    (COMPUTED / "gjennomslag_komite.json").write_text(
        json.dumps(per_komite_out, ensure_ascii=False))
    vedtatte.sort(key=lambda r: (r["dato"] or "", r["vid"]), reverse=True)
    (COMPUTED / "gjennomslag_vedtatt.json").write_text(
        json.dumps(vedtatte, ensure_ascii=False))
    print(f"Wrote {COMPUTED / 'gjennomslag.json'} (+ _komite, _vedtatt: {len(vedtatte)} vedtatte)")
    print(f"counted: {n_vegne} 'på vegne av' + {n_fra} 'fra' (alternativ votering m.m.)")
    print(f"skipped: {skipped_vegne} ikke-parti 'på vegne av', {skipped_fra} uparserbare 'fra'")


if __name__ == "__main__":
    main()

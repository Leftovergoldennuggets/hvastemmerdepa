"""Validate the shape of every raw API file the analysis consumes.

Stortinget documents the XML export but not the JSON format the pipeline
reads (proven equivalent by sjekk_json_mot_xml.py). This script pins that
contract: every field analyse.py touches must exist with the expected type
and value range. It runs in the daily auto-update between fetch and analyse,
so if Stortinget ever changes the JSON shape, the job fails loudly and the
published site stays untouched — instead of numbers silently going wrong.

Exit 0 = all files match the expected shape. ~30 s over the full raw store.
"""
import gzip
import json
import sys
from pathlib import Path

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"

errors = []
counts = {"sesjoner": 0, "saker": 0, "voteringer": 0, "stemmer": 0}


def err(msg):
    errors.append(msg)


def expect(cond, msg):
    if not cond:
        err(msg)
    return cond


def read(path):
    return json.loads(gzip.decompress(path.read_bytes()))


def check_sesjoner():
    data = read(RAW / "sesjoner.json.gz")
    liste = data.get("sesjoner_liste")
    if not expect(isinstance(liste, list) and liste, "sesjoner: sesjoner_liste mangler/tom"):
        return
    for s in liste:
        expect(isinstance(s.get("id"), str), f"sesjon: id ikke str: {s.get('id')!r}")
        expect(isinstance(s.get("fra"), str), f"sesjon {s.get('id')}: fra ikke str")
        counts["sesjoner"] += 1


def check_saker():
    for p in sorted((RAW / "saker").glob("*.json.gz")):
        liste = read(p).get("saker_liste")
        if not expect(isinstance(liste, list), f"{p.name}: saker_liste mangler"):
            continue
        for s in liste:
            ok = isinstance(s.get("id"), int)
            expect(ok, f"{p.name}: sak-id ikke int: {s.get('id')!r}")
            kom = s.get("komite")
            expect(kom is None or isinstance(kom.get("id"), str),
                   f"{p.name}: sak {s.get('id')}: komite uten str-id")
            counts["saker"] += 1


def check_voteringer():
    for p in sorted((RAW / "voteringer").glob("*.json.gz")):
        liste = read(p).get("sak_votering_liste")
        if liste is None:
            continue  # sak uten voteringer
        if not expect(isinstance(liste, list), f"{p.name}: sak_votering_liste feil type"):
            continue
        for v in liste:
            vid = v.get("votering_id")
            expect(isinstance(vid, int), f"{p.name}: votering_id ikke int: {vid!r}")
            for f in ("antall_for", "antall_mot", "alternativ_votering_id",
                      "votering_resultat_type"):
                expect(isinstance(v.get(f), int), f"votering {vid}: {f} ikke int: {v.get(f)!r}")
            expect(isinstance(v.get("vedtatt"), bool), f"votering {vid}: vedtatt ikke bool")
            expect(isinstance(v.get("fri_votering"), bool), f"votering {vid}: fri_votering ikke bool")
            expect(v.get("votering_tid") is None or isinstance(v["votering_tid"], str),
                   f"votering {vid}: votering_tid feil type")
            expect(v.get("votering_tema") is None or isinstance(v["votering_tema"], str),
                   f"votering {vid}: votering_tema feil type")
            counts["voteringer"] += 1


def check_stemmer():
    for p in sorted((RAW / "stemmer").glob("*.json.gz")):
        liste = read(p).get("voteringsresultat_liste")
        if liste is None:
            continue  # tomme individdata (data_pending) er kjent og opplyst
        if not expect(isinstance(liste, list), f"{p.name}: voteringsresultat_liste feil type"):
            continue
        for s in liste:
            code = s.get("votering")
            # 1=ikke tilstede, 2=for, 3=mot — bekreftet mot XML-eksportens
            # navngitte verdier (sjekk_json_mot_xml.py) og offisielle stemmetall.
            expect(code in (1, 2, 3), f"{p.name}: ukjent stemmekode {code!r}")
            rep = s.get("representant")
            if expect(isinstance(rep, dict), f"{p.name}: representant mangler"):
                expect(isinstance(rep.get("id"), str), f"{p.name}: representant uten str-id")
                parti = rep.get("parti")
                expect(parti is None or isinstance(parti.get("id"), str),
                       f"{p.name}: parti uten str-id")
            counts["stemmer"] += 1


def main():
    for step in (check_sesjoner, check_saker, check_voteringer, check_stemmer):
        step()
        if len(errors) > 100:
            break
    print(f"valider_format: {counts['sesjoner']} sesjoner, {counts['saker']} saker, "
          f"{counts['voteringer']} voteringer, {counts['stemmer']} enkeltstemmer sjekket")
    if errors:
        print(f"valider_format: FAIL — {len(errors)} avvik fra forventet format:")
        for e in errors[:20]:
            print(f"  {e}")
        sys.exit(1)
    print("valider_format: OK")


if __name__ == "__main__":
    main()

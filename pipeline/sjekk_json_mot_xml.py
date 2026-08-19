"""Verify that the API's JSON export mirrors the documented XML, field by field.

Stortinget documents the XML elements of every endpoint (data.stortinget.no →
teknisk dokumentasjon) but not the JSON format. The JSON is generated from the
same data with the same field names; this script PROVES that empirically for
every field the pipeline consumes, by fetching a sample in both formats and
comparing value by value.

Known representational differences (all handled by comparing semantically):
  - datetimes: XML uses ISO 8601 ("2013-09-23T00:00:00+02:00"), JSON uses
    WCF epoch format ("/Date(1379887200000+0200)/") — compared as instants.
  - booleans: XML "true"/"false" text vs JSON true/false.
  - null: XML i:nil="true" vs JSON null.
  - enum fields: XML uses NAMED values, JSON numeric codes. This applies to
    votering_resultat_type ("enstemmig_vedtatt" = 5, "ikke_spesifisert" = 0)
    and — crucially — the individual vote itself: XML says "for"/"mot"/
    "ikke_tilstede" where JSON says 2/3/1. The script builds each mapping
    from the data and fails only on inconsistency, so the XML names serve as
    official documentation of the JSON codes. This independently PROVES the
    pipeline's vote-code table (1=ikke tilstede, 2=for, 3=mot), which was
    previously verified only empirically against official tallies.

Observed API quirk OUTSIDE our data range (2011→): session from/til dates
before 1996 differ by exactly one hour between XML and JSON (a DST artifact
on Stortinget's side). Sessions 2011+ — the only ones the pipeline uses —
agree exactly, so the comparison is limited to those. Worth reporting to
web@stortinget.no together with the missing JSON documentation.

Usage:  python3 pipeline/sjekk_json_mot_xml.py [sesjon]   (default 2024-2025)
Makes ~12 API calls. Exit 0 = every compared field identical.
"""
import datetime
import json
import re
import sys
import xml.etree.ElementTree as ET

from fetch import BASE, _paced_fetch

NIL = "{http://www.w3.org/2001/XMLSchema-instance}nil"


def local(tag):
    return tag.split("}", 1)[-1]


def child(elem, name):
    for c in elem:
        if local(c.tag) == name:
            return c
    return None


def value(elem):
    """XML leaf -> comparable native value (None for nil)."""
    if elem is None or elem.get(NIL) == "true":
        return None
    t = (elem.text or "").strip()
    if t in ("true", "false"):
        return t == "true"
    if re.fullmatch(r"-?\d+", t):
        return int(t)
    return t


def as_instant(v):
    """Datetime in either representation -> epoch milliseconds."""
    if v is None:
        return None
    if isinstance(v, str) and v.startswith("/Date("):
        return int(re.search(r"-?\d+", v).group())
    return int(datetime.datetime.fromisoformat(v).timestamp() * 1000)


def fetch_both(path):
    xml = ET.fromstring(_paced_fetch(f"{BASE}/{path}"))
    js = json.loads(_paced_fetch(f"{BASE}/{path}{'&' if '?' in path else '?'}format=json"))
    return xml, js


def compare(label, xml_val, json_val, errors, datetime_field=False):
    if datetime_field:
        xml_val, json_val = as_instant(xml_val), as_instant(json_val)
    if xml_val != json_val:
        errors.append(f"{label}: XML={xml_val!r} JSON={json_val!r}")


def main():
    sesjon = sys.argv[1] if len(sys.argv) > 1 else "2024-2025"
    errors = []
    compared = 0
    resultat_type_map = {}  # XML name -> JSON code, must be consistent
    stemme_map = {}         # XML vote name ("for"/"mot"/...) -> JSON code

    # 1) Sessions in the pipeline's range (2011+): id + date bounds.
    xml, js = fetch_both("sesjoner")
    xml_sesjoner = {value(child(s, "id")): s for s in xml.iter() if local(s.tag) == "sesjon"}
    n_sesjoner = 0
    for j in js["sesjoner_liste"]:
        if int(j["id"][:4]) < 2011:
            continue  # pre-1996 rows have a known 1h DST quirk; out of scope
        n_sesjoner += 1
        x = xml_sesjoner.get(j["id"])
        if x is None:
            errors.append(f"sesjon {j['id']}: mangler i XML")
            continue
        for f in ("fra", "til"):
            compare(f"sesjon {j['id']}.{f}", value(child(x, f)), j[f], errors, datetime_field=True)
            compared += 1
    print(f"  sesjoner: {n_sesjoner} rader (2011+)")

    # 2) Cases for the session: id, korttittel, komite (first 50).
    xml, js = fetch_both(f"saker?sesjonid={sesjon}")
    xml_saker = {value(child(s, "id")): s for s in xml.iter() if local(s.tag) == "sak"}
    sample_saker = js["saker_liste"][:50]
    for j in sample_saker:
        x = xml_saker.get(j["id"])
        compare(f"sak {j['id']}.korttittel", value(child(x, "korttittel")), j["korttittel"], errors)
        x_kom, j_kom = child(x, "komite"), j.get("komite")
        compare(f"sak {j['id']}.komite",
                None if x_kom is None or x_kom.get(NIL) == "true" else value(child(x_kom, "id")),
                None if j_kom is None else j_kom.get("id"), errors)
        compared += 2
    print(f"  saker: {len(sample_saker)} rader")

    # 3) Votes from sample saker: every field analyse.py uses. Keep scanning
    # until at least two RECORDED votes are found (so step 4 can compare the
    # individual 1/2/3 vote codes), capped at 12 saker to bound API calls.
    vote_ids = []
    checked_saker = 0
    for j in sample_saker:
        if checked_saker >= 12 or (checked_saker >= 3 and len(vote_ids) >= 2):
            break
        xml, js2 = fetch_both(f"voteringer?sakid={j['id']}")
        j_votes = js2.get("sak_votering_liste") or []
        if not j_votes:
            continue
        checked_saker += 1
        x_votes = {value(child(v, "votering_id")): v
                   for v in xml.iter() if local(v.tag) == "sak_votering"}
        for jv in j_votes:
            xv = x_votes.get(jv["votering_id"])
            if xv is None:
                errors.append(f"votering {jv['votering_id']}: mangler i XML")
                continue
            for f in ("antall_for", "antall_mot", "antall_ikke_tilstede", "vedtatt",
                      "alternativ_votering_id", "votering_tema", "fri_votering"):
                compare(f"votering {jv['votering_id']}.{f}", value(child(xv, f)), jv.get(f), errors)
                compared += 1
            # XML names the result type, JSON numbers it: require a consistent
            # name<->code mapping (this doubles as documentation of the codes).
            x_type, j_type = value(child(xv, "votering_resultat_type")), jv.get("votering_resultat_type")
            if x_type in resultat_type_map and resultat_type_map[x_type] != j_type:
                errors.append(f"votering {jv['votering_id']}: resultat_type "
                              f"{x_type!r} = både {resultat_type_map[x_type]} og {j_type}")
            resultat_type_map[x_type] = j_type
            compared += 1
            compare(f"votering {jv['votering_id']}.votering_tid",
                    value(child(xv, "votering_tid")), jv.get("votering_tid"),
                    errors, datetime_field=True)
            compared += 1
            if jv.get("antall_for", -1) >= 0:
                vote_ids.append(jv["votering_id"])

    # 4) Individual votes for up to 2 recorded voteringer: person, party, code.
    n_stemmer = 0
    for vid in vote_ids[:2]:
        xml, js2 = fetch_both(f"voteringsresultat?voteringid={vid}")
        j_rows = {r["representant"]["id"]: r for r in js2.get("voteringsresultat_liste") or []}
        x_rows = [r for r in xml.iter() if local(r.tag) == "representant_voteringsresultat"]
        if len(x_rows) != len(j_rows):
            errors.append(f"stemmer {vid}: {len(x_rows)} rader i XML, {len(j_rows)} i JSON")
        for xr in x_rows:
            rep = child(xr, "representant")
            rid = value(child(rep, "id"))
            jr = j_rows.get(rid)
            if jr is None:
                errors.append(f"stemmer {vid}: {rid} mangler i JSON")
                continue
            x_code, j_code = value(child(xr, "votering")), jr["votering"]
            if x_code in stemme_map and stemme_map[x_code] != j_code:
                errors.append(f"stemmer {vid}.{rid}: {x_code!r} = både "
                              f"{stemme_map[x_code]} og {j_code}")
            stemme_map[x_code] = j_code
            x_parti = child(rep, "parti")
            compare(f"stemmer {vid}.{rid}.parti",
                    None if x_parti is None or x_parti.get(NIL) == "true"
                    else value(child(x_parti, "id")),
                    (jr["representant"].get("parti") or {}).get("id"), errors)
            compared += 2
            n_stemmer += 1
    print(f"  stemmer: {n_stemmer} enkeltstemmer i {len(vote_ids[:2])} voteringer")

    print(f"Sammenlignet {compared} feltverdier (sesjon {sesjon}).")
    if resultat_type_map:
        print("  votering_resultat_type, XML-navn -> JSON-kode: "
              + ", ".join(f"{k}={v}" for k, v in sorted(resultat_type_map.items(),
                                                        key=lambda p: p[1])))
    if stemme_map:
        print("  stemmekoder, XML-navn -> JSON-kode: "
              + ", ".join(f"{k}={v}" for k, v in sorted(stemme_map.items(),
                                                        key=lambda p: p[1])))
    if errors:
        print(f"AVVIK ({len(errors)}):")
        for e in errors[:20]:
            print(f"  {e}")
        sys.exit(1)
    print("OK: JSON og XML er identiske for alle sammenlignede felter.")


if __name__ == "__main__":
    main()

"""Aggregate representative demographics per party per stortingsperiode.

Only structured fields are aggregated (gender, birth date, time in
parliament) — free-text education/occupation entries are never classified by
us. Codes verified empirically: kjoenn 1 = kvinne, 2 = mann (checked against
known representatives).

Who is counted:
- Earlier periods: the representatives elected at the start of the period.
- The current period: the chamber as it is today. Members of the government
  (and others on long leave) do not meet in Stortinget; a permanent
  substitute (fast vararepresentant) meets instead. Stortinget's own list of
  today's representatives (dagensrepresentanter) names who meets «fast» for
  whom, and each such substitute replaces the person they meet for. It is
  refetched every morning, so a government reshuffle shows up the next day.

«Tid på Stortinget» (field fartstid, years at the start of the period) follows
the rule behind Stortinget's own seniority (ansiennitet): time as elected
representative — including periods on leave as a minister — plus time
actually meeting as a substitute. Gaps in a career are NOT counted (until
Nov 2026 this was «time since first elected», so someone elected in 1989 and
again in 2025 showed 36 years instead of 4).
- Current period: Stortinget's official ansiennitet from the biography,
  wound back to the period start, for everyone elected at the start.
- Otherwise: summed from the biography's periods and leave records (merged so
  nothing is counted twice), including substitute time recorded in other
  members' biographies (matched by exact, unique name). Short substitute
  stints are not always recorded there, so this can be slightly LOWER than
  Stortinget's figure; measured Nov 2026 on 452 biographies: 400 within
  60 days of the official number, 6 off by more than a year.

Output: data/computed/personer.json
"""
import datetime
import gzip
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "data"
RAW = ROOT / "raw"
OUT = ROOT / "computed"


def read(path):
    return json.loads(gzip.decompress(path.read_bytes()))


def ms_date(s):
    if not s:
        return None
    ms = int(re.search(r"-?\d+", s).group())
    return datetime.datetime.fromtimestamp(ms / 1000, datetime.timezone.utc).date()


def biografi(pid, cache={}):
    if pid not in cache:
        p = RAW / "biografi" / f"{pid}.json.gz"
        cache[pid] = read(p) if p.exists() else {}
    return cache[pid]


def real_date(s):
    """ms_date, but the API's placeholder for «open-ended» (year 1) → None."""
    d = ms_date(s)
    return d if d and d.year >= 1900 else None


def _all_bios():
    for f in sorted((RAW / "biografi").glob("*.json.gz")):
        yield f.name[: -len(".json.gz")]


_SPANS = None


def spans(pid):
    """(from, to) spans when the person was on Stortinget: elected periods
    (verv Representant, leave included — as in Stortinget's ansiennitet) and
    time meeting as a substitute. Substitute time is recorded either in the
    person's own biography (type VARA) or in the absent member's (type BORTE,
    with the substitute's NAME only) — the latter is matched to a person id
    only when exactly one representative has that name. to=None: ongoing."""
    global _SPANS
    if _SPANS is None:
        names = defaultdict(set)
        for f in (RAW / "representanter").glob("*.json.gz"):
            for r in read(f)["representanter_liste"]:
                names[(r.get("fornavn", "").strip(), r.get("etternavn", "").strip())].add(r["id"])
        for r in dagens_liste():
            names[(r.get("fornavn", "").strip(), r.get("etternavn", "").strip())].add(r["id"])
        _SPANS = defaultdict(list)
        for p in _all_bios():
            b = biografi(p)
            for sp in b.get("stortingsperiode_kodet_liste") or []:
                if sp.get("verv") == "Representant":
                    _SPANS[p].append((real_date(sp.get("fra_dato")), real_date(sp.get("til_dato"))))
            for perm in b.get("permisjon_kodet_liste") or []:
                span = (real_date(perm.get("fra_dato")), real_date(perm.get("til_dato")))
                if perm.get("type") == "VARA":
                    _SPANS[p].append(span)
                elif perm.get("type") == "BORTE":
                    ids = names.get(((perm.get("vara_fornavn") or "").strip(),
                                     (perm.get("vara_etternavn") or "").strip()), set())
                    if len(ids) == 1:
                        _SPANS[next(iter(ids))].append(span)
    return _SPANS[pid]


def years_before(pid, ved):
    """Years on Stortinget before date `ved`, overlapping spans merged."""
    cut = sorted((f, min(t or ved, ved)) for f, t in spans(pid) if f and f < ved)
    days, cur = 0, None
    for f, t in cut:
        if cur and f <= cur[1]:
            cur[1] = max(cur[1], t)
            continue
        if cur:
            days += (cur[1] - cur[0]).days
        cur = [f, t]
    if cur:
        days += (cur[1] - cur[0]).days
    return days / 365.25


def official_years_at(pid, periode, start):
    """Stortinget's own ansiennitet, wound back to the period start — only
    for someone elected for this period from its start, who has accrued
    ansiennitet every day since (leave included). None otherwise."""
    b = biografi(pid)
    pk = b.get("personalia_kodet") or {}
    resp = real_date(b.get("respons_dato_tid"))
    if pk.get("ansiennitet_aar") is None or not resp or resp < start:
        return None
    elected_from_start = any(
        sp.get("stortingsperiode_id") == periode and sp.get("verv") == "Representant"
        and (real_date(sp.get("fra_dato")) or start) <= start
        for sp in b.get("stortingsperiode_kodet_liste") or [])
    if not elected_from_start:
        return None
    years = pk["ansiennitet_aar"] + (pk.get("ansiennitet_dager") or 0) / 365.25
    return max(0.0, years - (resp - start).days / 365.25)


def dagens_liste():
    p = RAW / "dagensrepresentanter.json.gz"
    return (read(p).get("dagensrepresentanter_liste") or []) if p.exists() else []


def _years(e):
    fra = e.get("fra_aar") if not e.get("fra_aar_ukjent") else None
    til = e.get("til_aar") if not e.get("til_aar_ukjent") else None
    if fra and til:
        return f"{fra}" if fra == til else f"{fra}–{til}"
    return f"{fra or til}" if (fra or til) else None


def cv(pid):
    """Education (type 10) and occupation (type 20) entries, verbatim from
    Stortinget's coded biography — we display, never classify, free text."""
    utd, yrk = [], []
    for e in biografi(pid).get("utdanning_yrke_kodet_liste") or []:
        navn = (e.get("navn") or "").strip()
        if not navn:
            continue
        item = {"navn": navn, "aar": _years(e)}
        (utd if e.get("type") == "10" else yrk).append(item)
    return utd, yrk


def komiteer(pid, periode):
    """Fagkomité memberships in the given period (structured field)."""
    out = []
    for v in biografi(pid).get("stortingsverv_kodet_liste") or []:
        if v.get("stortingsperiode_id") == periode and v.get("komite_type") == "FAG":
            navn = v.get("komite_navn")
            if navn and navn not in out:
                out.append(navn)
    return out


def sammensetning_i_dag(reps):
    """Replace every elected member who has a permanent substitute today with
    that substitute. Returns (reps, replaced) or (reps, None) when today's
    list does not fit the period (e.g. right after an election), in which
    case the elected list is kept and the site says so."""
    dagens = dagens_liste()
    valgt = {r["id"]: r for r in reps}
    vara = [r for r in dagens if r.get("fast_vara_for")]
    if not (150 <= len(dagens) <= 175) or any(
            (v["fast_vara_for"] or {}).get("id") not in valgt for v in vara):
        print(f"  dagensrepresentanter passer ikke perioden ({len(dagens)} personer) "
              f"— viser de valgte")
        return reps, None
    erstattet = {}
    for v in vara:
        erstattet[v["fast_vara_for"]["id"]] = v
    ut = [r for r in reps if r["id"] not in erstattet]
    for pid, v in erstattet.items():
        ut.append({**v, "_moter_for": valgt[pid]})
    replaced = [{
        "id": pid,
        "navn": f"{valgt[pid].get('fornavn', '')} {valgt[pid].get('etternavn', '')}".strip(),
        "parti": (valgt[pid].get("parti") or {}).get("id"),
        "vara_id": v["id"],
        "vara_navn": f"{v.get('fornavn', '')} {v.get('etternavn', '')}".strip(),
    } for pid, v in sorted(erstattet.items(), key=lambda kv: valgt[kv[0]].get("etternavn", ""))]
    return ut, replaced


def main():
    result = {}
    previous = {}
    if (OUT / "personer.json").exists():
        previous = json.loads((OUT / "personer.json").read_text())
    periods = sorted(p.stem.replace(".json", "") for p in (RAW / "representanter").glob("*.json.gz"))
    for periode in periods:
        p = RAW / "representanter" / f"{periode}.json.gz"
        start = datetime.date(int(periode[:4]), 10, 1)
        reps = [r for r in read(p)["representanter_liste"]
                if not r.get("vara_representant")]
        sammensetning = {"type": "valgt"}
        dagens_komiteer = {}
        if periode == periods[-1] and dagens_liste():
            reps, replaced = sammensetning_i_dag(reps)
            if replaced is not None:
                dagens_komiteer = {r["id"]: [k.get("navn") for k in r.get("komiteer_liste") or []
                                             if k.get("navn")] for r in dagens_liste()}
                # «Oppdatert»: the date the composition last changed (kept
                # from the previous run while it stays the same), so the
                # daily job does not commit a new date every morning.
                old = previous.get(periode, {}).get("sammensetning", {})
                same = old.get("type") == "i_dag" and old.get("erstattet") == replaced
                sammensetning = {
                    "type": "i_dag",
                    "oppdatert": old["oppdatert"] if same else datetime.date.today().isoformat(),
                    "erstattet": replaced,
                }

        per_parti = defaultdict(lambda: {"seter": 0, "kvinner": 0,
                                         "aldre": [], "fartstid": []})
        personer = []
        for r in reps:
            parti = (r.get("parti") or {}).get("id") or "Uav"
            g = per_parti[parti]
            g["seter"] += 1
            g["kvinner"] += (r.get("kjoenn") == 1)
            born = ms_date(r.get("foedselsdato"))
            alder = round((start - born).days / 365.25, 1) if born else None
            if alder is not None:
                g["aldre"].append(alder)
            official = official_years_at(r["id"], periode, start) if periode == periods[-1] else None
            fartstid = round(official if official is not None else years_before(r["id"], start), 1) \
                if biografi(r["id"]) else None
            if fartstid is not None:
                g["fartstid"].append(fartstid)
            utd, yrk = cv(r["id"])
            person = {
                "id": r["id"],
                "navn": f"{r.get('fornavn', '')} {r.get('etternavn', '')}".strip(),
                "parti": parti,
                "kjoenn": r.get("kjoenn"),
                "alder": alder,
                "fartstid": fartstid,
                "fylke": (r.get("fylke") or {}).get("navn"),
                "komiteer": dagens_komiteer.get(r["id"], komiteer(r["id"], periode))
                            if dagens_komiteer else komiteer(r["id"], periode),
                "utdanning": utd,
                "yrke": yrk,
            }
            if r.get("_moter_for"):
                m = r["_moter_for"]
                person["moter_for"] = {
                    "id": m["id"],
                    "navn": f"{m.get('fornavn', '')} {m.get('etternavn', '')}".strip(),
                }
            personer.append(person)

        out = {}
        for parti, g in per_parti.items():
            out[parti] = {
                "seter": g["seter"],
                "kvinner": g["kvinner"],
                "snittalder": round(sum(g["aldre"]) / len(g["aldre"]), 1) if g["aldre"] else None,
                "snitt_fartstid": round(sum(g["fartstid"]) / len(g["fartstid"]), 1) if g["fartstid"] else None,
                "fartstid_n": len(g["fartstid"]),
            }
        result[periode] = {
            "sammensetning": sammensetning,
            "partier": dict(sorted(out.items(), key=lambda kv: -kv[1]["seter"])),
            "representanter": sorted(personer, key=lambda x: x["navn"]),
        }
        if sammensetning["type"] == "i_dag":
            print(f"  i dag: {len(sammensetning['erstattet'])} valgte erstattet av fast vara")
        total = sum(v["seter"] for v in out.values())
        print(f"[{periode}] {total} representanter, {len(out)} partier")

    (OUT / "personer.json").write_text(json.dumps(result, ensure_ascii=False))
    print(f"Wrote {OUT / 'personer.json'}")


if __name__ == "__main__":
    main()

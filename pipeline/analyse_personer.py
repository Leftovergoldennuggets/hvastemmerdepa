"""Aggregate representative demographics per party per stortingsperiode.

Only structured fields are aggregated (gender, birth date, first period in
parliament) — free-text education/occupation entries are never classified by
us. Codes verified empirically: kjoenn 1 = kvinne, 2 = mann (checked against
known representatives).

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


def first_elected(pid):
    """Date the person first sat as elected representative (vara periods
    excluded — being on the substitute list is not being elected)."""
    p = RAW / "biografi" / f"{pid}.json.gz"
    if not p.exists():
        return None
    perioder = read(p).get("stortingsperiode_kodet_liste") or []
    dates = [ms_date(sp.get("fra_dato")) for sp in perioder
             if sp.get("verv") == "Representant" and sp.get("fra_dato")]
    dates = [d for d in dates if d]
    return min(dates) if dates else None


def main():
    result = {}
    for p in sorted((RAW / "representanter").glob("*.json.gz")):
        periode = p.stem.replace(".json", "")
        start = datetime.date(int(periode[:4]), 10, 1)
        reps = [r for r in read(p)["representanter_liste"]
                if not r.get("vara_representant")]

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
            first = first_elected(r["id"])
            fartstid = round(max(0.0, (start - first).days / 365.25), 1) if first else None
            if fartstid is not None:
                g["fartstid"].append(fartstid)
            personer.append({
                "id": r["id"],
                "navn": f"{r.get('fornavn', '')} {r.get('etternavn', '')}".strip(),
                "parti": parti,
                "kjoenn": r.get("kjoenn"),
                "alder": alder,
                "fartstid": fartstid,
                "fylke": (r.get("fylke") or {}).get("navn"),
            })

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
            "partier": dict(sorted(out.items(), key=lambda kv: -kv[1]["seter"])),
            "representanter": sorted(personer, key=lambda x: x["navn"]),
        }
        total = sum(v["seter"] for v in out.values())
        print(f"[{periode}] {total} representanter, {len(out)} partier")

    (OUT / "personer.json").write_text(json.dumps(result, ensure_ascii=False))
    print(f"Wrote {OUT / 'personer.json'}")


if __name__ == "__main__":
    main()

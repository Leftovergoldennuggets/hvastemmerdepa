"""Copy computed data artifacts into the website's public data folder.

Run after analyse.py. Keeps the website a pure consumer of pipeline output.
"""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "computed"
DST = ROOT / "web" / "public" / "data"

# Overwrite in place — never delete the live directory. A rmtree while the
# dev server is running leaves it with stale file handles, and it starts
# serving index.html instead of JSON for random files.
DST.mkdir(parents=True, exist_ok=True)
shutil.copy(SRC / "sessions.json", DST / "sessions.json")
shutil.copy(SRC / "eras.json", DST / "eras.json")
shutil.copy(SRC / "komiteer.json", DST / "komiteer.json")
shutil.copy(SRC / "splits.json", DST / "splits.json")
shutil.copy(SRC / "personer.json", DST / "personer.json")
shutil.copy(SRC / "gjennomslag.json", DST / "gjennomslag.json")
shutil.copytree(SRC / "matrix", DST / "matrix", dirs_exist_ok=True)
shutil.copytree(SRC / "matrix_komite", DST / "matrix_komite", dirs_exist_ok=True)
shutil.copytree(SRC / "positions", DST / "positions", dirs_exist_ok=True)
fotos = ROOT / "data" / "raw" / "fotos"
if fotos.exists():
    shutil.copytree(fotos, ROOT / "web" / "public" / "fotos", dirs_exist_ok=True)
for old in DST.rglob("*.json"):
    rel = old.relative_to(DST)
    if str(rel) not in ("sessions.json", "eras.json", "meta.json") and not (SRC / rel).exists():
        old.unlink()

# Build metadata so the site never hardcodes dates or totals. Everything the
# method page states as fact is computed here from the published data.
import datetime
import json
from collections import defaultdict

sessions = json.loads((SRC / "sessions.json").read_text())
mismatches = []   # individual sums differ from official tallies (disclosed)
pending = []      # API returns no individual votes despite official tallies
unity = []        # per party per session: share of votes with zero dissenters
for s in sessions:
    per_party = defaultdict(lambda: [0, 0])  # parti -> [united, participated]
    for row in json.loads((SRC / "positions" / f"{s['sesjon']}.json").read_text()):
        if row["verified"] is False:
            mismatches.append({"vid": row["vid"], "dato": row["dato"], "tittel": row["tittel"]})
        if row["excluded"] == "data_pending":
            pending.append({"vid": row["vid"], "dato": row["dato"], "tittel": row["tittel"]})
        if not row["excluded"]:
            for parti, (f, m) in row["partier"].items():
                if parti != "Uav" and f + m > 0:
                    per_party[parti][1] += 1
                    per_party[parti][0] += (f == 0 or m == 0)
    for parti, (u, t) in per_party.items():
        if t >= 50:  # need a meaningful sample within the session
            unity.append(100 * u / t)

meta = {
    "generated": datetime.date.today().isoformat(),
    "sessions": len(sessions),
    "first_session": sessions[0]["sesjon"],
    "last_session": sessions[-1]["sesjon"],
    "recorded_votes": sum(s["recorded"] for s in sessions),
    "counted_votes": sum(s.get("counted", s["recorded"]) for s in sessions),
    "alternativ_speil": sum(s.get("alternativ_speil", 0) for s in sessions),
    "verify_mismatches": mismatches,
    "data_pending": pending,
    "enstemmig": sum(s["enstemmig"] for s in sessions),
    "uten_anlegg": sum(s.get("uten_anlegg", 0) for s in sessions),
    # Party unity, measured: min/max over party-sessions (>= 50 votes)
    "unity_min": round(min(unity)) if unity else None,
    "unity_max": round(max(unity)) if unity else None,
}
(DST / "meta.json").write_text(json.dumps(meta))

n = sum(1 for _ in DST.rglob("*.json"))
size = sum(p.stat().st_size for p in DST.rglob("*.json")) / 1e6
print(f"published {n} files, {size:.1f} MB -> {DST} (generated {meta['generated']})")

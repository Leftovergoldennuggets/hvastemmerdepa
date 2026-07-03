"""Copy computed data artifacts into the website's public data folder.

Run after analyse.py. Keeps the website a pure consumer of pipeline output.
"""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "computed"
DST = ROOT / "web" / "public" / "data"

if DST.exists():
    shutil.rmtree(DST)
DST.mkdir(parents=True)
shutil.copy(SRC / "sessions.json", DST / "sessions.json")
shutil.copy(SRC / "eras.json", DST / "eras.json")
shutil.copytree(SRC / "matrix", DST / "matrix")
shutil.copytree(SRC / "positions", DST / "positions")

# Build metadata so the site never hardcodes dates or totals.
import datetime
import json
sessions = json.loads((SRC / "sessions.json").read_text())
mismatches = []
for s in sessions:
    if s["verify_mismatches"]:
        for row in json.loads((SRC / "positions" / f"{s['sesjon']}.json").read_text()):
            if row["verified"] is False:
                mismatches.append({"vid": row["vid"], "dato": row["dato"], "tittel": row["tittel"]})

meta = {
    "generated": datetime.date.today().isoformat(),
    "sessions": len(sessions),
    "first_session": sessions[0]["sesjon"],
    "last_session": sessions[-1]["sesjon"],
    "recorded_votes": sum(s["recorded"] for s in sessions),
    "verify_mismatches": mismatches,
    "enstemmig": sum(s["enstemmig"] for s in sessions),
}
(DST / "meta.json").write_text(json.dumps(meta))

n = sum(1 for _ in DST.rglob("*.json"))
size = sum(p.stat().st_size for p in DST.rglob("*.json")) / 1e6
print(f"published {n} files, {size:.1f} MB -> {DST} (generated {meta['generated']})")

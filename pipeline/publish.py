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
shutil.copytree(SRC / "matrix", DST / "matrix", dirs_exist_ok=True)
shutil.copytree(SRC / "matrix_komite", DST / "matrix_komite", dirs_exist_ok=True)
shutil.copytree(SRC / "positions", DST / "positions", dirs_exist_ok=True)
for old in DST.rglob("*.json"):
    rel = old.relative_to(DST)
    if str(rel) not in ("sessions.json", "eras.json", "meta.json") and not (SRC / rel).exists():
        old.unlink()

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

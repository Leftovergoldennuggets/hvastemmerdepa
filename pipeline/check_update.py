"""Sanity-check freshly computed data against the last committed version.

Run between analyse.py and publish.py in the auto-update job. Voting data is
append-only, so a legitimate update can only ADD: if sessions disappear, a
session's vote counts shrink, a party list changes for an already-published
session, or any computed file comes out empty or with impossible numbers,
something upstream went wrong (incomplete raw store, API change, code bug)
and publishing would corrupt the site. In that case this script exits
non-zero, the job stops, nothing is committed, and the live site keeps
yesterday's data. (Coverage widened Sept 2026 after the external review
showed the old check only guarded one of the computed file types.)

An increase in verify-mismatches is reported but does not block: those votes
are flagged in the data and disclosed automatically on the method page.
"""
import json
import subprocess
import sys
from pathlib import Path

COMPUTED = Path(__file__).resolve().parent.parent / "data" / "computed"


def sane_pairs(rows, label, errors, may_be_empty=False):
    """Every pair row must satisfy 0 <= agree <= total, total > 0."""
    if not rows and not may_be_empty:
        errors.append(f"{label}: empty matrix")
    for r in rows:
        if not (0 <= r["agree"] <= r["total"]) or r["total"] <= 0:
            errors.append(f"{label} {r.get('pair')}: impossible counts "
                          f"agree={r['agree']} total={r['total']}")
            return  # one example per file is enough


def main():
    old_raw = subprocess.run(
        ["git", "show", "HEAD:data/computed/sessions.json"],
        capture_output=True, text=True, cwd=COMPUTED.parent.parent)
    if old_raw.returncode != 0:
        sys.exit("check_update: cannot read committed sessions.json from git")
    old = {s["sesjon"]: s for s in json.loads(old_raw.stdout)}
    new = {s["sesjon"]: s for s in json.loads((COMPUTED / "sessions.json").read_text())}

    errors = []
    for sesjon in old:
        if sesjon not in new:
            errors.append(f"session {sesjon} disappeared")
            continue
        for field in ("recorded", "counted"):
            if new[sesjon].get(field, 0) < old[sesjon].get(field, 0):
                errors.append(f"{sesjon}: {field} shrank "
                              f"{old[sesjon].get(field)} -> {new[sesjon].get(field)}")
        # Party lists for already-published sessions are historical facts.
        gamle = {p["id"] for p in old[sesjon].get("partier", [])}
        nye = {p["id"] for p in new[sesjon].get("partier", [])}
        if gamle != nye:
            errors.append(f"{sesjon}: party list changed {sorted(gamle)} -> {sorted(nye)}")

    # Every matrix must exist, be non-empty (when the session has counted
    # votes) and contain only possible counts.
    for sesjon, s in new.items():
        p = COMPUTED / "matrix" / f"{sesjon}.json"
        if not p.exists():
            errors.append(f"{sesjon}: matrix file missing")
            continue
        sane_pairs(json.loads(p.read_text()), f"matrix/{sesjon}", errors,
                   may_be_empty=s.get("counted", 0) == 0)

    # Eras, gjennomslag and personer must parse and be non-empty.
    eras = json.loads((COMPUTED / "eras.json").read_text())
    if not eras:
        errors.append("eras.json: empty")
    for era in eras:
        sane_pairs(era.get("matrix", []), f"era {era.get('navn')} {era.get('fra')}",
                   errors, may_be_empty=era.get("voteringer", 0) == 0)
    if not json.loads((COMPUTED / "gjennomslag.json").read_text()):
        errors.append("gjennomslag.json: empty")
    if not json.loads((COMPUTED / "personer.json").read_text()):
        errors.append("personer.json: empty")

    old_mismatch = sum(s.get("verify_mismatches", 0) for s in old.values())
    new_mismatch = sum(s.get("verify_mismatches", 0) for s in new.values())
    if new_mismatch > old_mismatch:
        print(f"check_update: NOTE verify_mismatches rose {old_mismatch} -> "
              f"{new_mismatch} (disclosed on the method page, not blocking)")

    added = sum(new[s].get("counted", 0) for s in new) - \
        sum(old[s].get("counted", 0) for s in old)
    print(f"check_update: {len(old)} -> {len(new)} sessions, "
          f"{added:+d} counted votes vs last commit")

    if errors:
        for e in errors:
            print(f"check_update: FAIL {e}")
        sys.exit(1)
    print("check_update: OK")


if __name__ == "__main__":
    main()

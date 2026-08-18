"""Sanity-check freshly computed data against the last committed version.

Run between analyse.py and publish.py in the auto-update job. Voting data is
append-only, so a legitimate update can only ADD: if sessions disappear or a
session's vote counts shrink, something upstream went wrong (incomplete raw
store, API change, refetch failure) and publishing would corrupt the site.
In that case this script exits non-zero, the job stops, nothing is committed,
and the live site keeps yesterday's data.

An increase in verify-mismatches is reported but does not block: those votes
are flagged in the data and disclosed automatically on the method page.
"""
import json
import subprocess
import sys
from pathlib import Path

NEW_PATH = Path(__file__).resolve().parent.parent / "data" / "computed" / "sessions.json"


def main():
    old_raw = subprocess.run(
        ["git", "show", "HEAD:data/computed/sessions.json"],
        capture_output=True, text=True, cwd=NEW_PATH.parent.parent.parent)
    if old_raw.returncode != 0:
        sys.exit("check_update: cannot read committed sessions.json from git")
    old = {s["sesjon"]: s for s in json.loads(old_raw.stdout)}
    new = {s["sesjon"]: s for s in json.loads(NEW_PATH.read_text())}

    errors = []
    for sesjon in old:
        if sesjon not in new:
            errors.append(f"session {sesjon} disappeared")
            continue
        for field in ("recorded", "counted"):
            if new[sesjon].get(field, 0) < old[sesjon].get(field, 0):
                errors.append(f"{sesjon}: {field} shrank "
                              f"{old[sesjon].get(field)} -> {new[sesjon].get(field)}")

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

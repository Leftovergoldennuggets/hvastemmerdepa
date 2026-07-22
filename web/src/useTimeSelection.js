import { useEffect, useMemo, useState } from "react";
import { groupPeriods } from "./lib.js";

// Shared time-range state for matrix and party views: stortingsperiode tabs
// plus single-session override, defaulting to the newest period.
export function useTimeSelection(index) {
  const periods = useMemo(() => (index ? groupPeriods(index) : new Map()), [index]);
  const [selection, setSelection] = useState(null);

  useEffect(() => {
    if (index && !selection) {
      const keys = [...groupPeriods(index).keys()];
      setSelection({ kind: "period", id: keys[keys.length - 1] });
    }
  }, [index, selection]);

  const selectedSessions = useMemo(() => {
    if (!index || !selection) return [];
    if (selection.kind === "sesjon") {
      return index.filter((s) => s.sesjon === selection.id);
    }
    return periods.get(selection.id) || [];
  }, [index, selection, periods]);

  const label =
    selection?.kind === "period"
      ? `i stortingsperioden ${selection.id}`
      : `i sesjonen ${selection?.id}`;
  // counted = votes that enter the statistics (excludes lovteknisk
  // confirmations and the mirrored twin of each alternativ votering)
  const totalVotes = selectedSessions.reduce((n, s) => n + (s.counted ?? s.recorded), 0);

  return { periods, selection, setSelection, selectedSessions, label, totalVotes };
}

import { useEffect, useState } from "react";
import { partyOrFallback } from "./parties.js";
import { gjennomslagData, gjennomslagKomiteData, aggregateGjennomslag } from "./lib.js";

// Shared by this page and the home-page teaser: per-party counts for the
// selected sessions, optionally for one committee («tema»), plus the
// committees that have any party proposals in those sessions.
export function useGjennomslag(sessions, tema) {
  const [data, setData] = useState(null);
  const [komiteData, setKomiteData] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    Promise.all([gjennomslagData(), gjennomslagKomiteData()])
      .then(([d, k]) => { setData(d); setKomiteData(k); })
      .catch(() => setError(true));
  }, []);

  const ids = sessions.map((s) => s.sesjon);
  if (!data || !komiteData || !ids.length) return { ranking: null, komiteValg: [], error };

  // Committees ordered by how many party-proposal votes they had (summed
  // over parties, so joint proposals weigh more — only used for ordering).
  const vekt = new Map();
  for (const id of ids) {
    for (const [kid, perParti] of Object.entries(komiteData[id] || {})) {
      const n = Object.values(perParti).reduce((a, v) => a + v.fremmet, 0);
      vekt.set(kid, (vekt.get(kid) || 0) + n);
    }
  }
  const komiteValg = [...vekt.entries()].sort((a, b) => b[1] - a[1]).map(([kid]) => kid);

  const agg = tema
    ? aggregateGjennomslag(komiteData, ids, tema)
    : aggregateGjennomslag(data, ids);
  // Ranked by the NUMBER of adopted proposals, not the share: opposition
  // parties routinely file stacks of proposals they know will fall, so the
  // count of what actually passed says more about real influence.
  const ranking = [...agg.entries()]
    .filter(([, v]) => v.fremmet > 0)
    .map(([id, v]) => ({
      party: partyOrFallback(id),
      ...v,
      pct: (100 * v.vedtatt) / v.fremmet,
    }))
    .sort((a, b) => b.vedtatt - a.vedtatt || b.pct - a.pct);
  return { ranking, komiteValg, error };
}

// Data loading and aggregation. The site is a pure consumer of the pipeline's
// computed JSON (web/public/data); no numbers are calculated from scratch here
// beyond summing per-session pair counts over the selected time range.

const cache = new Map();

export async function fetchJSON(path) {
  if (!cache.has(path)) {
    const p = fetch(path).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    });
    // Never memoize a failure: a transient error (offline moment, data being
    // republished) must not wedge the view until a full page reload.
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path);
}

export const sessionsIndex = () => fetchJSON("/data/sessions.json");

// Stortingsperioder are election-to-election. Norwegian elections fall every
// fourth year (2009, 2013, …), so the period is computed, not listed — new
// sessions slot in automatically forever.
export function periodOf(sesjonId) {
  const y = parseInt(sesjonId.slice(0, 4), 10);
  const start = 2009 + Math.floor((y - 2009) / 4) * 4;
  // Electronic voting records begin autumn 2011, so the 2009-2013 period is
  // only partially covered; the label must not overpromise.
  if (start === 2009) return "2011–2013";
  return `${start}–${start + 4}`;
}

export const siteMeta = () => fetchJSON("/data/meta.json");

export function groupPeriods(sessions) {
  const groups = new Map();
  for (const s of sessions) {
    const p = periodOf(s.sesjon);
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(s);
  }
  return groups;
}

// Sum pairwise agree/total over a set of sessions.
export async function aggregateMatrix(sesjonIds) {
  const out = new Map();
  for (const id of sesjonIds) {
    const rows = await fetchJSON(`/data/matrix/${id}.json`);
    for (const { pair, agree, total } of rows) {
      const acc = out.get(pair) || { agree: 0, total: 0 };
      acc.agree += agree;
      acc.total += total;
      out.set(pair, acc);
    }
  }
  return out;
}

export function pairKey(a, b) {
  return [a, b].sort().join("|");
}

export const formatN = (n) => n.toLocaleString("nb-NO");

export const formatDate = (iso) =>
  new Date(iso + "T12:00:00").toLocaleDateString("nb-NO", {
    day: "numeric", month: "long", year: "numeric",
  });

export const sakUrl = (sakId) =>
  `https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=${sakId}`;

// Agreement between two parties per session, oldest first.
export async function pairSeries(index, aId, bId) {
  const key = pairKey(aId, bId);
  const out = [];
  for (const s of index) {
    const rows = await fetchJSON(`/data/matrix/${s.sesjon}.json`);
    const hit = rows.find((r) => r.pair === key);
    out.push({ sesjon: s.sesjon, agree: hit?.agree ?? 0, total: hit?.total ?? 0 });
  }
  return out;
}

export const loadPositions = (sesjon) => fetchJSON(`/data/positions/${sesjon}.json`);

export const erasData = () => fetchJSON("/data/eras.json");

// A pair's agreement per government constellation, with the pair's role.
export function pairEras(eras, aId, bId) {
  const key = pairKey(aId, bId);
  return eras
    .map((era) => {
      const hit = era.matrix.find((r) => r.pair === key);
      if (!hit || !hit.total) return null;
      const inGov = [era.partier.includes(aId), era.partier.includes(bId)];
      return {
        navn: era.navn,
        fra: era.fra.slice(0, 4),
        til: era.til ? era.til.slice(0, 4) : "nå",
        partier: era.partier,
        role:
          inGov[0] && inGov[1] ? "sammen"
          : inGov[0] ? aId
          : inGov[1] ? bId
          : "opposisjon",
        agree: hit.agree,
        total: hit.total,
      };
    })
    .filter(Boolean);
}

// A party's stance on one vote: true = for, false = mot, null = no position
// (absent, tied, or not in parliament).
export function stance(row, partyId) {
  const p = row.partier[partyId];
  if (!p) return null;
  const [f, m] = p;
  if (f === m) return null;
  return f > m;
}

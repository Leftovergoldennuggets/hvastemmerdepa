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

// Official biography page for a representative on stortinget.no.
export const personUrl = (personId) =>
  `https://www.stortinget.no/no/Representanter-og-komiteer/Representantene/Representant/?perid=${encodeURIComponent(personId)}`;

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

export const komiteerData = () => fetchJSON("/data/komiteer.json");

// Per-committee ("tema") agreement, summed over the given sessions.
export async function aggregateKomite(sesjonIds) {
  const counts = new Map();
  const byKomite = new Map();
  for (const id of sesjonIds) {
    const d = await fetchJSON(`/data/matrix_komite/${id}.json`);
    for (const [k, n] of Object.entries(d.counts)) {
      counts.set(k, (counts.get(k) || 0) + n);
    }
    for (const { komite, pair, agree, total } of d.pairs) {
      if (!byKomite.has(komite)) byKomite.set(komite, new Map());
      const m = byKomite.get(komite);
      const acc = m.get(pair) || { agree: 0, total: 0 };
      acc.agree += agree;
      acc.total += total;
      m.set(pair, acc);
    }
  }
  return { counts, byKomite };
}

// «Stemte likt» broken down into begge for / begge mot / ulikt per vote type
// (pipeline/analyse_for_mot.py — which stops the daily job unless the
// breakdown sums exactly to the verified matrix). Summed over sessions,
// optionally for one committee. Shape per pair:
//   { innstilling: [for, mot, ulikt], forslag: [...], annet: [...],
//     alternativ: [likt, ulikt] }
const TOM_FOR_MOT = () => ({
  innstilling: [0, 0, 0], forslag: [0, 0, 0], annet: [0, 0, 0], alternativ: [0, 0],
});

export async function aggregateForMot(sesjonIds, komite = "") {
  const pairs = new Map();
  const antall = { innstilling: 0, forslag: 0, annet: 0, alternativ: 0 };
  for (const id of sesjonIds) {
    const d = await fetchJSON(
      komite ? `/data/for_mot_komite/${id}.json` : `/data/for_mot/${id}.json`
    );
    const n = komite ? d.antall[komite] : d.antall;
    if (n) for (const t of Object.keys(antall)) antall[t] += n[t] || 0;
    for (const row of d.pairs) {
      if (komite && row.komite !== komite) continue;
      const acc = pairs.get(row.pair) || TOM_FOR_MOT();
      for (const t of Object.keys(acc)) row[t].forEach((v, i) => { acc[t][i] += v; });
      pairs.set(row.pair, acc);
    }
  }
  return { pairs, antall };
}

// Which vote types each «utvalg» covers for the for/mot readings.
const RETNINGSTYPER = {
  alle: ["innstilling", "forslag", "annet"],
  innstilling: ["innstilling"],
  forslag: ["forslag"],
};

// One reading of the breakdown as a pair → {agree, total} map, the same shape
// aggregateMatrix returns, so the matrix and party ranking show it unchanged.
//   maaling "likt": begge for + begge mot, of all votes where both took a stance
//   maaling "for":  begge for, of the votes where at least one voted for
//   maaling "mot":  begge mot, of the votes where at least one voted against
// Alternative voteringer count only in «likt» over all votes: there the
// chamber chooses between two alternatives, so both sides vote FOR something
// and the API's «for» side is arbitrary.
export function forMotMatrix(pairs, maaling, utvalg) {
  const out = new Map();
  for (const [pair, c] of pairs) {
    let bf = 0, bm = 0, u = 0;
    for (const t of RETNINGSTYPER[utvalg]) {
      bf += c[t][0]; bm += c[t][1]; u += c[t][2];
    }
    let agree, total;
    if (maaling === "for") { agree = bf; total = bf + u; }
    else if (maaling === "mot") { agree = bm; total = bm + u; }
    else {
      agree = bf + bm; total = bf + bm + u;
      if (utvalg === "alle") {
        agree += c.alternativ[0];
        total += c.alternativ[0] + c.alternativ[1];
      }
    }
    if (total > 0) out.set(pair, { agree, total });
  }
  return out;
}

// Number of counted votes in an «utvalg».
export function antallIUtvalg(antall, utvalg) {
  return utvalg === "alle"
    ? Object.values(antall).reduce((a, b) => a + b, 0)
    : antall[utvalg];
}

// One pair's breakdown per session, oldest first (pair page).
export async function pairForMot(index, aId, bId) {
  const key = pairKey(aId, bId);
  const out = [];
  for (const s of index) {
    const d = await fetchJSON(`/data/for_mot/${s.sesjon}.json`);
    const hit = d.pairs.find((r) => r.pair === key);
    out.push({ sesjon: s.sesjon, ...(hit || TOM_FOR_MOT()) });
  }
  return out;
}

// Vote id → type («innstilling», «forslag», «annet», «alternativ») for one
// session, as classified by the pipeline.
export async function voteTypes(sesjon) {
  const d = await fetchJSON(`/data/for_mot/${sesjon}.json`);
  const out = new Map();
  for (const [t, vids] of Object.entries(d.typer || {})) {
    for (const vid of vids) out.set(vid, t);
  }
  return out;
}

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

export const personerData = () => fetchJSON("/data/personer.json");

export const gjennomslagData = () => fetchJSON("/data/gjennomslag.json");

export const gjennomslagKomiteData = () => fetchJSON("/data/gjennomslag_komite.json");

export const gjennomslagVedtattData = () => fetchJSON("/data/gjennomslag_vedtatt.json");

// Sum per-party proposal counts (fremmet/vedtatt) over a set of sessions —
// from gjennomslag.json, or for one committee from gjennomslag_komite.json.
export function aggregateGjennomslag(data, sesjonIds, komite = "") {
  const out = new Map();
  for (const id of sesjonIds) {
    const perParti = komite ? data[id]?.[komite] : data[id];
    for (const [parti, v] of Object.entries(perParti || {})) {
      const acc = out.get(parti) || { fremmet: 0, vedtatt: 0 };
      acc.fremmet += v.fremmet;
      acc.vedtatt += v.vedtatt;
      out.set(parti, acc);
    }
  }
  return out;
}

// Official Stortinget portrait, downloaded by the pipeline and served from
// this site (hotlinking the API is rate-limited and breaks at scale).
export const personPhoto = (personId) => `/fotos/${encodeURIComponent(personId)}.jpg`;

// A party's stance on one vote: true = for, false = mot, null = no position
// (absent, tied, or not in parliament).
export function stance(row, partyId) {
  const p = row.partier[partyId];
  if (!p) return null;
  const [f, m] = p;
  if (f === m) return null;
  return f > m;
}

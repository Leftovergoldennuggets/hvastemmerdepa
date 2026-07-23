import { useEffect, useMemo, useRef, useState } from "react";
import { pairSeries, loadPositions, erasData, pairEras, aggregateKomite, komiteerData, pairKey, stance, formatN, formatDate, sakUrl } from "./lib.js";
import { cellColor, cellText, partyOrFallback } from "./parties.js";
import { downloadCsv } from "./csv.js";

function Logo({ party, size = 34 }) {
  return (
    <span className="logo-tile" style={{ width: size, height: size }}>
      {party.logo ? (
        <img src={party.logo} alt="" />
      ) : (
        <span style={{ width: "55%", height: "55%", borderRadius: "50%", background: party.farge }} />
      )}
    </span>
  );
}

/* Hand-rolled SVG line chart: agreement per session, 0-100 %, hairline grid,
   hover crosshair + tooltip, direct label on the last point. Government
   changes are drawn as dashed vertical lines (labelled when the PM changed). */
function TimeSeries({ series, a, b }) {
  const [hover, setHover] = useState(null);
  const [eras, setEras] = useState(null);
  const wrapRef = useRef(null);
  useEffect(() => { erasData().then(setEras).catch(() => {}); }, []);
  const W = 900, H = 280, L = 44, R = 24, T = 18, B = 30;
  const pts = series
    .map((s, i) => ({ ...s, i }))
    .filter((s) => s.total > 0)
    .map((s) => ({
      ...s,
      x: L + (s.i / (series.length - 1)) * (W - L - R),
      y: T + (1 - s.agree / s.total) * (H - T - B),
      pct: (100 * s.agree) / s.total,
    }));

  // line segments only between sessions where both have data and are adjacent
  const segments = [];
  for (let k = 1; k < pts.length; k++) {
    if (pts[k].i === pts[k - 1].i + 1) {
      segments.push([pts[k - 1], pts[k]]);
    }
  }

  const years = series
    .map((s, i) => ({ y: s.sesjon.slice(0, 4), i }))
    .filter(({ y }) => ["2011", "2013", "2017", "2021", "2025"].includes(y));

  // Government changes as x-positions. Sessions run 1 Oct-30 Sep; a change
  // mid-session lands proportionally between the session points. Only PM
  // changes get a label; coalition reshuffles are unlabelled lines.
  const markers = [];
  if (eras && series.length > 1) {
    let prev = null;
    for (const era of eras) {
      if (prev && era.fra) {
        const [yy, mm] = [Number(era.fra.slice(0, 4)), Number(era.fra.slice(5, 7))];
        const sessYear = mm >= 10 ? yy : yy - 1;
        const idx = series.findIndex((s) => s.sesjon.startsWith(String(sessYear)));
        if (idx !== -1) {
          const f = Math.min(1, Math.max(0,
            (new Date(era.fra) - new Date(`${sessYear}-10-01`)) / (365 * 864e5)));
          const pos = Math.min(series.length - 1, Math.max(0, idx + f - 0.5));
          markers.push({
            x: L + (pos / (series.length - 1)) * (W - L - R),
            label: era.navn !== prev.navn ? era.navn : null,
          });
        }
      }
      prev = era;
    }
  }

  const onMove = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    let best = null;
    for (const p of pts) {
      if (!best || Math.abs(p.x - mx) < Math.abs(best.x - mx)) best = p;
    }
    setHover(best ? { ...best, cx: e.clientX, cy: e.clientY } : null);
  };

  const last = pts[pts.length - 1];

  return (
    <div className="chart" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Andel voteringer der ${a.navn} og ${b.navn} stemte likt, per sesjon`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 25, 50, 75, 100].map((v) => {
          const y = T + (1 - v / 100) * (H - T - B);
          return (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y} y2={y} className="grid" />
              <text x={L - 8} y={y + 4} className="tick" textAnchor="end">{v}</text>
            </g>
          );
        })}
        {years.map(({ y, i }) => {
          const x = L + (i / (series.length - 1)) * (W - L - R);
          return (
            <text key={y} x={x} y={H - 8} className="tick" textAnchor="middle">{y}</text>
          );
        })}
        {markers.map((m, k) => (
          <g key={k}>
            <line x1={m.x} x2={m.x} y1={T} y2={H - B} className="era-line" />
            {m.label && (
              <text x={m.x + 5} y={T + 10} className="era-label">{m.label}</text>
            )}
          </g>
        ))}
        {hover && (
          <line x1={hover.x} x2={hover.x} y1={T} y2={H - B} className="crosshair" />
        )}
        {segments.map(([p1, p2], k) => (
          <line key={k} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className="dataline" />
        ))}
        {pts.map((p) => (
          <circle key={p.sesjon} cx={p.x} cy={p.y} r="4.5" className="datapoint" />
        ))}
        {last && (
          <text x={last.x} y={last.y - 12} className="endlabel" textAnchor="middle">
            {Math.round(last.pct)} %
          </text>
        )}
      </svg>
      {hover && (
        <div
          className="tooltip"
          style={{ left: Math.min(hover.cx + 14, window.innerWidth - 300), top: hover.cy + 16 }}
        >
          <div className="pct">{hover.pct.toFixed(1).replace(".", ",")} %</div>
          <div>
            Stemte likt i {formatN(hover.agree)} av {formatN(hover.total)} voteringer
            i sesjonen {hover.sesjon}.
          </div>
        </div>
      )}
    </div>
  );
}

function EraTable({ a, b }) {
  const [eras, setEras] = useState(null);
  useEffect(() => { erasData().then(setEras); }, []);
  if (!eras) return null;
  const rows = pairEras(eras, a.id, b.id);
  if (rows.length < 2) return null;

  const roleText = (r) =>
    r.role === "sammen" ? "i regjering sammen"
    : r.role === "opposisjon" ? "begge i opposisjon"
    : `${r.role === a.id ? a.navn : b.navn} i regjering`;

  return (
    <section className="era-table">
      <h3>Gjennom regjeringene</h3>
      <ol>
        {rows.map((r, i) => {
          const pct = (100 * r.agree) / r.total;
          return (
            <li key={i}>
              <span className="era-name">
                {r.navn} ({r.partier.map((id) => partyOrFallback(id).kort).join(", ")}){" "}
                <span className="era-years">{r.fra}–{r.til}</span>
              </span>
              <span className="era-role">{roleText(r)}</span>
              <span className="era-pct" style={{ background: cellColor(pct), color: cellText(pct) }}>
                {pct.toFixed(1).replace(".", ",")} %
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function KomiteTable({ index, a, b }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const [agg, navn] = await Promise.all([
        aggregateKomite(index.map((s) => s.sesjon)),
        komiteerData(),
      ]);
      const key = pairKey(a.id, b.id);
      const out = [];
      for (const [kid, m] of agg.byKomite) {
        const c = m.get(key);
        if (c && c.total >= 30) {
          out.push({ kid, navn: navn[kid] || kid, ...c, pct: (100 * c.agree) / c.total });
        }
      }
      out.sort((x, y) => y.pct - x.pct);
      if (live) setRows(out);
    })().catch(() => live && setRows([]));
    return () => { live = false; };
  }, [index, a.id, b.id]);

  if (!rows || rows.length < 2) return null;
  return (
    <section className="era-table">
      <h3>Tema for tema</h3>
      <ol>
        {rows.map((r) => (
          <li key={r.kid}>
            <span className="era-name">{r.navn}</span>
            <span className="era-role">{formatN(r.total)} voteringer</span>
            <span className="era-pct" style={{ background: cellColor(r.pct), color: cellText(r.pct) }}>
              {r.pct.toFixed(1).replace(".", ",")} %
            </span>
          </li>
        ))}
      </ol>
      <p className="empty-note">
        Tema følger fagkomiteen som behandlet saken, alle år samlet. Temaer med
        under 30 felles voteringer vises ikke.
      </p>
    </section>
  );
}

function VoteList({ index, a, b }) {
  const newestFirst = useMemo(
    () => [...index].map((s) => s.sesjon).reverse(),
    [index]
  );
  const [filter, setFilter] = useState("uenige");
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(0);
  const [visible, setVisible] = useState(25);

  useEffect(() => {
    setRows([]); setLoaded(0); setVisible(25);
  }, [a.id, b.id]);

  // load sessions newest-first until we can fill the visible window
  useEffect(() => {
    let live = true;
    (async () => {
      let have = rows;
      let n = loaded;
      while (n < newestFirst.length) {
        const matching = have.filter((r) => r.match[filter]).length;
        if (matching >= visible + 1) break;
        const positions = await loadPositions(newestFirst[n]);
        n += 1;
        const extra = positions
          .filter((r) => !r.excluded)
          .map((r) => {
            const sa = stance(r, a.id);
            const sb = stance(r, b.id);
            if (sa === null || sb === null) return null;
            return { ...r, sa, sb, match: { uenige: sa !== sb, enige: sa === sb } };
          })
          .filter(Boolean)
          .sort((x, y) => (y.dato || "").localeCompare(x.dato || ""));
        have = [...have, ...extra];
        if (!live) return;
      }
      if (live) { setRows(have); setLoaded(n); }
    })();
    return () => { live = false; };
  }, [a.id, b.id, filter, visible, loaded, newestFirst]); // eslint-disable-line

  const shown = rows.filter((r) => r.match[filter]).slice(0, visible);
  const exhausted = loaded >= newestFirst.length;
  const [exporting, setExporting] = useState(false);

  const exportAll = async () => {
    setExporting(true);
    try {
      const out = [];
      for (const sesjon of newestFirst) {
        const positions = await loadPositions(sesjon);
        for (const r of positions) {
          if (r.excluded) continue;
          const sa = stance(r, a.id);
          const sb = stance(r, b.id);
          if (sa === null || sb === null) continue;
          out.push([
            r.dato || "", sesjon, r.sak, r.tittel || "", r.vid, r.tema || "",
            sa ? "for" : "mot", sb ? "for" : "mot",
            sa === sb ? "enige" : "uenige", sakUrl(r.sak),
          ]);
        }
      }
      out.sort((x, y) => String(y[0]).localeCompare(String(x[0])));
      downloadCsv(
        `voteringer-${a.kort}-${b.kort}.csv`.toLowerCase(),
        ["dato", "sesjon", "sak_id", "sak", "votering_id", "votering_tema",
         a.kort.toLowerCase(), b.kort.toLowerCase(), "resultat", "lenke"],
        out
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="votelist">
      <div className="filter-tabs">
        <button className={`tab${filter === "uenige" ? " active" : ""}`} onClick={() => setFilter("uenige")}>
          Der de stemte ulikt
        </button>
        <button className={`tab${filter === "enige" ? " active" : ""}`} onClick={() => setFilter("enige")}>
          Der de stemte likt
        </button>
        <button className="dl right" onClick={exportAll} disabled={exporting}>
          {exporting ? "Henter alle voteringer …" : "Last ned alle som CSV"}
        </button>
      </div>
      <ol>
        {shown.map((r) => (
          <li key={r.vid} className="vote-row">
            <div className="vote-meta">
              {r.dato ? formatDate(r.dato) : ""}
            </div>
            <div className="vote-main">
              <a href={sakUrl(r.sak)} target="_blank" rel="noreferrer">{r.tittel}</a>
              <div className="vote-tema">{r.tema}</div>
            </div>
            <div className="vote-stances">
              <span><strong>{a.kort}</strong> {r.sa ? "for" : "mot"}</span>
              <span><strong>{b.kort}</strong> {r.sb ? "for" : "mot"}</span>
            </div>
          </li>
        ))}
      </ol>
      {shown.length === 0 && (
        <p className="empty-note">
          {exhausted ? "Ingen voteringer funnet." : "Laster …"}
        </p>
      )}
      {(rows.filter((r) => r.match[filter]).length > visible || !exhausted) && shown.length > 0 && (
        <button className="more" onClick={() => setVisible((v) => v + 25)}>
          Vis flere
        </button>
      )}
      <p className="empty-note">
        Hver votering lenker til saken hos stortinget.no, der du kan
        kontrollere resultatet.
      </p>
    </section>
  );
}

export default function PairView({ index, a, b }) {
  const [series, setSeries] = useState(null);

  useEffect(() => {
    let live = true;
    setSeries(null);
    pairSeries(index, a.id, b.id)
      .then((s) => live && setSeries(s))
      .catch(() => live && setSeries([]));
    return () => { live = false; };
  }, [index, a.id, b.id]);

  const overall = series
    ? series.reduce((acc, s) => ({ agree: acc.agree + s.agree, total: acc.total + s.total }), { agree: 0, total: 0 })
    : null;
  const firstYear = series?.find((s) => s.total > 0)?.sesjon.slice(0, 4);

  return (
    <div>
      <div className="pair-head">
        <Logo party={a} /> <Logo party={b} />
        <h2>{a.navn} og {b.navn}</h2>
        {overall && overall.total > 0 && (
          <p>
            Har stemt likt i <strong>{((100 * overall.agree) / overall.total).toFixed(1).replace(".", ",")} %</strong>{" "}
            av {formatN(overall.total)} felles voteringer siden {firstYear}.
          </p>
        )}
        <p className="see-also">
          <a href={`#/parti/${a.id}`}>Hvem stemmer {a.kort} med? →</a>
          {" · "}
          <a href={`#/parti/${b.id}`}>Hvem stemmer {b.kort} med? →</a>
        </p>
      </div>
      {series ? <TimeSeries series={series} a={a} b={b} /> : <div className="loading">Laster …</div>}
      <EraTable a={a} b={b} />
      <KomiteTable index={index} a={a} b={b} />
      <VoteList index={index} a={a} b={b} />
    </div>
  );
}

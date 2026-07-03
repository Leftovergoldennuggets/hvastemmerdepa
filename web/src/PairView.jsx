import { useEffect, useMemo, useRef, useState } from "react";
import { pairSeries, loadPositions, erasData, pairEras, stance, formatN, formatDate, sakUrl } from "./lib.js";
import { cellColor, cellText, partyOrFallback } from "./parties.js";

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
   hover crosshair + tooltip, direct label on the last point. */
function TimeSeries({ series, a, b }) {
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
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

  return (
    <section className="votelist">
      <div className="filter-tabs">
        <button className={`tab${filter === "uenige" ? " active" : ""}`} onClick={() => setFilter("uenige")}>
          Der de stemte ulikt
        </button>
        <button className={`tab${filter === "enige" ? " active" : ""}`} onClick={() => setFilter("enige")}>
          Der de stemte likt
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
      <a className="back-link" href="#/">← Alle partier</a>
      <div className="pair-head">
        <Logo party={a} /> <Logo party={b} />
        <h2>{a.navn} og {b.navn}</h2>
        {overall && overall.total > 0 && (
          <p>
            Har stemt likt i <strong>{((100 * overall.agree) / overall.total).toFixed(1).replace(".", ",")} %</strong>{" "}
            av {formatN(overall.total)} felles voteringer siden {firstYear}.
          </p>
        )}
      </div>
      {series ? <TimeSeries series={series} a={a} b={b} /> : <div className="loading">Laster …</div>}
      <EraTable a={a} b={b} />
      <VoteList index={index} a={a} b={b} />
    </div>
  );
}

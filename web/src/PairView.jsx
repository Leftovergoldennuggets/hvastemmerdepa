import { useEffect, useMemo, useRef, useState } from "react";
import { medHistorikk } from "./komiteer.js";
import { pairSeries, pairForMot, voteTypes, periodOf, loadPositions, erasData, pairEras, aggregateKomite, komiteerData, pairKey, stance, formatN, formatDate, sakUrl } from "./lib.js";
import { cellColor, cellText, partyOrFallback } from "./parties.js";
import { downloadCsv } from "./csv.js";

/* Progressive disclosure: the pair page opens with the headline number and
   the time series; the detail tables live in collapsed folds so the overview
   stays calm while explorers can dig. Native <details> keeps it accessible. */
function Fold({ title, hint, defaultOpen = false, children }) {
  return (
    <details className="fold" open={defaultOpen}>
      <summary>
        <span className="fold-title">{title}</span>
        {hint && <span className="fold-hint">{hint}</span>}
        <span className="fold-arrow" aria-hidden="true">›</span>
      </summary>
      {children}
    </details>
  );
}

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

  // Government eras as tinted background bands (red-green vs borgerlig blue)
  // separated by dashed lines. Sessions run 1 Oct-30 Sep; a change
  // mid-session lands proportionally between the session points. Only PM
  // changes get a text label; every band explains itself on hover.
  const RED_TINT = "rgba(221, 48, 73, 0.055)";
  const BLUE_TINT = "rgba(43, 108, 184, 0.06)";
  const markers = [];
  const bands = [];
  if (eras && series.length > 1) {
    let prev = null;
    let bandStart = L;
    const xFor = (dato) => {
      const [yy, mm] = [Number(dato.slice(0, 4)), Number(dato.slice(5, 7))];
      const sessYear = mm >= 10 ? yy : yy - 1;
      const idx = series.findIndex((s) => s.sesjon.startsWith(String(sessYear)));
      if (idx === -1) return null;
      const f = Math.min(1, Math.max(0,
        (new Date(dato) - new Date(`${sessYear}-10-01`)) / (365 * 864e5)));
      const pos = Math.min(series.length - 1, Math.max(0, idx + f - 0.5));
      return L + (pos / (series.length - 1)) * (W - L - R);
    };
    const bandFor = (era, x1, x2) => ({
      x1, x2,
      fill: era.partier.includes("A") ? RED_TINT : BLUE_TINT,
      title: `${era.navn}-regjeringen (${era.partier.join(", ")}), `
        + `${era.fra.slice(0, 4)}–${era.til ? era.til.slice(0, 4) : "nå"}`,
    });
    for (const era of eras) {
      if (prev && era.fra) {
        const x = xFor(era.fra);
        if (x !== null) {
          bands.push(bandFor(prev, bandStart, x));
          bandStart = x;
          markers.push({ x, label: era.navn !== prev.navn ? era.navn : null });
        }
      }
      prev = era;
    }
    if (prev) bands.push(bandFor(prev, bandStart, W - R));
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

  // The newest session is still running and has few votes so far, so its
  // value can swing a lot. Draw it hollow with a dashed link and a
  // «foreløpig» tag, and put the big end label on the last COMPLETE
  // session instead. A session runs 1 Oct – 30 Sep.
  const iDag = new Date().toISOString().slice(0, 10);
  const pagar = (sesjon) => iDag <= `${Number(sesjon.slice(0, 4)) + 1}-09-30`;
  const siste = pts[pts.length - 1];
  const forelopig = siste && pagar(siste.sesjon) ? siste : null;
  const last = forelopig ? pts[pts.length - 2] : siste;
  // The tag sits above the hollow point; if the end label would collide
  // with it (points at nearly the same height), the end label goes below.
  const kollisjon = forelopig && last && Math.abs(forelopig.y - last.y) < 18
    && forelopig.x - last.x < 90;

  return (
    <div className="chart" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Andel voteringer der ${a.navn} og ${b.navn} stemte likt, per sesjon`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {bands.map((bd, k) => (
          <rect
            key={`b${k}`}
            x={bd.x1}
            y={T}
            width={Math.max(0, bd.x2 - bd.x1)}
            height={H - T - B}
            fill={bd.fill}
          >
            <title>{bd.title}</title>
          </rect>
        ))}
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
          <line
            key={k}
            x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            className={`dataline${p2 === forelopig ? " prelim" : ""}`}
          />
        ))}
        {pts.map((p) => (
          <circle
            key={p.sesjon}
            cx={p.x} cy={p.y} r="4.5"
            className={`datapoint${p === forelopig ? " prelim" : ""}`}
          />
        ))}
        {last && (
          <text
            x={last.x}
            y={kollisjon ? last.y + 22 : last.y - 12}
            className="endlabel"
            textAnchor="middle"
          >
            {Math.round(last.pct)} %
          </text>
        )}
        {forelopig && (
          <text x={forelopig.x + 10} y={forelopig.y - 12} className="prelim-label" textAnchor="end">
            foreløpig
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
          {pagar(hover.sesjon) && (
            <div className="muted">
              Sesjonen pågår – foreløpig tall, som kan endre seg mye.
            </div>
          )}
        </div>
      )}
      {bands.length > 0 && (
        <p className="chart-caption">
          Bakgrunnen viser hvem som satt i regjering:{" "}
          <span className="band-key band-red" /> rødgrønn,{" "}
          <span className="band-key band-blue" /> borgerlig. Stiplede linjer
          er regjeringsskifter – hold pekeren over et felt for
          konstellasjonen.
          {forelopig && (
            <>
              {" "}Det hule punktet er sesjonen som pågår: foreløpig tall,
              bygd på {formatN(forelopig.total)} voteringer så langt.
            </>
          )}
        </p>
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
    <Fold
      title="Gjennom regjeringene"
      hint="regjeringsdeltakelse forklarer mye av stemmegivningen"
    >
      <section className="era-table">
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
    </Fold>
  );
}

/* Per-committee agreement for the pair, shared by the headline line in the
   pair head and the full "Tema for tema" fold. Sorted most-agreeing first. */
function useKomitePair(index, a, b) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const [agg, navnRaa] = await Promise.all([
        aggregateKomite(index.map((s) => s.sesjon)),
        komiteerData(),
      ]);
      const navn = medHistorikk(navnRaa);
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

  return rows;
}

const pctStr = (p) => p.toFixed(0);

// Not policy areas: the presidency (procedural matters), the election
// committee and one-off special committees. Shown in the full table, but
// never in the one-line summary at the top.
const IKKE_TEMA = new Set(["PRES", "VALG", "SÆRKOM", "KOR", "EOS"]);
const senkNavn = (navn) => navn.charAt(0).toLowerCase() + navn.slice(1);

function KomiteTable({ rows }) {
  if (!rows || rows.length < 2) return null;
  return (
    <Fold
      title="Tema for tema"
      hint="hvor de oftest og sjeldnest stemte likt, etter fagkomité"
    >
      <section className="era-table">
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
    </Fold>
  );
}

/* «Stemte likt» split into its parts: did they vote the same by both
   voting FOR, or by both voting AGAINST (typically a third party's
   proposal)? From pipeline/analyse_for_mot.py, whose sums are checked
   against the matrix every night. Alternative voteringer are their own
   part: there the chamber chooses between two alternatives, so both sides
   vote for something. */
function forMotSum(rows) {
  const t = { bf: 0, bm: 0, u: 0, altLikt: 0, altUlikt: 0 };
  for (const r of rows) {
    for (const k of ["innstilling", "forslag", "annet"]) {
      t.bf += r[k][0]; t.bm += r[k][1]; t.u += r[k][2];
    }
    t.altLikt += r.alternativ[0]; t.altUlikt += r.alternativ[1];
  }
  t.total = t.bf + t.bm + t.u + t.altLikt + t.altUlikt;
  return t;
}

const DELER = [
  { key: "bf", navn: "Begge for", farge: "#14684F", tekst: "#FFFFFF" },
  { key: "bm", navn: "Begge mot", farge: "#62A68D", tekst: "#191715" },
  { key: "altLikt", navn: "Valgte samme alternativ", farge: "#BFD8CE", tekst: "#191715" },
  { key: "ulikt", navn: "Stemte ulikt", farge: "#E8E6E1", tekst: "#191715" },
];

const pct1 = (x) => x.toFixed(0);

function ForMotBar({ t, label }) {
  const verdier = { ...t, ulikt: t.u + t.altUlikt };
  return (
    <div
      className="fm-bar"
      role="img"
      aria-label={`${label}: ` + DELER.map((d) =>
        `${d.navn.toLowerCase()} ${pct1((100 * verdier[d.key]) / t.total)} %`).join(", ")}
    >
      {DELER.map((d) => {
        const andel = (100 * verdier[d.key]) / t.total;
        if (!verdier[d.key]) return null;
        return (
          <span
            key={d.key}
            className="fm-del"
            style={{ flexGrow: verdier[d.key], background: d.farge, color: d.tekst }}
            title={`${d.navn}: ${formatN(verdier[d.key])} av ${formatN(t.total)} voteringer (${andel.toFixed(1).replace(".", ",")} %)`}
          >
            {andel >= 9 ? `${pct1(andel)} %` : ""}
          </span>
        );
      })}
    </div>
  );
}

function ForMotFold({ rows, a, b }) {
  if (!rows) return null;
  const perioder = new Map();
  for (const r of rows) {
    const p = periodOf(r.sesjon);
    if (!perioder.has(p)) perioder.set(p, []);
    perioder.get(p).push(r);
  }
  const linjer = [...perioder.entries()]
    .map(([p, rs]) => ({ p, t: forMotSum(rs) }))
    .filter((x) => x.t.total > 0)
    .reverse();
  if (!linjer.length) return null;
  return (
    <Fold
      title="For eller mot?"
      hint="stemte de likt ved å stemme for – eller ved å stemme ned noe sammen?"
      defaultOpen
    >
      <section className="fm">
        <p className="votelist-intro">
          Å stemme likt kan bety at begge stemte for, eller at begge stemte
          mot – ofte mot et forslag fra et tredje parti. Stolpene viser
          hvordan voteringene der begge tok standpunkt, fordeler seg i hver
          stortingsperiode, nyeste øverst.
        </p>
        <ul className="fm-legend" aria-hidden="true">
          {DELER.map((d) => (
            <li key={d.key}><span style={{ background: d.farge }} />{d.navn}</li>
          ))}
        </ul>
        <ol className="fm-list">
          {linjer.map(({ p, t }) => (
            <li key={p}>
              <span className="fm-periode">{p}</span>
              <ForMotBar t={t} label={`${a.kort} og ${b.kort} ${p}`} />
              <span className="fm-n">{formatN(t.total)}</span>
            </li>
          ))}
        </ol>
        <p className="empty-note">
          Tallet til høyre er antall voteringer der begge partiene tok
          standpunkt. Ved alternativ votering velger salen mellom to forslag,
          så der stemmer begge sider for noe – de vises for seg. Hold pekeren
          over en del av stolpen for de nøyaktige tallene.
        </p>
      </section>
    </Fold>
  );
}

function StandpunktInnhold({ r, a, b }) {
  if (r.alt) {
    return (
      <span className="vote-varierer">
        {r.sa === r.sb ? "valgte samme alternativ" : "valgte ulike alternativer"}
      </span>
    );
  }
  return (
    <>
      <span><strong>{a.kort}</strong> <em className={r.sa ? "stem-for" : "stem-mot"}>{r.sa ? "for" : "mot"}</em></span>
      <span><strong>{b.kort}</strong> <em className={r.sb ? "stem-for" : "stem-mot"}>{r.sb ? "for" : "mot"}</em></span>
    </>
  );
}

function Standpunkt(props) {
  return <div className="vote-stances"><StandpunktInnhold {...props} /></div>;
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
        const [positions, typer] = await Promise.all([
          loadPositions(newestFirst[n]), voteTypes(newestFirst[n]),
        ]);
        n += 1;
        const extra = positions
          .filter((r) => !r.excluded)
          .map((r) => {
            const sa = stance(r, a.id);
            const sb = stance(r, b.id);
            if (sa === null || sb === null) return null;
            // In an alternativ votering both sides vote FOR one of two
            // alternatives; the API's for/mot side is arbitrary, so these
            // rows never count as «begge for» or «begge mot».
            const alt = typer.get(r.vid) === "alternativ";
            return {
              ...r, sa, sb, alt,
              match: {
                uenige: sa !== sb, enige: sa === sb,
                beggeFor: !alt && sa && sb, beggeMot: !alt && !sa && !sb,
              },
            };
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

  // Budget and omnibus cases explode into dozens of near-identical rows
  // (one per forslag). Group consecutive votes on the same sak so the list
  // reads as a case list; single votes render as before.
  const groups = [];
  for (const r of shown) {
    const g = groups[groups.length - 1];
    if (g && g.sak === r.sak) g.rows.push(r);
    else groups.push({ sak: r.sak, tittel: r.tittel, rows: [r] });
  }
  const [exporting, setExporting] = useState(false);

  const exportAll = async () => {
    setExporting(true);
    try {
      const out = [];
      for (const sesjon of newestFirst) {
        const [positions, typer] = await Promise.all([loadPositions(sesjon), voteTypes(sesjon)]);
        for (const r of positions) {
          if (r.excluded) continue;
          const sa = stance(r, a.id);
          const sb = stance(r, b.id);
          if (sa === null || sb === null) continue;
          out.push([
            r.dato || "", sesjon, r.sak, r.tittel || "", r.vid, r.tema || "",
            typer.get(r.vid) || "",
            sa ? "for" : "mot", sb ? "for" : "mot",
            sa === sb ? "likt" : "ulikt", sakUrl(r.sak),
          ]);
        }
      }
      out.sort((x, y) => String(y[0]).localeCompare(String(x[0])));
      // votering_type «alternativ»: for/mot then refers to the API's two
      // mirrored alternatives, not to support or opposition.
      downloadCsv(
        `voteringer-${a.kort}-${b.kort}.csv`.toLowerCase(),
        ["dato", "sesjon", "sak_id", "sak", "votering_id", "votering_tema", "votering_type",
         a.kort.toLowerCase(), b.kort.toLowerCase(), "stemte", "lenke"],
        out
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <Fold
      title="Voteringene, én for én"
      hint="hva de stemte likt og ulikt om"
      defaultOpen
    >
    <section className="votelist">
      <p className="votelist-intro">
        Hver rad er én votering i stortingssalen, nyeste først. Kolonnen til
        høyre viser hva hvert av partiene stemte. Ved alternativ votering,
        der salen velger mellom to forslag, står det om de valgte samme
        alternativ. Trykk på saken for å lese den hos stortinget.no.
      </p>
      <div className="filter-tabs">
        <button className={`tab${filter === "uenige" ? " active" : ""}`} onClick={() => setFilter("uenige")}>
          Der de stemte ulikt
        </button>
        <button className={`tab${filter === "enige" ? " active" : ""}`} onClick={() => setFilter("enige")}>
          Der de stemte likt
        </button>
        <button className={`tab${filter === "beggeFor" ? " active" : ""}`} onClick={() => setFilter("beggeFor")}>
          Begge for
        </button>
        <button className={`tab${filter === "beggeMot" ? " active" : ""}`} onClick={() => setFilter("beggeMot")}>
          Begge mot
        </button>
        <button className="dl right" onClick={exportAll} disabled={exporting}>
          {exporting ? "Henter alle voteringer …" : "Last ned alle som CSV"}
        </button>
      </div>
      <ol>
        {groups.map((g) => {
          if (g.rows.length === 1) {
            const r = g.rows[0];
            return (
              <li key={r.vid} className="vote-row">
                <div className="vote-meta">
                  {r.dato ? formatDate(r.dato) : ""}
                </div>
                <div className="vote-main">
                  <a href={sakUrl(r.sak)} target="_blank" rel="noreferrer">{r.tittel}</a>
                  <div className="vote-tema">{r.tema}</div>
                </div>
                <Standpunkt r={r} a={a} b={b} />
              </li>
            );
          }
          const ensartet = g.rows.every((r) =>
            r.sa === g.rows[0].sa && r.sb === g.rows[0].sb && r.alt === g.rows[0].alt);
          return (
            <li key={`sak-${g.sak}-${g.rows[0].vid}`}>
              <details className="vote-group">
                <summary>
                  <div className="vote-row">
                    <div className="vote-meta">
                      {g.rows[0].dato ? formatDate(g.rows[0].dato) : ""}
                    </div>
                    <div className="vote-main">
                      <a
                        href={sakUrl(g.sak)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {g.tittel}
                      </a>
                      <div className="vote-tema">
                        {g.rows.length} voteringer i samme sak – trykk for å se dem
                      </div>
                    </div>
                    <div className="vote-stances">
                      {ensartet ? (
                        <StandpunktInnhold r={g.rows[0]} a={a} b={b} />
                      ) : (
                        <span className="vote-varierer">varierer</span>
                      )}
                    </div>
                  </div>
                </summary>
                <ol className="vote-sublist">
                  {g.rows.map((r) => (
                    <li key={r.vid} className="vote-row">
                      <div className="vote-meta">{r.dato ? formatDate(r.dato) : ""}</div>
                      <div className="vote-main">
                        <div className="vote-tema">{r.tema}</div>
                      </div>
                      <Standpunkt r={r} a={a} b={b} />
                    </li>
                  ))}
                </ol>
              </details>
            </li>
          );
        })}
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
    </Fold>
  );
}

export default function PairView({ index, a, b }) {
  const [series, setSeries] = useState(null);
  const [forMot, setForMot] = useState(null);
  const komiteRows = useKomitePair(index, a, b);

  useEffect(() => {
    let live = true;
    setForMot(null);
    pairForMot(index, a.id, b.id)
      .then((r) => live && setForMot(r))
      .catch(() => live && setForMot(null));
    return () => { live = false; };
  }, [index, a.id, b.id]);
  const fmTotal = forMot ? forMotSum(forMot) : null;
  // One-line committee summary: policy committees only, all years pooled.
  const temaLinje = komiteRows ? komiteRows.filter((r) => !IKKE_TEMA.has(r.kid)) : null;

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
            av {formatN(overall.total)} felles voteringer siden {firstYear}
            {fmTotal && fmTotal.total === overall.total ? (
              <>
                : begge for i {pctStr((100 * fmTotal.bf) / fmTotal.total)} %,
                begge mot i {pctStr((100 * fmTotal.bm) / fmTotal.total)} %
                {fmTotal.altLikt > 0 && (
                  <>, samme alternativ i {pctStr((100 * fmTotal.altLikt) / fmTotal.total)} %</>
                )}.
              </>
            ) : "."}
          </p>
        )}
        {temaLinje && temaLinje.length >= 3 && (
          <p className="pair-tema">
            Alle år samlet: sjeldnest likt i {senkNavn(temaLinje[temaLinje.length - 1].navn)}{" "}
            ({pctStr(temaLinje[temaLinje.length - 1].pct)} %) og{" "}
            {senkNavn(temaLinje[temaLinje.length - 2].navn)}{" "}
            ({pctStr(temaLinje[temaLinje.length - 2].pct)} %) · oftest likt i{" "}
            {senkNavn(temaLinje[0].navn)} ({pctStr(temaLinje[0].pct)} %)
          </p>
        )}
        <p className="see-also">
          <a href={`/parti/${a.id}`}>Hvem stemmer {a.kort} med? →</a>
          {" · "}
          <a href={`/parti/${b.id}`}>Hvem stemmer {b.kort} med? →</a>
        </p>
      </div>
      {series ? <TimeSeries series={series} a={a} b={b} /> : <div className="loading">Laster …</div>}
      <ForMotFold rows={forMot} a={a} b={b} />
      <EraTable a={a} b={b} />
      <KomiteTable rows={komiteRows} />
      <VoteList index={index} a={a} b={b} />
    </div>
  );
}

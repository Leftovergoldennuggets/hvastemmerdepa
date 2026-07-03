import { useEffect, useMemo, useState } from "react";
import Matrix from "./Matrix.jsx";
import PairView from "./PairView.jsx";
import MethodPage from "./MethodPage.jsx";
import ForstaPage from "./ForstaPage.jsx";
import OmPage from "./OmPage.jsx";
import { partyOrFallback } from "./parties.js";
import { sessionsIndex, siteMeta, groupPeriods, aggregateMatrix, formatN, formatDate } from "./lib.js";

// Hash routing keeps every view shareable: #/par/R/FrP is a permalink.
function parseHash() {
  if (window.location.hash.startsWith("#/metodikk")) return { view: "method" };
  if (window.location.hash.startsWith("#/forsta")) return { view: "forsta" };
  if (window.location.hash.startsWith("#/om")) return { view: "om" };
  const m = window.location.hash.match(/^#\/par\/([\wÆØÅæøå]+)\/([\wÆØÅæøå]+)/);
  if (m && m[1] !== m[2]) {
    return { view: "pair", a: partyOrFallback(m[1]), b: partyOrFallback(m[2]) };
  }
  return { view: "matrix" };
}

function Menu() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="menu">
      <button
        className="menu-btn"
        aria-expanded={open}
        aria-label="Meny"
        onClick={() => setOpen(!open)}
      >
        <span /><span /><span />
      </button>
      {open && (
        <div className="menu-panel" onClick={() => setOpen(false)}>
          <a href="#/">Oversikten</a>
          <a href="#/forsta">Hvordan forstå tallene</a>
          <a href="#/metodikk">Metode</a>
          <a href="#/om">Om prosjektet</a>
        </div>
      )}
    </nav>
  );
}

export default function App() {
  const [index, setIndex] = useState(null);
  const [selection, setSelection] = useState(null); // {kind:'period'|'sesjon', id}
  const [matrix, setMatrix] = useState(null);
  const [route, setRoute] = useState(parseHash);
  const [meta, setMeta] = useState(null);

  useEffect(() => { siteMeta().then(setMeta).catch(() => {}); }, []);

  useEffect(() => {
    const onHash = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    sessionsIndex().then((idx) => {
      setIndex(idx);
      const periods = [...groupPeriods(idx).keys()];
      setSelection({ kind: "period", id: periods[periods.length - 1] });
    });
  }, []);

  const periods = useMemo(() => (index ? groupPeriods(index) : new Map()), [index]);

  const selectedSessions = useMemo(() => {
    if (!index || !selection) return [];
    if (selection.kind === "sesjon") {
      return index.filter((s) => s.sesjon === selection.id);
    }
    return periods.get(selection.id) || [];
  }, [index, selection, periods]);

  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    if (!selectedSessions.length) return;
    let live = true;
    setMatrix(null);
    setLoadError(false);
    aggregateMatrix(selectedSessions.map((s) => s.sesjon))
      .then((m) => { if (live) setMatrix(m); })
      .catch(() => { if (live) setLoadError(true); });
    return () => { live = false; };
  }, [selectedSessions]);

  const totalVotes = selectedSessions.reduce((n, s) => n + s.recorded, 0);
  const label =
    selection?.kind === "period"
      ? `i stortingsperioden ${selection.id}`
      : `i sesjonen ${selection?.id}`;

  return (
    <div className="shell">
      <Menu />
      <header className="masthead">
        <h1><a href="#/">Hva stemmer de på?</a></h1>
        <p className="standfirst">
          Hvor ofte stemmer partiene på Stortinget likt – og med hvem?
          Alle voteringer siden 2011.
        </p>
      </header>

      {!index || !selection ? (
        <div className="loading">Laster data …</div>
      ) : ["method", "forsta", "om"].includes(route.view) ? (
        <main>
          {route.view === "method" ? <MethodPage /> : route.view === "forsta" ? <ForstaPage /> : <OmPage />}
          <footer className="credit">
            <span>
              Kilde: <a href="https://data.stortinget.no">Stortingets tjeneste for åpne data</a> (NLOD).
            </span>
            {meta && <span>Sist oppdatert {formatDate(meta.generated)}</span>}
          </footer>
        </main>
      ) : route.view === "pair" ? (
        <main>
          <PairView index={index} a={route.a} b={route.b} />
          <footer className="credit">
            <span>
              Kilde: <a href="https://data.stortinget.no">Stortingets tjeneste for åpne data</a> (NLOD).
            </span>
          </footer>
        </main>
      ) : (
        <main>
          <nav className="controls" aria-label="Velg tidsrom">
            {[...periods.keys()].map((p) => (
              <button
                key={p}
                className={`tab${selection.kind === "period" && selection.id === p ? " active" : ""}`}
                onClick={() => setSelection({ kind: "period", id: p })}
              >
                {p}
              </button>
            ))}
            <select
              value={selection.kind === "sesjon" ? selection.id : ""}
              onChange={(e) =>
                e.target.value && setSelection({ kind: "sesjon", id: e.target.value })
              }
              aria-label="Velg enkeltsesjon"
            >
              <option value="">Enkeltsesjon</option>
              {index.map((s) => (
                <option key={s.sesjon} value={s.sesjon}>
                  {s.sesjon}
                </option>
              ))}
            </select>
          </nav>

          {matrix ? (
            <Matrix
              matrix={matrix}
              label={label}
              onSelect={(a, b) => { window.location.hash = `/par/${a.id}/${b.id}`; }}
            />
          ) : loadError ? (
            <div className="loading">
              Kunne ikke laste dataene.{" "}
              <button className="tab" onClick={() => setSelection({ ...selection })}>
                Prøv igjen
              </button>
            </div>
          ) : (
            <div className="loading">Beregner …</div>
          )}

          <p className="count-note">
            Hver rute: andel av <strong>{formatN(totalVotes)}</strong> voteringer{" "}
            {label} der de to partiene stemte likt.
          </p>

          <footer className="credit">
            <span>
              Kilde: <a href="https://data.stortinget.no">Stortingets tjeneste for åpne data</a> (NLOD).
              Datagrunnlaget kan lastes ned og etterprøves.
            </span>
            {meta && <span>Sist oppdatert {formatDate(meta.generated)}</span>}
          </footer>
        </main>
      )}
    </div>
  );
}

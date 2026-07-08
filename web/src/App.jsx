import { useEffect, useState } from "react";
import Matrix from "./Matrix.jsx";
import PairView from "./PairView.jsx";
import PartyView from "./PartyView.jsx";
import MethodPage from "./MethodPage.jsx";
import SplitsPage from "./SplitsPage.jsx";
import PeoplePage from "./PeoplePage.jsx";
import GjennomslagPage from "./GjennomslagPage.jsx";
import ForstaPage from "./ForstaPage.jsx";
import OmPage from "./OmPage.jsx";
import PeriodPicker from "./PeriodPicker.jsx";
import { PARTIES, partyOrFallback } from "./parties.js";
import { downloadCsv } from "./csv.js";
import { sessionsIndex, siteMeta, aggregateMatrix, aggregateKomite, komiteerData, formatN, formatDate, fetchJSON, gjennomslagData, aggregateGjennomslag, personerData } from "./lib.js";
import { useTimeSelection } from "./useTimeSelection.js";

// Hash routing keeps every view shareable: #/par/R/FrP and #/parti/R are permalinks.
function parseHash() {
  const h = window.location.hash;
  if (h.startsWith("#/metodikk")) return { view: "method" };
  if (h.startsWith("#/forsta")) return { view: "forsta" };
  if (h.startsWith("#/om")) return { view: "om" };
  if (h.startsWith("#/splittelser")) return { view: "splits" };
  if (h.startsWith("#/hvem")) return { view: "people" };
  if (h.startsWith("#/gjennomslag")) return { view: "gjennomslag" };
  const party = h.match(/^#\/parti\/([\wÆØÅæøå]+)/);
  if (party) return { view: "party", party: partyOrFallback(party[1]) };
  const pair = h.match(/^#\/par\/([\wÆØÅæøå]+)\/([\wÆØÅæøå]+)/);
  if (pair && pair[1] !== pair[2]) {
    return { view: "pair", a: partyOrFallback(pair[1]), b: partyOrFallback(pair[2]) };
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
          <a href="#/splittelser">Splittelser</a>
          <a href="#/gjennomslag">Gjennomslag</a>
          <a href="#/hvem">Hvem er de?</a>
          <a href="#/forsta">Hvordan forstå tallene</a>
          <a href="#/metodikk">Metode</a>
          <a href="#/om">Om prosjektet</a>
        </div>
      )}
    </nav>
  );
}

// Home-page teasers for the story pages. Every number is computed from the
// published data at load time — nothing hardcoded.
function StoryCards() {
  const [gj, setGj] = useState(null);
  const [splits, setSplits] = useState(null);
  const [kv, setKv] = useState(null);

  useEffect(() => {
    gjennomslagData().then((d) => {
      const agg = aggregateGjennomslag(d, Object.keys(d));
      let low = null;
      for (const [id, v] of agg) {
        if (v.fremmet < 300) continue;
        const pct = (100 * v.vedtatt) / v.fremmet;
        if (!low || pct < low.pct) low = { party: partyOrFallback(id), pct };
      }
      setGj(low);
    }).catch(() => {});
    fetchJSON("/data/splits.json").then((d) => setSplits(d.length)).catch(() => {});
    personerData().then((d) => {
      const latest = d[Object.keys(d).sort().pop()];
      const partier = Object.values(latest.partier);
      const seter = partier.reduce((a, v) => a + v.seter, 0);
      const kvinner = partier.reduce((a, v) => a + v.kvinner, 0);
      setKv(Math.round((100 * kvinner) / seter));
    }).catch(() => {});
  }, []);

  return (
    <section className="party-chips">
      <h2>Mer i tallene</h2>
      <div className="story-cards">
        <a className="story-card" href="#/gjennomslag">
          <span className="story-kicker">Gjennomslag</span>
          {gj && (
            <>
              <span className="story-stat">{gj.pct.toFixed(1).replace(".", ",")} %</span>
              <p>av forslagene fra {gj.party.navn} er blitt vedtatt siden 2011.</p>
            </>
          )}
          <span className="story-link">Se hvem som vinner frem ›</span>
        </a>
        <a className="story-card" href="#/splittelser">
          <span className="story-kicker">Splittelser</span>
          {splits != null && (
            <>
              <span className="story-stat">{formatN(splits)}</span>
              <p>ganger har et parti splittet seg i en votering.</p>
            </>
          )}
          <span className="story-link">Se når partiene sprekker ›</span>
        </a>
        <a className="story-card" href="#/hvem">
          <span className="story-kicker">Hvem er de?</span>
          {kv != null && (
            <>
              <span className="story-stat">{kv} %</span>
              <p>av dagens representanter er kvinner.</p>
            </>
          )}
          <span className="story-link">Se hvem som sitter i salen ›</span>
        </a>
      </div>
    </section>
  );
}

function Credit({ meta, full }) {
  return (
    <footer className="credit">
      <span>
        Kilde: <a href="https://data.stortinget.no">Stortingets tjeneste for åpne data</a> (NLOD).
        {full && " Datagrunnlaget kan lastes ned og etterprøves."}
      </span>
      {meta && <span>Sist oppdatert {formatDate(meta.generated)}</span>}
    </footer>
  );
}

export default function App() {
  const [index, setIndex] = useState(null);
  const [route, setRoute] = useState(parseHash);
  const [meta, setMeta] = useState(null);
  const { periods, selection, setSelection, selectedSessions, label, totalVotes } =
    useTimeSelection(index);
  const [matrix, setMatrix] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [tema, setTema] = useState("");
  const [komiteAgg, setKomiteAgg] = useState(null);
  const [komiteNavn, setKomiteNavn] = useState({});

  useEffect(() => { sessionsIndex().then(setIndex); }, []);
  useEffect(() => { siteMeta().then(setMeta).catch(() => {}); }, []);
  useEffect(() => { komiteerData().then(setKomiteNavn).catch(() => {}); }, []);

  useEffect(() => {
    const onHash = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!selectedSessions.length) return;
    let live = true;
    setMatrix(null);
    setKomiteAgg(null);
    setLoadError(false);
    const ids = selectedSessions.map((s) => s.sesjon);
    Promise.all([aggregateMatrix(ids), aggregateKomite(ids)])
      .then(([m, k]) => {
        if (!live) return;
        setMatrix(m);
        setKomiteAgg(k);
        setTema((t) => (t && !k.byKomite.has(t) ? "" : t));
      })
      .catch(() => { if (live) setLoadError(true); });
    return () => { live = false; };
  }, [selectedSessions]);

  const shownMatrix = tema && komiteAgg ? komiteAgg.byKomite.get(tema) : matrix;
  const temaVotes = tema && komiteAgg ? komiteAgg.counts.get(tema) : null;

  return (
    <div className="shell">
      {route.view !== "matrix" && (
        <div className="topbar">
          <a href="#/">← Til forsiden</a>
        </div>
      )}
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
          <Credit meta={meta} />
        </main>
      ) : route.view === "splits" ? (
        <main>
          <SplitsPage />
          <Credit meta={meta} />
        </main>
      ) : route.view === "people" ? (
        <main>
          <PeoplePage />
          <Credit meta={meta} />
        </main>
      ) : route.view === "gjennomslag" ? (
        <main>
          <GjennomslagPage index={index} />
          <Credit meta={meta} />
        </main>
      ) : route.view === "party" ? (
        <main>
          <PartyView index={index} party={route.party} />
          <Credit meta={meta} />
        </main>
      ) : route.view === "pair" ? (
        <main>
          <PairView index={index} a={route.a} b={route.b} />
          <Credit meta={meta} />
        </main>
      ) : (
        <main>
          <PeriodPicker index={index} periods={periods} selection={selection} onChange={setSelection} />

          {komiteAgg && (
            <div className="tema-row">
              <label htmlFor="tema">Tema</label>
              <select id="tema" value={tema} onChange={(e) => setTema(e.target.value)}>
                <option value="">Alle temaer</option>
                {[...komiteAgg.counts.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([kid]) => (
                    <option key={kid} value={kid}>
                      {komiteNavn[kid] || kid}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <p className="tap-hint">
            Trykk på en rute for å sammenligne to partier – prøv f.eks.{" "}
            <a href="#/par/R/FrP">Rødt × FrP</a> eller{" "}
            <a href="#/par/A/H">Ap × Høyre</a>.
          </p>

          {shownMatrix ? (
            <Matrix
              matrix={shownMatrix}
              label={tema ? `${label} (${komiteNavn[tema] || tema})` : label}
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
            {tema ? (
              <>
                Hver rute: andel av <strong>{formatN(temaVotes || 0)}</strong>{" "}
                voteringer behandlet i {komiteNavn[tema] || tema} {label} der de
                to partiene stemte likt.
              </>
            ) : (
              <>
                Hver rute: andel av <strong>{formatN(totalVotes)}</strong>{" "}
                voteringer {label} der de to partiene stemte likt.
              </>
            )}
            {shownMatrix && (
              <>
                {" · "}
                <button
                  className="dl"
                  onClick={() => {
                    const rows = [...shownMatrix.entries()].map(([key, c]) => {
                      const [pa, pb] = key.split("|");
                      return [
                        partyOrFallback(pa).kort, partyOrFallback(pb).kort,
                        c.agree, c.total, ((100 * c.agree) / c.total).toFixed(1).replace(".", ","),
                        selection.id, tema ? (komiteNavn[tema] || tema) : "alle",
                      ];
                    });
                    downloadCsv(
                      `enighet-${selection.id}${tema ? "-" + tema : ""}.csv`,
                      ["parti_a", "parti_b", "enige", "felles_voteringer", "enighet_prosent", "tidsrom", "tema"],
                      rows
                    );
                  }}
                >
                  Last ned som CSV
                </button>
              </>
            )}
          </p>

          <section className="party-chips">
            <h2>Utforsk ett parti</h2>
            <p>Se hvem hvert parti stemmer mest – og minst – sammen med.</p>
            <div className="chips-row">
              {PARTIES.filter((p) =>
                matrix && [...matrix.keys()].some((k) => k.split("|").includes(p.id))
              ).map((p) => (
                <a key={p.id} className="party-chip" href={`#/parti/${p.id}`}>
                  <span className="logo-tile" style={{ width: 24, height: 24 }}>
                    <img src={p.logo} alt="" loading="lazy" />
                  </span>
                  {p.navn}
                </a>
              ))}
            </div>
          </section>

          <StoryCards />

          <Credit meta={meta} full />
        </main>
      )}
    </div>
  );
}

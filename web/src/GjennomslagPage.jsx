import { useEffect, useState } from "react";
import { partyOrFallback } from "./parties.js";
import { gjennomslagData, aggregateGjennomslag, formatN } from "./lib.js";
import { downloadCsv } from "./csv.js";
import { useTimeSelection } from "./useTimeSelection.js";
import PeriodPicker from "./PeriodPicker.jsx";

function Logo({ party, size = 26 }) {
  return (
    <span className="logo-tile" style={{ width: size, height: size }}>
      {party.logo ? (
        <img src={party.logo} alt="" loading="lazy" />
      ) : (
        <span style={{ width: "55%", height: "55%", borderRadius: "50%", background: party.farge }} />
      )}
    </span>
  );
}

export default function GjennomslagPage({ index }) {
  const { periods, selection, setSelection, selectedSessions, label } =
    useTimeSelection(index);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    gjennomslagData().then(setData).catch(() => setError(true));
  }, []);

  let ranking = [];
  if (data && selectedSessions.length) {
    const agg = aggregateGjennomslag(data, selectedSessions.map((s) => s.sesjon));
    ranking = [...agg.entries()]
      .filter(([, v]) => v.fremmet >= 20)
      .map(([id, v]) => ({
        party: partyOrFallback(id),
        ...v,
        pct: (100 * v.vedtatt) / v.fremmet,
      }))
      .sort((a, b) => b.pct - a.pct);
  }
  const maxPct = Math.max(10, ...ranking.map((r) => r.pct));

  return (
    <div>
      <div className="pair-head">
        <h2>Hvem får gjennomslag?</h2>
        <p>
          Når et parti fremmer forslag i stortingssalen – hvor ofte blir de
          vedtatt?
        </p>
      </div>

      <PeriodPicker index={index} periods={periods} selection={selection} onChange={setSelection} />

      {error ? (
        <div className="loading">Kunne ikke laste dataene.</div>
      ) : !data || !selectedSessions.length ? (
        <div className="loading">Beregner …</div>
      ) : ranking.length === 0 ? (
        <p className="empty-note">Ingen partiforslag til votering {label}.</p>
      ) : (
        <ol className="ranking gj-ranking">
          {ranking.map((r) => (
            <li key={r.party.id}>
              <a className="gj-row" href={`#/parti/${r.party.id}`}>
                <span className="gj-label">
                  <Logo party={r.party} />
                  <span>
                    <strong>{r.party.kort}</strong>
                    <em>{formatN(r.vedtatt)} av {formatN(r.fremmet)} forslag vedtatt</em>
                  </span>
                </span>
                <span className="rank-track">
                  <span
                    className="rank-bar"
                    style={{ width: `${(100 * r.pct) / maxPct}%`, background: "#35886C" }}
                  />
                </span>
                <span className="rank-pct">{r.pct.toFixed(1).replace(".", ",")} %</span>
              </a>
            </li>
          ))}
        </ol>
      )}

      {ranking.length > 0 && (
        <p className="count-note">
          Forslag fremmet på vegne av partiet i salen {label}, alene eller
          sammen med andre. Søylene er skalert til den høyeste verdien.
          {" · "}
          <button
            className="dl"
            onClick={() =>
              downloadCsv(
                `gjennomslag-${selection.id}.csv`,
                ["parti", "forslag_til_votering", "vedtatt", "andel_prosent", "tidsrom"],
                ranking.map((r) => [
                  r.party.kort, r.fremmet, r.vedtatt,
                  r.pct.toFixed(1).replace(".", ","), selection.id,
                ])
              )
            }
          >
            Last ned som CSV
          </button>
        </p>
      )}

      <div className="section">
        <h2>Slik leser du tallene</h2>
        <p>
          Når en komité er ferdig med en sak, fremmer partiene som ikke fikk
          viljen sin i innstillingen egne forslag i salen. Stortingets
          voteringsbeskrivelser navngir forslagsstillerne («Forslag nr. 17 på
          vegne av SV og R»), og det er disse som telles her. Forslag fremmet
          av flere partier sammen teller for hvert av dem.
        </p>
        <p>
          Merk at regjeringspartier sjelden trenger å fremme egne forslag –
          politikken deres ligger allerede i komitéinnstillingene som vedtas.
          Tallene måler derfor først og fremst hvor ofte et parti vinner frem
          når det utfordrer flertallet, og må leses sammen med hvem som satt i
          regjering. Detaljene står på <a href="#/metodikk">metodesiden</a>.
        </p>
      </div>
    </div>
  );
}

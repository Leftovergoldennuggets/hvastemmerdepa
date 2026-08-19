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
    // Ranked by the NUMBER of adopted proposals, not the share: opposition
    // parties routinely file stacks of proposals they know will fall, so the
    // count of what actually passed says more about real influence.
    ranking = [...agg.entries()]
      .filter(([, v]) => v.fremmet > 0)
      .map(([id, v]) => ({
        party: partyOrFallback(id),
        ...v,
        pct: (100 * v.vedtatt) / v.fremmet,
      }))
      .sort((a, b) => b.vedtatt - a.vedtatt || b.pct - a.pct);
  }
  const maxVedtatt = Math.max(1, ...ranking.map((r) => r.vedtatt));
  const allZero = ranking.length > 0 && ranking.every((r) => r.vedtatt === 0);

  return (
    <div>
      <div className="pair-head">
        <h2>Hvem får gjennomslag?</h2>
        <p>
          Et parti som er i mindretall i en sak, kan fremme sitt eget forslag
          når saken avgjøres i stortingssalen. Her ser du hvor mange av disse
          forslagene hvert parti faktisk har fått vedtatt – og hvor mange som
          ble stemt ned.
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
                    <em>av {formatN(r.fremmet)} fremmet · {r.pct.toFixed(1).replace(".", ",")} %</em>
                  </span>
                </span>
                <span className="rank-track">
                  <span
                    className="rank-bar"
                    style={{ width: `${(100 * r.vedtatt) / maxVedtatt}%`, background: "#35886C" }}
                  />
                </span>
                <span className="rank-pct">{formatN(r.vedtatt)}</span>
              </a>
            </li>
          ))}
        </ol>
      )}

      {allZero && (
        <p className="empty-note" style={{ textAlign: "center" }}>
          Ingen av disse forslagene ble vedtatt. Det er det vanlige bildet når
          regjeringspartiene har flertall alene: Alt de er imot, stemmes ned.
        </p>
      )}
      {ranking.length > 0 && (
        <p className="count-note">
          Antall vedtatte forslag fremmet på vegne av partiet i salen {label},
          alene eller sammen med andre. Rangeringen går etter antallet, ikke
          andelen: Opposisjonspartier fremmer rutinemessig mange forslag de
          vet vil falle, så antallet som faktisk blir vedtatt sier mer om
          reelt gjennomslag.
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
          voteringsbeskrivelser navngir forslagsstillerne – enten i en egen
          votering («Forslag nr. 17 på vegne av SV og R») eller i en
          alternativ votering der forslaget settes direkte opp mot komiteens
          innstilling. Begge telles her. Forslag fremmet av flere partier
          sammen teller for hvert av dem.
        </p>
        <p>
          Merk at regjeringspartier sjelden trenger å fremme egne forslag –
          politikken deres ligger allerede i komitéinnstillingene som vedtas.
          Tallene måler derfor først og fremst hvor ofte et parti vinner frem
          når det utfordrer flertallet, og må leses sammen med hvem som satt i
          regjering. Detaljene står på <a href="#/metodikk">metodesiden</a>.
        </p>
        <p>
          Forskjellen på flertalls- og mindretallsregjering er dramatisk: I
          2011–2013 hadde Ap, SV og Sp flertall sammen, og ikke ett eneste av
          opposisjonens over 2 000 forslag ble vedtatt. Under
          mindretallsregjeringer må regjeringen derimot forhandle, og
          opposisjonspartier vinner jevnlig frem.
        </p>
      </div>
    </div>
  );
}

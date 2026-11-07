import { useEffect, useMemo, useState } from "react";
import { partyOrFallback, politicalOrder } from "./parties.js";
import { gjennomslagVedtattData, komiteerData, formatN, formatDate, sakUrl } from "./lib.js";
import { useGjennomslag } from "./useGjennomslag.js";
import { medHistorikk } from "./komiteer.js";
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

const pctStr = (p) => p.toFixed(1).replace(".", ",");

export function GjTemaVelger({ komiteValg, komiteNavn, tema, onChange }) {
  if (!komiteValg.length) return null;
  return (
    <div className="tema-row gj-tema">
      <label htmlFor="gj-tema">Tema</label>
      <select id="gj-tema" value={tema} onChange={(e) => onChange(e.target.value)}>
        <option value="">Alle temaer</option>
        {komiteValg.map((kid) => (
          <option key={kid} value={kid}>{komiteNavn[kid] || kid}</option>
        ))}
        {tema && !komiteValg.includes(tema) && (
          <option value={tema}>{komiteNavn[tema] || tema}</option>
        )}
      </select>
    </div>
  );
}

export function GjennomslagRanking({ ranking, lenke }) {
  const maxVedtatt = Math.max(1, ...ranking.map((r) => r.vedtatt));
  return (
    <ol className="ranking gj-ranking">
      {ranking.map((r) => (
        <li key={r.party.id}>
          <a className="gj-row" href={lenke(r)}>
            <span className="gj-label">
              <Logo party={r.party} />
              <span>
                <strong>{r.party.kort}</strong>
                <em>av {formatN(r.fremmet)} til votering · {pctStr(r.pct)} %</em>
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
  );
}

/* Every adopted party proposal in the selection, newest first, each linking
   to the case on stortinget.no — so the counts above can be checked one by
   one. One row is one votering; it can cover several numbered proposals. */
function VedtatteForslag({ sessions, tema, temaTekst, label, partier }) {
  const [rows, setRows] = useState(null);
  const [parti, setParti] = useState("");
  const [visible, setVisible] = useState(20);
  useEffect(() => {
    gjennomslagVedtattData().then(setRows).catch(() => setRows([]));
  }, []);
  const ids = useMemo(() => new Set(sessions.map((s) => s.sesjon)), [sessions]);
  useEffect(() => { setVisible(20); }, [ids, tema, parti]);

  if (!rows) return null;
  const shown = rows.filter((r) =>
    ids.has(r.sesjon) && (!tema || r.komite === tema) && (!parti || r.partier.includes(parti))
  );
  const partiNavn = (id) => partyOrFallback(id).kort;
  const ordne = (ps) => [...ps].sort((a, b) => politicalOrder(a) - politicalOrder(b));

  return (
    <div className="section gj-vedtatt">
      <h2>Forslagene som ble vedtatt</h2>
      <p>
        Her er hver votering {label}{temaTekst} der et partiforslag ble
        vedtatt, nyeste først. Én votering kan gjelde flere forslag samtidig
        («Forslag nr. 3–5 på vegne av …»). Mange vedtatte forslag er
        anmodninger til regjeringen («Stortinget ber regjeringen …»). Trykk
        på saken for å lese den hos stortinget.no.
      </p>
      <div className="filter-tabs">
        <select value={parti} onChange={(e) => setParti(e.target.value)} aria-label="Velg parti">
          <option value="">Alle partier</option>
          {partier.map((p) => (
            <option key={p.id} value={p.id}>{p.navn}</option>
          ))}
        </select>
        <span className="gj-antall">{formatN(shown.length)} voteringer</span>
        {shown.length > 0 && (
          <button
            className="dl right"
            onClick={() =>
              downloadCsv(
                `vedtatte-forslag${parti ? "-" + parti : ""}${tema ? "-" + tema : ""}.csv`,
                ["dato", "sesjon", "forslagsstillere", "sak_id", "sak", "votering_id", "votering_tema", "lenke"],
                shown.map((r) => [
                  r.dato || "", r.sesjon, ordne(r.partier).map(partiNavn).join(", "),
                  r.sak, r.tittel || "", r.vid, r.tema || "", sakUrl(r.sak),
                ])
              )
            }
          >
            Last ned som CSV
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="empty-note">Ingen vedtatte partiforslag i dette utvalget.</p>
      ) : (
        <ol className="votelist-plain">
          {shown.slice(0, visible).map((r) => (
            <li key={r.vid} className="vote-row">
              <div className="vote-meta">{r.dato ? formatDate(r.dato) : ""}</div>
              <div className="vote-main">
                <a href={sakUrl(r.sak)} target="_blank" rel="noreferrer">{r.tittel}</a>
                <div className="vote-tema">{r.tema}</div>
              </div>
              <div className="vote-stances gj-partier">
                {ordne(r.partier).map((id) => (
                  <span key={id} className="gj-parti">
                    <Logo party={partyOrFallback(id)} size={20} /> {partiNavn(id)}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
      {shown.length > visible && (
        <button className="more" onClick={() => setVisible((v) => v + 20)}>
          Vis flere
        </button>
      )}
    </div>
  );
}

export default function GjennomslagPage({ index }) {
  const { periods, selection, setSelection, selectedSessions, label } =
    useTimeSelection(index);
  const [tema, setTema] = useState("");
  const [komiteNavn, setKomiteNavn] = useState({});
  useEffect(() => {
    komiteerData().then((d) => setKomiteNavn(medHistorikk(d))).catch(() => {});
  }, []);
  const { ranking, komiteValg, error } = useGjennomslag(selectedSessions, tema);

  const temaTekst = tema ? ` i saker fra ${komiteNavn[tema] || tema}` : "";
  const allZero = ranking && ranking.length > 0 && ranking.every((r) => r.vedtatt === 0);

  return (
    <div>
      <div className="pair-head">
        <h2>Hvem får gjennomslag?</h2>
        <p>
          Et parti som er i mindretall i en sak, kan fremme sitt eget forslag
          når saken avgjøres i stortingssalen. Her ser du hvor mange av
          voteringene over disse forslagene som endte med vedtak for hvert
          parti – og hvor mange som ble stemt ned.
        </p>
      </div>

      <PeriodPicker index={index} periods={periods} selection={selection} onChange={setSelection} />

      <GjTemaVelger komiteValg={komiteValg} komiteNavn={komiteNavn} tema={tema} onChange={setTema} />

      {error ? (
        <div className="loading">Kunne ikke laste dataene.</div>
      ) : !ranking ? (
        <div className="loading">Beregner …</div>
      ) : ranking.length === 0 ? (
        <p className="empty-note">Ingen partiforslag til votering {label}{temaTekst}.</p>
      ) : (
        <GjennomslagRanking ranking={ranking} lenke={(r) => `/parti/${r.party.id}`} />
      )}

      {allZero && (
        <p className="empty-note" style={{ textAlign: "center" }}>
          Ingen av disse forslagene ble vedtatt. Det er det vanlige bildet når
          regjeringspartiene har flertall alene: Alt de er imot, stemmes ned.
        </p>
      )}
      {ranking && ranking.length > 0 && (
        <p className="count-note">
          Antall voteringer {label}{temaTekst} der et forslag fremmet på vegne
          av partiet, alene eller sammen med andre, ble vedtatt. Tema følger
          fagkomiteen som behandlet saken. Rangeringen går etter antallet, ikke
          andelen: Opposisjonspartier fremmer rutinemessig mange forslag de
          vet vil falle, så antallet som faktisk blir vedtatt sier mer om
          reelt gjennomslag.
          {" · "}
          <button
            className="dl"
            onClick={() =>
              downloadCsv(
                `gjennomslag-${selection.id}${tema ? "-" + tema : ""}.csv`,
                ["parti", "voteringer_over_forslag", "vedtatt", "andel_prosent", "tidsrom", "tema"],
                ranking.map((r) => [
                  r.party.kort, r.fremmet, r.vedtatt, pctStr(r.pct), selection.id,
                  tema ? (komiteNavn[tema] || tema) : "alle",
                ])
              )
            }
          >
            Last ned som CSV
          </button>
        </p>
      )}

      {ranking && ranking.length > 0 && (
        <VedtatteForslag
          sessions={selectedSessions}
          tema={tema}
          temaTekst={temaTekst}
          label={label}
          partier={[...ranking.map((r) => r.party)].sort(
            (a, b) => politicalOrder(a.id) - politicalOrder(b.id)
          )}
        />
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
          sammen teller for hvert av dem. Tallene teller voteringer, ikke
          enkeltforslag: Presidenten slår ofte sammen forslag som ventes å få
          samme utfall, og da avgjøres de i én votering.
        </p>
        <p>
          Merk at regjeringspartier sjelden trenger å fremme egne forslag –
          politikken deres ligger allerede i komitéinnstillingene som vedtas,
          og i budsjettforlik som forhandles fram før saken kommer til salen.
          Tallene måler derfor først og fremst hvor ofte et parti vinner frem
          når det utfordrer flertallet, og må leses sammen med hvem som satt i
          regjering. Detaljene står på <a href="/metodikk">metodesiden</a>.
        </p>
        <p>
          Forskjellen på flertalls- og mindretallsregjering er dramatisk: I
          2011–2013 hadde Ap, SV og Sp flertall sammen, og ingen av de nesten
          1 200 voteringene over opposisjonens forslag endte med vedtak. Under
          mindretallsregjeringer må regjeringen derimot forhandle, og
          opposisjonspartier vinner jevnlig frem.
        </p>
      </div>
    </div>
  );
}

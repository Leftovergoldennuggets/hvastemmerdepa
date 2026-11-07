import { useEffect, useState } from "react";
import { partyOrFallback, cellColor } from "./parties.js";
import { aggregateMatrix, aggregateForMot, forMotMatrix, antallIUtvalg, pairKey, formatN } from "./lib.js";
import MaalingVelger from "./ForMot.jsx";
import { beskrivPar, maalingOrd, utvalgEtikett } from "./maaling.js";
import { useTweenedMatrix } from "./useTweenedMatrix.js";
import { downloadCsv } from "./csv.js";
import { useTimeSelection } from "./useTimeSelection.js";
import PeriodPicker from "./PeriodPicker.jsx";

function Logo({ party, size = 40 }) {
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

export default function PartyView({ index, party }) {
  const { periods, selection, setSelection, selectedSessions, label, totalVotes } =
    useTimeSelection(index);
  const [matrix, setMatrix] = useState(null);
  const [antall, setAntall] = useState(null);
  const [tip, setTip] = useState(null);
  const [maaling, setMaaling] = useState("likt");
  const [utvalg, setUtvalg] = useState("alle");
  const standard = maaling === "likt" && utvalg === "alle";

  useEffect(() => {
    if (!selectedSessions.length) return;
    let live = true;
    const ids = selectedSessions.map((s) => s.sesjon);
    // Keep the previous ranking on screen while the new selection loads,
    // so bars and numbers roll to their new values instead of reloading.
    // The default reading uses the verified matrix files directly.
    const load = standard
      ? aggregateMatrix(ids).then((m) => [m, null])
      : aggregateForMot(ids).then((d) => [
          forMotMatrix(d.pairs, maaling, utvalg),
          maaling === "likt"
            ? antallIUtvalg(d.antall, utvalg)
            : utvalg === "alle"
              ? d.antall.innstilling + d.antall.forslag + d.antall.annet
              : d.antall[utvalg],
        ]);
    load
      .then(([m, n]) => { if (live) { setMatrix(m); setAntall(n); } })
      .catch(() => { if (live) setMatrix(new Map()); });
    return () => { live = false; };
  }, [selectedSessions, maaling, utvalg, standard]);
  const fullLabel = `${label}${utvalgEtikett(utvalg)}`;

  const shown = useTweenedMatrix(matrix);

  let ranking = [];
  if (matrix && shown) {
    const ids = new Set();
    for (const key of matrix.keys()) key.split("|").forEach((id) => ids.add(id));
    ranking = [...ids]
      .filter((id) => id !== party.id)
      .map((id) => {
        const key = pairKey(party.id, id);
        const target = matrix.get(key);
        if (!target || !target.total) return null;
        const cell = shown.get(key) || target;
        return {
          other: partyOrFallback(id),
          agree: cell.agree,
          total: cell.total,
          pct: cell.pct ?? (100 * cell.agree) / cell.total,
          // rows sort by the destination value so the order settles at once
          // while the numbers are still rolling
          sortPct: (100 * target.agree) / target.total,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.sortPct - a.sortPct);
  }

  return (
    <div>
      <div className="pair-head">
        <Logo party={party} />
        <h2>Hvem stemmer {party.navn} med?</h2>
        <p>
          Partiene rangert etter hvor ofte de og {party.kort} stemte likt –
          regnet av voteringene der begge deltok. Å stemme likt kan bety at
          begge stemte for, eller at begge stemte mot. Bryterne under skiller
          de to. Trykk på et parti for hele historien: utviklingen over tid og
          de konkrete sakene der de stemte likt og ulikt.
        </p>
      </div>

      <PeriodPicker index={index} periods={periods} selection={selection} onChange={setSelection} />

      <MaalingVelger maaling={maaling} utvalg={utvalg} onMaaling={setMaaling} onUtvalg={setUtvalg} />

      {!matrix ? (
        <div className="loading">Beregner …</div>
      ) : ranking.length === 0 ? (
        <p className="empty-note">
          {party.navn} hadde ingen registrerte voteringer {fullLabel}.
        </p>
      ) : (
        <ol className="ranking">
          {ranking.map((r) => (
            <li key={r.other.id}>
              <a
                className="rank-row"
                href={`/par/${party.id}/${r.other.id}`}
                onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, ...r })}
                onMouseLeave={() => setTip(null)}
              >
                <span className="rank-label">
                  <Logo party={r.other} size={26} />
                  {r.other.kort}
                </span>
                <span className="rank-track">
                  <span
                    className="rank-bar"
                    style={{ width: `${r.pct}%`, background: cellColor(r.pct) }}
                  />
                </span>
                <span className="rank-pct">{Math.round(r.pct)} %</span>
                <span className="rank-arrow" aria-hidden="true">›</span>
              </a>
            </li>
          ))}
        </ol>
      )}

      <p className="count-note">
        {maaling === "likt"
          ? "Andelen av voteringene der begge partiene tok standpunkt, der de stemte likt."
          : `Av voteringene der minst ett av partiene stemte ${maaling}, andelen der begge stemte ${maaling}.`}{" "}
        Grunnlaget er opptil {formatN(standard ? totalVotes : antall ?? 0)} voteringer {fullLabel}.
        Trykk på et parti for detaljene.
        {ranking.length > 0 && (
          <>
            {" · "}
            <button
              className="dl"
              onClick={() =>
                downloadCsv(
                  `${party.kort.toLowerCase()}-stemte-${maalingOrd(maaling).replaceAll(" ", "-")}-${selection.id}${utvalg !== "alle" ? "-" + utvalg : ""}.csv`,
                  ["parti", "antall", "av_voteringer", "andel_prosent", "maaling", "voteringer", "tidsrom"],
                  ranking.map((r) => [
                    r.other.kort, r.agree, r.total,
                    r.pct.toFixed(1).replace(".", ","),
                    `stemte ${maalingOrd(maaling)}`, utvalg, selection.id,
                  ])
                )
              }
            >
              Last ned som CSV
            </button>
          </>
        )}
      </p>

      {tip && (
        <div
          className="tooltip"
          style={{ left: Math.min(tip.x + 14, window.innerWidth - 300), top: tip.y + 16 }}
        >
          <div className="pct">{tip.pct.toFixed(1).replace(".", ",")} %</div>
          <div>
            {beskrivPar(maaling, party.navn, tip.other.navn, tip.agree, tip.total, fullLabel, formatN)}
          </div>
        </div>
      )}
    </div>
  );
}

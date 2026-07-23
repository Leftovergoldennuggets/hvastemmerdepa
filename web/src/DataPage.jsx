import { useEffect, useState } from "react";
import { siteMeta, formatN } from "./lib.js";

// Documentation for the site's open data files. Everything the site shows is
// served as static JSON under /data/ — this page makes that an explicit,
// documented interface so journalists and researchers can build on it.

const FILES = [
  ["meta.json", "Nøkkeltall: antall voteringer, sesjonsspenn, sist oppdatert, kjente avvik"],
  ["sessions.json", "Én rad per sesjon: antall saker, voteringer, talte voteringer, partier"],
  ["matrix/<sesjon>.json", "Parvis enighet per sesjon: par, antall enige, antall felles voteringer"],
  ["matrix_komite/<sesjon>.json", "Samme tall brutt ned per fagkomité (tema)"],
  ["positions/<sesjon>.json", "Én rad per votering: dato, sak, resultat og hvert partis stemmetall"],
  ["eras.json", "Enighetsmatriser per regjeringsperiode"],
  ["splits.json", "Alle voteringer der minst to representanter brøt med eget parti"],
  ["gjennomslag.json", "Partiforslag til votering og vedtak, per parti per sesjon"],
  ["personer.json", "Representantene per stortingsperiode: parti, kjønn, alder, fylke, komiteer, CV"],
  ["komiteer.json", "Komité-id → offisielt navn"],
];

export default function DataPage() {
  const [meta, setMeta] = useState(null);
  useEffect(() => { siteMeta().then(setMeta).catch(() => {}); }, []);

  return (
    <div className="method">
      <h2>Åpne data</h2>
      <p className="lede">
        Alle tall på nettstedet leveres som statiske JSON-filer under{" "}
        <code>/data/</code>. Filene kan lastes ned fritt og brukes til egne
        analyser – de er selve datagrunnlaget siden leser fra, ikke en kopi.
      </p>

      <h3>Filene</h3>
      <div className="matrix-scroll">
        <table className="people-table">
          <thead>
            <tr><th>Fil</th><th>Innhold</th></tr>
          </thead>
          <tbody>
            {FILES.map(([f, desc]) => (
              <tr key={f}>
                <td><code>/data/{f}</code></td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="count-note">
        <code>&lt;sesjon&gt;</code> er f.eks. <code>2024-2025</code>
        {meta && (
          <> – tilgjengelig fra {meta.first_session} til {meta.last_session}</>
        )}
        . Prøv{" "}
        <a href="/data/matrix/2024-2025.json" target="_blank" rel="noreferrer">
          /data/matrix/2024-2025.json
        </a>.
      </p>

      <h3>De viktigste feltene</h3>
      <p>
        <strong>matrix</strong>: <code>pair</code> er to parti-id-er sortert
        alfabetisk («A|H»), <code>agree</code> antall voteringer med samme
        standpunkt, <code>total</code> antall voteringer der begge deltok.
        Prosenten på nettstedet er <code>agree/total</code>.
      </p>
      <p>
        <strong>positions</strong>: én rad per votering, med{" "}
        <code>partier</code> som partiets interne stemmetall{" "}
        <code>[for, mot]</code>. Radene som holdes utenfor statistikken har{" "}
        <code>excluded</code> satt: <code>lovteknisk</code> («lovens
        overskrift»-bekreftelser), <code>alternativ_speil</code> (speilbildet
        av en alternativ votering – API-et eksporterer én avstemning som to
        speilvendte voteringer), eller <code>data_pending</code> (API-et
        mangler individdata). <code>fri</code> markerer voteringer Stortinget
        selv har registrert som frie (partilinjen opphevet), og{" "}
        <code>verified</code> om summen av enkeltstemmene stemmer eksakt med
        Stortingets offisielle stemmetall. <code>vid</code> og{" "}
        <code>sak</code> peker til votering og sak hos stortinget.no.
      </p>

      <h3>Vilkår og kreditering</h3>
      <p>
        Rådataene kommer fra{" "}
        <a href="https://data.stortinget.no">Stortingets tjeneste for åpne data</a>{" "}
        (NLOD-lisens; Stortinget er kilde). Våre beregnede filer kan
        gjenbrukes fritt med kreditering av både Stortinget (rådata) og
        dette nettstedet (beregningene). Metoden er dokumentert på{" "}
        <a href="#/metodikk">metodesiden</a>, og alle metodeendringer føres i
        prosjektets endringslogg.
        {meta && (
          <> Datagrunnlaget dekker {formatN(meta.recorded_votes)} registrerte
          voteringer, sist oppdatert {meta.generated}.</>
        )}
      </p>
      <p>
        Filformatene holdes stabile; nye felter kan komme til, men
        eksisterende felter endres ikke uten varsel i endringsloggen.
      </p>
    </div>
  );
}

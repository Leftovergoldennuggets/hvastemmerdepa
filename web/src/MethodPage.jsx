import { useEffect, useState } from "react";
import { siteMeta, formatN, formatDate } from "./lib.js";

export default function MethodPage() {
  const [meta, setMeta] = useState(null);
  useEffect(() => { siteMeta().then(setMeta).catch(() => {}); }, []);

  return (
    <div className="method">
      <h2>Metode</h2>
      <p className="lede">
        Alt på dette nettstedet er beregnet fra Stortingets egne rådata og kan
        etterprøves. Her er hele metoden – ingen skjulte valg.
      </p>

      <h3>Datagrunnlag</h3>
      <p>
        Kilden er{" "}
        <a href="https://data.stortinget.no">Stortingets tjeneste for åpne data</a>{" "}
        (NLOD-lisens). Stortinget registrerer hver enkelt representants stemme
        når voteringsanlegget brukes, og disse dataene finnes fra oktober 2011.
        {meta && (
          <>
            {" "}Datagrunnlaget omfatter <strong>{formatN(meta.recorded_votes)}</strong>{" "}
            registrerte voteringer fra sesjonen {meta.first_session} til{" "}
            {meta.last_session}, sist oppdatert {formatDate(meta.generated)}.
          </>
        )}
      </p>

      <h3>Hvilke voteringer telles?</h3>
      <p>
        Alle voteringer tatt med voteringsanlegget. Stortinget bruker bare
        anlegget når minst én representant krever votering – rene formaliteter
        avgjøres ved akklamasjon og havner ikke i tallene. Dermed er det
        Stortingets egen praksis, ikke vår vurdering, som skiller reelle
        avstemninger fra formaliteter.
        {meta && (
          <>
            {" "}I tillegg ble {formatN(meta.enstemmig)} vedtak enstemmig vedtatt
            uten telling; disse har ingen stemmedata på partinivå og holdes
            utenfor prosentene.
          </>
        )}
      </p>
      <p>
        Ett unntak: voteringer over «lovens overskrift og loven i sin helhet»
        – en lovteknisk bekreftelse på slutten av hver lovbehandling – holdes
        utenfor, i tråd med{" "}
        <a href="https://data.stortinget.no/dokumentasjon-og-hjelp/kommentar-til-datagrunnlaget-for-voteringer/">
          Stortingets egne råd om statistikk på voteringsdata
        </a>.
      </p>

      <h3>Hva er et partis standpunkt?</h3>
      <p>
        Et partis standpunkt i en votering er det flertallet av partiets
        deltakende representanter stemte. Partiene stemmer svært samlet: i
        93–99 prosent av voteringene stemmer alle representantene i et parti
        likt. Ved helt likt antall for og mot regnes partiet uten standpunkt i
        den voteringen.
      </p>

      <h3>Hva betyr «enige»?</h3>
      <p>
        To partier er enige i en votering når begge har samme standpunkt –
        begge for, eller begge mot. Prosenten er antall voteringer der de var
        enige, delt på antall voteringer der begge deltok. Merk at Stortinget
        ikke er til stede fulltallig; utbyttingsordningen holder styrkeforholdet
        mellom partiene riktig, så fravær påvirker ikke partistandpunktene.
      </p>

      <h3>Gjennomslag: partienes egne forslag</h3>
      <p>
        Stortingets voteringsbeskrivelser navngir forslagsstillerne når salen
        stemmer over et forslag («Forslag nr. 17 på vegne av SV og R»).
        Gjennomslag-tallene teller alle slike partiforslag som kom til
        votering, og hvor mange av dem som ble vedtatt. Forslag fremmet av
        flere partier sammen telles for hvert av partiene. Forslag fremmet av
        enkeltrepresentanter eller presidentskapet – rundt 70 av 13 000 –
        gjelder ikke et parti og holdes utenfor.
      </p>
      <p>
        Tolk tallene med omhu: Regjeringspartier fremmer sjelden egne forslag,
        fordi politikken deres allerede ligger i komitéinnstillingene. Lav
        gjennomslagsprosent betyr først og fremst at partiet ofte utfordrer
        flertallet – ikke at det er uten innflytelse, som også kan skje
        gjennom forhandlinger før innstillingen.
      </p>

      <h3>Hvem er de?</h3>
      <p>
        Opplysningene om representantene – kjønn, fødselsdato, valgdistrikt,
        komitémedlemskap og når de først ble innvalgt – hentes fra Stortingets
        biografidata. Vi teller de innvalgte representantene ved hver
        periodestart; vararepresentanter er ikke med. Alder beregnes ved
        periodestart, og «tid på Stortinget» er tiden siden representanten
        første gang ble innvalgt som fast representant.
      </p>
      <p>
        Utdanning og yrke vises ordrett slik Stortinget selv har registrert
        dem i biografiene – vi kategoriserer eller tolker aldri fritekst.
        Landsdelene er de vanlige grupperingene av de 19 valgdistriktene
        (Nord-Norge, Trøndelag, Vestlandet, Sørlandet, Østlandet og Oslo).
        Fotografiene er Stortingets offisielle portretter, lastet ned fra den
        åpne datatjenesten og vist med kreditering. Norgeskartet bygger på{" "}
        <a href="https://kartverket.no">Kartverkets</a> offisielle geometri for
        valgdistriktene (åpne data), forenklet for visning og med havområdene
        inkludert.
      </p>

      <h3>Verifisering</h3>
      <p>
        For hver votering summeres de individuelle stemmene og sammenlignes med
        Stortingets offisielle stemmetall. Avvik flagges i datasettet.
        {meta && (
          <>
            {" "}I dag stemmer{" "}
            <strong>{formatN(meta.recorded_votes - meta.verify_mismatches.length)}</strong>{" "}
            av {formatN(meta.recorded_votes)} voteringer eksakt.
            {meta.verify_mismatches.length > 0 && (
              <>
                {" "}{meta.verify_mismatches.length} voteringer har et lite avvik
                som ligger i Stortingets egne kildedata:{" "}
                {meta.verify_mismatches.map((m, i) => (
                  <span key={m.vid}>
                    {i > 0 && ", "}
                    votering {m.vid} ({m.dato ? formatDate(m.dato) : ""})
                  </span>
                ))}.
              </>
            )}
          </>
        )}
      </p>

      <h3>Begrensninger å kjenne til</h3>
      <p>
        Prosent lik stemmegivning er ikke det samme som prosent politisk
        enighet. Én votering kan gjelde flere sammenslåtte forslag, forslag
        varierer i omfang, og subsidiær stemmegivning kan gjøre at et parti
        stemmer for noe annet enn sitt primærstandpunkt. Stortingets arkiv
        anbefaler å supplere med kvalitative vurderinger – det gjør vi også.
        Enkeltrepresentanters feiltrykk rettes ikke i etterkant og kan gi
        enkeltavvik.
      </p>
      <p>
        Regjeringsdeltakelse forklarer mye: partier i regjering stemmer nesten
        alltid likt, og opposisjonspartier stemmer oftere mot. Derfor viser
        partisidene tallene brutt ned per regjeringsperiode.
      </p>

      <h3>Etterprøv oss</h3>
      <p>
        Hver votering i listene lenker til saken hos stortinget.no. Hele
        datasettet og all kode – innhenting, beregning og denne nettsiden – er
        åpen, slik at hvem som helst kan kjøre analysen på nytt fra Stortingets
        rådata og få de samme tallene.
      </p>
    </div>
  );
}

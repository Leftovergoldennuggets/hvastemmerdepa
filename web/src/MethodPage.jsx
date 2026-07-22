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
        Alle voteringer der voteringsanlegget registrerte enkeltstemmer.
        Stortinget bruker anlegget i de fleste voteringene, men enstemmige og
        nær enstemmige avgjørelser tas ofte uten at enkeltstemmer registreres
        – da finnes det ingen stemmedata å telle.
        {meta && (
          <>
            {" "}I datagrunnlaget gjelder det {formatN(meta.uten_anlegg ?? meta.enstemmig)}{" "}
            avgjørelser ({formatN(meta.enstemmig)} enstemmig vedtatt, resten
            nær enstemmige som «vedtatt mot 1 stemme»); disse holdes utenfor
            prosentene.
          </>
        )}
        {" "}Det er dermed Stortingets egen praksis, ikke vår vurdering, som
        avgjør hvilke voteringer som får stemmedata.
      </p>
      <p>
        Ett unntak: voteringer over «lovens overskrift og loven i sin helhet»
        – en lovteknisk bekreftelse på slutten av hver lovbehandling – holdes
        utenfor, i tråd med{" "}
        <a href="https://data.stortinget.no/dokumentasjon-og-hjelp/kommentar-til-datagrunnlaget-for-voteringer/">
          Stortingets egne råd om statistikk på voteringsdata
        </a>.
      </p>
      <p>
        Ved <em>alternativ votering</em> – der salen velger mellom to
        alternativer, for eksempel komiteens innstilling og et mindretallsforslag
        – registrerer Stortingets datatjeneste én avstemning som to speilvendte
        voteringer (63–38 og 38–63, samme representanter). Det er én beslutning,
        ikke to, så vi teller hendelsen én gang og holder speilbildet utenfor
        {meta?.alternativ_speil ? ` (${formatN(meta.alternativ_speil)} voteringer)` : ""}.
      </p>

      <h3>Hva er et partis standpunkt?</h3>
      <p>
        Et partis standpunkt i en votering er det flertallet av partiets
        deltakende representanter stemte. Partiene stemmer svært samlet
        {meta && meta.unity_min != null && (
          <>
            : målt per sesjon stemmer alle deltakende representanter i et
            parti likt i {meta.unity_min}–{meta.unity_max} prosent av
            voteringene
          </>
        )}
        . Ved helt likt antall for og mot regnes partiet uten standpunkt i
        den voteringen. Uavhengige representanter tilhører ikke noe parti og
        inngår ikke i partistatistikken.
      </p>

      <h3>Hva betyr «enige»?</h3>
      <p>
        To partier er enige i en votering når begge har samme standpunkt –
        begge for, eller begge mot. Prosenten er antall voteringer der de var
        enige, delt på antall voteringer der begge deltok. Merk at Stortinget
        sjelden er fulltallig: utbyttingsordningen holder styrkeforholdet
        mellom de større partiene riktig, men for partier med én eller få
        representanter betyr fravær at partiet står uten standpunkt i
        voteringen. Slike voteringer telles ikke med for det partiet. MDG
        deltok for eksempel bare i 56 prosent av voteringene i 2013–2014, og
        Pasientfokus i om lag 70 prosent – tallene deres bygger altså på de
        voteringene de deltok i.
      </p>

      <h3>Gjennomslag: partienes egne forslag</h3>
      <p>
        Stortingets voteringsbeskrivelser navngir forslagsstillerne når salen
        stemmer over et forslag. Det skjer i to former: som egen votering
        («Forslag nr. 17 på vegne av SV og R») eller som alternativ votering
        der forslaget settes direkte opp mot komiteens innstilling
        («Alternativ votering mellom innstillingen og forslag 1 fra H, FrP og
        R»). Gjennomslag-tallene teller begge former: hvor mange voteringer
        over partiforslag som ble holdt, og i hvor mange av dem forslaget
        vant. Ved alternativ votering regnes forslaget som vedtatt når
        forslagsstillernes side vant en votering med stemmer på begge sider.
        Forslag fremmet av flere partier sammen telles for hvert av partiene.
        Rundt hundre voteringer gjelder forslag fra enkeltrepresentanter
        eller presidentskapet, eller lar seg ikke entydig knytte til partier;
        de holdes utenfor.
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
      {meta && meta.data_pending?.length > 0 && (
        <p>
          For {meta.data_pending.length} voteringer oppgir Stortingets API de
          offisielle stemmetallene, men returnerer ingen individuelle
          stemmedata. Uten enkeltstemmer kan vi ikke beregne partistandpunkt,
          så disse holdes utenfor prosentene og er merket i datasettet
          (<code>data_pending</code>):{" "}
          {meta.data_pending.map((m, i) => (
            <span key={m.vid}>
              {i > 0 && "; "}
              {m.tittel} ({m.dato ? formatDate(m.dato) : ""})
            </span>
          ))}.
        </p>
      )}

      <h3>Begrensninger å kjenne til</h3>
      <p>
        Prosent lik stemmegivning er ikke det samme som prosent politisk
        enighet. Stortingets egen veiledning sier det utvetydig: «Det finnes
        dermed ingen måleenhet i dette materialet som kan brukes til å måle
        graden av enighet eller uenighet.» Tallene her måler derfor hvor ofte
        partiene stemte likt – aldri hvor enige de er. Mange mindretallsforslag
        fremmes for å markere standpunkt selv om utfallet er gitt; hvem som
        fremmer og støtter dem sammen er reell informasjon om politisk nærhet,
        men ikke det samme som enighet om politikkens innhold. Én votering kan
        dessuten gjelde flere sammenslåtte forslag, forslag varierer i omfang,
        og subsidiær stemmegivning kan gjøre at et parti stemmer for noe annet
        enn sitt primærstandpunkt. Enkeltrepresentanters feiltrykk rettes ikke
        i etterkant og kan gi enkeltavvik.
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

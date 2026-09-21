export default function OmPage() {
  return (
    <div className="method">
      <h2>Om prosjektet</h2>
      <p className="lede">
        Hva stemmer de? er et uavhengig, ikke-kommersielt samfunnsprosjekt
        som gjør Stortingets voteringsdata tilgjengelige for alle.
      </p>
      <p>
        Alt som vedtas i Norge, vedtas gjennom voteringer på Stortinget. Dataene
        om hvem som stemte hva er offentlige, men vanskelige å få oversikt over.
        Dette nettstedet samler alle registrerte voteringer siden 2011 og viser
        mønstrene: hvem stemmer sammen, hvem står mot hverandre, og hvordan
        endrer det seg med skiftende regjeringer.
      </p>
      <p>
        Målet er at velgere, journalister og forskere enkelt skal kunne
        ettergå hva partiene faktisk gjør – ikke bare hva de sier. Derfor er
        åpenhet bærende: metoden er dokumentert i sin helhet, hver eneste
        votering lenker til kilden hos stortinget.no, og all kode og alle
        data er{" "}
        <a href="https://github.com/Leftovergoldennuggets/hvastemmerdepa">
          åpne på GitHub
        </a>{" "}
        slik at beregningene kan reproduseres fra Stortingets rådata.
      </p>
      <p>
        Nettstedet oppdateres automatisk hver morgen med nye voteringer fra
        Stortingets API, og har ingen tilknytning til Stortinget eller noe
        politisk parti.
      </p>

      <h3>Hvem står bak?</h3>
      <figure className="om-figur">
        <img
          src="/anders.jpg"
          alt="Anders Eidesvik i rød skjorte står med armene i kors foran Stortingsbygningen i Oslo, ved siden av en av steinløvene ved inngangen, under blå himmel"
          width="1600"
          height="1066"
          onError={(e) => { e.currentTarget.parentElement.style.display = "none"; }}
        />
        <figcaption>
          Foto: Simon Eidesvik. Bildet kan brukes fritt, også av medier, mot
          kreditering «Foto: Simon Eidesvik».{" "}
          <a href="/anders-eidesvik-stortinget-foto-simon-eidesvik.jpg" download>
            Last ned i full oppløsning (JPG, 2048 px)
          </a>
        </figcaption>
      </figure>
      <div className="om-tekst">
        <div>
          <p>
            Jeg heter Anders Eidesvik og har laget dette nettstedet. Jeg har
            jobbet som journalist i NRK, Klassekampen og Dagens Næringsliv,
            har en mastergrad i journalistikk fra Stanford, og jobber i dag
            med kunstig intelligens i tankesmien{" "}
            <a href="https://langsikt.no">Langsikt</a>.
          </p>
          <p>
            Motivasjonen min ligger tett på den journalistiske: Voteringene er
            der demokratiet faktisk skjer, og dataene om dem er offentlige –
            men i praksis utilgjengelige for folk flest. Dette prosjektet er
            et forsøk på å gjøre dem like lette å lese som de er viktige, slik
            at debatten om partiene kan handle om hva de gjør, ikke bare hva
            de sier.
          </p>
          <p>
            Andre ting jeg driver med: <a href="https://ki-nytt.no">KI-nytt</a>,
            en nettside om kunstig intelligens og samfunn, og{" "}
            <a href="https://anderseidesvik.com">fotografi</a>. Innspill og
            spørsmål er velkomne, og oppdager du noe som ser feil ut, blir
            jeg takknemlig for beskjed – feil rettes:{" "}
            <a href="mailto:anders.eidesvik@gmail.com">anders.eidesvik@gmail.com</a>.
          </p>
        </div>
      </div>

      <h3>Takk og inspirasjon</h3>
      <p>
        Prosjektet er inspirert av{" "}
        <a href="https://github.com/holderdeord">Holder de ord</a>, den
        frivillige organisasjonen som i mange år gjorde Stortingets voteringer
        tilgjengelige for offentligheten. Nettstedet deres er lagt ned, men
        kildekoden deres er fortsatt åpen – og både metoden og tallene her er
        kvalitetssjekket mot den, i tillegg til mot{" "}
        <a href="https://polsys.sikt.no/storting/voteringsarkiv">
          Voteringsarkivet hos Sikt
        </a>{" "}
        (tidligere NSD). Takk til begge for arbeidet som gjorde det mulig å
        etterprøve dette prosjektet skikkelig.
      </p>
      <p>
        Data: <a href="https://data.stortinget.no">Stortingets tjeneste for åpne data</a>,
        brukt under <a href="https://data.norge.no/nlod/no/2.0">NLOD-lisensen</a>.
        Partilogoene tilhører de respektive partiene og brukes redaksjonelt.
      </p>
      <p>
        Se også: <a href="#/metodikk">Metode</a> ·{" "}
        <a href="#/forsta">Hvordan forstå tallene</a>
      </p>
    </div>
  );
}

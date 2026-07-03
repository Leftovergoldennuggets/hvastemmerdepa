export default function OmPage() {
  return (
    <div className="method">
      <a className="back-link" href="#/">← Til oversikten</a>
      <h2>Om prosjektet</h2>
      <p className="lede">
        Hva stemmer de på? er et uavhengig, ikke-kommersielt samfunnsprosjekt
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
        votering lenker til kilden hos stortinget.no, og alle beregninger kan
        reproduseres fra Stortingets rådata.
      </p>
      <p>
        Prosjektet er laget av Anders Eidesvik, tidligere journalist i NRK,
        Klassekampen og Dagens Næringsliv. Nettstedet har ingen tilknytning til
        Stortinget eller noe politisk parti.
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

export default function OmPage() {
  return (
    <div className="method">
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
        Nettstedet oppdateres automatisk hver morgen med nye voteringer fra
        Stortingets API, og har ingen tilknytning til Stortinget eller noe
        politisk parti.
      </p>

      <h3>Hvem står bak?</h3>
      <div className="om-person">
        <img
          className="om-foto"
          src="/anders.jpg"
          alt="Anders Eidesvik"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
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
            spørsmål er velkomne:{" "}
            <a href="mailto:anders.eidesvik@gmail.com">anders.eidesvik@gmail.com</a>.
          </p>
        </div>
      </div>

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

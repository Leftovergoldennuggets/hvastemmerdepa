export default function ForstaPage() {
  return (
    <div className="method">
      <h2>Hvordan forstå tallene</h2>
      <p className="lede">
        Kort veiledning til matrisen, fargene og partisidene.
      </p>

      <h3>Matrisen</h3>
      <p>
        Hver rute viser hvor stor andel av voteringene to partier stemte likt.
        Finn det ene partiet i raden og det andre i kolonnen: ruta der de møtes
        er deres tall. 61 betyr at partiene stemte likt i 61 prosent av
        voteringene der begge deltok. Hold pekeren over en rute for å se de
        nøyaktige tallene, og trykk for å åpne partienes felles historie.
      </p>

      <h3>Fargene</h3>
      <p>
        Grønt betyr at partiene oftest stemmer likt, rødt at de oftest stemmer
        ulikt. Grått ligger rundt midten – omtrent annenhver gang. Jo mørkere
        fargen er, desto sterkere er mønsteret.
      </p>

      <h3>Hva er høyt og lavt?</h3>
      <p>
        Selv erkefiender møtes i mange brede forlik og ukontroversielle saker,
        så tall under 40 prosent er sjeldne og markerer sterk motsetning.
        Partier i regjering sammen ligger tett på 100. De fleste partipar
        lander et sted mellom 45 og 75.
      </p>

      <h3>Perioder og sesjoner</h3>
      <p>
        Fanene øverst velger stortingsperiode – fireårsbolken mellom to valg.
        «Enkeltsesjon» viser ett parlamentsår (oktober til september) for den
        som vil se nærmere på et bestemt år. Merk at 2011–2013 bare dekker de
        to siste sesjonene av perioden 2009–2013, siden Stortingets elektroniske
        stemmedata begynner høsten 2011.
      </p>

      <h3>Partisidene</h3>
      <p>
        Trykker du på en rute, får du partienes historie: utviklingen over tid,
        tallene brutt ned per regjering – der du ser tydelig hvordan
        regjeringsdeltakelse styrer stemmegivningen – og selve listene over
        voteringer der partiene stemte likt eller ulikt. Hver votering lenker
        til saken hos stortinget.no.
      </p>

      <p>
        Vil du vite nøyaktig hvordan alt beregnes?{" "}
        <a href="#/metodikk">Les hele metoden</a>.
      </p>
    </div>
  );
}

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

      <h3>Stemte likt, for eller mot?</h3>
      <p>
        Å stemme likt kan bety to ting: at begge partiene stemte for, eller at
        begge stemte mot. Nesten tre av fire voteringer gjelder forslag som
        partier fremmer i salen, oftest fra mindretallet, og dem stemmer de
        største partiene ofte ned sammen. Et høyt tall kan derfor bety at to
        partier har stemt ned de samme forslagene – ikke at de har stemt for
        den samme politikken.
      </p>
      <p>
        Bryterne over matrisen lar deg velge. <strong>Stemte likt</strong>{" "}
        teller begge deler. <strong>Stemte for det samme</strong> ser bare på
        voteringene der minst ett av partiene stemte for, og viser hvor ofte
        begge gjorde det. <strong>Stemte mot det samme</strong> gjør det samme
        for mot-stemmer. Du kan også velge å se bare voteringer over{" "}
        <strong>komiteens innstilling</strong> – flertallets forslag til
        vedtak – eller bare over <strong>partienes forslag</strong>. Et
        eksempel: Fra valget i 2025 og fram til november 2026 stemte Ap og
        Høyre likt i 71 prosent av voteringene der begge deltok. Men bare i
        14 prosent stemte begge for; i 54 prosent stemte begge mot.
      </p>

      <h3>Fargene</h3>
      <p>
        Grønt betyr at partiene oftest stemmer likt (eller for eller mot det
        samme, etter hva du har valgt), rødt at de sjelden gjør det. Grått ligger rundt midten – omtrent annenhver gang. Jo mørkere
        fargen er, desto sterkere er mønsteret.
      </p>

      <h3>Hva er høyt og lavt?</h3>
      <p>
        Partier i regjering sammen ligger tett på 100. Ellers avhenger tallene
        mye av perioden og av hva det stemmes over. Når de fleste voteringene
        gjelder forslag fra mindretallet, stemmer selv partier langt fra
        hverandre ofte likt, rett og slett fordi begge stemmer ned et tredje
        partis forslag. Sammenlign derfor helst partipar innenfor samme
        periode, og se gjerne på «stemte for det samme» før du trekker
        konklusjoner om politisk nærhet.
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
        hvor mye av det å stemme likt som var å stemme for og hvor mye som var
        å stemme mot, tallene brutt ned per regjering – der du ser tydelig
        hvordan regjeringsdeltakelse styrer stemmegivningen – og selve
        listene over voteringer der partiene stemte likt eller ulikt, begge
        for eller begge mot. Hver votering lenker
        til saken hos stortinget.no.
      </p>

      <p>
        Vil du vite nøyaktig hvordan alt beregnes?{" "}
        <a href="/metodikk">Les hele metoden</a>.
      </p>
    </div>
  );
}

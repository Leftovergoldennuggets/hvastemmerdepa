/* Visningsnavn for fagkomiteer.

   Stortingets API (allekomiteer) gir bare id og navn, ikke når en komité ble
   opprettet eller nedlagt. Uten et tillegg ser «Kirke-, utdannings- og
   forskningskomiteen» ut som en komité som fortsatt finnes. Årstallene under
   er lest ut av voteringsdataene selv (første og siste sesjon med voteringer
   fra komiteen) og gjelder kun komiteer som ikke lenger finnes:

   - KIRKE: siste voteringer i sesjonen 2016–2017. Fra høsten 2017 heter den
     Utdannings- og forskningskomiteen (UFO), og kirkesakene gikk til
     Familie- og kulturkomiteen.
   - SÆRKOM, KOR, EOS: særskilte komiteer nedsatt for én sak. */
const HISTORIKK = {
  KIRKE: "til 2017",
  SÆRKOM: "2011–2012",
  KOR: "2019–2020",
  EOS: "2020–2021",
};

export function komiteVisningsnavn(id, navn) {
  const h = HISTORIKK[id];
  return h ? `${navn} (${h})` : navn;
}

/* Kart id → navn fra komiteer.json, med årstall lagt til for nedlagte komiteer. */
export function medHistorikk(navnKart) {
  return Object.fromEntries(
    Object.entries(navnKart).map(([id, navn]) => [id, komiteVisningsnavn(id, navn)])
  );
}

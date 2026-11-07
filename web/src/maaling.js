// Tekstene til bryterne «Stemte likt / for det samme / mot det samme» og
// «Alle voteringer / Komiteens innstilling / Partienes forslag». Én kilde for
// forsiden, partisidene og matrisen, så ordlyden aldri sprer seg. Tallene
// kommer fra pipeline/analyse_for_mot.py (se metodesiden).

export const MAALINGER = [
  {
    id: "likt",
    navn: "Stemte likt",
    hjelp: "Begge partiene stemte for, eller begge stemte mot.",
  },
  {
    id: "for",
    navn: "Stemte for det samme",
    hjelp:
      "Bare voteringer der minst ett av partiene stemte for: hvor ofte stemte begge for?",
  },
  {
    id: "mot",
    navn: "Stemte mot det samme",
    hjelp:
      "Bare voteringer der minst ett av partiene stemte mot: hvor ofte stemte begge mot?",
  },
];

export const UTVALG = [
  {
    id: "alle",
    navn: "Alle voteringer",
    hjelp: "Alle voteringer der salen delte seg.",
  },
  {
    id: "innstilling",
    navn: "Komiteens innstilling",
    hjelp:
      "Voteringer over komiteens tilråding – flertallets forslag til vedtak. Ni av ti blir vedtatt.",
  },
  {
    id: "forslag",
    navn: "Partienes forslag",
    hjelp:
      "Voteringer over forslag som partier fremmer i salen, oftest fra mindretallet. De fleste faller.",
  },
];

// Tilleggstekst til periode-etiketten når et utvalg er valgt.
export const utvalgEtikett = (utvalg) =>
  utvalg === "innstilling" ? " (bare komiteens innstilling)"
  : utvalg === "forslag" ? " (bare partienes forslag)"
  : "";

// Kort ord til fargeskalaen: «Sjelden likt» … «Oftest likt».
export const maalingOrd = (maaling) =>
  maaling === "for" ? "for det samme" : maaling === "mot" ? "mot det samme" : "likt";

// Én setning om én rute/ett par, med de eksakte tallene.
export function beskrivPar(maaling, aNavn, bNavn, agree, total, label, formatN) {
  if (maaling === "for") {
    return `${aNavn} og ${bNavn} stemte begge for i ${formatN(agree)} av de ${formatN(total)} voteringene ${label} der minst ett av dem stemte for.`;
  }
  if (maaling === "mot") {
    return `${aNavn} og ${bNavn} stemte begge mot i ${formatN(agree)} av de ${formatN(total)} voteringene ${label} der minst ett av dem stemte mot.`;
  }
  return `${aNavn} og ${bNavn} stemte likt i ${formatN(agree)} av ${formatN(total)} voteringer ${label}.`;
}


// Party metadata. Order = political spectrum, left to right; this order is
// fixed everywhere in the UI (matrix axes, legends) so readers build a stable
// mental map. `farge` anchors in the parties' official/press colors but the
// shades are deliberately pulled apart so neighbours stay distinguishable on
// small marks (salkart dots, map lists): R darker than Ap, Sp dark forest vs
// MDG light yellow-green, H light blue vs FrP navy. Logos are the official
// marks (Wikimedia Commons). `id` is Stortinget's party id in the data;
// `kort` is the abbreviation people actually read in the press (Ap, not A).
export const PARTIES = [
  { id: "R",   kort: "R",   navn: "Rødt",                     farge: "#7A1E27", logo: "/logos/R.svg" },
  { id: "SV",  kort: "SV",  navn: "Sosialistisk Venstreparti", farge: "#C24D87", logo: "/logos/SV.svg" },
  { id: "MDG", kort: "MDG", navn: "Miljøpartiet De Grønne",    farge: "#88B437", logo: "/logos/MDG.svg" },
  { id: "A",   kort: "Ap",  navn: "Arbeiderpartiet",           farge: "#E23F52", logo: "/logos/A.svg" },
  { id: "Sp",  kort: "Sp",  navn: "Senterpartiet",             farge: "#0D5C30", logo: "/logos/Sp.png" },
  { id: "KrF", kort: "KrF", navn: "Kristelig Folkeparti",      farge: "#D9A017", logo: "/logos/KrF.svg" },
  { id: "V",   kort: "V",   navn: "Venstre",                   farge: "#00A195", logo: "/logos/V.svg" },
  { id: "H",   kort: "H",   navn: "Høyre",                     farge: "#5B93D6", logo: "/logos/H.svg" },
  { id: "FrP", kort: "FrP", navn: "Fremskrittspartiet",        farge: "#1C3A66", logo: "/logos/FrP.svg" },
  { id: "PF",  kort: "PF",  navn: "Pasientfokus",              farge: "#8C8578", logo: "/logos/PF.png" },
];

export const PARTY_BY_ID = Object.fromEntries(PARTIES.map((p) => [p.id, p]));

// Left-to-right index for sorting; unknown parties sort last.
export function politicalOrder(id) {
  const i = PARTIES.findIndex((p) => p.id === id);
  return i === -1 ? PARTIES.length : i;
}

// Safety net: a party id in the data that we have no metadata for (e.g. a new
// party after a future election) still renders — gray, abbreviation as name —
// instead of silently disappearing from the matrix.
export function partyOrFallback(id) {
  return PARTY_BY_ID[id] || { id, kort: id, navn: id, farge: "#9A938A", logo: null };
}

// Diverging scale around 50 %: disagreement reads red, agreement reads green,
// the midpoint is a neutral gray. The green leans teal so the two poles stay
// distinguishable for red-green colorblind readers (and every cell prints its
// value). Both arms validated for monotone lightness.
export const DIVERGING = [
  "#8A2A2E", "#A94A45", "#C4716A", "#D69B92", "#E3C4BD", // 0–45 %: red, dark→light
  "#E8E6E1",                                             // ~50 %: neutral
  "#BFD8CE", "#93C0AF", "#62A68D", "#35886C", "#14684F", // 55–100 %: green, light→dark
];

export function cellColor(pct) {
  const i = Math.min(DIVERGING.length - 1, Math.floor((pct / 100) * DIVERGING.length));
  return DIVERGING[i];
}

// Ink on light mid-tones, white on the dark poles, so values stay readable.
export function cellText(pct) {
  const i = Math.floor((pct / 100) * DIVERGING.length);
  return i <= 1 || i >= 9 ? "#FFFFFF" : "#191715";
}

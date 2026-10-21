// Routes, page titles and descriptions — one source for the app (which
// updates <head> on navigation) and scripts/prerender.mjs (which writes one
// HTML file per route so search engines and link previews see real titles).
// Plain module with no browser or Vite dependencies, so Node can import it.
import { PARTIES, partyOrFallback, politicalOrder } from "./parties.js";

export const SITE = "https://hvastemmerde.no";
export const SITE_NAME = "Hva stemmer de?";

const PAGES = {
  "/splittelser": { view: "splits" },
  "/gjennomslag": { view: "gjennomslag" },
  "/hvem": { view: "people" },
  "/forsta": { view: "forsta" },
  "/metodikk": { view: "method" },
  "/apne-data": { view: "data" },
  "/om": { view: "om" },
};

export function parsePath(pathname) {
  const p = decodeURIComponent(pathname).replace(/\/+$/, "") || "/";
  if (PAGES[p]) return { ...PAGES[p] };
  const party = p.match(/^\/parti\/([\wÆØÅæøå]+)$/);
  if (party) return { view: "party", party: partyOrFallback(party[1]) };
  const pair = p.match(/^\/par\/([\wÆØÅæøå]+)\/([\wÆØÅæøå]+)$/);
  if (pair && pair[1] !== pair[2]) {
    return { view: "pair", a: partyOrFallback(pair[1]), b: partyOrFallback(pair[2]) };
  }
  return { view: "matrix" };
}

// The site used hash routes (#/par/R/FrP) until October 2026. Old links are
// in articles and emails, so they are translated to the new paths on load.
export function pathFromLegacyHash(hash) {
  if (!hash.startsWith("#/")) return null;
  const p = hash.slice(1);
  return p === "/data" || p.startsWith("/data/") ? "/apne-data" : p;
}

// Pair pages exist in both orders (the matrix links row → column); the
// canonical one lists the parties left to right, as everywhere else.
function pairPath(a, b) {
  const [x, y] = politicalOrder(a.id) <= politicalOrder(b.id) ? [a, b] : [b, a];
  return `/par/${x.id}/${y.id}`;
}

export function seo(route) {
  const t = (s) => `${s} | ${SITE_NAME}`;
  switch (route.view) {
    case "splits":
      return {
        path: "/splittelser",
        title: t("Når partiene sprekker – splittelser på Stortinget"),
        description:
          "Alle voteringer på Stortinget der minst to representanter brøt med sitt eget parti, fra 2011 til i dag – med dato, sak og stemmetall.",
      };
    case "gjennomslag":
      return {
        path: "/gjennomslag",
        title: t("Hvem får gjennomslag på Stortinget?"),
        description:
          "Hvor mange av partienes egne forslag i Stortinget som faktisk ble vedtatt – parti for parti og periode for periode siden 2011.",
      };
    case "people":
      return {
        path: "/hvem",
        title: t("Hvem sitter på Stortinget? Kjønn, alder og erfaring"),
        description:
          "Alle stortingsrepresentantene i salkart og på Norgeskart – fordelt på parti, kjønn, alder, erfaring og valgdistrikt, med komiteer og bakgrunn.",
      };
    case "forsta":
      return {
        path: "/forsta",
        title: t("Slik leser du tallene"),
        description:
          "Hva betyr det at to partier stemmer likt i en viss andel av voteringene – og hva betyr det ikke? En kort forklaring av tallene på Hva stemmer de?",
      };
    case "method":
      return {
        path: "/metodikk",
        title: t("Metode"),
        description:
          "Hvordan voteringene hentes fra Stortingets åpne data, hva som telles med og ikke, og hvordan tallene er kontrollert mot Stortingets offisielle stemmetall.",
      };
    case "data":
      return {
        path: "/apne-data",
        title: t("Åpne data – last ned voteringstallene"),
        description:
          "Alle tallene bak Hva stemmer de? som åpne JSON-filer: enighet mellom partiene, splittelser, gjennomslag og representanter. Fritt til bruk mot kreditering.",
      };
    case "om":
      return {
        path: "/om",
        title: t("Om prosjektet"),
        description:
          "Hva stemmer de? er et uavhengig, ikke-kommersielt samfunnsprosjekt med åpen kildekode og åpen metode, laget av Anders Eidesvik.",
      };
    case "party":
      return {
        path: `/parti/${route.party.id}`,
        title: t(`Hvem stemmer ${route.party.navn} med på Stortinget?`),
        description:
          `Se hvilke partier ${route.party.navn} (${route.party.kort}) oftest og sjeldnest stemmer likt med på Stortinget, og hvordan partiet stemmer i konkrete saker.`,
      };
    case "pair":
      return {
        path: pairPath(route.a, route.b),
        title: t(`Hvor ofte stemmer ${route.a.navn} og ${route.b.navn} likt?`),
        description:
          `Andelen voteringer på Stortinget der ${route.a.navn} og ${route.b.navn} stemte likt – over tid, gjennom regjeringene og tema for tema. Alle tall fra Stortingets åpne data.`,
      };
    default:
      return {
        path: "/",
        title: `${SITE_NAME} – slik stemmer partiene på Stortinget`,
        description:
          "Hvor ofte stemmer partiene på Stortinget likt – og med hvem? Alle voteringer siden 2011, parti for parti. Åpne data fra Stortinget, oppdatert daglig.",
      };
  }
}

// Every page worth indexing, for the prerender step and the sitemap.
// Pair pages are generated in both orders; only canonical ones go in the
// sitemap.
export function allRoutes() {
  const routes = [{ view: "matrix" }, ...Object.values(PAGES)];
  for (const p of PARTIES) routes.push({ view: "party", party: p });
  for (const a of PARTIES) {
    for (const b of PARTIES) if (a.id !== b.id) routes.push({ view: "pair", a, b });
  }
  return routes;
}

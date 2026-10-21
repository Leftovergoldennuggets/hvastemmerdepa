// Runs after `vite build`. Writes one HTML file per route (dist/splittelser.html,
// dist/par/R/FrP.html …) with that page's title, description, canonical URL and
// share tags, plus dist/sitemap.xml. Vercel serves them via cleanUrls; the app
// itself is unchanged and renders in the browser as before. Without this,
// search engines and link previews only ever see the front page.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allRoutes, seo, SITE, SITE_NAME } from "../src/routes.js";
import { PARTIES } from "../src/parties.js";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const template = readFileSync(join(dist, "index.html"), "utf8");
const meta = JSON.parse(readFileSync(join(dist, "data", "meta.json"), "utf8"));

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Fail the build loudly if index.html no longer has a tag we rewrite.
function swap(html, pattern, replacement) {
  if (!pattern.test(html)) throw new Error(`prerender: fant ikke ${pattern} i index.html`);
  return html.replace(pattern, replacement);
}

const jsonLd = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: `${SITE}/`,
  inLanguage: "nb",
  description: seo({ view: "matrix" }).description,
  publisher: { "@type": "Person", name: "Anders Eidesvik", url: `${SITE}/om` },
};

// Lets the data show up in Google Dataset Search. Only files that exist in
// dist/data are listed.
const dataFiles = ["meta.json", "sessions.json", "splits.json", "gjennomslag.json", "personer.json", "eras.json", "komiteer.json"];
const dataset = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "Voteringer på Stortinget: enighet, splittelser og gjennomslag for partiene",
  description:
    "Stortingets voteringer fra 2011 til i dag, bearbeidet til åpne JSON-filer: parvis enighet mellom partiene per sesjon og fagkomité, " +
    "partienes stemmetall i hver votering, splittelser i partiene, gjennomslag for partienes forslag og opplysninger om representantene. " +
    "Rådata fra Stortingets tjeneste for åpne data (NLOD). Oppdateres daglig.",
  url: `${SITE}/apne-data`,
  inLanguage: "nb",
  keywords: ["Stortinget", "voteringer", "partier", "stortingsrepresentanter", "åpne data", "Norge"],
  creator: { "@type": "Person", name: "Anders Eidesvik", url: `${SITE}/om` },
  isBasedOn: "https://data.stortinget.no",
  license: "https://github.com/Leftovergoldennuggets/hvastemmerdepa/blob/main/LISENS-DATA.md",
  isAccessibleForFree: true,
  spatialCoverage: "Norge",
  temporalCoverage: `${meta.first_session.slice(0, 4)}-10-01/..`,
  dateModified: meta.generated,
  distribution: dataFiles.map((f) => ({
    "@type": "DataDownload",
    encodingFormat: "application/json",
    contentUrl: `${SITE}/data/${f}`,
  })),
};

// Shown only without JavaScript (and read by crawlers that do not run it):
// what the page is, and links onward so every page can be discovered.
const navLinks = [
  ["/", "Forsiden: enighet mellom partiene"],
  ...["splits", "gjennomslag", "people", "forsta", "method", "data", "om"].map((view) => {
    const s = seo({ view });
    return [s.path, s.title.replace(` | ${SITE_NAME}`, "")];
  }),
  ...PARTIES.map((p) => [`/parti/${p.id}`, p.navn]),
];
function noscript(s) {
  const links = navLinks.map(([href, text]) => `<li><a href="${href}">${esc(text)}</a></li>`).join("");
  return (
    `<noscript><h1>${esc(s.title.replace(` | ${SITE_NAME}`, ""))}</h1><p>${esc(s.description)}</p>` +
    `<p>Tallene vises med JavaScript. Skru det på, eller last ned dataene under <a href="/apne-data">Åpne data</a>.</p>` +
    `<ul>${links}</ul></noscript>`
  );
}

const canonical = new Set();
let written = 0;
for (const route of allRoutes()) {
  const s = seo(route);
  // Pair pages are written in both orders; both point to the canonical one.
  const path = route.view === "pair" ? `/par/${route.a.id}/${route.b.id}` : s.path;
  canonical.add(s.path);

  let html = template;
  html = swap(html, /<title>[^<]*<\/title>/, `<title>${esc(s.title)}</title>`);
  html = swap(html, /(<meta name="description" content=")[^"]*/, `$1${esc(s.description)}`);
  html = swap(html, /(<link rel="canonical" href=")[^"]*/, `$1${SITE}${s.path}`);
  html = swap(html, /(<meta property="og:url" content=")[^"]*/, `$1${SITE}${s.path}`);
  html = swap(html, /(<meta property="og:title" content=")[^"]*/, `$1${esc(s.title)}`);
  html = swap(html, /(<meta property="og:description" content=")[^"]*/, `$1${esc(s.description)}`);
  const ld = route.view === "matrix" ? jsonLd(website) : route.view === "data" ? jsonLd(dataset) : "";
  if (ld) html = swap(html, /<\/head>/, `  ${ld}\n  </head>`);
  html = swap(html, /<div id="root"><\/div>/, `<div id="root"></div>\n    ${noscript(s)}`);

  const file = path === "/" ? join(dist, "index.html") : join(dist, `${path}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  written++;
}

const urls = [...canonical]
  .map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${meta.generated}</lastmod></url>`)
  .join("\n");
writeFileSync(
  join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
);
console.log(`prerender: ${written} sider, ${canonical.size} i sitemap.xml`);

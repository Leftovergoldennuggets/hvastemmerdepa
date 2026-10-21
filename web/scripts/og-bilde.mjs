// Draws public/og.png, the 1200×630 image shown when a link to the site is
// shared. The seat chart uses the same layout and party order as Salkart.jsx
// and the real seat counts from the latest period in personer.json, so rerun
// this after an election:
//
//   node scripts/og-bilde.mjs
//
// Needs Google Chrome installed (macOS path below); it renders the card
// headless and saves a screenshot.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { partyOrFallback } from "../src/parties.js";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const personer = JSON.parse(readFileSync(join(web, "public/data/personer.json"), "utf8"));
const periode = Object.keys(personer).sort().pop();
const reps = personer[periode].representanter;

// Same as Salkart.jsx: left-to-right party order, seats on 8 concentric rows.
const LEFT_TO_RIGHT = ["R", "SV", "A", "Sp", "MDG", "KrF", "V", "H", "FrP", "PF"];
const order = (id) => (LEFT_TO_RIGHT.indexOf(id) + 1 || LEFT_TO_RIGHT.length + 1);
const parties = reps.map((r) => r.parti).sort((a, b) => order(a) - order(b));

function seatLayout(total) {
  const ROWS = 8;
  const r0 = 140;
  const r1 = 340;
  const radii = Array.from({ length: ROWS }, (_, i) => r0 + ((r1 - r0) * i) / (ROWS - 1));
  const weight = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.floor((total * r) / weight));
  let rest = total - counts.reduce((a, b) => a + b, 0);
  for (let i = ROWS - 1; rest > 0; i = (i - 1 + ROWS) % ROWS, rest--) counts[i]++;
  const seats = [];
  radii.forEach((r, row) => {
    const n = counts[row];
    for (let k = 0; k < n; k++) {
      const angle = Math.PI - (Math.PI * k) / (n - 1);
      seats.push({ angle, x: 360 + r * Math.cos(angle), y: 368 - r * Math.sin(angle) });
    }
  });
  seats.sort((a, b) => b.angle - a.angle || a.y - b.y);
  return seats;
}

const dots = seatLayout(parties.length)
  .map((s, i) => `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="9" fill="${partyOrFallback(parties[i]).farge}"/>`)
  .join("");

const html = `<!doctype html><html lang="no"><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #fff; color: #191715;
         font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
         display: flex; align-items: center; padding: 0 64px; gap: 40px; }
  .tekst { flex: 0 0 470px; }
  .tekst::before { content: ""; display: block; width: 44px; border-top: 4px solid #c4272e; margin-bottom: 30px; }
  h1 { font-family: "Iowan Old Style", Palatino, Georgia, serif; font-weight: 500;
       font-size: 76px; line-height: 1.04; letter-spacing: -0.01em; }
  p { margin-top: 26px; font-size: 29px; line-height: 1.32; color: #57534e; }
  .url { margin-top: 34px; font-size: 24px; font-weight: 600; letter-spacing: 0.01em; }
  svg { flex: 1; }
</style></head><body>
  <div class="tekst">
    <h1>Hva<br>stemmer de?</h1>
    <p>Slik stemmer partiene på Stortinget – alle voteringer siden 2011</p>
    <div class="url">hvastemmerde.no</div>
  </div>
  <svg viewBox="0 0 720 380">${dots}</svg>
</body></html>`;

const tmp = mkdtempSync(join(tmpdir(), "og-"));
writeFileSync(join(tmp, "og.html"), html);
execFileSync(CHROME, [
  "--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
  "--window-size=1200,630", `--screenshot=${join(web, "public/og.png")}`, `file://${join(tmp, "og.html")}`,
], { stdio: "ignore" });
console.log(`og.png: ${parties.length} representanter, periode ${periode}`);

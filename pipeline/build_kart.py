"""Build an SVG-ready map of the 19 valgdistrikter from Kartverket's
official geometry.

Source: Kartverket, "Valgdistrikter" (open data, CC BY 4.0 / NLOD-compatible;
credit Kartverket). Downloaded automatically if missing:
  https://nedlasting.geonorge.no/geonorge/Basisdata/Valgdistrikter/GeoJSON/
    Basisdata_0000_Norge_25833_Valgdistrikter_GeoJSON.zip

The geometry is in EPSG:25833 (UTM 33N) — planar meters — so it can be
scaled straight into SVG coordinates without any map projection code.
Polygons are simplified with Douglas-Peucker and small islands dropped to
keep the file tiny; this is display simplification only, no data changes.

Output: web/src/norgeskart.json
  { "<valgdistrikt>": {"d": "<svg path>", "cx": x, "cy": y}, "_viewBox": ... }
"""
import io
import json
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "valgdistrikter.geojson"
OUT = ROOT / "web" / "src" / "norgeskart.json"
URL = ("https://nedlasting.geonorge.no/geonorge/Basisdata/Valgdistrikter/"
       "GeoJSON/Basisdata_0000_Norge_25833_Valgdistrikter_GeoJSON.zip")

TOLERANCE_M = 1200      # Douglas-Peucker tolerance in meters
MIN_RING_KM2 = 25       # drop islands smaller than this
VIEW_H = 1000           # SVG viewBox height


def fetch():
    if RAW.exists():
        return json.loads(RAW.read_text())
    print("downloading valgdistrikter from Kartverket …", flush=True)
    req = urllib.request.Request(URL, headers={"User-Agent": "stortingsvotering-prosjekt"})
    with urllib.request.urlopen(req, timeout=120) as r:
        z = zipfile.ZipFile(io.BytesIO(r.read()))
    data = z.read(z.namelist()[0]).decode("utf-8")
    RAW.parent.mkdir(parents=True, exist_ok=True)
    RAW.write_text(data)
    return json.loads(data)


def simplify(points, tol):
    """Iterative Douglas-Peucker (recursion depth is unbounded on coastlines)."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]
        bx, by = points[b]
        dx, dy = bx - ax, by - ay
        seg2 = dx * dx + dy * dy
        dmax, imax = 0.0, -1
        for i in range(a + 1, b):
            px, py = points[i]
            if seg2 == 0:
                d2 = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg2))
                d2 = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d2 > dmax:
                dmax, imax = d2, i
        if dmax > tol * tol:
            keep[imax] = True
            stack.append((a, imax))
            stack.append((imax, b))
    return [p for p, k in zip(points, keep) if k]


def ring_area_m2(ring):
    s = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def centroid(ring):
    a = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        cross = x1 * y2 - x2 * y1
        a += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    a /= 2
    return (cx / (6 * a), cy / (6 * a))


def main():
    d = fetch()
    districts = {}
    for f in d["Valgdistrikt"]["features"]:
        # Northern districts carry Sami names too: "Troms – Romsa – Tromssa"
        navn = f["properties"]["valgdistriktsnavn"].split(" – ")[0].strip()
        geom = f["geometry"]
        polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
        districts.setdefault(navn, []).extend(polys)

    # Keep outer rings only (holes are lakes — invisible at this scale)
    kept = {}
    for navn, polys in districts.items():
        rings = []
        for poly in polys:
            ring = [(x, y) for x, y, *rest in poly[0]]
            if ring_area_m2(ring) >= MIN_RING_KM2 * 1e6:
                rings.append(ring)
        kept[navn] = rings

    all_pts = [p for rings in kept.values() for r in rings for p in r]
    minx = min(p[0] for p in all_pts); maxx = max(p[0] for p in all_pts)
    miny = min(p[1] for p in all_pts); maxy = max(p[1] for p in all_pts)
    scale = VIEW_H / (maxy - miny)
    view_w = round((maxx - minx) * scale, 1)

    def to_svg(p):
        return (round((p[0] - minx) * scale, 1), round((maxy - p[1]) * scale, 1))

    out = {"_viewBox": f"0 0 {view_w} {VIEW_H}",
           "_kilde": "Kartverket (valgdistrikter), forenklet for visning"}
    total = 0
    for navn, rings in sorted(kept.items()):
        parts = []
        biggest = max(rings, key=ring_area_m2)
        for ring in rings:
            s = simplify(ring, TOLERANCE_M)
            if len(s) < 4:
                continue
            pts = [to_svg(p) for p in s]
            parts.append("M" + "L".join(f"{x} {y}" for x, y in pts) + "Z")
        cx, cy = to_svg(centroid(biggest))
        out[navn] = {"d": "".join(parts), "cx": cx, "cy": cy}
        total += len(out[navn]["d"])
        print(f"{navn:20s} {len(rings):3d} øyer/flater, {len(out[navn]['d'])//1000} KB path")

    OUT.write_text(json.dumps(out, ensure_ascii=False))
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1000} KB, {len(kept)} distrikter)")


if __name__ == "__main__":
    main()

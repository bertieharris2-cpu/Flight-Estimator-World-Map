// Builds world-map-estimator.html from data.json + Natural Earth land (world-atlas).
// Usage: node build.js
const fs = require('fs');
const path = require('path');
const { feature } = require('topojson-client');
const topo = require('world-atlas/land-110m.json');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
const { lonMin, latMax } = data.map;
const U = 10; // map units per degree
const px = lon => (lon - lonMin) * U;
const py = lat => (latMax - lat) * U;

// Land -> one SVG path in map units. Rings that cross the date line are
// unwrapped and drawn twice (shifted by 360 degrees); the map clip hides the overflow.
const land = feature(topo, topo.objects.land);
let d = '';
const ringPath = (ring, shift) =>
  'M' + ring.map(([lon, lat]) => px(lon + shift).toFixed(1) + ' ' + py(lat).toFixed(1)).join('L') + 'Z';
for (const f of land.features) {
  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys) for (let ring of poly) {
    if (ring.every(([, lat]) => lat < data.map.latMin - 5)) continue; // Antarctica etc.
    let jumped = false;
    ring = ring.map(p => p.slice());
    for (let i = 1; i < ring.length; i++) {
      while (ring[i][0] - ring[i - 1][0] > 180) { ring[i][0] -= 360; jumped = true; }
      while (ring[i][0] - ring[i - 1][0] < -180) { ring[i][0] += 360; jumped = true; }
    }
    d += ringPath(ring, 0);
    if (jumped) d += ringPath(ring, ring.some(p => p[0] < -180) ? 360 : -360);
  }
}

const symbols = Object.entries(data.flags)
  .map(([id, f]) => `<symbol id="flag-${id}" viewBox="${f.viewBox}" preserveAspectRatio="none">${f.svg}</symbol>`)
  .join('\n');

const appData = { map: data.map, home: data.home, benchmarks: data.benchmarks, continents: data.continents,
  destinations: data.destinations.map(({ check, ...rest }) => rest),
  flagAspect: Object.fromEntries(Object.entries(data.flags).map(([id, f]) => {
    const v = f.viewBox.split(/\s+/).map(Number); return [id, v[2] / v[3]];
  })) };

let html = fs.readFileSync(path.join(__dirname, 'src', 'template.html'), 'utf8');
html = html.replace('__LAND_PATH__', () => d)
  .replace('__FLAG_SYMBOLS__', () => symbols)
  .replace('__APP_DATA__', () => JSON.stringify(appData));
fs.writeFileSync(path.join(__dirname, 'world-map-estimator.html'), html);
console.log('wrote world-map-estimator.html', (html.length / 1024).toFixed(0) + ' KB');

# World Map Flight Estimator

A classroom tool for estimating flight times from the Lego Airport (UK) on a world map.

## For teachers

Open **`world-map-estimator.html`**. It is one file, works offline, and needs nothing installed.

- **Whiteboard:** double-click the file, or drag it into Chrome or Edge.
- **iPad:** save the file into *Documents by Readdle* (or the Files app), then tap it to open.

How it works:
1. Tap a flag. The route curves out from the Lego Airport, and the other flags fade so the route is easy to see.
2. Set an estimate with **−** and **+** (half-hour steps), or type one.
3. Tap **REVEAL** to see the real time and how far out the estimate was.

- **Known flights** (Spain 2½ hours, New York 8 hours) are always shown under the map.
- The grid starts **hidden**, so children make a ballpark estimate first. **Show squares** (bottom left of the map) brings it back: 1 square ≈ 1 hour.
- **Results** (top right) lists estimates, with Copy and Clear.
- **Teacher** has flag filters, grid, benchmark flights, animations (on/off and plane speed) and reset.

## Changing the data

Destinations, flight times, flags and grid size all live in **`data.json`**. After editing it, rebuild:

```
npm install
npm run build   # writes world-map-estimator.html
npm test        # headless checks + screenshots in screenshots/
```

- Grid: 1 square = 9° (about 1000 km, about 1 hour of flying). Rows line up with the Lego Airport's latitude.
- `hours` are typical times from London, rounded to the nearest half hour. The `check` notes mark figures worth double-checking.
- `utcOffset` is stored for a later time-zone lesson. The time-zone lines are already in the map, hidden, and so is their teacher switch.

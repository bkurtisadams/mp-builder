// greyhawk-map.patch.js v0.1.0 — 2026-04-18
//
// Minimal edits to greyhawk-map.html to integrate gcc-landmarks.js.
// Apply as str_replace edits on precise strings. Three edits total.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EDIT 1 — Add landmark overlay rendering to buildHexGrid
// ═══════════════════════════════════════════════════════════════════════════════
//
// FIND the closing of buildHexGrid, specifically the line:
//
//     svg.appendChild(cellsG); svg.appendChild(labelsG); svg.appendChild(markerG);
//     updatePartyMarker();
//   }
//
// REPLACE with:
//
//     svg.appendChild(cellsG); svg.appendChild(labelsG);
//     svg.appendChild(buildLandmarkOverlay());
//     svg.appendChild(markerG);
//     updatePartyMarker();
//   }
//
// ═══════════════════════════════════════════════════════════════════════════════
// EDIT 2 — Add buildLandmarkOverlay function
// ═══════════════════════════════════════════════════════════════════════════════
//
// INSERT immediately after the closing brace of buildHexGrid (before
// `function rebuildGrid`):

function buildLandmarkOverlay(){
  const ns='http://www.w3.org/2000/svg';
  const g=document.createElementNS(ns,'g');
  g.id='landmark-overlay';
  g.style.pointerEvents='none';
  if(typeof GCCLandmarks === 'undefined') return g;

  // Draw a small marker at each landmark's true hex center.
  // Kind determines symbol: city = filled circle, town = outlined circle,
  // castle = square, ruin = X, village = small dot, feature = diamond.
  const KIND_STYLE = {
    city:     { shape:'circle',   r:3.5, fill:'#c8941a',   stroke:'#e8b840', sw:0.6 },
    town:     { shape:'circle',   r:2.8, fill:'none',      stroke:'#c8941a', sw:0.8 },
    castle:   { shape:'square',   s:5.0, fill:'#8b2a1a',   stroke:'#e8b840', sw:0.6 },
    ruin:     { shape:'x',        s:4.0, stroke:'#8b6e45', sw:1.0 },
    village:  { shape:'circle',   r:1.8, fill:'#8b6e45',   stroke:'#c8a96e', sw:0.4 },
    feature:  { shape:'diamond',  s:4.5, fill:'#4a7fa0',   stroke:'#8bc5e0', sw:0.6 },
    landmark: { shape:'diamond',  s:4.0, fill:'#8b5aa0',   stroke:'#c090e0', sw:0.6 },
  };

  for(const [id, lm] of GCCLandmarks.all()){
    const hit = GCCLandmarks.hex(id);
    if(!hit) continue;
    const {x:mx, y:my} = hexCenter(hit.col, hit.row);
    const {x, y} = mapToStage(mx, my);
    const style = KIND_STYLE[lm.kind] || KIND_STYLE.feature;
    let mark;
    switch(style.shape){
      case 'circle': {
        mark = document.createElementNS(ns,'circle');
        mark.setAttribute('cx', x.toFixed(1));
        mark.setAttribute('cy', y.toFixed(1));
        mark.setAttribute('r',  style.r);
        break;
      }
      case 'square': {
        mark = document.createElementNS(ns,'rect');
        mark.setAttribute('x', (x - style.s/2).toFixed(1));
        mark.setAttribute('y', (y - style.s/2).toFixed(1));
        mark.setAttribute('width',  style.s);
        mark.setAttribute('height', style.s);
        break;
      }
      case 'diamond': {
        mark = document.createElementNS(ns,'polygon');
        const s = style.s;
        mark.setAttribute('points',
          `${x},${y-s} ${x+s},${y} ${x},${y+s} ${x-s},${y}`);
        break;
      }
      case 'x': {
        mark = document.createElementNS(ns,'path');
        const s = style.s;
        mark.setAttribute('d',
          `M${x-s},${y-s} L${x+s},${y+s} M${x+s},${y-s} L${x-s},${y+s}`);
        mark.setAttribute('fill','none');
        break;
      }
    }
    if(style.fill && style.shape !== 'x') mark.setAttribute('fill',  style.fill);
    if(style.stroke) mark.setAttribute('stroke', style.stroke);
    if(style.sw)     mark.setAttribute('stroke-width', style.sw);
    mark.setAttribute('class', 'landmark-mark');
    mark.dataset.id = id;
    g.appendChild(mark);

    // Label below the marker
    const label = document.createElementNS(ns,'text');
    label.setAttribute('x', x.toFixed(1));
    label.setAttribute('y', (y + 9).toFixed(1));
    label.setAttribute('text-anchor','middle');
    label.setAttribute('class','landmark-label');
    label.textContent = lm.name;
    g.appendChild(label);
  }
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDIT 3 — Add CSS for landmark labels (inside the <style> block)
// ═══════════════════════════════════════════════════════════════════════════════
//
// FIND in <style>:
//   .hex-label { font-family:'Cinzel',serif; font-size:5px; ... }
//
// INSERT AFTER:
/*
  .landmark-mark  { filter: drop-shadow(0 0 2px rgba(0,0,0,.5)); }
  .landmark-label { font-family:'Cinzel',serif; font-size:4.5px; font-weight:600;
                    fill:#2a1a08; stroke:#f4e4b8; stroke-width:0.3;
                    paint-order:stroke; text-anchor:middle;
                    pointer-events:none; letter-spacing:.05em; }
*/

// ═══════════════════════════════════════════════════════════════════════════════
// EDIT 4 — Include gcc-landmarks.js before the main init script
// ═══════════════════════════════════════════════════════════════════════════════
//
// FIND at the bottom of greyhawk-map.html:
//   <script src="gcc-data.js"></script>
//   <script src="gcc-header.js"></script>
//
// INSERT BEFORE gcc-data.js line:
//   <script src="gcc-landmarks.js"></script>
//
// Actually — gcc-landmarks.js needs to load BEFORE the inline init script that
// calls buildHexGrid. Since the inline script runs on `window.load`, any script
// tag at the bottom of <body> will be loaded in time. Place it anywhere after
// the inline script block but before </body>, or (cleaner) add it right before
// the inline script block:
//
//   <script src="gcc-landmarks.js"></script>
//   <script>
//   // ── FIXED CANONICAL GRID ────...
//
// ═══════════════════════════════════════════════════════════════════════════════
// EDIT 5 — Update onHexHover / updateSidePanel to show landmark name
// ═══════════════════════════════════════════════════════════════════════════════
//
// FIND:
//   function onHexHover(mx,my){
//     if(state.calMode) return;
//     const hit=mapToHex(mx,my);
//     if(!hit) return;
//     document.getElementById('coords').textContent=
//       `${hexIdStr(hit.col,hit.row)}  ·  ${TERRAIN[getHexTerrain(hit.col,hit.row)]?.label}  ·  ${getRegion(hit.col,hit.row)}`;
//   }
//
// REPLACE with:
/*
  function onHexHover(mx,my){
    if(state.calMode) return;
    const hit=mapToHex(mx,my);
    if(!hit) return;
    const lm = (typeof GCCLandmarks !== 'undefined')
      ? GCCLandmarks.getByHex(hit.col, hit.row) : null;
    const base = `${hexIdStr(hit.col,hit.row)}  ·  ${TERRAIN[getHexTerrain(hit.col,hit.row)]?.label}  ·  ${getRegion(hit.col,hit.row)}`;
    document.getElementById('coords').textContent = lm ? `${lm.name}  ·  ${base}` : base;
  }
*/
//
// FIND in updateSidePanel:
//   document.getElementById('panel-hex-id').textContent=hexIdStr(col,row);
//
// REPLACE with:
/*
    const _id = hexIdStr(col,row);
    const _lm = (typeof GCCLandmarks !== 'undefined') ? GCCLandmarks.getById(_id) : null;
    document.getElementById('panel-hex-id').textContent = _lm ? `${_lm.name} (${_id})` : _id;
*/

// ═══════════════════════════════════════════════════════════════════════════════
// COMMIT MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════
/*
Add landmark overlay: Darlene-ID-keyed city data, drawn on grid

* gcc-landmarks.js (new):
  - GH_LANDMARKS table keyed by Darlene hex ID (D4-86, H4-89, etc.)
  - Seeded with 4 anchor cities verified against 27MB scan:
    Greyhawk, Dyvers, Hardby, Niole Dra
  - Commented TODO list of additional cities to transcribe from LGG
  - GCCLandmarks global API: getById, getByHex, all, hex

* greyhawk-map.html:
  - Load gcc-landmarks.js before inline map script
  - buildLandmarkOverlay: draws per-kind symbols (city/town/castle/
    ruin/village/feature/landmark) at each landmark's true hex center,
    with labels below. Marker kind drives shape and color.
  - buildHexGrid: inject overlay group between labels and party marker
    so it renders above hexes but below party
  - onHexHover / updateSidePanel: prefix hex ID with landmark name when
    present, so hovering Greyhawk's hex shows "City of Greyhawk · D4-86"
  - CSS: landmark-mark drop shadow, landmark-label with parchment
    stroke for readability over any terrain color
*/

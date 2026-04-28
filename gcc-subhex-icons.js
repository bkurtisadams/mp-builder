// gcc-subhex-icons.js v0.4.0 — 2026-04-28
// Terrain icon registry for the subhex window. One small SVG glyph per
// terrain type, stamped into each cell at a deterministic-jittered
// position so identical-terrain neighbors don't form a polka-dot grid.
// Style mirrors the line-art Darlene/Greyhawk vibe: single-color ink
// strokes, no fills except mountains. Cell radius ~26 viewbox units;
// icons sized for ~14 unit footprint with the cell.
//
// Phase A icon set (7): hills, mountains, hardwood, forest/conifer,
// swamp, plains, clear. Other terrains (jungle, desert, barrens,
// forest_hills, water_*) fall through to the closest match or render
// no icon — color fill carries the cell.
//
// Public API:
//   GCCSubhexIcons.append(parentG, terrain, cx, cy, subR, q, r)
//     Appends icon child elements to parentG (SVG <g>) at the cell
//     center, with deterministic jitter seeded on (q, r). No-op if
//     terrain has no icon.

(function(){
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  // Map every terrain key to a glyph kind. Keys not in this map render
  // no icon. Keep the kinds small — visual grouping > visual variety
  // at this scale.
  const TERRAIN_TO_GLYPH = {
    hills:        'hills',
    forest_hills: 'hills',
    mountains:    'mountains',
    forest:       'conifer',
    conifer:      'conifer',
    hardwood:     'hardwood',
    jungle:       'hardwood',
    swamp:        'swamp',
    plains:       'plains',
    desert:       'dunes',
    barrens:      'barrens',
    // clear and water_* render no icon — flat fill speaks for itself.
  };

  const INK = {
    hills:     '#3a2410',
    mountains: '#1a0a00',
    conifer:   '#0a2010',
    hardwood:  '#0a2810',
    swamp:     '#2a3a10',
    plains:    '#3a4a10',
    dunes:     '#5a4015',
    barrens:   '#4a3a18',
  };

  function el(tag, attrs){
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    e.setAttribute('class', (attrs.class ? attrs.class + ' ' : '') + 'sxw-icon');
    e.style.pointerEvents = 'none';
    return e;
  }

  // Glyph builders. Each takes (g, cx, cy, s) where s is half the
  // visual footprint (≈ SUB_R * 0.42 by default, set in append()).
  const GLYPHS = {
    hills(g, cx, cy, s){
      const ink = INK.hills;
      // Three little arcs in a "^^^" run, slightly varied heights.
      const d = `M ${cx - s*1.1} ${cy + s*0.3}` +
                ` Q ${cx - s*0.75} ${cy - s*0.45} ${cx - s*0.4} ${cy + s*0.3}` +
                ` Q ${cx - s*0.05} ${cy - s*0.55} ${cx + s*0.3} ${cy + s*0.3}` +
                ` Q ${cx + s*0.65} ${cy - s*0.45} ${cx + s*1.0} ${cy + s*0.3}`;
      g.appendChild(el('path', { d, fill: 'none', stroke: ink, 'stroke-width': '1.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    },
    mountains(g, cx, cy, s){
      const ink = INK.mountains;
      // Jagged peak silhouette filled.
      const d = `M ${cx - s} ${cy + s*0.55}` +
                ` L ${cx - s*0.35} ${cy - s*0.7}` +
                ` L ${cx + s*0.05} ${cy - s*0.05}` +
                ` L ${cx + s*0.55} ${cy - s*0.45}` +
                ` L ${cx + s} ${cy + s*0.55} Z`;
      g.appendChild(el('path', { d, fill: ink, stroke: ink, 'stroke-width': '0.6', 'stroke-linejoin': 'round' }));
    },
    hardwood(g, cx, cy, s){
      const ink = INK.hardwood;
      // Round canopy + tiny trunk.
      g.appendChild(el('line', { x1: cx, y1: cy + s*0.2, x2: cx, y2: cy + s*0.7, stroke: ink, 'stroke-width': '1.2', 'stroke-linecap': 'round' }));
      g.appendChild(el('circle', { cx, cy: cy - s*0.1, r: s*0.55, fill: ink }));
    },
    conifer(g, cx, cy, s){
      const ink = INK.conifer;
      // Triangular canopy + trunk.
      g.appendChild(el('line', { x1: cx, y1: cy + s*0.2, x2: cx, y2: cy + s*0.7, stroke: ink, 'stroke-width': '1.2', 'stroke-linecap': 'round' }));
      const d = `M ${cx} ${cy - s*0.85} L ${cx - s*0.6} ${cy + s*0.25} L ${cx + s*0.6} ${cy + s*0.25} Z`;
      g.appendChild(el('path', { d, fill: ink }));
    },
    swamp(g, cx, cy, s){
      const ink = INK.swamp;
      // Stylized reeds and a low wave.
      g.appendChild(el('path', {
        d: `M ${cx - s*0.85} ${cy + s*0.35} Q ${cx - s*0.4} ${cy - s*0.05} ${cx} ${cy + s*0.35} Q ${cx + s*0.4} ${cy - s*0.05} ${cx + s*0.85} ${cy + s*0.35}`,
        fill: 'none', stroke: ink, 'stroke-width': '1.0', 'stroke-linecap': 'round',
      }));
      g.appendChild(el('line', { x1: cx - s*0.35, y1: cy - s*0.45, x2: cx - s*0.35, y2: cy - s*0.05, stroke: ink, 'stroke-width': '0.9' }));
      g.appendChild(el('line', { x1: cx + s*0.35, y1: cy - s*0.45, x2: cx + s*0.35, y2: cy - s*0.05, stroke: ink, 'stroke-width': '0.9' }));
    },
    plains(g, cx, cy, s){
      const ink = INK.plains;
      // Faint grass tuft — three short verticals.
      g.appendChild(el('line', { x1: cx - s*0.3, y1: cy + s*0.35, x2: cx - s*0.2, y2: cy - s*0.05, stroke: ink, 'stroke-width': '0.8', 'stroke-linecap': 'round' }));
      g.appendChild(el('line', { x1: cx, y1: cy + s*0.35, x2: cx, y2: cy - s*0.2, stroke: ink, 'stroke-width': '0.8', 'stroke-linecap': 'round' }));
      g.appendChild(el('line', { x1: cx + s*0.3, y1: cy + s*0.35, x2: cx + s*0.2, y2: cy - s*0.05, stroke: ink, 'stroke-width': '0.8', 'stroke-linecap': 'round' }));
    },
    dunes(g, cx, cy, s){
      const ink = INK.dunes;
      // Two low arches.
      g.appendChild(el('path', {
        d: `M ${cx - s} ${cy + s*0.2} Q ${cx - s*0.5} ${cy - s*0.15} ${cx} ${cy + s*0.2} Q ${cx + s*0.5} ${cy - s*0.15} ${cx + s} ${cy + s*0.2}`,
        fill: 'none', stroke: ink, 'stroke-width': '1.0', 'stroke-linecap': 'round',
      }));
    },
    barrens(g, cx, cy, s){
      const ink = INK.barrens;
      // Scattered dots.
      const dots = [[-0.6, 0.1], [-0.1, -0.3], [0.4, 0.2], [0.6, -0.4], [0.0, 0.4]];
      for (const [dx, dy] of dots){
        g.appendChild(el('circle', { cx: cx + s*dx, cy: cy + s*dy, r: '0.9', fill: ink }));
      }
    },
  };

  function append(parentG, terrain, cx, cy, subR, q, r){
    if (!parentG || !terrain) return;
    const kind = TERRAIN_TO_GLYPH[terrain];
    if (!kind || !GLYPHS[kind]) return;
    // Deterministic jitter seeded on (q,r). Range ±20% of subR keeps
    // the icon comfortably inside the cell at any orientation.
    let jx = 0, jy = 0;
    if (window.GCCRng){
      const h = window.GCCRng.cyrb53(`subhex-icon|${q}|${r}`, 0);
      jx = (((h & 0xff) / 255) - 0.5) * subR * 0.25;
      jy = ((((h >>> 8) & 0xff) / 255) - 0.5) * subR * 0.25;
    }
    const s = subR * 0.42;
    GLYPHS[kind](parentG, cx + jx, cy + jy, s);
  }

  window.GCCSubhexIcons = { append, TERRAIN_TO_GLYPH };
})();

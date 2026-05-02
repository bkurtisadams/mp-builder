// gcc-coast-scanner.js v0.1.0 — 2026-05-02
//
// Scans the Darlene map image and classifies each subhex cell of a
// parent hex as water-vs-land, writing subhex overrides for the water
// cells. Sole feature: water/coast detection by HSV threshold on
// pixel samples taken at each subhex center.
//
// The Darlene image is positioned in the page via a CSS transform
// (imgX in greyhawk-map.html). To sample the right pixel for a given
// subhex SVG center, we invert that transform: SVG world → pre-transform
// image pixel, then read from a hidden canvas drawn at the image's
// natural size.
//
// Public API (single-parent MVP):
//   GCCCoastScanner.openPreview(col, row)
//     Open a modal dialog showing the scan result for parent (col, row).
//     Operator can adjust the threshold, preview the classification,
//     and apply it as subhex overrides (source='scanner-coast-v1').
//
//   GCCCoastScanner.scanParent(col, row, opts) → { results, summary }
//     Headless scan returning [{Q, R, isWater, terrain, alreadyAuthored}, …].
//     opts.threshold = HSV thresholds (see DEFAULT_THRESHOLDS).
//
//   GCCCoastScanner.applyResults(results) → { written, skipped }
//     Write water overrides for all results where isWater=true and the
//     cell isn't already authored. Skips authored cells unless
//     opts.overwriteAuthored=true.
//
// Coordinate flow:
//   subhex (Q,R) ──subhexSvgCenter──> world SVG (x,y)
//   world SVG (x,y) ──invert imgX──> image pixel (px,py)
//   image pixel ──canvas getImageData──> RGB
//   RGB ──rgbToHsv → threshold──> isWater bool
//
// Calibration baseline: HSV with H ∈ [180°, 230°], S > 0.20, V ∈ [0.30, 0.85]
// works well against Darlene's blue water palette without picking up
// the parchment background or shaded mountains. Threshold can be
// adjusted live in the preview panel.

(function(){
  'use strict';

  // ── Defaults ────────────────────────────────────────────────────────
  const DEFAULT_THRESHOLDS = {
    hMin: 180, hMax: 230,
    sMin: 0.20, sMax: 1.00,
    vMin: 0.30, vMax: 0.85,
  };
  const SAMPLE_RADIUS_PX = 2;     // average over a (2r+1)x(2r+1) window
  const SOURCE_TAG = 'scanner-coast-v1';

  // ── Internal canvas (cached) ────────────────────────────────────────
  // We draw the Darlene image into a canvas at natural size once, then
  // sample from it for as many parents as needed. Re-draws if the image
  // src changes (rare). The canvas is hidden — never inserted into DOM.
  let _canvas = null, _ctx = null, _imgSrc = null, _imgNW = 0, _imgNH = 0;
  function ensureCanvas(){
    const img = document.getElementById('map-img');
    if (!img || !img.naturalWidth) return null;
    if (_canvas && _imgSrc === img.src && _imgNW === img.naturalWidth) return _ctx;
    _canvas = document.createElement('canvas');
    _canvas.width  = img.naturalWidth;
    _canvas.height = img.naturalHeight;
    _ctx = _canvas.getContext('2d', { willReadFrequently: true });
    _ctx.drawImage(img, 0, 0);
    _imgSrc = img.src;
    _imgNW = img.naturalWidth;
    _imgNH = img.naturalHeight;
    return _ctx;
  }

  // ── Coordinate transforms ───────────────────────────────────────────
  // Invert the imgX transform to map world SVG coords → image pixel coords.
  // imgX is `translate(tx, ty) rotate(rot) scale(sx, sy)` with origin at
  // image center, so:
  //   pixel = M^-1 · (svg - imgCenter) + imgNaturalCenter
  // where M is the rotate*scale composition.
  function svgToImagePixel(svgX, svgY){
    const img = document.getElementById('map-img');
    if (!img) return null;
    // imgX is declared in greyhawk-map.html's top-level script as a
    // `const`. It lives in the shared lexical scope of all <script>
    // tags loaded into the page (this module is one of them). Read
    // defensively in case of ES-module loading or test harnesses.
    let X = null;
    try { if (typeof imgX !== 'undefined') X = imgX; } catch(e){}
    if (!X) X = { tx:0, ty:0, sx:1, sy:1, rot:0 };
    // Image's pre-transform position: top-left at (0,0) in the same
    // SVG-stage coord system. Center is (nw/2, nh/2). The CSS
    // transform translates (tx, ty), rotates rot°, scales (sx, sy)
    // around center. Inverse:
    const cx = img.naturalWidth  / 2;
    const cy = img.naturalHeight / 2;
    // 1. Subtract translation. The translation moves the *center* of
    //    the transformed image.
    let x = svgX - cx - X.tx;
    let y = svgY - cy - X.ty;
    // 2. Inverse rotate.
    const a = -X.rot * Math.PI / 180;
    const ca = Math.cos(a), sa = Math.sin(a);
    const xr = x*ca - y*sa;
    const yr = x*sa + y*ca;
    // 3. Inverse scale.
    x = xr / X.sx;
    y = yr / X.sy;
    // 4. Add center back to get pre-transform pixel coords.
    return { px: x + cx, py: y + cy };
  }

  // ── Color classification ────────────────────────────────────────────
  function rgbToHsv(r, g, b){
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d > 0){
      if      (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else                h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : d / max;
    return { h, s, v: max };
  }
  function isWaterRgb(r, g, b, T){
    const { h, s, v } = rgbToHsv(r, g, b);
    return h >= T.hMin && h <= T.hMax
        && s >= T.sMin && s <= T.sMax
        && v >= T.vMin && v <= T.vMax;
  }

  // Sample at (px, py) with a (2r+1)x(2r+1) average. Out-of-bounds
  // pixels skip; if all pixels are out, return null.
  function samplePixel(ctx, px, py){
    const r = SAMPLE_RADIUS_PX;
    const ix = Math.round(px), iy = Math.round(py);
    let rs = 0, gs = 0, bs = 0, n = 0;
    for (let dy = -r; dy <= r; dy++){
      for (let dx = -r; dx <= r; dx++){
        const x = ix + dx, y = iy + dy;
        if (x < 0 || y < 0 || x >= ctx.canvas.width || y >= ctx.canvas.height) continue;
        const d = ctx.getImageData(x, y, 1, 1).data;
        rs += d[0]; gs += d[1]; bs += d[2]; n++;
      }
    }
    if (n === 0) return null;
    return { r: rs/n, g: gs/n, b: bs/n };
  }

  // Pick the right water variant for a subhex based on the parent's
  // terrain. Identity if the parent is itself a water terrain; falls
  // back to water_fresh for inland (forest/plains/etc.) parents that
  // contain small lakes.
  function waterVariantForParent(parentTerrain){
    if (!parentTerrain) return 'water_fresh';
    if (parentTerrain === 'water')              return 'water_fresh';
    if (parentTerrain.startsWith('water_'))     return parentTerrain;
    return 'water_fresh';
  }

  // ── Scan one parent ─────────────────────────────────────────────────
  function scanParent(col, row, opts){
    opts = opts || {};
    const T = Object.assign({}, DEFAULT_THRESHOLDS, opts.threshold || {});
    const ctx = ensureCanvas();
    if (!ctx){
      return { error: 'map image not ready', results: [], summary: null };
    }
    if (!window.GCCSubhexData){
      return { error: 'GCCSubhexData not loaded', results: [], summary: null };
    }
    const SD = window.GCCSubhexData;
    const cells = SD.ownedByParent(col, row);
    const parentTerrain = (typeof window.getHexTerrain === 'function')
      ? window.getHexTerrain(col, row) : null;
    const waterVariant = waterVariantForParent(parentTerrain);

    const results = [];
    let waterN = 0, landN = 0, sampleFails = 0, alreadyN = 0;
    for (const { Q, R } of cells){
      const svg = SD.subhexSvgCenter(Q, R);
      const pix = svgToImagePixel(svg.x, svg.y);
      if (!pix){ sampleFails++; continue; }
      const rgb = samplePixel(ctx, pix.px, pix.py);
      if (!rgb){ sampleFails++; continue; }
      const isWater = isWaterRgb(rgb.r, rgb.g, rgb.b, T);
      const sub = SD.getSubhex(Q, R, parentTerrain);
      const alreadyAuthored = sub && sub.source === 'authored';
      results.push({
        Q, R,
        rgb,
        isWater,
        terrain: isWater ? waterVariant : null,
        alreadyAuthored,
      });
      if (alreadyAuthored) alreadyN++;
      if (isWater) waterN++; else landN++;
    }
    return {
      results,
      summary: {
        col, row,
        parentTerrain,
        waterVariant,
        cellCount: cells.length,
        water: waterN,
        land: landN,
        sampleFails,
        alreadyAuthored: alreadyN,
        threshold: T,
      },
    };
  }

  // ── Apply results to overrides ──────────────────────────────────────
  function applyResults(results, opts){
    opts = opts || {};
    const overwriteAuthored = !!opts.overwriteAuthored;
    if (!window.GCCSubhexData) return { written: 0, skipped: 0, error: 'no data layer' };
    const SD = window.GCCSubhexData;
    let written = 0, skipped = 0;
    for (const r of results){
      if (!r.isWater) continue;
      if (r.alreadyAuthored && !overwriteAuthored){ skipped++; continue; }
      SD.setSubhexOverride(r.Q, r.R, {
        terrain: r.terrain,
        source: SOURCE_TAG,
      });
      written++;
    }
    return { written, skipped };
  }

  // ── Preview UI ──────────────────────────────────────────────────────
  // A small modal: parent label, threshold sliders, preview canvas,
  // counts, Apply / Cancel buttons. Reuses the page's gold/parchment
  // styling (themed to the map page chrome).
  let _previewState = null;

  function openPreview(col, row){
    if (col == null || row == null){
      // Default to the currently selected hex if any. See the click
      // handler below for why we read bare `state` rather than
      // `window.state` — the page's state lives in the script's
      // lexical scope, not on window.
      try {
        if (typeof state !== 'undefined' && state && state.selectedCol != null){
          col = state.selectedCol;
          row = state.selectedRow;
        }
      } catch(e){ /* not in scope */ }
      if (col == null){
        alert('Pick a parent hex first (click one on the map), then run the coast scanner.');
        return;
      }
    }
    closePreview();
    _previewState = { col, row, threshold: Object.assign({}, DEFAULT_THRESHOLDS), results: null };
    buildPreviewDOM();
    runPreview();
  }

  function closePreview(){
    const ex = document.getElementById('coast-scanner-modal');
    if (ex) ex.remove();
    _previewState = null;
  }

  function buildPreviewDOM(){
    const wrap = document.createElement('div');
    wrap.id = 'coast-scanner-modal';
    wrap.style.cssText = `
      position:fixed; top:50%; left:50%;
      transform:translate(-50%, -50%);
      background:#120900; color:#f4e8c4;
      border:1px solid #c8941a; border-radius:3px;
      padding:14px 16px; z-index:400;
      min-width:480px; max-width:560px;
      box-shadow:0 10px 50px rgba(0,0,0,.85);
      font-family:'Crimson Text', Georgia, serif;
    `;
    const id = (typeof hexIdStr === 'function') ? hexIdStr(_previewState.col, _previewState.row)
      : `${_previewState.col},${_previewState.row}`;
    wrap.innerHTML = `
      <div style="font-family:'Cinzel',serif; font-size:14px; color:#e8b840; letter-spacing:.06em; text-transform:uppercase; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #5a4a30; display:flex; justify-content:space-between; align-items:baseline;">
        <span>Coast Scanner · ${id}</span>
        <span style="cursor:pointer; color:#c8a070; font-size:18px;" id="cs-close">×</span>
      </div>
      <div id="cs-summary" style="font-size:13px; line-height:1.5; margin-bottom:10px;">scanning…</div>
      <canvas id="cs-canvas" width="320" height="320" style="display:block; margin:0 auto 10px; border:1px solid #5a4a30; background:#000;"></canvas>
      <div style="font-size:11px; color:#c8a070; margin-bottom:8px; line-height:1.4;">Blue overlay = classified water · Red dot = sample fail · No overlay = land</div>
      <div style="font-size:11px; line-height:1.6; margin-bottom:10px;">
        <div style="display:grid; grid-template-columns:60px 1fr 60px; gap:4px 8px; align-items:center;">
          <label>Hue min</label>
            <input type="range" id="cs-hmin" min="0" max="360" value="${DEFAULT_THRESHOLDS.hMin}" style="width:100%;">
            <span id="cs-hmin-v">${DEFAULT_THRESHOLDS.hMin}°</span>
          <label>Hue max</label>
            <input type="range" id="cs-hmax" min="0" max="360" value="${DEFAULT_THRESHOLDS.hMax}" style="width:100%;">
            <span id="cs-hmax-v">${DEFAULT_THRESHOLDS.hMax}°</span>
          <label>Sat min</label>
            <input type="range" id="cs-smin" min="0" max="100" value="${Math.round(DEFAULT_THRESHOLDS.sMin*100)}" style="width:100%;">
            <span id="cs-smin-v">${Math.round(DEFAULT_THRESHOLDS.sMin*100)}%</span>
          <label>Val min</label>
            <input type="range" id="cs-vmin" min="0" max="100" value="${Math.round(DEFAULT_THRESHOLDS.vMin*100)}" style="width:100%;">
            <span id="cs-vmin-v">${Math.round(DEFAULT_THRESHOLDS.vMin*100)}%</span>
          <label>Val max</label>
            <input type="range" id="cs-vmax" min="0" max="100" value="${Math.round(DEFAULT_THRESHOLDS.vMax*100)}" style="width:100%;">
            <span id="cs-vmax-v">${Math.round(DEFAULT_THRESHOLDS.vMax*100)}%</span>
        </div>
      </div>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button id="cs-cancel" style="background:transparent; color:#f4e8c4; border:1px solid #8b6a30; border-radius:3px; padding:6px 14px; font-family:inherit; font-size:13px; cursor:pointer;">Close</button>
        <button id="cs-apply" style="background:#5a3a0a; color:#f4e8c4; border:1px solid #c8941a; border-radius:3px; padding:6px 14px; font-family:inherit; font-size:13px; cursor:pointer; font-weight:600;">Apply water overrides</button>
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('cs-close').addEventListener('click', closePreview);
    document.getElementById('cs-cancel').addEventListener('click', closePreview);
    document.getElementById('cs-apply').addEventListener('click', onApplyClick);
    for (const ctl of ['hmin','hmax','smin','vmin','vmax']){
      const el = document.getElementById('cs-' + ctl);
      el.addEventListener('input', () => { onSliderInput(ctl); });
    }
    // Esc dismiss
    document.addEventListener('keydown', _onCsKey, true);
  }

  function _onCsKey(e){
    if (e.key === 'Escape' && document.getElementById('coast-scanner-modal')){
      e.preventDefault(); e.stopPropagation();
      closePreview();
      document.removeEventListener('keydown', _onCsKey, true);
    }
  }

  function onSliderInput(name){
    const T = _previewState.threshold;
    const v = parseFloat(document.getElementById('cs-' + name).value);
    if (name === 'hmin'){ T.hMin = v; document.getElementById('cs-hmin-v').textContent = v + '°'; }
    if (name === 'hmax'){ T.hMax = v; document.getElementById('cs-hmax-v').textContent = v + '°'; }
    if (name === 'smin'){ T.sMin = v/100; document.getElementById('cs-smin-v').textContent = v + '%'; }
    if (name === 'vmin'){ T.vMin = v/100; document.getElementById('cs-vmin-v').textContent = v + '%'; }
    if (name === 'vmax'){ T.vMax = v/100; document.getElementById('cs-vmax-v').textContent = v + '%'; }
    runPreview();
  }

  function runPreview(){
    if (!_previewState) return;
    const { col, row, threshold } = _previewState;
    const out = scanParent(col, row, { threshold });
    _previewState.results = out.results;
    const sumEl = document.getElementById('cs-summary');
    if (out.error){
      sumEl.textContent = 'Error: ' + out.error;
      return;
    }
    const s = out.summary;
    sumEl.innerHTML = `
      <div>Parent: <b>${s.parentTerrain || '(unknown)'}</b> · would write as <b>${s.waterVariant}</b></div>
      <div>${s.cellCount} cells · <span style="color:#6dc8c8;">${s.water} water</span> · <span style="color:#c8a070;">${s.land} land</span> ·
        ${s.sampleFails ? `<span style="color:#e07070;">${s.sampleFails} sample fail</span> · ` : ''}
        ${s.alreadyAuthored ? `<span style="color:#e8b840;">${s.alreadyAuthored} already authored (will skip)</span>` : ''}
      </div>
    `;
    drawPreviewCanvas();
  }

  function drawPreviewCanvas(){
    if (!_previewState) return;
    const cv = document.getElementById('cs-canvas');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const ctx2 = ensureCanvas();
    if (!ctx2){
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,cv.width,cv.height);
      ctx.fillStyle = '#e07070'; ctx.font = '14px sans-serif'; ctx.fillText('Image not loaded', 10, 30);
      return;
    }
    // Compute the parent's image-pixel bounding box from its 6 corners.
    const SD = window.GCCSubhexData;
    const center = SD.parentSvgCenter(_previewState.col, _previewState.row);
    const HEX_R = SD.HEX_R || 20;     // hex radius in SVG units (data layer constant)
    const SQRT3 = Math.sqrt(3);
    const corners = [];
    for (let i = 0; i < 6; i++){
      const a = (Math.PI / 180) * (60 * i);
      corners.push({ x: center.x + HEX_R*Math.cos(a), y: center.y + HEX_R*Math.sin(a) });
    }
    let minPx = Infinity, minPy = Infinity, maxPx = -Infinity, maxPy = -Infinity;
    for (const c of corners){
      const p = svgToImagePixel(c.x, c.y);
      if (!p) continue;
      minPx = Math.min(minPx, p.px); maxPx = Math.max(maxPx, p.px);
      minPy = Math.min(minPy, p.py); maxPy = Math.max(maxPy, p.py);
    }
    const pad = 6;
    minPx -= pad; minPy -= pad; maxPx += pad; maxPy += pad;
    const srcW = maxPx - minPx, srcH = maxPy - minPy;
    if (srcW <= 0 || srcH <= 0){
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,cv.width,cv.height);
      return;
    }
    const scale = Math.min(cv.width / srcW, cv.height / srcH);
    const drawW = srcW * scale, drawH = srcH * scale;
    const offX = (cv.width - drawW) / 2, offY = (cv.height - drawH) / 2;
    // Background
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,cv.width,cv.height);
    // Draw the cropped region of the source image.
    ctx.drawImage(ctx2.canvas,
      Math.max(0, minPx), Math.max(0, minPy),
      Math.min(srcW, ctx2.canvas.width - minPx),
      Math.min(srcH, ctx2.canvas.height - minPy),
      offX, offY, drawW, drawH);
    // Overlay each subhex result.
    const results = _previewState.results || [];
    for (const r of results){
      const svg = SD.subhexSvgCenter(r.Q, r.R);
      const pix = svgToImagePixel(svg.x, svg.y);
      if (!pix) continue;
      const x = offX + (pix.px - minPx) * scale;
      const y = offY + (pix.py - minPy) * scale;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2*Math.PI);
      if (r.isWater){
        ctx.fillStyle = 'rgba(50,160,255,0.55)';
        ctx.strokeStyle = 'rgba(120,200,255,0.95)';
      } else {
        ctx.fillStyle = 'rgba(180,140,60,0.30)';
        ctx.strokeStyle = 'rgba(220,180,100,0.65)';
      }
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function onApplyClick(){
    if (!_previewState || !_previewState.results) return;
    const out = applyResults(_previewState.results);
    alert(`Wrote ${out.written} water override${out.written === 1 ? '' : 's'}` +
      (out.skipped ? `, skipped ${out.skipped} already-authored cell${out.skipped === 1 ? '' : 's'}.` : '.'));
    closePreview();
    // Notify the rest of the app that subhex data changed.
    window.dispatchEvent(new CustomEvent('gcc-subhex-changed', { detail: { reason: 'coast-scanner' } }));
  }

  // ── Public surface ──────────────────────────────────────────────────
  window.GCCCoastScanner = {
    DEFAULT_THRESHOLDS,
    SOURCE_TAG,
    rgbToHsv, isWaterRgb, svgToImagePixel,
    waterVariantForParent,
    scanParent, applyResults,
    openPreview, closePreview,
  };

  // ── Toolbar button auto-wire ────────────────────────────────────────
  function wireButton(){
    const btn = document.getElementById('btn-coast-scan');
    if (!btn) return false;
    if (btn.dataset.coastWired) return true;
    btn.dataset.coastWired = '1';
    btn.addEventListener('click', () => {
      // The page's top-level state object holds selectedCol/Row. It's
      // declared as a `const` at the page's script scope — reachable
      // here because we're loaded via a plain <script src=> into the
      // same global execution context. Read defensively in case the
      // module ever gets loaded as an ES module.
      let col = null, row = null;
      try {
        if (typeof state !== 'undefined' && state){
          col = state.selectedCol;
          row = state.selectedRow;
        }
      } catch(e){ /* state not in scope — leave col/row null */ }
      if (col == null || row == null){
        alert('Click a parent hex first, then run the Coast Scanner on it.');
        return;
      }
      openPreview(col, row);
    });
    return true;
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', wireButton);
  } else {
    wireButton();
  }
})();

// mp-canvas.js v2.2.0 — Cell-painting canvas for system space assignment

const CELL_PX = 28;

class FloorPlanEditor {
  constructor(canvasEl, wrapEl, vehicle) {
    this.canvas = canvasEl;
    this.wrap = wrapEl;
    this.ctx = canvasEl.getContext("2d");
    this.veh = vehicle;

    this.mode = "select";   // "select" | "paint" | "erase"
    this.activeSysId = null; // system id being painted

    this.panX = 0;
    this.panY = 0;
    this.panStart = null;
    this.zoom = 1.0;
    this.painting = false;  // mouse held down in paint mode

    this.hoverGx = null;
    this.hoverGy = null;
    this.selectedCell = null; // {gx, gy, sysId} for Delete key

    this.onUpdate = null;

    // Silhouette overlay
    this._silImg = null;      // loaded Image element
    this._silDrag = null;     // {type:"move"|"resize", startGx, startGy, origSil}
    this._silHover = "";      // "" | "move" | "resize"

    this._bind();
    this._resize();
    this.draw();
  }

  _bind() {
    this.canvas.addEventListener("mousemove", e => this._onMouseMove(e));
    this.canvas.addEventListener("mousedown", e => this._onMouseDown(e));
    this.canvas.addEventListener("mouseup", e => this._onMouseUp(e));
    this.canvas.addEventListener("mouseleave", () => {
      this.hoverGx = null; this.hoverGy = null;
      this.painting = false; this.panStart = null;
      this.draw();
    });
    this.canvas.addEventListener("wheel", e => this._onWheel(e), { passive: false });
    this.canvas.addEventListener("contextmenu", e => e.preventDefault());
    this._keyHandler = e => this._onKey(e);
    window.addEventListener("keydown", this._keyHandler);
    this._resizeObs = new ResizeObserver(() => { this._resize(); this.draw(); });
    this._resizeObs.observe(this.wrap);
  }

  destroy() {
    if (this._keyHandler) window.removeEventListener("keydown", this._keyHandler);
    if (this._resizeObs) this._resizeObs.disconnect();
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(this.wrap.clientWidth * dpr);
    const h = Math.round(this.wrap.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
    }
    this.canvas.style.width = this.wrap.clientWidth + "px";
    this.canvas.style.height = this.wrap.clientHeight + "px";
    this.ctx = this.canvas.getContext("2d");
  }

  _canvasPos(ev) {
    const rect = this.canvas.getBoundingClientRect();
    return { cx: ev.clientX - rect.left, cy: ev.clientY - rect.top };
  }

  _cssToGrid(cx, cy) {
    const cell = CELL_PX * this.zoom;
    return { gx: Math.floor((cx - this.panX) / cell), gy: Math.floor((cy - this.panY) / cell) };
  }

  setMode(mode) {
    this.mode = mode;
    this.painting = false;
    this.canvas.style.cursor = mode === "paint" ? "crosshair" : mode === "erase" ? "not-allowed" : "default";
    this.draw();
  }

  setActiveSys(sysId) {
    this.activeSysId = sysId;
    if (sysId) {
      this.mode = "paint";
      this.canvas.style.cursor = "crosshair";
    }
    this.draw();
  }

  _onMouseMove(ev) {
    const { cx, cy } = this._canvasPos(ev);
    if (this.panStart) {
      this.panX = this.panStart.panX + (ev.clientX - this.panStart.clientX);
      this.panY = this.panStart.panY + (ev.clientY - this.panStart.clientY);
      this.draw();
      return;
    }

    // Silhouette drag in progress
    if (this._silDrag) {
      const cell = CELL_PX * this.zoom;
      const dx = (cx - this._silDrag.startCx) / cell;
      const dy = (cy - this._silDrag.startCy) / cell;
      const sil = this.veh.silhouette;
      if (this._silDrag.type === "move") {
        sil.gx = Math.round((this._silDrag.origGx + dx) * 2) / 2;
        sil.gy = Math.round((this._silDrag.origGy + dy) * 2) / 2;
      } else if (this._silDrag.type === "resize") {
        sil.gw = Math.max(1, Math.round((this._silDrag.origGw + dx) * 2) / 2);
        sil.gh = Math.max(1, Math.round((this._silDrag.origGh + dy) * 2) / 2);
      }
      this.draw();
      if (this.onUpdate) this.onUpdate();
      return;
    }

    const { gx, gy } = this._cssToGrid(cx, cy);
    this.hoverGx = gx;
    this.hoverGy = gy;

    // Cursor updates for sil mode
    if (this.mode === "sil") {
      const hit = this._silhouetteHitTest(cx, cy);
      this._silHover = hit;
      this.canvas.style.cursor = hit === "resize" ? "nwse-resize" : hit === "move" ? "grab" : "default";
    }

    // Drag-paint
    if (this.painting && this.mode === "paint" && this.activeSysId) {
      if (this.veh.paintCell(this.activeSysId, gx, gy)) {
        if (this.onUpdate) this.onUpdate();
      }
    }
    this.draw();
  }

  _onMouseDown(ev) {
    if (ev.button === 2 || ev.button === 1) {
      this.panStart = { clientX: ev.clientX, clientY: ev.clientY, panX: this.panX, panY: this.panY };
      ev.preventDefault();
      return;
    }
    if (ev.button !== 0) return;
    ev.preventDefault();
    const { cx, cy } = this._canvasPos(ev);
    const { gx, gy } = this._cssToGrid(cx, cy);

    // Silhouette mode
    if (this.mode === "sil" && this.veh.silhouette && this._silImg) {
      const hit = this._silhouetteHitTest(cx, cy);
      if (hit) {
        const sil = this.veh.silhouette;
        this._silDrag = {
          type: hit,
          startCx: cx, startCy: cy,
          origGx: sil.gx, origGy: sil.gy,
          origGw: sil.gw, origGh: sil.gh
        };
        this.canvas.style.cursor = hit === "resize" ? "nwse-resize" : "grabbing";
        return;
      }
    }

    // Paint mode
    if (this.mode === "paint" && this.activeSysId) {
      this.painting = true;
      if (this.veh.paintCell(this.activeSysId, gx, gy)) {
        if (this.onUpdate) this.onUpdate();
      }
      this.draw();
      return;
    }

    // Select mode — click a cell to select it
    if (this.mode === "select") {
      const sys = this.veh.cellAt(gx, gy);
      this.selectedCell = sys ? { gx, gy, sysId: sys.id } : null;
      this.draw();
      if (this.onUpdate) this.onUpdate();
    }
  }

  _onMouseUp(ev) {
    if (ev.button === 2 || ev.button === 1) { this.panStart = null; return; }
    if (this._silDrag) {
      this._silDrag = null;
      this.canvas.style.cursor = this.mode === "sil" ? "default" : "default";
      if (this.onUpdate) this.onUpdate();
    }
    this.painting = false;
  }

  _onWheel(ev) {
    ev.preventDefault();
    const { cx, cy } = this._canvasPos(ev);
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.25, Math.min(4, this.zoom * (ev.deltaY < 0 ? 1.12 : 0.89)));
    if (this.zoom === oldZoom) return;
    const ratio = this.zoom / oldZoom;
    this.panX = cx - (cx - this.panX) * ratio;
    this.panY = cy - (cy - this.panY) * ratio;
    this.draw();
  }

  _onKey(ev) {
    if (["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)) return;
    if (ev.key === "Escape") {
      this.setMode("select");
      this.activeSysId = null;
      this.selectedCell = null;
      this.draw();
      if (this.onUpdate) this.onUpdate();
    }
    if ((ev.key === "Delete" || ev.key === "Backspace") && this.mode === "select" && this.selectedCell) {
      ev.preventDefault();
      this.veh.unpaintCell(this.selectedCell.gx, this.selectedCell.gy);
      this.selectedCell = null;
      this.draw();
      if (this.onUpdate) this.onUpdate();
    }
  }

  zoomIn() { this._zoomBy(1.25); }
  zoomOut() { this._zoomBy(0.8); }
  resetView() { this.zoom = 1; this.panX = 40; this.panY = 40; this.draw(); }

  _zoomBy(factor) {
    const cx = this.wrap.clientWidth / 2;
    const cy = this.wrap.clientHeight / 2;
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.25, Math.min(4, this.zoom * factor));
    const ratio = this.zoom / oldZoom;
    this.panX = cx - (cx - this.panX) * ratio;
    this.panY = cy - (cy - this.panY) * ratio;
    this.draw();
  }

  // ---- Silhouette ----
  loadSilhouette(dataUrl, gw, gh) {
    const sil = this.veh.silhouette || {};
    sil.data = dataUrl;
    sil.gx = sil.gx || 0;
    sil.gy = sil.gy || 0;
    sil.gw = gw || 10;
    sil.gh = gh || 8;
    this.veh.silhouette = sil;
    this._silImg = new Image();
    this._silImg.onload = () => this.draw();
    this._silImg.src = dataUrl;
  }

  clearSilhouette() {
    this.veh.silhouette = null;
    this._silImg = null;
    this._silDrag = null;
    this.draw();
  }

  _ensureSilImage() {
    if (this.veh.silhouette && this.veh.silhouette.data && !this._silImg) {
      this._silImg = new Image();
      this._silImg.onload = () => this.draw();
      this._silImg.src = this.veh.silhouette.data;
    }
  }

  _silhouetteHitTest(cx, cy) {
    const sil = this.veh.silhouette;
    if (!sil || !this._silImg) return "";
    const cell = CELL_PX * this.zoom;
    const sx = this.panX + sil.gx * cell;
    const sy = this.panY + sil.gy * cell;
    const sw = sil.gw * cell;
    const sh = sil.gh * cell;
    // Resize handle: 8px square at bottom-right corner
    const hSize = 8;
    if (cx >= sx + sw - hSize && cx <= sx + sw + hSize && cy >= sy + sh - hSize && cy <= sy + sh + hSize) return "resize";
    // Move: anywhere inside
    if (cx >= sx && cx <= sx + sw && cy >= sy && cy <= sy + sh) return "move";
    return "";
  }

  // ---- Drawing ----

  draw() {
    this._ensureSilImage();
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const cell = CELL_PX * this.zoom * dpr;
    const ox = this.panX * dpr;
    const oy = this.panY * dpr;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Silhouette overlay (behind grid)
    const sil = this.veh.silhouette;
    if (sil && this._silImg && this._silImg.complete) {
      const sx = ox + sil.gx * cell;
      const sy = oy + sil.gy * cell;
      const sw = sil.gw * cell;
      const sh = sil.gh * cell;
      ctx.globalAlpha = 0.2;
      ctx.drawImage(this._silImg, sx, sy, sw, sh);
      ctx.globalAlpha = 1;
      // Border
      ctx.strokeStyle = "#00000030";
      ctx.lineWidth = 1;
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.setLineDash([]);
      // Resize handle
      const hSize = 6 * dpr;
      ctx.fillStyle = "#00000040";
      ctx.fillRect(sx + sw - hSize, sy + sh - hSize, hSize * 2, hSize * 2);
    }

    const startGx = Math.floor(-ox / cell);
    const endGx = Math.ceil((W - ox) / cell);
    const startGy = Math.floor(-oy / cell);
    const endGy = Math.ceil((H - oy) / cell);

    // Grid
    for (let gx = startGx; gx <= endGx; gx++) {
      const isOrigin = gx === 0;
      const isHeavy = gx % 2 === 0;
      ctx.strokeStyle = isOrigin ? "#d4820a" : isHeavy ? "#aaaaaa" : "#dddddd";
      ctx.lineWidth = isOrigin ? 2 : isHeavy ? 1 : 0.4;
      const x = ox + gx * cell;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let gy = startGy; gy <= endGy; gy++) {
      const isOrigin = gy === 0;
      const isHeavy = gy % 2 === 0;
      ctx.strokeStyle = isOrigin ? "#d4820a" : isHeavy ? "#aaaaaa" : "#dddddd";
      ctx.lineWidth = isOrigin ? 2 : isHeavy ? 1 : 0.4;
      const y = oy + gy * cell;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Feet labels
    const labelSize = Math.max(8, Math.round(9 * this.zoom * dpr));
    ctx.fillStyle = "#999999";
    ctx.font = `${labelSize}px monospace`;
    ctx.textBaseline = "top";
    for (let gx = 0; gx <= endGx; gx += 2) {
      const x = ox + gx * cell;
      const feet = (gx / 2) * 5;
      if (x > 0 && x < W) ctx.fillText(`${feet}'`, x + 3, 3);
    }
    ctx.textBaseline = "middle";
    for (let gy = 2; gy <= endGy; gy += 2) {
      const y = oy + gy * cell;
      const feet = (gy / 2) * 5;
      if (y > 0 && y < H) ctx.fillText(`${feet}'`, 3, y + 2);
    }
    ctx.textBaseline = "alphabetic";

    // Painted cells
    for (const sys of this.veh.systems) {
      const color = MP.sysColor(sys.desc);
      const isSeat = MP.isSeatSystem(sys.desc);
      const isActive = sys.id === this.activeSysId;
      for (const c of sys.cells) {
        const x = ox + c.gx * cell;
        const y = oy + c.gy * cell;
        if (isSeat) {
          // Seat: light tinted background with colored symbol
          ctx.globalAlpha = 0.15;
          ctx.fillStyle = color;
          ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
          ctx.globalAlpha = 0.9;
          // Draw seat shape: rounded rect body
          const pad = cell * 0.2;
          const sW = cell - pad * 2;
          const sH = cell - pad * 2;
          const sx = x + pad;
          const sy = y + pad + sH * 0.15;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(sx, sy, sW, sH * 0.7, 2);
          ctx.fill();
          // Backrest
          ctx.beginPath();
          ctx.roundRect(sx, y + pad, sW, sH * 0.25, 2);
          ctx.fill();
        } else {
          // Standard system: solid fill
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = color;
          ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = isActive ? "#f4d03f" : "#00000044";
        ctx.lineWidth = isActive ? 2 : 0.5;
        ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
        // Label if cell is big enough and not a seat
        if (!isSeat && cell / dpr > 16) {
          const fs = Math.max(7, Math.min(11, (cell / dpr) * 0.4)) * dpr;
          ctx.font = `bold ${fs}px sans-serif`;
          ctx.fillStyle = "#ffffffdd";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          // Use first 2 chars of desc as label
          const lbl = (sys.desc || "??").substring(0, 2).toUpperCase();
          ctx.fillText(lbl, x + cell / 2, y + cell / 2);
        }
      }
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // Hover ghost in paint mode
    if (this.mode === "paint" && this.activeSysId && this.hoverGx !== null) {
      const sys = this.veh.findSystem(this.activeSysId);
      if (sys && sys.cells.length < sys.spaces && !this.veh.cellAt(this.hoverGx, this.hoverGy)) {
        const color = MP.sysColor(sys.desc);
        const x = ox + this.hoverGx * cell;
        const y = oy + this.hoverGy * cell;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = color;
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        ctx.strokeStyle = "#f4d03f";
        ctx.lineWidth = 2;
        ctx.setLineDash([3 * dpr, 3 * dpr]);
        ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }

    // Selected cell highlight (Select mode, Delete to remove)
    if (this.selectedCell && this.mode === "select") {
      const x = ox + this.selectedCell.gx * cell;
      const y = oy + this.selectedCell.gy * cell;
      ctx.strokeStyle = "#f4d03f";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, cell, cell);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.strokeRect(x, y, cell, cell);
      ctx.setLineDash([]);
    }
  }

  toImage(maxWidth) {
    let allCells = [];
    for (const sys of this.veh.systems) allCells.push(...sys.cells.map(c => ({ ...c, sys })));
    if (!allCells.length) return null;
    let minGx = Infinity, minGy = Infinity, maxGx = -Infinity, maxGy = -Infinity;
    for (const c of allCells) {
      minGx = Math.min(minGx, c.gx); minGy = Math.min(minGy, c.gy);
      maxGx = Math.max(maxGx, c.gx + 1); maxGy = Math.max(maxGy, c.gy + 1);
    }
    const gw = maxGx - minGx;
    const gh = maxGy - minGy;
    const cellPx = maxWidth ? Math.min(28, Math.floor(maxWidth / gw)) : 28;
    const w = gw * cellPx + 2;
    const h = gh * cellPx + 2;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x <= gw; x++) {
      ctx.strokeStyle = x % 2 === 0 ? "#aaaaaa" : "#dddddd";
      ctx.lineWidth = x % 2 === 0 ? 1 : 0.4;
      ctx.beginPath(); ctx.moveTo(x * cellPx + 1, 0); ctx.lineTo(x * cellPx + 1, h); ctx.stroke();
    }
    for (let y = 0; y <= gh; y++) {
      ctx.strokeStyle = y % 2 === 0 ? "#aaaaaa" : "#dddddd";
      ctx.lineWidth = y % 2 === 0 ? 1 : 0.4;
      ctx.beginPath(); ctx.moveTo(0, y * cellPx + 1); ctx.lineTo(w, y * cellPx + 1); ctx.stroke();
    }
    for (const cc of allCells) {
      const color = MP.sysColor(cc.sys.desc);
      const isSeat = MP.isSeatSystem(cc.sys.desc);
      const sx = (cc.gx - minGx) * cellPx + 1;
      const sy = (cc.gy - minGy) * cellPx + 1;
      if (isSeat) {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = color;
        ctx.fillRect(sx + 1, sy + 1, cellPx - 2, cellPx - 2);
        ctx.globalAlpha = 0.9;
        const pad = cellPx * 0.2;
        const sW = cellPx - pad * 2;
        const sH = cellPx - pad * 2;
        const bx = sx + pad;
        const by = sy + pad + sH * 0.15;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(bx, by, sW, sH * 0.7, 2);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(bx, sy + pad, sW, sH * 0.25, 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = color;
        ctx.fillRect(sx + 1, sy + 1, cellPx - 2, cellPx - 2);
        ctx.globalAlpha = 1;
        if (cellPx > 14) {
          ctx.font = `bold ${Math.max(7, Math.min(11, cellPx * 0.4))}px sans-serif`;
          ctx.fillStyle = "#ffffffdd";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          const lbl = (cc.sys.desc || "??").substring(0, 2).toUpperCase();
          ctx.fillText(lbl, sx + cellPx / 2, sy + cellPx / 2);
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    return c;
  }
}

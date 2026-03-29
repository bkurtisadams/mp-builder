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

    this.onUpdate = null;

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
    const { gx, gy } = this._cssToGrid(cx, cy);
    this.hoverGx = gx;
    this.hoverGy = gy;

    // Drag-paint
    if (this.painting && this.mode === "paint" && this.activeSysId) {
      if (this.veh.paintCell(this.activeSysId, gx, gy)) {
        if (this.onUpdate) this.onUpdate();
      }
    }
    // Drag-erase
    if (this.painting && this.mode === "erase") {
      if (this.veh.unpaintCell(gx, gy)) {
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

    if (this.mode === "paint" && this.activeSysId) {
      this.painting = true;
      if (this.veh.paintCell(this.activeSysId, gx, gy)) {
        if (this.onUpdate) this.onUpdate();
      }
      this.draw();
      return;
    }
    if (this.mode === "erase") {
      this.painting = true;
      if (this.veh.unpaintCell(gx, gy)) {
        if (this.onUpdate) this.onUpdate();
      }
      this.draw();
      return;
    }
    if (this.mode === "select") {
      const sys = this.veh.cellAt(gx, gy);
      this.activeSysId = sys ? sys.id : null;
      this.draw();
      if (this.onUpdate) this.onUpdate();
    }
  }

  _onMouseUp(ev) {
    if (ev.button === 2 || ev.button === 1) { this.panStart = null; return; }
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
    if (ev.key === "Escape") { this.setMode("select"); this.activeSysId = null; this.draw(); if (this.onUpdate) this.onUpdate(); }
    if (ev.key === "e" || ev.key === "E") { ev.preventDefault(); this.setMode("erase"); }
    if (ev.key === "s" || ev.key === "S") { ev.preventDefault(); this.setMode("select"); }
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

  // ---- Drawing ----

  draw() {
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
      const ab = MP.abilityById(sys.abilityId);
      const color = ab?.color || "#707070";
      const isActive = sys.id === this.activeSysId;
      for (const c of sys.cells) {
        const x = ox + c.gx * cell;
        const y = oy + c.gy * cell;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = color;
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        ctx.strokeStyle = isActive ? "#f4d03f" : "#00000044";
        ctx.lineWidth = isActive ? 2 : 0.5;
        ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
        ctx.globalAlpha = 1;
        // Abbr label if cell is big enough
        if (cell / dpr > 16) {
          const fs = Math.max(7, Math.min(11, (cell / dpr) * 0.4)) * dpr;
          ctx.font = `bold ${fs}px sans-serif`;
          ctx.fillStyle = "#ffffffdd";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(ab?.abbr || "??", x + cell / 2, y + cell / 2);
        }
      }
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // Hover ghost in paint mode
    if (this.mode === "paint" && this.activeSysId && this.hoverGx !== null) {
      const sys = this.veh.findSystem(this.activeSysId);
      const ab = sys ? MP.abilityById(sys.abilityId) : null;
      if (sys && sys.cells.length < sys.spaces && !this.veh.cellAt(this.hoverGx, this.hoverGy)) {
        const x = ox + this.hoverGx * cell;
        const y = oy + this.hoverGy * cell;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = ab?.color || "#707070";
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        ctx.strokeStyle = "#f4d03f";
        ctx.lineWidth = 2;
        ctx.setLineDash([3 * dpr, 3 * dpr]);
        ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }

    // Erase hover
    if (this.mode === "erase" && this.hoverGx !== null) {
      const hit = this.veh.cellAt(this.hoverGx, this.hoverGy);
      if (hit) {
        const x = ox + this.hoverGx * cell;
        const y = oy + this.hoverGy * cell;
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
        // X mark
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + cell - 4, y + cell - 4);
        ctx.moveTo(x + cell - 4, y + 4); ctx.lineTo(x + 4, y + cell - 4);
        ctx.stroke();
      }
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
      const ab = MP.abilityById(cc.sys.abilityId);
      const sx = (cc.gx - minGx) * cellPx + 1;
      const sy = (cc.gy - minGy) * cellPx + 1;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = ab?.color || "#707070";
      ctx.fillRect(sx + 1, sy + 1, cellPx - 2, cellPx - 2);
      ctx.globalAlpha = 1;
      if (cellPx > 14) {
        ctx.font = `bold ${Math.max(7, Math.min(11, cellPx * 0.4))}px sans-serif`;
        ctx.fillStyle = "#ffffffdd";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(ab?.abbr || "??", sx + cellPx / 2, sy + cellPx / 2);
      }
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    return c;
  }
}

// mp-app.js v4.0.0 — Ability picker popup, live system stats, cost bar, edit mode

const veh = new Vehicle();
let editor = null;

// ---- Populate templates dropdown ----
(function buildTemplateDropdown() {
  const sel = document.getElementById("sel-template");
  for (let i = 0; i < MP.TEMPLATES.length; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = MP.TEMPLATES[i].name;
    sel.appendChild(opt);
  }
  sel.addEventListener("change", () => {
    if (sel.value === "") return;
    const tpl = MP.TEMPLATES[parseInt(sel.value)];
    if (!tpl) return;
    veh.name = tpl.name;
    veh.model = "";
    veh.operator = "";
    veh.basicCost = tpl.basicCost;
    veh.techMod = tpl.techMod || 0;
    veh.maneuverMod = tpl.maneuverMod || 0;
    veh.wontExplode = tpl.wontExplode || false;
    veh.isBase = tpl.isBase || false;
    veh.pictureData = "";
    veh.systems = [];
    veh._nextId = 1;
    for (const ts of tpl.systems) {
      const sys = veh.addSystem();
      sys.spaces = ts.spaces || 0;
      sys.extraCPs = ts.extraCPs || 0;
      sys.desc = ts.desc || "";
      sys.integral = ts.integral || false;
      sys.bulky = ts.bulky || 0;
      sys.delicate = ts.delicate || 0;
      sys.open = ts.open || false;
      sys.adjST = ts.adjST || 0;
      sys.adjEN = ts.adjEN || 0;
      sys.adjAG = ts.adjAG || 0;
      sys.adjIN = ts.adjIN || 0;
      sys.adjCL = ts.adjCL || 0;
    }
    syncFormFromVeh();
    updateAll();
    sel.value = "";
  });
})();

// ---- Sync form fields from vehicle state ----
function syncFormFromVeh() {
  document.getElementById("vs-name").value = veh.name;
  document.getElementById("vs-model").value = veh.model;
  document.getElementById("vs-operator").value = veh.operator;
  document.getElementById("vs-basic-cost").value = veh.basicCost;
  document.getElementById("vs-tech").value = veh.techMod;
  document.getElementById("vs-maneuver").value = veh.maneuverMod;
  document.getElementById("vs-noexplode").checked = veh.wontExplode;
  document.getElementById("vs-base").checked = veh.isBase;
  const img = document.getElementById("vs-picture-img");
  if (veh.pictureData) {
    img.src = veh.pictureData;
    img.style.display = "block";
    document.getElementById("vs-picture-area").classList.add("has-image");
  } else {
    img.src = "";
    img.style.display = "none";
    document.getElementById("vs-picture-area").classList.remove("has-image");
  }
  // Restore picture height
  const ph = veh.pictureHeight || 120;
  document.getElementById("vs-picture-area").style.height = ph + "px";
  document.getElementById("vs-pic-height").value = ph;
  document.getElementById("vs-pic-height-val").textContent = ph;
}

// ---- Update all ----
function updateAll() {
  const ch = veh.chassis;
  const a = veh.armor;

  document.getElementById("vs-sys-spaces").textContent = ch.sp;
  document.getElementById("vs-profile").textContent = "x" + ch.prof;
  document.getElementById("vs-weight").textContent = ch.wt.replace(" lbs", "");
  document.getElementById("vs-mass").textContent = ch.mass;
  document.getElementById("vs-basic-cost").value = veh.basicCost;
  document.getElementById("vs-hits").textContent = veh.hits;
  document.getElementById("vs-power").textContent = veh.power;
  // Sync current to max if current exceeds max or equals old max
  const hitsCur = document.getElementById("vs-hits-cur");
  const powerCur = document.getElementById("vs-power-cur");
  if (parseInt(hitsCur.value) > veh.hits || hitsCur.value === "" || hitsCur.dataset.lastMax !== String(veh.hits)) {
    hitsCur.value = veh.hits;
  }
  hitsCur.dataset.lastMax = veh.hits;
  if (parseInt(powerCur.value) > veh.power || powerCur.value === "" || powerCur.dataset.lastMax !== String(veh.power)) {
    powerCur.value = veh.power;
  }
  powerCur.dataset.lastMax = veh.power;
  document.getElementById("vs-explosion").textContent = veh.explosionDice;
  document.getElementById("vs-area").textContent = veh.explosionArea;
  document.getElementById("vs-armor-kin").value = a.kin;
  document.getElementById("vs-armor-eng").value = a.eng;
  document.getElementById("vs-armor-bio").value = a.bio;
  document.getElementById("vs-armor-ent").value = a.ent;
  document.getElementById("vs-armor-psy").value = a.psy;
  document.getElementById("vs-total-cost").textContent = veh.totalCost;
  document.getElementById("vs-st").textContent = veh.st;
  document.getElementById("vs-hth").textContent = MP.hthDamage(veh.st);
  document.getElementById("vs-en").textContent = veh.en;
  document.getElementById("vs-en-save").textContent = MP.save(veh.en);
  document.getElementById("vs-ag").textContent = veh.ag;
  document.getElementById("vs-ag-save").textContent = MP.save(veh.ag);
  document.getElementById("vs-handling").textContent = veh.handling;
  document.getElementById("vs-in").textContent = veh.intel;
  document.getElementById("vs-in-save").textContent = MP.save(veh.intel);
  document.getElementById("vs-cl").textContent = veh.cl;
  document.getElementById("vs-cl-save").textContent = MP.save(veh.cl);
  document.getElementById("vs-turn-rate").textContent = veh.turnRate;
  document.getElementById("vs-init").textContent = MP.initDie(veh.cl);

  renderSystemsTable();
  renderKey();
  updateSystemDropdown();
  updateActiveIndicator();
  if (typeof updateSilBar === "function") updateSilBar();
  if (editor) editor.draw();
  autoSave();
}

// HTML attribute escaper
function escAttr(s) {
  return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ---- Systems table: 18 rows + remaining ----
const SYS_ROW_COUNT = 18;

function renderSystemsTable() {
  const el = document.getElementById("vs-sys-rows");
  let html = "";

  for (let i = 0; i < SYS_ROW_COUNT; i++) {
    const s = veh.systems[i] || null;
    const cost = s ? (s.extraCPs || "") : "";
    const spaces = s ? (s.spaces || "") : "";
    const prof = s && s.spaces ? veh.sysProfileDisplay(s) : "";
    const hits = s && s.spaces ? veh.sysHits(s) : "";
    const hitsDisplay = hits !== "" ? `(${hits})` : "";
    const pts = s && s.spaces ? `(${veh.sysCPs(s)})` : "";
    const dmg = s ? escAttr(s.dmg || "") : "";
    const desc = s ? escAttr(s.desc || "") : "";
    const integral = s ? (s.integral || false) : false;
    const open = s ? (s.open || false) : false;
    const bulky = s ? (s.bulky || "") : "";
    const delicate = s ? (s.delicate || "") : "";
    const adjST = s ? (s.adjST || "") : "";
    const adjEN = s ? (s.adjEN || "") : "";
    const adjAG = s ? (s.adjAG || "") : "";
    const adjIN = s ? (s.adjIN || "") : "";
    const adjCL = s ? (s.adjCL || "") : "";

    html += `<div class="vs-sys-row-wrap" data-idx="${i}" draggable="true">
      <span class="vs-sys-grip" title="Drag to reorder">&#9776;</span>
      <div class="vs-sys-row">
        <input type="number" value="${cost}" data-field="extraCPs" data-idx="${i}" step="2.5" min="0" title="Extra CPs added to this system (adds to vehicle cost)">
        <input type="number" value="${spaces}" data-field="spaces" data-idx="${i}" min="0" title="System spaces allocated">
        <span class="vs-sys-val">${prof}</span>
        <span class="vs-sys-val">${hitsDisplay}</span>
        <input type="text" value="${dmg}" data-field="dmg" data-idx="${i}" title="Damage taken by this system">
        <span class="vs-sys-val vs-sys-pts">${pts}</span>
        <input type="text" class="vs-sys-desc" value="${desc}" data-field="desc" data-idx="${i}" title="System name, abilities, arc, notes">
        <span class="vs-sys-ins" data-idx="${i}" title="Insert Ability (Ctrl+I)">+</span>
        <span class="vs-sys-edit" data-idx="${i}" title="Edit Ability (Ctrl+E)">✎</span>
        <span class="vs-sys-del" data-idx="${i}" title="Clear row">&times;</span>
      </div>
      <div class="vs-sys-mods">
        <input type="checkbox" data-field="integral" data-idx="${i}" ${integral ? "checked" : ""} title="Integral — hidden, can't be targeted. Halves CPs.">
        <input type="number" class="${bulky ? "has-val" : ""}" value="${bulky}" data-field="bulky" data-idx="${i}" min="0" title="Bulky — +4.3 Hits per dose, -2.5 CPs per dose">
        <input type="number" class="${delicate ? "has-val" : ""}" value="${delicate}" data-field="delicate" data-idx="${i}" min="0" title="Delicate — -4.3 Hits per dose, +2.5 CPs per dose">
        <input type="checkbox" data-field="open" data-idx="${i}" ${open ? "checked" : ""} title="Open System — passable, yields ¼ CPs">
        <input type="number" class="${adjST ? "has-val" : ""}" value="${adjST}" data-field="adjST" data-idx="${i}" title="ST adjustment from this system">
        <input type="number" class="${adjEN ? "has-val" : ""}" value="${adjEN}" data-field="adjEN" data-idx="${i}" title="EN adjustment from this system">
        <input type="number" class="${adjAG ? "has-val" : ""}" value="${adjAG}" data-field="adjAG" data-idx="${i}" title="AG adjustment (e.g. Automation)">
        <input type="number" class="${adjIN ? "has-val" : ""}" value="${adjIN}" data-field="adjIN" data-idx="${i}" title="IN adjustment (e.g. Robot Brain)">
        <input type="number" class="${adjCL ? "has-val" : ""}" value="${adjCL}" data-field="adjCL" data-idx="${i}" title="CL adjustment (e.g. Performance)">
      </div>
    </div>`;
  }

  // Row 19: remaining
  const remSys = veh.getRemainingSys();
  const remPlaced = remSys.cells.length;
  const remAvail = veh.remainingSpaces;
  const remTotal = remPlaced + remAvail;
  html += `<div class="vs-sys-row-wrap vs-sys-remain">
    <div class="vs-sys-row">
      <span class="vs-sys-val"></span>
      <span class="vs-sys-val">${remTotal}</span>
      <span></span><span></span><span></span><span></span>
      <span class="vs-remain-note"><em>Remaining spaces (${remPlaced} placed, ${remAvail} unplaced)</em></span>
      <span></span>
    </div>
    <div class="vs-sys-mods"></div>
  </div>`;

  el.innerHTML = html;

  // Wire inputs
  el.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("change", () => {
      const idx = parseInt(inp.dataset.idx);
      const field = inp.dataset.field;
      let sys = veh.systems[idx] || null;

      if (!sys) {
        if (inp.type === "checkbox" && !inp.checked) return;
        if (inp.type !== "checkbox" && !inp.value.trim()) return;
        while (veh.systems.length <= idx) veh.addSystem();
        sys = veh.systems[idx];
      }

      if (field === "integral" || field === "open") {
        sys[field] = inp.checked;
      } else if (["extraCPs","spaces","bulky","delicate","adjST","adjEN","adjAG","adjIN","adjCL"].includes(field)) {
        sys[field] = parseFloat(inp.value) || 0;
      } else {
        sys[field] = inp.value;
      }
      updateAll();
    });
  });

  // Wire clear
  el.querySelectorAll(".vs-sys-del").forEach(del => {
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(del.dataset.idx);
      const sys = veh.systems[idx];
      if (!sys) return;
      if (editor && editor.activeSysId === sys.id) editor.activeSysId = null;
      veh.systems.splice(idx, 1);
      updateAll();
    });
  });

  // Wire insert ability icon
  el.querySelectorAll(".vs-sys-ins").forEach(ins => {
    ins.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(ins.dataset.idx);
      if (!isNaN(idx)) abilityDlg.open(idx, false);
    });
  });

  // Wire edit ability icon
  el.querySelectorAll(".vs-sys-edit").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      if (!isNaN(idx)) abilityDlg.open(idx, true);
    });
  });

  // Wire drag-to-reorder
  let dragIdx = null;
  el.querySelectorAll(".vs-sys-row-wrap[draggable]").forEach(row => {
    row.addEventListener("dragstart", e => {
      dragIdx = parseInt(row.dataset.idx);
      row.classList.add("vs-sys-dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("vs-sys-dragging");
      el.querySelectorAll(".vs-sys-row-wrap").forEach(r => r.classList.remove("vs-sys-dragover"));
      dragIdx = null;
    });
    row.addEventListener("dragover", e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      el.querySelectorAll(".vs-sys-row-wrap").forEach(r => r.classList.remove("vs-sys-dragover"));
      row.classList.add("vs-sys-dragover");
    });
    row.addEventListener("dragleave", () => {
      row.classList.remove("vs-sys-dragover");
    });
    row.addEventListener("drop", e => {
      e.preventDefault();
      const dropIdx = parseInt(row.dataset.idx);
      if (dragIdx === null || dragIdx === dropIdx) return;
      // Ensure both indices have systems
      while (veh.systems.length <= Math.max(dragIdx, dropIdx)) veh.addSystem();
      const [moved] = veh.systems.splice(dragIdx, 1);
      veh.systems.splice(dropIdx, 0, moved);
      dragIdx = null;
      updateAll();
    });
  });
}

// ---- Vehicle Key: 4 columns, 8 rows ----
const KEY_ROW_COUNT = 8;

function renderKey() {
  const tbody = document.getElementById("vs-key-tbody");
  let html = "";
  for (let i = 0; i < KEY_ROW_COUNT; i++) {
    const left = i;
    const right = i + KEY_ROW_COUNT;
    const kL = veh.keyEntries[left] || null;
    const kR = veh.keyEntries[right] || null;
    html += `<tr>
      <td><input type="text" class="vs-key-label" value="${escAttr(kL ? kL.label : "")}" data-kidx="${left}" data-field="label" placeholder="#"></td>
      <td><input type="text" class="vs-key-desc" value="${escAttr(kL ? kL.desc : "")}" data-kidx="${left}" data-field="desc"></td>
      <td><input type="text" class="vs-key-label" value="${escAttr(kR ? kR.label : "")}" data-kidx="${right}" data-field="label" placeholder="#"></td>
      <td><input type="text" class="vs-key-desc" value="${escAttr(kR ? kR.desc : "")}" data-kidx="${right}" data-field="desc"></td>
    </tr>`;
  }
  tbody.innerHTML = html;

  tbody.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("change", () => {
      const kidx = parseInt(inp.dataset.kidx);
      while (veh.keyEntries.length <= kidx) veh.addKeyEntry("", "");
      veh.keyEntries[kidx][inp.dataset.field] = inp.value;
    });
  });
}

// ---- System dropdown in layout toolbar ----
function updateSystemDropdown() {
  const sel = document.getElementById("sel-layout-sys");
  const curVal = sel.value;
  let html = '<option value="">— select system —</option>';
  for (const sys of veh.systems) {
    if (!sys.desc && !sys.spaces) continue;
    const name = sys.desc || "(unnamed)";
    const placed = sys.cells.length;
    const total = sys.spaces || 0;
    const selected = (String(sys.id) === curVal) ? " selected" : "";
    html += `<option value="${sys.id}"${selected}>${name} (${placed}/${total})</option>`;
  }
  // Add remaining spaces entry
  const remSys = veh.getRemainingSys();
  const remPlaced = remSys.cells.length;
  const remTotal = veh.remainingSpaces + remPlaced;
  if (remTotal > 0) {
    const remSelected = (curVal === "remaining") ? " selected" : "";
    html += `<option value="remaining"${remSelected}>Remaining (${remPlaced}/${remTotal})</option>`;
  }
  sel.innerHTML = html;
  // Restore selection if still valid
  if (editor && editor.activeSysId) {
    if (editor.activeSysId === "remaining") {
      sel.value = "remaining";
    } else {
      sel.value = String(editor.activeSysId);
    }
    if (!sel.value) {
      editor.activeSysId = null;
      editor.setMode("select");
    }
  }
}

// ---- Active system indicator ----
function updateActiveIndicator() {
  const el = document.getElementById("vs-active-sys");
  if (!editor || !editor.activeSysId) {
    el.innerHTML = '<span style="font-size:8px;color:var(--tx3);font-style:italic">Select a system to paint</span>';
    return;
  }
  let sys, color, name, placed, total;
  if (editor.activeSysId === "remaining") {
    sys = veh.getRemainingSys();
    color = "#606060";
    name = "Remaining";
    placed = sys.cells.length;
    total = veh.remainingSpaces + placed;
  } else {
    sys = veh.findSystem(editor.activeSysId);
    if (!sys) {
      el.innerHTML = '<span style="font-size:8px;color:var(--tx3);font-style:italic">Select a system to paint</span>';
      return;
    }
    color = MP.sysColor(sys.desc);
    name = sys.desc || "(unnamed)";
    placed = sys.cells.length;
    total = sys.spaces || 0;
  }
  el.innerHTML = `<span class="vs-active-swatch" style="background:${color}"></span>`
    + `<span class="vs-active-name">${name}</span>`
    + `<span class="vs-active-count">${placed} / ${total}</span>`;
}

// ---- Config change handlers ----
function onConfigChange() {
  veh.name = document.getElementById("vs-name").value;
  veh.model = document.getElementById("vs-model").value;
  veh.operator = document.getElementById("vs-operator").value;
  veh.basicCost = parseFloat(document.getElementById("vs-basic-cost").value) || 0;
  veh.techMod = parseFloat(document.getElementById("vs-tech").value) || 0;
  veh.maneuverMod = parseFloat(document.getElementById("vs-maneuver").value) || 0;
  veh.wontExplode = document.getElementById("vs-noexplode").checked;
  veh.isBase = document.getElementById("vs-base").checked;
  updateAll();
}

["vs-name","vs-model","vs-operator"].forEach(id => {
  document.getElementById(id).addEventListener("input", onConfigChange);
});
["vs-basic-cost","vs-tech","vs-maneuver"].forEach(id => {
  document.getElementById(id).addEventListener("change", onConfigChange);
  document.getElementById(id).addEventListener("input", onConfigChange);
});
["vs-noexplode","vs-base"].forEach(id => {
  document.getElementById(id).addEventListener("change", onConfigChange);
});

// ---- Import image ----
document.getElementById("inp-picture").addEventListener("change", e => {
  if (!e.target.files.length) return;
  const reader = new FileReader();
  reader.onload = ev => {
    veh.pictureData = ev.target.result;
    const img = document.getElementById("vs-picture-img");
    img.src = veh.pictureData;
    img.style.display = "block";
    document.getElementById("vs-picture-area").classList.add("has-image");
  };
  reader.readAsDataURL(e.target.files[0]);
  e.target.value = "";
});

// Import button below picture (always visible)
document.getElementById("btn-import-img2").addEventListener("click", () => {
  document.getElementById("inp-picture").click();
});

// Clear picture
document.getElementById("btn-clear-img").addEventListener("click", () => {
  veh.pictureData = "";
  const img = document.getElementById("vs-picture-img");
  img.src = "";
  img.style.display = "none";
  document.getElementById("vs-picture-area").classList.remove("has-image");
  updateAll();
});

// Picture height slider
document.getElementById("vs-pic-height").addEventListener("input", () => {
  const h = parseInt(document.getElementById("vs-pic-height").value) || 120;
  document.getElementById("vs-picture-area").style.height = h + "px";
  document.getElementById("vs-pic-height-val").textContent = h;
  veh.pictureHeight = h;
});

// ---- Layout toolbar: system dropdown ----
document.getElementById("sel-layout-sys").addEventListener("change", () => {
  const sel = document.getElementById("sel-layout-sys");
  let sysId = null;
  if (sel.value === "remaining") {
    sysId = "remaining";
  } else {
    sysId = parseInt(sel.value) || null;
  }
  if (editor) {
    editor.activeSysId = sysId;
    if (sysId) {
      setLayoutMode("paint");
    }
    updateActiveIndicator();
    editor.draw();
  }
});

// ---- Mode buttons: Select / Paint / Sil ----
function setLayoutMode(mode) {
  if (!editor) return;
  editor.setMode(mode);
  editor.selectedCell = null;
  document.getElementById("btn-mode-select").classList.toggle("active", mode === "select");
  document.getElementById("btn-mode-paint").classList.toggle("active", mode === "paint");
  document.getElementById("btn-mode-sil").classList.toggle("active", mode === "sil");
  updateSilBar();
  editor.draw();
}

function updateSilBar() {
  const bar = document.getElementById("vs-sil-bar");
  const sil = veh.silhouette;
  const inSilMode = editor && editor.mode === "sil";
  bar.classList.toggle("disabled", !inSilMode);
  if (sil) {
    document.getElementById("sil-x").value = sil.gx ?? 0;
    document.getElementById("sil-y").value = sil.gy ?? 0;
    document.getElementById("sil-w").value = sil.gw ?? 10;
    document.getElementById("sil-h").value = sil.gh ?? 8;
    document.getElementById("sil-rot").value = sil.rot ?? 0;
  } else {
    document.getElementById("sil-x").value = "";
    document.getElementById("sil-y").value = "";
    document.getElementById("sil-w").value = "";
    document.getElementById("sil-h").value = "";
    document.getElementById("sil-rot").value = "";
  }
}

document.getElementById("btn-mode-select").addEventListener("click", () => setLayoutMode("select"));
document.getElementById("btn-mode-paint").addEventListener("click", () => setLayoutMode("paint"));
document.getElementById("btn-mode-sil").addEventListener("click", () => setLayoutMode("sil"));

document.getElementById("btn-zoom-in").addEventListener("click", () => editor.zoomIn());
document.getElementById("btn-zoom-out").addEventListener("click", () => editor.zoomOut());
document.getElementById("btn-zoom-reset").addEventListener("click", () => editor.resetView());

// ---- Silhouette bar ----
document.getElementById("btn-sil-import").addEventListener("click", () => {
  document.getElementById("inp-silhouette").click();
});
document.getElementById("inp-silhouette").addEventListener("change", e => {
  if (!e.target.files.length) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const gw = 10;
      const gh = Math.max(1, Math.round(gw * (img.height / img.width)));
      editor.loadSilhouette(ev.target.result, gw, gh);
      setLayoutMode("sil");
      updateSilBar();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(e.target.files[0]);
  e.target.value = "";
});
document.getElementById("btn-sil-clear").addEventListener("click", () => {
  if (editor) editor.clearSilhouette();
  updateSilBar();
});

// Sil X/Y/W/H/Rot inputs
["sil-x","sil-y","sil-w","sil-h","sil-rot"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => {
    const sil = veh.silhouette;
    if (!sil) return;
    sil.gx = parseFloat(document.getElementById("sil-x").value) || 0;
    sil.gy = parseFloat(document.getElementById("sil-y").value) || 0;
    sil.gw = Math.max(1, parseFloat(document.getElementById("sil-w").value) || 1);
    sil.gh = Math.max(1, parseFloat(document.getElementById("sil-h").value) || 1);
    sil.rot = parseFloat(document.getElementById("sil-rot").value) || 0;
    if (editor) editor.draw();
  });
});

// ---- Popout Layout Window ----
let popoutWin = null;
let popoutEditor = null;
let popoutSyncInterval = null;

function buildPopoutSysDropdown(doc) {
  const sel = doc.getElementById("pop-sel-sys");
  let html = '<option value="">— select system —</option>';
  for (const sys of veh.systems) {
    if (!sys.desc && !sys.spaces) continue;
    const name = escAttr(sys.desc || "(unnamed)");
    const placed = sys.cells.length;
    const total = sys.spaces || 0;
    const selected = (popoutEditor && popoutEditor.activeSysId === sys.id) ? " selected" : "";
    html += `<option value="${sys.id}"${selected}>${name} (${placed}/${total})</option>`;
  }
  sel.innerHTML = html;
}

function updatePopoutIndicator(doc) {
  const el = doc.getElementById("pop-active-sys");
  if (!popoutEditor || !popoutEditor.activeSysId) {
    el.innerHTML = '<span style="font-size:9px;color:#6a8a9a;font-style:italic">Select a system to paint</span>';
    return;
  }
  const sys = veh.findSystem(popoutEditor.activeSysId);
  if (!sys) { el.innerHTML = ''; return; }
  const color = MP.sysColor(sys.desc);
  el.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${color};border:1px solid #8ab4d0;vertical-align:middle"></span> `
    + `<b style="color:#c05a00">${escAttr(sys.desc || "?")}</b> `
    + `<b style="color:#b03000">${sys.cells.length} / ${sys.spaces || 0}</b>`;
}

function syncPopout() {
  if (!popoutWin || popoutWin.closed) {
    clearInterval(popoutSyncInterval);
    popoutWin = null;
    popoutEditor = null;
    popoutSyncInterval = null;
    return;
  }
  // Sync main sheet from any popout painting
  updateAll();
}

function openPopout() {
  if (popoutWin && !popoutWin.closed) {
    popoutWin.focus();
    return;
  }

  popoutWin = window.open("", "mp_layout_popout", "width=1000,height=700,resizable=yes");
  if (!popoutWin) { alert("Popup blocked. Please allow popups for this site."); return; }

  const doc = popoutWin.document;
  doc.open();
  doc.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Vehicle Layout — ${escAttr(veh.name || "Untitled")}</title>
<link href="https://fonts.googleapis.com/css2?family=Bitter:wght@400;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#d6eaf8;--bg2:#c4dff0;--inp:#ffffff;--brd:#8ab4d0;--brd2:#a0c8e0;
--tx:#1a2a3a;--tx2:#3a5a70;--tx3:#6a8a9a;--accent:#c05a00;--accent-lt:#d06a10;
--fb:'Bitter',serif}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:var(--bg);font-family:var(--fb);font-size:12px;color:var(--tx);overflow:hidden}
.pop-wrap{display:flex;flex-direction:column;height:100%}
.pop-toolbar{display:flex;align-items:center;gap:3px;padding:4px 6px;background:var(--bg2);border-bottom:2px solid var(--brd);flex-wrap:wrap;flex-shrink:0}
.pop-canvas-wrap{flex:1;overflow:hidden;position:relative;background:#fff}
.pop-canvas-wrap canvas{display:block;width:100%;height:100%}
.pop-hint{font-size:9px;color:var(--tx3);padding:3px 6px;background:var(--bg2);border-top:1px solid var(--brd);flex-shrink:0}
.pop-hint b{color:var(--tx)}
select{background:var(--inp);border:1px solid var(--brd);border-radius:2px;padding:2px 4px;font-family:var(--fb);font-size:9px;color:var(--tx)}
select:focus{outline:none;border-color:var(--accent)}
.pop-sys-sel{max-width:220px}
.ed-btn{display:inline-flex;align-items:center;gap:2px;padding:3px 7px;font-size:10px;background:var(--accent);color:#fff;border:none;border-radius:3px;cursor:pointer;font-family:var(--fb);font-weight:700;white-space:nowrap}
.ed-btn:hover{background:var(--accent-lt)}
.ed-btn-mode{background:#e0e8f0;color:var(--tx2);border:1px solid var(--brd)}
.ed-btn-mode:hover{background:#d0d8e8}
.ed-btn-mode.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.ed-btn-mode.ed-btn-disabled{opacity:0.4;pointer-events:none}
.ed-sep{width:1px;height:16px;background:var(--brd);margin:0 2px}
.pop-active{margin-left:auto;font-size:9px;white-space:nowrap}
.pop-sil-bar{display:flex;align-items:center;gap:3px;padding:3px 6px;background:var(--bg2);border-top:1px solid var(--brd);flex-wrap:wrap;flex-shrink:0}
.pop-sil-bar.disabled{opacity:0.4;pointer-events:none}
.pop-sil-label{font-size:8px;font-weight:700;color:#0a4a6a;white-space:nowrap}
.pop-sil-inp{width:42px;background:var(--inp);border:1px solid var(--brd);border-radius:2px;padding:1px 2px;font-family:var(--fb);font-size:9px;color:var(--tx);text-align:center}
.ed-btn-sm{padding:3px 7px;font-size:9px;background:#2a3a4a;border:1px solid #4a6a7a;color:#ccc;border-radius:2px;cursor:pointer;font-family:var(--fb);font-weight:700}
.ed-btn-sm:hover{border-color:var(--accent)}
</style>
</head><body>
<div class="pop-wrap">
  <div class="pop-toolbar">
    <select id="pop-sel-sys" class="pop-sys-sel" title="Select a system to paint">
      <option value="">— select system —</option>
    </select>
    <button id="pop-select" class="ed-btn ed-btn-mode active" title="Select cell, Delete to remove">Select</button>
    <button id="pop-paint" class="ed-btn ed-btn-mode" title="Paint cells">Paint</button>
    <button id="pop-sil" class="ed-btn ed-btn-mode" title="Move/resize silhouette">Sil.</button>
    <span class="ed-sep"></span>
    <button id="pop-zin" class="ed-btn">+</button>
    <button id="pop-zout" class="ed-btn">&minus;</button>
    <button id="pop-zreset" class="ed-btn">Reset</button>
    <span class="ed-sep"></span>
    <button id="pop-popout-close" class="ed-btn">Close</button>
    <span id="pop-active-sys" class="pop-active"></span>
  </div>
  <div class="pop-canvas-wrap" id="pop-canvas-wrap">
    <canvas id="pop-canvas"></canvas>
  </div>
  <div class="pop-sil-bar" id="pop-sil-bar">
    <label class="pop-sil-label">Silhouette:</label>
    <button id="pop-sil-import" class="ed-btn-sm">Import</button>
    <button id="pop-sil-clear" class="ed-btn-sm">Clear</button>
    <input type="file" id="pop-inp-sil" accept="image/*" style="display:none">
    <span class="ed-sep"></span>
    <label class="pop-sil-label">X:</label><input type="number" id="pop-sil-x" class="pop-sil-inp" step="0.5">
    <label class="pop-sil-label">Y:</label><input type="number" id="pop-sil-y" class="pop-sil-inp" step="0.5">
    <label class="pop-sil-label">W:</label><input type="number" id="pop-sil-w" class="pop-sil-inp" step="0.5" min="1">
    <label class="pop-sil-label">H:</label><input type="number" id="pop-sil-h" class="pop-sil-inp" step="0.5" min="1">
    <label class="pop-sil-label">Rot:</label><input type="number" id="pop-sil-rot" class="pop-sil-inp" step="15">
  </div>
  <div class="pop-hint">
    <b>Del</b>=delete selected cell &bull; Right-drag=pan &bull; Scroll=zoom &bull;
    1 cell = 1 system space (2.5') / heavy lines = 5'
  </div>
</div>
</body></html>`);
  doc.close();

  // Wait for DOM ready
  popoutWin.addEventListener("load", () => {
    const pdoc = popoutWin.document;
    const canvas = pdoc.getElementById("pop-canvas");
    const wrap = pdoc.getElementById("pop-canvas-wrap");

    popoutWin.MP = MP;
    popoutWin.FloorPlanEditor = FloorPlanEditor;
    popoutWin.CELL_PX = CELL_PX;

    popoutEditor = new FloorPlanEditor(canvas, wrap, veh);
    popoutEditor.panX = 40;
    popoutEditor.panY = 40;
    popoutEditor.onUpdate = () => {
      buildPopoutSysDropdown(pdoc);
      updatePopoutIndicator(pdoc);
      updatePopoutSilBar(pdoc);
      popoutEditor.draw();
      updateAll();
    };

    buildPopoutSysDropdown(pdoc);
    updatePopoutIndicator(pdoc);

    function setPopoutMode(mode) {
      popoutEditor.setMode(mode);
      popoutEditor.selectedCell = null;
      pdoc.getElementById("pop-select").classList.toggle("active", mode === "select");
      pdoc.getElementById("pop-paint").classList.toggle("active", mode === "paint");
      pdoc.getElementById("pop-sil").classList.toggle("active", mode === "sil");
      updatePopoutSilBar(pdoc);
      popoutEditor.draw();
    }

    function updatePopoutSilBar(d) {
      const bar = d.getElementById("pop-sil-bar");
      const sil = veh.silhouette;
      const inSil = popoutEditor && popoutEditor.mode === "sil";
      bar.classList.toggle("disabled", !inSil);
      if (sil) {
        d.getElementById("pop-sil-x").value = sil.gx ?? 0;
        d.getElementById("pop-sil-y").value = sil.gy ?? 0;
        d.getElementById("pop-sil-w").value = sil.gw ?? 10;
        d.getElementById("pop-sil-h").value = sil.gh ?? 8;
        d.getElementById("pop-sil-rot").value = sil.rot ?? 0;
      }
    }
    updatePopoutSilBar(pdoc);

    pdoc.getElementById("pop-sel-sys").addEventListener("change", function() {
      const sysId = parseInt(this.value) || null;
      popoutEditor.activeSysId = sysId;
      if (sysId) setPopoutMode("paint");
      updatePopoutIndicator(pdoc);
      popoutEditor.draw();
    });

    pdoc.getElementById("pop-select").addEventListener("click", () => setPopoutMode("select"));
    pdoc.getElementById("pop-paint").addEventListener("click", () => setPopoutMode("paint"));
    pdoc.getElementById("pop-sil").addEventListener("click", () => setPopoutMode("sil"));
    pdoc.getElementById("pop-zin").addEventListener("click", () => popoutEditor.zoomIn());
    pdoc.getElementById("pop-zout").addEventListener("click", () => popoutEditor.zoomOut());
    pdoc.getElementById("pop-zreset").addEventListener("click", () => popoutEditor.resetView());
    pdoc.getElementById("pop-popout-close").addEventListener("click", () => popoutWin.close());

    // Silhouette controls in popout
    pdoc.getElementById("pop-sil-import").addEventListener("click", () => {
      pdoc.getElementById("pop-inp-sil").click();
    });
    pdoc.getElementById("pop-inp-sil").addEventListener("change", function(e) {
      if (!e.target.files.length) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const gw = 10;
          const gh = Math.max(1, Math.round(gw * (img.height / img.width)));
          popoutEditor.loadSilhouette(ev.target.result, gw, gh);
          setPopoutMode("sil");
          if (editor) { editor._ensureSilImage(); editor.draw(); }
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(e.target.files[0]);
      e.target.value = "";
    });
    pdoc.getElementById("pop-sil-clear").addEventListener("click", () => {
      popoutEditor.clearSilhouette();
      updatePopoutSilBar(pdoc);
      if (editor) editor.draw();
    });

    ["pop-sil-x","pop-sil-y","pop-sil-w","pop-sil-h","pop-sil-rot"].forEach(id => {
      pdoc.getElementById(id).addEventListener("input", () => {
        const sil = veh.silhouette;
        if (!sil) return;
        sil.gx = parseFloat(pdoc.getElementById("pop-sil-x").value) || 0;
        sil.gy = parseFloat(pdoc.getElementById("pop-sil-y").value) || 0;
        sil.gw = Math.max(1, parseFloat(pdoc.getElementById("pop-sil-w").value) || 1);
        sil.gh = Math.max(1, parseFloat(pdoc.getElementById("pop-sil-h").value) || 1);
        sil.rot = parseFloat(pdoc.getElementById("pop-sil-rot").value) || 0;
        popoutEditor.draw();
        if (editor) editor.draw();
      });
    });

    popoutEditor.draw();
  });

  // Poll for sync and detect close
  popoutSyncInterval = setInterval(syncPopout, 500);

  popoutWin.addEventListener("beforeunload", () => {
    clearInterval(popoutSyncInterval);
    popoutEditor = null;
    popoutWin = null;
    popoutSyncInterval = null;
    updateAll(); // refresh main
  });
}

document.getElementById("btn-popout").addEventListener("click", openPopout);

// ---- Export ----
document.getElementById("btn-save").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(veh.toJSON(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = (veh.name || "vehicle").replace(/\s+/g, "_") + ".json";
  a.click(); URL.revokeObjectURL(url);
});

document.getElementById("btn-load").addEventListener("click", () => {
  document.getElementById("inp-json").click();
});
document.getElementById("inp-json").addEventListener("change", e => {
  if (!e.target.files.length) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      veh.fromJSON(JSON.parse(ev.target.result));
      syncFormFromVeh();
      updateAll();
    } catch (err) { alert("Invalid JSON: " + err.message); }
  };
  reader.readAsText(e.target.files[0]);
  e.target.value = "";
});

document.getElementById("btn-csv").addEventListener("click", () => {
  const blob = new Blob([veh.toCSV()], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = (veh.name || "vehicle").replace(/\s+/g, "_") + ".csv";
  a.click(); URL.revokeObjectURL(url);
});

document.getElementById("btn-pdf").addEventListener("click", () => {
  // Render the layout canvas to a static image for print
  const layoutCanvas = document.getElementById("vs-layout-canvas");
  const printImg = editor.toImage(500);
  let layoutImgData = "";
  if (printImg) layoutImgData = printImg.toDataURL("image/png");

  // Snapshot the layout canvas area with a static image for printing
  const layoutWrap = document.getElementById("vs-layout-wrap");
  let origCanvas = null;
  let tempImg = null;
  if (layoutImgData) {
    origCanvas = layoutCanvas;
    origCanvas.style.display = "none";
    tempImg = document.createElement("img");
    tempImg.src = layoutImgData;
    tempImg.style.cssText = "display:block;max-width:100%;max-height:100%;object-fit:contain;margin:auto";
    layoutWrap.appendChild(tempImg);
  }

  window.print();

  // Restore canvas after print
  setTimeout(() => {
    if (origCanvas) origCanvas.style.display = "";
    if (tempImg && tempImg.parentNode) tempImg.parentNode.removeChild(tempImg);
  }, 500);
});

// ---- localStorage auto-save ----
const LS_KEY = "mp-vehicle-autosave";
let _saveTimer = null;

function autoSave() {
  // Debounce: save 300ms after last change
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(veh.toJSON()));
    } catch (e) { /* quota exceeded or private browsing */ }
  }, 300);
}

function autoLoad() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || data.type !== "mp-vehicle") return false;
    veh.fromJSON(data);
    return true;
  } catch (e) { return false; }
}

// ---- Ability Insert Dialog (Ctrl+I) ----

// Mousewheel cycling on select elements
function wheelSelect(sel) {
  sel.addEventListener("wheel", e => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    const newIdx = Math.max(0, Math.min(sel.options.length - 1, sel.selectedIndex + dir));
    if (newIdx !== sel.selectedIndex) { sel.selectedIndex = newIdx; sel.dispatchEvent(new Event("change")); }
  }, {passive: false});
}
// Mousewheel on number inputs
function wheelNumber(inp) {
  inp.addEventListener("wheel", e => {
    e.preventDefault();
    const step = parseFloat(inp.step) || 1;
    const dir = e.deltaY > 0 ? -step : step;
    const min = parseFloat(inp.min); const max = parseFloat(inp.max);
    let v = (parseFloat(inp.value) || 0) + dir;
    if (!isNaN(min)) v = Math.max(min, v);
    if (!isNaN(max)) v = Math.min(max, v);
    inp.value = v;
    inp.dispatchEvent(new Event("input"));
  }, {passive: false});
}

// Generic modifier select builders
function buildStepSelect(sel, steps, fmtFn, defIdx) {
  sel.innerHTML = "";
  for (let i = 0; i < steps.length; i++) {
    const opt = document.createElement("option");
    opt.value = i; opt.textContent = fmtFn(steps[i], i);
    if (i === (defIdx || 0)) opt.selected = true;
    sel.appendChild(opt);
  }
  wheelSelect(sel);
}

function fmtCp(s) { return `${s.label} (${s.cp >= 0 ? "+" : ""}${s.cp})`; }

// ---- Ability Picker Popup ----
const abilityPicker = {
  overlay: null,
  grid: null,
  onSelect: null,
  currentId: "",

  init() {
    this.overlay = document.getElementById("aid-picker-overlay");
    this.grid = document.getElementById("aid-picker-grid");

    // Build grouped columns
    const cats = {};
    for (const ab of MP.ABILITY_TYPES) { if (!cats[ab.cat]) cats[ab.cat] = []; cats[ab.cat].push(ab); }

    // Layout: 4 columns, balanced by count
    const colCats = [
      ["Vehicle", "Crew", "Cargo", "Movement"],
      ["Offensive"],
      ["Defensive", "Custom"],
      ["Miscellaneous"]
    ];

    for (const catGroup of colCats) {
      const col = document.createElement("div");
      col.className = "aid-picker-col";
      for (const cat of catGroup) {
        if (!cats[cat] || cats[cat].length === 0) continue;
        const hdr = document.createElement("div");
        hdr.className = "aid-picker-cat";
        hdr.textContent = cat;
        col.appendChild(hdr);
        for (const ab of cats[cat]) {
          const item = document.createElement("div");
          item.className = "aid-picker-item";
          item.textContent = ab.name;
          item.dataset.abId = ab.id;
          item.addEventListener("click", () => {
            this._select(ab.id);
          });
          col.appendChild(item);
        }
      }
      this.grid.appendChild(col);
    }

    this.overlay.addEventListener("mousedown", e => { if (e.target === this.overlay) this.close(); });
    this.overlay.addEventListener("keydown", e => { if (e.key === "Escape") this.close(); });
  },

  open(currentId, callback) {
    this.currentId = currentId || "";
    this.onSelect = callback;
    // Highlight current selection
    this.grid.querySelectorAll(".aid-picker-item").forEach(el => {
      el.classList.toggle("selected", el.dataset.abId === this.currentId);
    });
    this.overlay.style.display = "flex";
    this.overlay.focus();
  },

  close() {
    this.overlay.style.display = "none";
    this.onSelect = null;
  },

  _select(abId) {
    if (this.onSelect) this.onSelect(abId);
    this.close();
  }
};

// ---- Main Ability Dialog ----
const abilityDlg = {
  overlay: null,
  targetIdx: null,
  editMode: false, // true when editing existing ability

  init() {
    this.overlay = document.getElementById("ability-dlg-overlay");

    // Build system spaces dropdown
    const spSel = document.getElementById("aid-spaces");
    for (const row of MP.SYS_TABLE) {
      const opt = document.createElement("option");
      opt.value = row.sp; opt.textContent = `${row.sp} sp → ${row.cp} CPs`;
      if (row.sp === 8) opt.selected = true;
      spSel.appendChild(opt);
    }
    wheelSelect(spSel);

    // Build generic modifier dropdowns
    buildStepSelect(document.getElementById("aid-area"), MP.AREA_EFFECT_STEPS, fmtCp, 0);
    buildStepSelect(document.getElementById("aid-ap"), MP.ARMOR_PIERCING_STEPS, fmtCp, 0);
    buildStepSelect(document.getElementById("aid-autofire"), MP.AUTOFIRE_STEPS, fmtCp, 0);
    buildStepSelect(document.getElementById("aid-duration"), MP.DURATION_STEPS, fmtCp, 0);
    buildStepSelect(document.getElementById("aid-hardened"), MP.HARDENED_STEPS, fmtCp, 0);

    // Concentration dropdown
    const concSel = document.getElementById("aid-conc");
    [{l:"None (0)",cp:0},{l:"Activation (-2.5)",cp:-2.5},{l:"Per Use (-5)",cp:-5},{l:"Maintain (-7.5)",cp:-7.5}].forEach((o,i) => {
      const opt = document.createElement("option"); opt.value = i; opt.textContent = o.l; opt.dataset.cp = o.cp; concSel.appendChild(opt);
    });
    wheelSelect(concSel);

    // Knockback dropdown
    const kbSel = document.getElementById("aid-kb");
    [{l:"Normal (0)",cp:0},{l:"Knockback (+5)",cp:5},{l:"No Knockback (-5)",cp:-5},{l:"KB Only (-10)",cp:-10}].forEach((o,i) => {
      const opt = document.createElement("option"); opt.value = i; opt.textContent = o.l; opt.dataset.cp = o.cp; kbSel.appendChild(opt);
    });
    wheelSelect(kbSel);

    // Partial coverage dropdown
    const partSel = document.getElementById("aid-partial");
    [{l:"Full (0)",cp:0},{l:"Heavy (-5)",cp:-5},{l:"Light (-10)",cp:-10}].forEach((o,i) => {
      const opt = document.createElement("option"); opt.value = i; opt.textContent = o.l; opt.dataset.cp = o.cp; partSel.appendChild(opt);
    });
    wheelSelect(partSel);

    // Poor penetration dropdown
    const ppSel = document.getElementById("aid-poorpen");
    [{l:"Normal (0)",cp:0},{l:"Double prot (-5)",cp:-5},{l:"Any prot blocks (-10)",cp:-10}].forEach((o,i) => {
      const opt = document.createElement("option"); opt.value = i; opt.textContent = o.l; opt.dataset.cp = o.cp; ppSel.appendChild(opt);
    });
    wheelSelect(ppSel);

    // Obvious dropdown
    const obvSel = document.getElementById("aid-obvious");
    [{l:"Normal (0)",cp:0},{l:"Unobvious (+5)",cp:5},{l:"Fewer Senses (+2.5)",cp:2.5},{l:"Obvious (-5)",cp:-5},{l:"Extra Senses (-2.5)",cp:-2.5}].forEach((o,i) => {
      const opt = document.createElement("option"); opt.value = i; opt.textContent = o.l; opt.dataset.cp = o.cp; obvSel.appendChild(opt);
    });
    wheelSelect(obvSel);

    // Carrier/Contact dropdown
    const carrSel = document.getElementById("aid-carrier");
    [{l:"None (0)",cp:0},{l:"Carrier Main (+7.5)",cp:7.5},{l:"Carried Atk (+7.5)",cp:7.5},{l:"Contact Atk (+15)",cp:15},{l:"Conductive (+7.5)",cp:7.5}].forEach((o,i) => {
      const opt = document.createElement("option"); opt.value = i; opt.textContent = o.l; opt.dataset.cp = o.cp; carrSel.appendChild(opt);
    });
    wheelSelect(carrSel);

    // Other misc dropdown
    const othSel = document.getElementById("aid-other");
    [{l:"None (0)",cp:0},{l:"Immunity (+2.5)",cp:2.5},{l:"Body Part (-5)",cp:-5},{l:"Focused (0)",cp:0},
     {l:"Reversible (+10)",cp:10},{l:"Selective AE (+12.5)",cp:12.5},{l:"Backlash (-7.5)",cp:-7.5},
     {l:"Overload (+5)",cp:5},{l:"Non-Corp Effect (+5)",cp:5}].forEach((o,i) => {
      const opt = document.createElement("option"); opt.value = i; opt.textContent = o.l; opt.dataset.cp = o.cp; othSel.appendChild(opt);
    });
    wheelSelect(othSel);

    // System Modifiers — Arc dropdown
    const arcSel = document.getElementById("aid-arc");
    [{l:"Forward 120° (0)",cp:0},{l:"No Arc — line only (-10)",cp:-10},{l:"Wide 240° (+5)",cp:5},{l:"Wide 360° (+10)",cp:10}].forEach((o,i) => {
      const opt = document.createElement("option"); opt.value = i; opt.textContent = o.l; opt.dataset.cp = o.cp; arcSel.appendChild(opt);
    });
    wheelSelect(arcSel);

    // Mousewheel on number inputs
    wheelNumber(document.getElementById("aid-bulky"));
    wheelNumber(document.getElementById("aid-delicate"));
    wheelNumber(document.getElementById("aid-breakdown"));

    // Wire ability picker button
    document.getElementById("aid-ability-btn").addEventListener("click", () => {
      const curId = document.getElementById("aid-ability-val").value;
      abilityPicker.open(curId, (abId) => {
        this._setAbility(abId);
      });
    });

    // Wire events — recalc on any modifier change
    spSel.addEventListener("change", () => { this._updateSysStats(); this._updateStats(); this._updateCostBar(); });

    // Wire all modifier controls to update cost bar
    const costInputs = "#aid-area,#aid-ap,#aid-autofire,#aid-duration,#aid-hardened,#aid-conc,#aid-kb,#aid-partial,#aid-poorpen,#aid-obvious,#aid-carrier,#aid-other,#aid-arc,#aid-prch,#aid-range";
    costInputs.split(",").forEach(id => {
      const el = document.querySelector(id);
      if (el) el.addEventListener("change", () => this._updateCostBar());
    });
    ["aid-gear","aid-integral","aid-open","aid-indep","aid-wontexplode"].forEach(id => {
      document.getElementById(id).addEventListener("change", () => { this._updateSysStats(); this._updateCostBar(); });
    });
    ["aid-bulky","aid-delicate","aid-breakdown"].forEach(id => {
      document.getElementById(id).addEventListener("input", () => { this._updateSysStats(); this._updateCostBar(); });
    });

    document.getElementById("aid-ok").addEventListener("click", () => this._commit());
    document.getElementById("aid-cancel").addEventListener("click", () => this.close());
    this.overlay.addEventListener("mousedown", e => { if (e.target === this.overlay) this.close(); });
    this.overlay.addEventListener("keydown", e => { if (e.key === "Escape") this.close(); if (e.key === "Enter") this._commit(); });
  },

  _setAbility(abId) {
    document.getElementById("aid-ability-val").value = abId;
    const ab = MP.abilityById(abId);
    const btn = document.getElementById("aid-ability-btn");
    if (ab) {
      btn.textContent = ab.name;
      btn.classList.add("has-ability");
    } else {
      btn.textContent = "— select ability —";
      btn.classList.remove("has-ability");
    }
    this._onAbilityChange();
  },

  _updateSysStats() {
    const sp = parseInt(document.getElementById("aid-spaces").value) || 8;
    const sysRow = MP.lookupSys(sp);
    const bulky = parseInt(document.getElementById("aid-bulky").value) || 0;
    const delicate = parseInt(document.getElementById("aid-delicate").value) || 0;
    const integral = document.getElementById("aid-integral").checked;
    const open = document.getElementById("aid-open").checked;

    let hits = sysRow ? sysRow.hits : 0;
    hits += Math.ceil(4.3 * bulky);
    hits -= Math.ceil(4.3 * delicate);
    hits = Math.max(1, hits);

    const baseCp = sysRow ? sysRow.cp : 0;
    let cp = baseCp + veh.techMod;
    if (integral) cp = Math.ceil(cp / 2);
    if (open) cp = Math.ceil(cp / 4);
    cp = Math.max(0, cp);

    const prof = sysRow ? sysRow.prof : 0;
    const profStr = prof ? "x" + (Number.isInteger(prof) ? prof : prof.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")) : "—";

    // Integral systems can't be targeted — no Profile or Hits
    document.getElementById("aid-ss-prof").textContent = integral ? "—" : profStr;
    document.getElementById("aid-ss-hits").textContent = integral ? "— (hidden)" : hits;

    // Build CPs string with annotations for tech mod, integral, open
    let cpStr = "(" + cp + ")";
    const notes = [];
    if (veh.techMod !== 0) notes.push((veh.techMod > 0 ? "+" : "") + veh.techMod + " tech");
    if (integral) notes.push("½ integral");
    if (open) notes.push("¼ open");
    if (notes.length) cpStr += " [" + notes.join(", ") + "]";
    document.getElementById("aid-ss-cps").textContent = cpStr;
  },

  _updateStats() {
    const abId = document.getElementById("aid-ability-val").value;
    const sp = parseInt(document.getElementById("aid-spaces").value) || 8;
    const sysRow = MP.lookupSys(sp);
    // Include tech mod so damage/movement/armor calcs reflect actual system CPs
    const cp = (sysRow ? sysRow.cp : 0) + veh.techMod;
    const info = MP.computeAbilityInfo(abId, cp, veh.st, veh.en, veh.ag, veh.intel, veh.cl);
    document.getElementById("aid-stats-info").textContent = info ? info.hint : "";
  },

  // Compute total modifier cost from current dialog state
  _calcModCost() {
    let modAdj = 0;
    const abId = document.getElementById("aid-ability-val").value;

    // Ability-specific modifiers
    const abMods = MP.ABILITY_MODIFIERS[abId] || [];
    for (const am of abMods) {
      if (am.type === "number") {
        const inp = document.querySelector(`input[data-am-id="${am.id}"]`);
        const val = parseInt(inp?.value) || 0;
        if (val > 0) modAdj += am.cpFn(val);
      } else {
        const chk = document.querySelector(`input[data-am-id="${am.id}"]`);
        if (chk?.checked) modAdj += am.cp;
      }
    }

    // Generic modifiers
    function selCp(id) { const s = document.getElementById(id); return parseFloat(s.options[s.selectedIndex]?.dataset?.cp) || 0; }
    function stepCp(id, steps) { const v = parseInt(document.getElementById(id).value); return (v > 0 && steps[v]) ? steps[v].cp : 0; }

    modAdj += stepCp("aid-area", MP.AREA_EFFECT_STEPS);
    modAdj += stepCp("aid-ap", MP.ARMOR_PIERCING_STEPS);
    modAdj += stepCp("aid-autofire", MP.AUTOFIRE_STEPS);
    modAdj += stepCp("aid-duration", MP.DURATION_STEPS);
    modAdj += stepCp("aid-hardened", MP.HARDENED_STEPS);

    if (document.getElementById("aid-gear").checked) modAdj -= 5;

    const bulky = parseInt(document.getElementById("aid-bulky").value) || 0;
    if (bulky > 0) modAdj += bulky * 2.5;
    const delicate = parseInt(document.getElementById("aid-delicate").value) || 0;
    if (delicate > 0) modAdj -= delicate * 2.5;

    modAdj += selCp("aid-prch");
    modAdj += selCp("aid-range");
    modAdj += selCp("aid-conc");
    modAdj += selCp("aid-kb");

    const bkdn = parseInt(document.getElementById("aid-breakdown").value) || 0;
    if (bkdn > 0) modAdj -= bkdn * 2.5;

    modAdj += selCp("aid-partial");
    modAdj += selCp("aid-poorpen");
    modAdj += selCp("aid-obvious");
    modAdj += selCp("aid-carrier");
    modAdj += selCp("aid-other");

    if (document.getElementById("aid-wontexplode").checked) modAdj += 5;
    modAdj += selCp("aid-arc");

    return modAdj;
  },

  _updateCostBar() {
    const sp = parseInt(document.getElementById("aid-spaces").value) || 8;
    const sysRow = MP.lookupSys(sp);
    let budget = sysRow ? sysRow.cp : 0;
    budget += veh.techMod;
    const integral = document.getElementById("aid-integral").checked;
    const open = document.getElementById("aid-open").checked;
    if (integral) budget = Math.ceil(budget / 2);
    if (open) budget = Math.ceil(budget / 4);
    budget = Math.max(0, budget);

    const modAdj = this._calcModCost();

    document.getElementById("aid-cost-budget").textContent = budget + " CPs";
    document.getElementById("aid-cost-spent").textContent = (modAdj >= 0 ? "+" : "") + modAdj;

    const remaining = budget - modAdj;
    const diffEl = document.getElementById("aid-cost-diff");
    if (remaining > 0) {
      diffEl.textContent = remaining + " CPs remaining";
      diffEl.className = "aid-cost-diff under";
    } else if (remaining < 0) {
      diffEl.textContent = Math.abs(remaining) + " CPs over → COST";
      diffEl.className = "aid-cost-diff over";
    } else {
      diffEl.textContent = "0 CPs remaining";
      diffEl.className = "aid-cost-diff even";
    }
  },

  _onAbilityChange() {
    const abId = document.getElementById("aid-ability-val").value;
    const detail = MP.ABILITY_DETAILS[abId];
    const hintEl = document.getElementById("aid-hint-info");
    const prEl = document.getElementById("aid-pr-display");
    if (detail) {
      hintEl.textContent = detail.hint;
      const prText = detail.pr > 0 ? `PR=${detail.pr}` : "PR=0";
      const dmgText = detail.dmg !== "—" ? `${detail.dmg} dmg` : "";
      prEl.textContent = [prText, dmgText].filter(Boolean).join(", ");
    } else { hintEl.textContent = ""; prEl.textContent = ""; }
    this._rebuildPRCharges(detail ? detail.pr : 0);
    this._rebuildRange(detail?.calc?.baseRange || 'BCx1"');
    this._rebuildAbilityMods(abId);
    this._updateSysStats();
    this._updateStats();
    this._updateCostBar();
  },

  _rebuildPRCharges(basePR) {
    const sel = document.getElementById("aid-prch");
    const opts = MP.buildPRChargesOptions(basePR);
    const baseIdx = MP.prScaleIndex(basePR);
    sel.innerHTML = "";
    for (let i = 0; i < opts.length; i++) {
      const opt = document.createElement("option");
      opt.value = i; opt.textContent = opts[i].label; opt.dataset.cp = opts[i].cp;
      if (opts[i].idx === baseIdx) opt.selected = true;
      sel.appendChild(opt);
    }
    wheelSelect(sel);
  },

  _rebuildRange(baseLabel) {
    const sel = document.getElementById("aid-range");
    const opts = MP.buildRangeOptions(baseLabel);
    const baseIdx = MP.rangeScaleIndex(baseLabel);
    sel.innerHTML = "";
    for (let i = 0; i < opts.length; i++) {
      const opt = document.createElement("option");
      opt.value = i; opt.textContent = opts[i].label; opt.dataset.cp = opts[i].cp;
      opt.dataset.rangeLabel = opts[i].rangeLabel;
      if (opts[i].idx === baseIdx) opt.selected = true;
      sel.appendChild(opt);
    }
    wheelSelect(sel);
  },

  _rebuildAbilityMods(abId) {
    const container = document.getElementById("aid-ability-mods");
    const abMods = MP.ABILITY_MODIFIERS[abId];
    container.innerHTML = "";
    if (!abMods || abMods.length === 0) return;
    const hdr = document.createElement("div");
    hdr.className = "aid-section-hdr";
    hdr.textContent = "ABILITY MODIFIERS";
    container.appendChild(hdr);

    for (const am of abMods) {
      const row = document.createElement("div");
      row.className = "aid-mod-row";
      row.dataset.amId = am.id;
      const lbl = document.createElement("label");
      lbl.className = "aid-mlbl"; lbl.textContent = am.label + ":";
      row.appendChild(lbl);

      if (am.type === "number") {
        const inp = document.createElement("input");
        inp.type = "number"; inp.className = "aid-mnum"; inp.value = "0";
        inp.min = "0"; inp.max = String(am.max); inp.step = String(am.step || 1);
        inp.dataset.amId = am.id;
        row.appendChild(inp);
        const hint = document.createElement("span");
        hint.className = "aid-mhint"; hint.textContent = am.hint || "";
        row.appendChild(hint);
        wheelNumber(inp);
        inp.addEventListener("input", () => this._updateCostBar());
      } else {
        const chk = document.createElement("input");
        chk.type = "checkbox"; chk.className = "aid-mchk"; chk.dataset.amId = am.id;
        row.appendChild(chk);
        const cpStr = am.cp !== 0 ? (am.cp > 0 ? "+" + am.cp : String(am.cp)) : "0";
        const hint = document.createElement("span");
        hint.className = "aid-mhint"; hint.textContent = `(${cpStr} CPs)`;
        row.appendChild(hint);
        chk.addEventListener("change", () => this._updateCostBar());
      }
      container.appendChild(row);
    }
  },

  // Capture full dialog state as structured data
  _captureState() {
    const abId = document.getElementById("aid-ability-val").value;
    const state = {
      abId: abId,
      spaces: parseInt(document.getElementById("aid-spaces").value) || 8,
      // Generic modifiers (select indices)
      area: parseInt(document.getElementById("aid-area").value) || 0,
      ap: parseInt(document.getElementById("aid-ap").value) || 0,
      autofire: parseInt(document.getElementById("aid-autofire").value) || 0,
      duration: parseInt(document.getElementById("aid-duration").value) || 0,
      hardened: parseInt(document.getElementById("aid-hardened").value) || 0,
      gear: document.getElementById("aid-gear").checked,
      bulky: parseInt(document.getElementById("aid-bulky").value) || 0,
      delicate: parseInt(document.getElementById("aid-delicate").value) || 0,
      prch: parseInt(document.getElementById("aid-prch").value) || 0,
      range: parseInt(document.getElementById("aid-range").value) || 0,
      conc: parseInt(document.getElementById("aid-conc").value) || 0,
      kb: parseInt(document.getElementById("aid-kb").value) || 0,
      breakdown: parseInt(document.getElementById("aid-breakdown").value) || 0,
      partial: parseInt(document.getElementById("aid-partial").value) || 0,
      poorpen: parseInt(document.getElementById("aid-poorpen").value) || 0,
      obvious: parseInt(document.getElementById("aid-obvious").value) || 0,
      carrier: parseInt(document.getElementById("aid-carrier").value) || 0,
      other: parseInt(document.getElementById("aid-other").value) || 0,
      // System modifiers
      integral: document.getElementById("aid-integral").checked,
      open: document.getElementById("aid-open").checked,
      indep: document.getElementById("aid-indep").checked,
      wontexplode: document.getElementById("aid-wontexplode").checked,
      arc: parseInt(document.getElementById("aid-arc").value) || 0,
      notes: document.getElementById("aid-notes").value.trim(),
    };
    // Ability-specific modifiers
    const abMods = MP.ABILITY_MODIFIERS[abId] || [];
    state.abilityMods = {};
    for (const am of abMods) {
      if (am.type === "number") {
        const inp = document.querySelector(`input[data-am-id="${am.id}"]`);
        state.abilityMods[am.id] = parseInt(inp?.value) || 0;
      } else {
        const chk = document.querySelector(`input[data-am-id="${am.id}"]`);
        state.abilityMods[am.id] = chk?.checked || false;
      }
    }
    return state;
  },

  // Restore dialog from structured data
  _restoreState(state) {
    if (!state) return;
    this._setAbility(state.abId || "");
    const spSel = document.getElementById("aid-spaces");
    spSel.value = String(state.spaces || 8);

    document.getElementById("aid-area").selectedIndex = state.area || 0;
    document.getElementById("aid-ap").selectedIndex = state.ap || 0;
    document.getElementById("aid-autofire").selectedIndex = state.autofire || 0;
    document.getElementById("aid-duration").selectedIndex = state.duration || 0;
    document.getElementById("aid-hardened").selectedIndex = state.hardened || 0;
    document.getElementById("aid-gear").checked = state.gear || false;
    document.getElementById("aid-bulky").value = state.bulky || 0;
    document.getElementById("aid-delicate").value = state.delicate || 0;
    document.getElementById("aid-prch").selectedIndex = state.prch || 0;
    document.getElementById("aid-range").selectedIndex = state.range || 0;
    document.getElementById("aid-conc").selectedIndex = state.conc || 0;
    document.getElementById("aid-kb").selectedIndex = state.kb || 0;
    document.getElementById("aid-breakdown").value = state.breakdown || 0;
    document.getElementById("aid-partial").selectedIndex = state.partial || 0;
    document.getElementById("aid-poorpen").selectedIndex = state.poorpen || 0;
    document.getElementById("aid-obvious").selectedIndex = state.obvious || 0;
    document.getElementById("aid-carrier").selectedIndex = state.carrier || 0;
    document.getElementById("aid-other").selectedIndex = state.other || 0;
    document.getElementById("aid-integral").checked = state.integral || false;
    document.getElementById("aid-open").checked = state.open || false;
    document.getElementById("aid-indep").checked = state.indep || false;
    document.getElementById("aid-wontexplode").checked = state.wontexplode || false;
    document.getElementById("aid-arc").selectedIndex = state.arc || 0;
    document.getElementById("aid-notes").value = state.notes || "";

    // Restore ability-specific modifiers (after _onAbilityChange rebuilds them)
    if (state.abilityMods) {
      for (const [amId, val] of Object.entries(state.abilityMods)) {
        if (typeof val === "boolean") {
          const chk = document.querySelector(`input[data-am-id="${amId}"]`);
          if (chk) chk.checked = val;
        } else {
          const inp = document.querySelector(`input[data-am-id="${amId}"]`);
          if (inp) inp.value = val;
        }
      }
    }

    this._updateSysStats();
    this._updateStats();
    this._updateCostBar();
  },

  _resetDialog() {
    this._setAbility("");
    const spSel = document.getElementById("aid-spaces");
    for (let i = 0; i < spSel.options.length; i++) {
      if (parseInt(spSel.options[i].value) === 8) { spSel.selectedIndex = i; break; }
    }
    document.getElementById("aid-area").selectedIndex = 0;
    document.getElementById("aid-ap").selectedIndex = 0;
    document.getElementById("aid-autofire").selectedIndex = 0;
    document.getElementById("aid-duration").selectedIndex = 0;
    document.getElementById("aid-hardened").selectedIndex = 0;
    document.getElementById("aid-gear").checked = false;
    document.getElementById("aid-bulky").value = "0";
    document.getElementById("aid-delicate").value = "0";
    document.getElementById("aid-conc").selectedIndex = 0;
    document.getElementById("aid-kb").selectedIndex = 0;
    document.getElementById("aid-breakdown").value = "0";
    document.getElementById("aid-partial").selectedIndex = 0;
    document.getElementById("aid-poorpen").selectedIndex = 0;
    document.getElementById("aid-obvious").selectedIndex = 0;
    document.getElementById("aid-carrier").selectedIndex = 0;
    document.getElementById("aid-other").selectedIndex = 0;
    document.getElementById("aid-integral").checked = false;
    document.getElementById("aid-open").checked = false;
    document.getElementById("aid-indep").checked = false;
    document.getElementById("aid-wontexplode").checked = false;
    document.getElementById("aid-arc").selectedIndex = 0;
    document.getElementById("aid-notes").value = "";
  },

  open(rowIdx, editMode) {
    this.targetIdx = rowIdx;
    this.editMode = editMode || false;

    const sys = veh.systems[rowIdx];

    if (this.editMode && sys && sys.abilityData) {
      // Edit mode: restore from structured data
      document.getElementById("aid-title").textContent = "Edit Ability";
      // Need to trigger ability change first to build PR/Range/AbilityMods, then restore
      this._setAbility(sys.abilityData.abId || "");
      // Now restore full state (PR/Range/AbilityMods are rebuilt by _onAbilityChange)
      this._restoreState(sys.abilityData);
    } else {
      // Insert mode: blank dialog
      document.getElementById("aid-title").textContent = "Insert Ability";
      this._resetDialog();
      // Pre-fill spaces and system mods from existing row
      if (sys) {
        if (sys.spaces) document.getElementById("aid-spaces").value = String(sys.spaces);
        if (sys.integral) document.getElementById("aid-integral").checked = true;
        if (sys.open) document.getElementById("aid-open").checked = true;
      }
      this._onAbilityChange();
    }

    this.overlay.style.display = "flex";
    document.getElementById("aid-ability-btn").focus();
  },

  close() { this.overlay.style.display = "none"; this.targetIdx = null; this.editMode = false; },

  // Read CP from a select with data-cp attributes
  _selCp(id) { const s = document.getElementById(id); return parseFloat(s.options[s.selectedIndex]?.dataset?.cp) || 0; },

  _commit() {
    const idx = this.targetIdx;
    if (idx === null) return;
    const abId = document.getElementById("aid-ability-val").value;
    const ab = MP.abilityById(abId);
    const detail = MP.ABILITY_DETAILS[abId];
    const name = ab ? ab.name : "Custom";
    const sp = parseInt(document.getElementById("aid-spaces").value) || 8;
    const sysRow = MP.lookupSys(sp);
    const baseCp = sysRow ? sysRow.cp : 0;
    // Include tech mod for ability info (damage/movement/armor calcs)
    const effectiveCp = baseCp + veh.techMod;
    const info = MP.computeAbilityInfo(abId, effectiveCp, veh.st, veh.en, veh.ag, veh.intel, veh.cl);

    const parts = [];
    let basePart = name;
    if (info && info.desc) basePart += ": " + info.desc;
    basePart += " (" + baseCp + ")";
    parts.push(basePart);

    let modAdj = 0, bulkyTotal = 0, delicateTotal = 0;

    // Ability-specific modifiers first
    const abMods = MP.ABILITY_MODIFIERS[abId] || [];
    for (const am of abMods) {
      if (am.type === "number") {
        const inp = document.querySelector(`input[data-am-id="${am.id}"]`);
        const val = parseInt(inp?.value) || 0;
        if (val > 0) {
          const c = am.cpFn(val);
          const cpStr = c >= 0 ? "+" + c : String(c);
          parts.push(`${am.label} x${val} (${cpStr})`);
          modAdj += c;
        }
      } else {
        const chk = document.querySelector(`input[data-am-id="${am.id}"]`);
        if (chk?.checked) {
          const cpStr = am.cp >= 0 ? "+" + am.cp : String(am.cp);
          parts.push(am.cp !== 0 ? `${am.label} (${cpStr})` : am.label);
          modAdj += am.cp;
        }
      }
    }

    // Generic modifiers
    function addSelect(id, steps, descFn) {
      const val = parseInt(document.getElementById(id).value);
      if (val > 0 && steps[val]) {
        const c = steps[val].cp;
        parts.push(descFn(steps[val], c));
        modAdj += c;
      }
    }
    addSelect("aid-area", MP.AREA_EFFECT_STEPS, (s,c) => `Area Effect ${s.label} (+${c})`);
    addSelect("aid-ap", MP.ARMOR_PIERCING_STEPS, (s,c) => `AP ${s.val} (+${c})`);
    addSelect("aid-autofire", MP.AUTOFIRE_STEPS, (s,c) => `AF x${s.rof} (+${c})`);
    addSelect("aid-duration", MP.DURATION_STEPS, (s,c) => `Duration ${s.label} (+${c})`);
    addSelect("aid-hardened", MP.HARDENED_STEPS, (s,c) => `Hardened ${s.val} (+${c})`);

    if (document.getElementById("aid-gear").checked) { parts.push("Gear (-5)"); modAdj -= 5; }

    const bulky = parseInt(document.getElementById("aid-bulky").value) || 0;
    if (bulky > 0) { const c = bulky * 2.5; parts.push(`Bulky x${bulky} (+${c})`); modAdj += c; bulkyTotal = bulky; }
    const delicate = parseInt(document.getElementById("aid-delicate").value) || 0;
    if (delicate > 0) { const c = delicate * 2.5; parts.push(`Delicate x${delicate} (-${c})`); modAdj -= c; delicateTotal = delicate; }

    // PR/Charges
    const prchCp = this._selCp("aid-prch");
    if (prchCp !== 0) {
      const prchSel = document.getElementById("aid-prch");
      const row = MP.PR_CHARGES_SCALE[parseInt(prchSel.value)];
      if (row) { const cpStr = prchCp > 0 ? "+" + prchCp : String(prchCp); parts.push(`${row.label} (${cpStr})`); }
      modAdj += prchCp;
    }

    // Range
    const rngSel = document.getElementById("aid-range");
    const rngCp = parseFloat(rngSel.options[rngSel.selectedIndex]?.dataset?.cp) || 0;
    if (rngCp !== 0) {
      const rngLabel = rngSel.options[rngSel.selectedIndex]?.dataset?.rangeLabel || "";
      const cpStr = rngCp > 0 ? "+" + rngCp : String(rngCp);
      parts.push(`Range ${rngLabel} (${cpStr})`);
      modAdj += rngCp;
    }

    // Misc dropdowns
    function addCpSel(id, labelFn) {
      const c = abilityDlg._selCp(id);
      if (c !== 0) { const s = document.getElementById(id); const txt = s.options[s.selectedIndex].textContent.replace(/ \([^)]*\)$/, "");
        parts.push(`${labelFn ? labelFn(txt) : txt} (${c > 0 ? "+" + c : c})`); modAdj += c; }
    }
    addCpSel("aid-conc");
    addCpSel("aid-kb");
    addCpSel("aid-partial");
    addCpSel("aid-poorpen");
    addCpSel("aid-obvious");
    addCpSel("aid-carrier");
    addCpSel("aid-other");

    const bkdn = parseInt(document.getElementById("aid-breakdown").value) || 0;
    if (bkdn > 0) { const c = bkdn * 2.5; parts.push(`Breakdown x${bkdn} (-${c})`); modAdj -= c; }

    // System modifiers
    const isIntegral = document.getElementById("aid-integral").checked;
    const isOpen = document.getElementById("aid-open").checked;
    const isIndep = document.getElementById("aid-indep").checked;
    const wontExplode = document.getElementById("aid-wontexplode").checked;
    const arcCp = this._selCp("aid-arc");

    if (isIntegral) {
      const halfCp = Math.ceil((baseCp + veh.techMod) / 2);
      parts.push(`Integral (½ → ${halfCp} CPs)`);
    }
    if (isOpen) {
      let openBase = baseCp + veh.techMod;
      if (isIntegral) openBase = Math.ceil(openBase / 2);
      const qtrCp = Math.ceil(openBase / 4);
      parts.push(`Open (¼ → ${qtrCp} CPs)`);
    }
    if (isIndep) parts.push("Indep. Power");
    if (wontExplode) { parts.push("Won't Explode (+5)"); modAdj += 5; }
    if (arcCp !== 0) {
      const arcSel = document.getElementById("aid-arc");
      const arcTxt = arcSel.options[arcSel.selectedIndex].textContent.replace(/ \([^)]*\)$/, "");
      const cpStr = arcCp > 0 ? "+" + arcCp : String(arcCp);
      parts.push(`${arcTxt} (${cpStr})`);
      modAdj += arcCp;
    }

    const notes = document.getElementById("aid-notes").value.trim();
    if (notes) parts.push(notes);

    // Capture structured state before modifying system
    const abilityData = this._captureState();

    const spaces = parseInt(document.getElementById("aid-spaces").value) || 8;
    while (veh.systems.length <= idx) veh.addSystem();
    const sys = veh.systems[idx];

    if (this.editMode) {
      // Edit mode: replace system ability data entirely
      sys.spaces = spaces;
      sys.desc = parts.join(", ");
      sys.extraCPs = modAdj;
      sys.bulky = bulkyTotal;
      sys.delicate = delicateTotal;
      sys.integral = isIntegral;
      sys.open = isOpen;
      sys.abilityData = abilityData;
    } else {
      // Insert mode: append to existing system
      if (!sys.spaces) sys.spaces = spaces;
      if (bulkyTotal) sys.bulky = (sys.bulky || 0) + bulkyTotal;
      if (delicateTotal) sys.delicate = (sys.delicate || 0) + delicateTotal;
      if (isIntegral) sys.integral = true;
      if (isOpen) sys.open = true;
      if (sys.desc && sys.desc.trim()) sys.desc += ", " + parts.join(", ");
      else sys.desc = parts.join(", ");
      if (modAdj !== 0) sys.extraCPs = (sys.extraCPs || 0) + modAdj;
      sys.abilityData = abilityData;
    }

    this.close();
    updateAll();
  }
};

abilityPicker.init();
abilityDlg.init();



// Ctrl+I keydown handler on system rows
document.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "i") return;
  // Find which system row has focus (or desc input is focused)
  const active = document.activeElement;
  if (!active) return;
  const rowWrap = active.closest(".vs-sys-row-wrap[data-idx]");
  if (!rowWrap) return;
  e.preventDefault();
  const idx = parseInt(rowWrap.dataset.idx);
  if (isNaN(idx)) return;
  abilityDlg.open(idx, false);
});

// ---- Init ----
const layoutCanvasEl = document.getElementById("vs-layout-canvas");
const layoutWrapEl = document.getElementById("vs-layout-wrap");
editor = new FloorPlanEditor(layoutCanvasEl, layoutWrapEl, veh);
editor.onUpdate = () => {
  updateActiveIndicator();
  updateSystemDropdown();
  editor.draw();
};
editor.panX = 20;
editor.panY = 20;

// Restore from localStorage if available
if (autoLoad()) {
  syncFormFromVeh();
}
updateAll();

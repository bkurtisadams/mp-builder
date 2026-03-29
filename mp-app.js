// mp-app.js v2.8.0 — Open System, maneuver input, stats spread, tooltips

const veh = new Vehicle();
let editor = null;
let layoutEditor = null;

// ---- Tab navigation ----
document.querySelectorAll(".mp-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mp-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".mp-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "editor" && editor) {
      setTimeout(() => { editor._resize(); editor.draw(); }, 50);
    }
  });
});

// ---- Palette ----
function buildPalette() {
  const scroll = document.getElementById("ed-pal-scroll");
  let html = '<div style="padding:6px 8px;font-size:9px;color:var(--tx3);font-style:italic">Select a system on the Record Sheet, then paint its cells here.</div>';
  html += '<div class="ed-pal-cat">Current Systems</div>';
  for (const sys of veh.systems) {
    if (!sys.desc && !sys.spaces) continue;
    const active = editor && editor.activeSysId === sys.id;
    html += `<div class="ed-pal-item${active ? " active" : ""}" data-sysid="${sys.id}">
      <span class="ed-pal-sw" style="background:#707070"></span>
      <span class="ed-pal-nm">${sys.desc || "?"} (${sys.cells.length}/${sys.spaces})</span>
    </div>`;
  }
  scroll.innerHTML = html;
  scroll.querySelectorAll(".ed-pal-item[data-sysid]").forEach(el => {
    el.addEventListener("click", () => {
      editor.setActiveSys(parseInt(el.dataset.sysid));
      updateModeButtons();
      buildPalette();
    });
  });
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
  document.getElementById("vs-init").textContent = MP.initDie(MP.save(veh.cl));

  renderSystemsTable();
  renderKey();
  if (editor) { editor.draw(); buildPalette(); }
  if (layoutEditor) layoutEditor.draw();
}

// ---- Systems table: 18 rows + remaining ----
const SYS_ROW_COUNT = 18;

function renderSystemsTable() {
  const el = document.getElementById("vs-sys-rows");
  let html = "";

  for (let i = 0; i < SYS_ROW_COUNT; i++) {
    const s = veh.systems[i] || null;
    const active = s && editor && editor.activeSysId === s.id ? " active" : "";
    const cost = s ? (s.extraCPs || "") : "";
    const spaces = s ? (s.spaces || "") : "";
    const prof = s && s.spaces ? veh.sysProfileDisplay(s) : "";
    const hits = s && s.spaces ? veh.sysHits(s) : "";
    const hitsDisplay = hits !== "" ? `(${hits})` : "";
    const pts = s && s.spaces ? `(${veh.sysBaseCPs(s)})` : "";
    const dmg = s ? (s.dmg || "") : "";
    const desc = s ? (s.desc || "") : "";
    const integral = s ? (s.integral || false) : false;
    const open = s ? (s.open || false) : false;
    const bulky = s ? (s.bulky || "") : "";
    const delicate = s ? (s.delicate || "") : "";
    const adjST = s ? (s.adjST || "") : "";
    const adjEN = s ? (s.adjEN || "") : "";
    const adjAG = s ? (s.adjAG || "") : "";
    const adjIN = s ? (s.adjIN || "") : "";
    const adjCL = s ? (s.adjCL || "") : "";

    html += `<div class="vs-sys-row-wrap${active}" data-idx="${i}">
      <div class="vs-sys-row">
        <input type="number" value="${cost}" data-field="extraCPs" data-idx="${i}" step="2.5" min="0" title="Extra CPs added to this system (adds to vehicle cost)">
        <input type="number" value="${spaces}" data-field="spaces" data-idx="${i}" min="0" title="System spaces allocated">
        <span class="vs-sys-val">${prof}</span>
        <span class="vs-sys-val">${hitsDisplay}</span>
        <input type="text" value="${dmg}" data-field="dmg" data-idx="${i}" title="Damage taken by this system">
        <span class="vs-sys-val vs-sys-pts">${pts}</span>
        <input type="text" class="vs-sys-desc" value="${desc}" data-field="desc" data-idx="${i}" title="System name, abilities, arc, notes">
        <span class="vs-sys-del" data-idx="${i}" title="Clear row">&times;</span>
      </div>
      <div class="vs-sys-mods">
        <input type="checkbox" data-field="integral" data-idx="${i}" ${integral ? "checked" : ""} title="Integral — hidden, can't be targeted. Halves CPs.">
        <input type="number" value="${bulky}" data-field="bulky" data-idx="${i}" min="0" title="Bulky — +4.3 Hits per dose, +2.5 CP cost per dose">
        <input type="number" value="${delicate}" data-field="delicate" data-idx="${i}" min="0" title="Delicate — -4.3 Hits per dose, -2.5 CP cost per dose">
        <input type="checkbox" data-field="open" data-idx="${i}" ${open ? "checked" : ""} title="Open System — passable, yields ¼ CPs">
        <input type="number" value="${adjST}" data-field="adjST" data-idx="${i}" title="ST adjustment from this system">
        <input type="number" value="${adjEN}" data-field="adjEN" data-idx="${i}" title="EN adjustment from this system">
        <input type="number" value="${adjAG}" data-field="adjAG" data-idx="${i}" title="AG adjustment (e.g. Automation)">
        <input type="number" value="${adjIN}" data-field="adjIN" data-idx="${i}" title="IN adjustment (e.g. Robot Brain)">
        <input type="number" value="${adjCL}" data-field="adjCL" data-idx="${i}" title="CL adjustment (e.g. Performance)">
      </div>
    </div>`;
  }

  // Row 19: remaining
  html += `<div class="vs-sys-row-wrap vs-sys-remain">
    <div class="vs-sys-row">
      <span class="vs-sys-val"></span>
      <span class="vs-sys-val">${veh.remainingSpaces}</span>
      <span></span><span></span><span></span><span></span>
      <span class="vs-remain-note"><em>Remaining system spaces for rooms, storage, corridors etc</em></span>
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

  // Wire row click for floor plan
  el.querySelectorAll(".vs-sys-row-wrap").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT" || e.target.classList.contains("vs-sys-del")) return;
      const idx = parseInt(row.dataset.idx);
      const sys = veh.systems[idx];
      if (sys && editor) editor.setActiveSys(sys.id);
      updateAll();
    });
  });
}

// ---- Vehicle Key: 4 columns, 6 rows ----
const KEY_ROW_COUNT = 6;

function renderKey() {
  const tbody = document.getElementById("vs-key-tbody");
  let html = "";
  for (let i = 0; i < KEY_ROW_COUNT; i++) {
    const left = i;
    const right = i + KEY_ROW_COUNT;
    const kL = veh.keyEntries[left] || null;
    const kR = veh.keyEntries[right] || null;
    html += `<tr>
      <td><input type="text" class="vs-key-label" value="${kL ? kL.label : ""}" data-kidx="${left}" data-field="label" placeholder="#"></td>
      <td><input type="text" class="vs-key-desc" value="${kL ? kL.desc : ""}" data-kidx="${left}" data-field="desc"></td>
      <td><input type="text" class="vs-key-label" value="${kR ? kR.label : ""}" data-kidx="${right}" data-field="label" placeholder="#"></td>
      <td><input type="text" class="vs-key-desc" value="${kR ? kR.desc : ""}" data-kidx="${right}" data-field="desc"></td>
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
document.getElementById("btn-import-img").addEventListener("click", () => {
  document.getElementById("inp-picture").click();
});
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

// ---- Mode buttons ----
function updateModeButtons() {
  if (!editor) return;
  document.getElementById("btn-mode-select").classList.toggle("active", editor.mode === "select");
  document.getElementById("btn-mode-paint").classList.toggle("active", editor.mode === "paint");
  document.getElementById("btn-mode-erase").classList.toggle("active", editor.mode === "erase");
}
document.getElementById("btn-mode-select").addEventListener("click", () => { editor.setMode("select"); updateModeButtons(); });
document.getElementById("btn-mode-paint").addEventListener("click", () => { if (editor.activeSysId) editor.setMode("paint"); updateModeButtons(); });
document.getElementById("btn-mode-erase").addEventListener("click", () => { editor.setMode("erase"); updateModeButtons(); });
document.getElementById("btn-zoom-in").addEventListener("click", () => editor.zoomIn());
document.getElementById("btn-zoom-out").addEventListener("click", () => editor.zoomOut());
document.getElementById("btn-zoom-reset").addEventListener("click", () => editor.resetView());

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
      document.getElementById("vs-name").value = veh.name;
      document.getElementById("vs-model").value = veh.model;
      document.getElementById("vs-operator").value = veh.operator;
      document.getElementById("vs-basic-cost").value = veh.basicCost;
      document.getElementById("vs-tech").value = veh.techMod;
      document.getElementById("vs-maneuver").value = veh.maneuverMod;
      document.getElementById("vs-noexplode").checked = veh.wontExplode;
      document.getElementById("vs-base").checked = veh.isBase;
      if (veh.pictureData) {
        const img = document.getElementById("vs-picture-img");
        img.src = veh.pictureData;
        img.style.display = "block";
        document.getElementById("vs-picture-area").classList.add("has-image");
      }
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

document.getElementById("btn-png").addEventListener("click", () => {
  const c = editor.toImage(600);
  if (!c) { alert("No cells painted."); return; }
  const a = document.createElement("a");
  a.download = (veh.name || "vehicle").replace(/\s+/g, "_") + "_floorplan.png";
  a.href = c.toDataURL("image/png");
  a.click();
});

// ---- Init ----
const canvasEl = document.getElementById("ed-canvas");
const wrapEl = document.getElementById("ed-canvas-wrap");
editor = new FloorPlanEditor(canvasEl, wrapEl, veh);
editor.onUpdate = () => { updateAll(); };
editor.panX = 40;
editor.panY = 40;

const layoutCanvasEl = document.getElementById("vs-layout-canvas");
const layoutWrapEl = document.getElementById("vs-layout-wrap");
layoutEditor = new FloorPlanEditor(layoutCanvasEl, layoutWrapEl, veh);
layoutEditor.onUpdate = () => { updateAll(); };
layoutEditor.panX = 20;
layoutEditor.panY = 20;

updateAll();

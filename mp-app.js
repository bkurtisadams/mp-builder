// mp-app.js v3.1.0 — System dropdown in layout toolbar, color categories, no notes

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
  if (editor) editor.draw();
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

    html += `<div class="vs-sys-row-wrap" data-idx="${i}">
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
  sel.innerHTML = html;
  // Restore selection if still valid
  if (editor && editor.activeSysId) {
    sel.value = String(editor.activeSysId);
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
  const sys = veh.findSystem(editor.activeSysId);
  if (!sys) {
    el.innerHTML = '<span style="font-size:8px;color:var(--tx3);font-style:italic">Select a system to paint</span>';
    return;
  }
  const color = MP.sysColor(sys.desc);
  const name = sys.desc || "(unnamed)";
  const placed = sys.cells.length;
  const total = sys.spaces || 0;
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

// ---- Layout toolbar: system dropdown ----
document.getElementById("sel-layout-sys").addEventListener("change", () => {
  const sel = document.getElementById("sel-layout-sys");
  const sysId = parseInt(sel.value) || null;
  if (editor) {
    editor.activeSysId = sysId;
    if (sysId) {
      editor.setMode("paint");
    } else {
      editor.setMode("select");
    }
    updateModeButtons();
    updateActiveIndicator();
    editor.draw();
  }
});

// ---- Mode buttons ----
function updateModeButtons() {
  if (!editor) return;
  document.getElementById("btn-mode-paint").classList.toggle("active", editor.mode === "paint");
  document.getElementById("btn-mode-erase").classList.toggle("active", editor.mode === "erase");
}
document.getElementById("btn-mode-paint").addEventListener("click", () => {
  if (editor && editor.activeSysId) {
    editor.setMode("paint");
    updateModeButtons();
  }
});
document.getElementById("btn-mode-erase").addEventListener("click", () => {
  if (editor) {
    editor.setMode("erase");
    updateModeButtons();
  }
});
document.getElementById("btn-zoom-in").addEventListener("click", () => editor.zoomIn());
document.getElementById("btn-zoom-out").addEventListener("click", () => editor.zoomOut());
document.getElementById("btn-zoom-reset").addEventListener("click", () => editor.resetView());

// ---- Silhouette ----
document.getElementById("btn-sil-import").addEventListener("click", () => {
  document.getElementById("inp-silhouette").click();
});
document.getElementById("inp-silhouette").addEventListener("change", e => {
  if (!e.target.files.length) return;
  const reader = new FileReader();
  reader.onload = ev => {
    // Load image to get aspect ratio, then set silhouette at ~10 cells wide
    const img = new Image();
    img.onload = () => {
      const gw = 10;
      const gh = Math.round(gw * (img.height / img.width));
      editor.loadSilhouette(ev.target.result, gw, Math.max(2, gh));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(e.target.files[0]);
  e.target.value = "";
});
document.getElementById("btn-sil-clear").addEventListener("click", () => {
  if (editor) editor.clearSilhouette();
});
// Stub: built-in silhouettes dropdown (empty for now)
document.getElementById("sel-silhouette").addEventListener("change", () => {
  const sel = document.getElementById("sel-silhouette");
  // Future: load built-in silhouette by ID
  // const id = sel.value;
  // if (id && MP.SILHOUETTES[id]) editor.loadSilhouette(MP.SILHOUETTES[id].data, ...);
  sel.value = "";
});

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

document.getElementById("btn-png").addEventListener("click", () => {
  const c = editor.toImage(600);
  if (!c) { alert("No cells painted."); return; }
  const a = document.createElement("a");
  a.download = (veh.name || "vehicle").replace(/\s+/g, "_") + "_floorplan.png";
  a.href = c.toDataURL("image/png");
  a.click();
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

updateAll();

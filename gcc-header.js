// gcc-header.js v2.0.0 — 2026-04-04
// Shared site-wide header logic + theme system for all GCC pages

(function() {
  const ESC = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };

  // ── System Registry ──
  const SYSTEM_DEFS = [
    { id: 'mp', name: 'Mighty Protectors', icon: '🛡', tools: [
      { id: 'mp-char', name: 'Character Builder', href: 'character.html' },
      { id: 'mp-veh', name: 'Vehicle Builder', href: 'vehicle.html' },
      { id: 'mp-campaign', name: 'Campaign Manager', href: 'campaign.html' },
      { id: 'mp-canvas', name: 'Canvas (Layout Editor)', href: null },
    ]},
    { id: 'faserip', name: 'FASERIP', icon: '⚡', tools: [
      { id: 'fas-char', name: 'Character Sheet', href: null },
      { id: 'fas-table', name: 'Universal Table', href: null },
      { id: 'fas-combat', name: 'Combat Tracker', href: null },
      { id: 'fas-karma', name: 'Karma Log', href: null },
    ]},
    { id: 'add1e', name: 'AD&D 1st Edition', icon: '🗡', tools: [
      { id: 'add1-char', name: 'Character Sheet', href: null },
      { id: 'add1-enc', name: 'Encounter Generator', href: null },
      { id: 'add1-trs', name: 'Treasure Generator', href: null },
      { id: 'add1-wild', name: 'Wilderness Generator', href: null },
      { id: 'add1-dun', name: 'DMG Dungeon Builder', href: null },
      { id: 'add1-voy', name: 'Voyage Simulator', href: null },
    ]},
    { id: 'add2e', name: 'AD&D 2nd Edition', icon: '📜', tools: [
      { id: 'add2-char', name: 'Character Sheet', href: null },
    ]},
    { id: 'chainmail', name: 'Chainmail', icon: '⛓', tools: [
      { id: 'chain-battle', name: 'Battle Simulator', href: null },
    ]},
  ];

  const SHARED_TOOLS = [
    { icon: '📅', name: 'Calendar & Time' },
    { icon: '🌦', name: 'Greyhawk Weather' },
    { icon: '🎲', name: 'Dice Roller' },
    { icon: '🖥', name: 'VTT Connections' },
    { icon: '💾', name: 'Export / Import' },
  ];

  // ── Theme ──
  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function getStoredTheme() {
    try { return localStorage.getItem('gcc-theme'); } catch(e) { return null; }
  }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-gcc-theme', t);
    const icon = document.getElementById('gcc-theme-icon');
    if (icon) icon.textContent = t === 'dark' ? '☀' : '☽';
    // Notify page-level code that theme changed
    window.dispatchEvent(new CustomEvent('gcc-theme-change', { detail: { theme: t } }));
  }
  function initTheme() {
    applyTheme(getStoredTheme() || getSystemTheme());
  }

  // Apply theme immediately (before DOM ready) to prevent flash
  initTheme();

  // ── Detect current page ──
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  // ── Render ──
  function renderGCCBar() {
    const bar = document.getElementById('gcc-bar');
    if (!bar) return;

    // Build tools dropdown
    let dd = '<div class="gcc-td-section"><div class="gcc-td-section-title">SYSTEM TOOLS</div>';
    SYSTEM_DEFS.forEach(sys => {
      dd += `<div class="gcc-td-sys-hdr"><span class="gcc-td-sys-icon">${sys.icon}</span> ${ESC(sys.name)}</div>`;
      sys.tools.forEach(t => {
        const isActive = t.href && t.href === currentPage;
        const cls = t.href ? ('gcc-td-link' + (isActive ? ' active' : '')) : 'gcc-td-link disabled';
        dd += `<a class="${cls}"${t.href ? ' href="'+ESC(t.href)+'"' : ''}><span class="bullet">◆</span> ${ESC(t.name)}</a>`;
      });
    });
    dd += '</div><div class="gcc-td-section"><div class="gcc-td-section-title">SHARED TOOLS</div>';
    SHARED_TOOLS.forEach(t => {
      dd += `<a class="gcc-td-shared-link" href="#"><span class="gcc-td-shared-icon">${t.icon}</span> ${ESC(t.name)}</a>`;
    });
    dd += '</div>';

    document.getElementById('gcc-tools-dd').innerHTML = dd;

    // Wire tools dropdown
    const btnTools = document.getElementById('gcc-btn-tools');
    const toolsDD = document.getElementById('gcc-tools-dd');
    const toolsOL = document.getElementById('gcc-tools-overlay');

    btnTools.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = toolsDD.classList.toggle('open');
      toolsOL.classList.toggle('open', open);
    });
    toolsOL.addEventListener('click', () => {
      toolsDD.classList.remove('open');
      toolsOL.classList.remove('open');
    });
  }

  // ── Wire theme on any page (even without gcc-bar) ──
  function wireTheme() {
    const btnTheme = document.getElementById('gcc-btn-theme');
    if (btnTheme && !btnTheme._gccWired) {
      btnTheme._gccWired = true;
      btnTheme.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-gcc-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try { localStorage.setItem('gcc-theme', next); } catch(e) {}
      });
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!getStoredTheme()) applyTheme(e.matches ? 'dark' : 'light');
    });
  }

  // ── Init ──
  function init() {
    renderGCCBar();
    wireTheme();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose theme API for page-level code
  window.GCCTheme = { apply: applyTheme, get: () => document.documentElement.getAttribute('data-gcc-theme') };
})();

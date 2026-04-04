// gcc-header.js v1.0.0 — 2026-04-04
// Shared site-wide header logic for all GCC pages

(function() {
  const ESC = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };

  // ── System Registry (mirrors gcc-data.js SYSTEM_DEFS) ──
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

  // ── Detect current page for active highlighting ──
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  // ── Render the GCC site bar ──
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

    // Wire up dropdown toggle
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

  // ── Init on DOM ready ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderGCCBar);
  } else {
    renderGCCBar();
  }
})();

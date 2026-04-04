// gcc-data.js v1.0.0 — 2026-04-02
// Graycloak's Campaign Corner — core data layer

const GCC = (function() {

  // ── Storage helpers ──
  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch(e) { return null; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
  }

  // ── Keys ──
  const KEYS = {
    campaigns: 'gcc-campaigns',
    systems: 'gcc-systems',
    activity: 'gcc-activity',
    jumpback: 'gcc-jumpback',
    vtts: 'gcc-vtts',
    settings: 'gcc-settings',
    // Legacy MP keys (read for migration)
    mpChars: 'mp-char-list',
    mpVehs: 'mp-veh-list',
    mpCamps: 'mp-campaigns',
    mpCampSel: 'mp-campaign-sel',
  };

  // ── System Registry ──
  // Each system defines its id, display info, and tool definitions
  const SYSTEM_DEFS = [
    {
      id: 'mp',
      name: 'Mighty Protectors',
      icon: '🛡',
      color: '#a03020',
      tools: [
        { id: 'mp-char', name: 'Character Builder', href: 'character.html', charList: 'mp-char-list' },
        { id: 'mp-veh', name: 'Vehicle Builder', href: 'vehicle.html', charList: 'mp-veh-list' },
        { id: 'mp-campaign', name: 'Campaign Manager', href: 'campaign.html' },
        { id: 'mp-canvas', name: 'Canvas (Layout Editor)', href: null },
      ]
    },
    {
      id: 'faserip',
      name: 'FASERIP',
      icon: '⚡',
      color: '#4a7a9a',
      tools: [
        { id: 'fas-char', name: 'Character Sheet', href: 'faserip.html', charList: 'gcc-faserip-chars' },
        { id: 'fas-table', name: 'Universal Table', href: null },
        { id: 'fas-combat', name: 'Combat Tracker', href: null },
        { id: 'fas-karma', name: 'Karma Log', href: null },
      ]
    },
    {
      id: 'add1e',
      name: 'AD&D 1st Edition',
      icon: '🗡',
      color: '#5a8a30',
      tools: [
        { id: 'add1-char', name: 'Character Sheet', href: null },
        { id: 'add1-enc', name: 'Encounter Generator', href: null },
        { id: 'add1-trs', name: 'Treasure Generator', href: null },
        { id: 'add1-wild', name: 'Wilderness Generator', href: null },
        { id: 'add1-dun', name: 'DMG Dungeon Builder', href: null },
        { id: 'add1-voy', name: 'Voyage Simulator', href: null },
      ]
    },
    {
      id: 'add2e',
      name: 'AD&D 2nd Edition',
      icon: '📜',
      color: '#508a7a',
      tools: [
        { id: 'add2-char', name: 'Character Sheet', href: null },
      ]
    },
    {
      id: 'chainmail',
      name: 'Chainmail',
      icon: '⚔',
      color: '#7a5a8a',
      tools: [
        { id: 'cm-mass', name: 'Mass Combat Tracker', href: null },
        { id: 'cm-unit', name: 'Unit Builder', href: null },
      ]
    },
    {
      id: 'vnv',
      name: 'Villains & Vigilantes',
      icon: '💥',
      color: '#9a6a30',
      tools: [
        { id: 'vnv-char', name: 'Character Sheet', href: null },
      ]
    },
  ];

  // ── System-specific labels ──
  const TEAM_LABELS = {
    faserip: 'Team',
    mp: 'Team',
    vnv: 'Team',
    add1e: 'Party',
    add2e: 'Party',
    chainmail: 'Army',
  };
  function teamLabel(systemId) {
    return TEAM_LABELS[systemId] || 'Party';
  }

  // ── Campaigns ──
  function loadCampaigns() {
    return load(KEYS.campaigns) || [];
  }
  function saveCampaigns(list) {
    save(KEYS.campaigns, list);
  }
  function getCampaign(id) {
    return loadCampaigns().find(c => c.id === id) || null;
  }
  function addCampaign(data) {
    const list = loadCampaigns();
    const camp = {
      id: 'camp-' + Date.now(),
      name: data.name || 'Untitled',
      system: data.system || 'mp',
      gm: data.gm || '',
      gmTitle: data.gmTitle || 'GM',
      world: data.world || '',
      genre: data.genre || '',
      pitch: data.pitch || '',
      status: data.status || 'active',
      players: data.players || 0,
      session: data.session || 0,
      lastPlayed: data.lastPlayed || null,
      nextSession: data.nextSession || null,
      schedule: data.schedule || '',
      playMode: data.playMode || 'online',
      vttLabel: data.vttLabel || '',
      vttUrl: data.vttUrl || '',
      vttPlatform: data.vttPlatform || '',
      xpMethod: data.xpMethod || '',
      rulebooks: data.rulebooks || '',
      houseRules: data.houseRules || '',
      pinned: data.pinned || false,
      campaignImage: data.campaignImage || '',
      startDate: data.startDate || null,
      notes: data.notes || '',
      characters: data.characters || [],
      sessions: data.sessions || [],
      created: data.created || new Date().toISOString(),
    };
    list.push(camp);
    saveCampaigns(list);
    return camp;
  }
  function updateCampaign(id, updates) {
    const list = loadCampaigns();
    const camp = list.find(c => c.id === id);
    if (!camp) return null;
    Object.assign(camp, updates);
    saveCampaigns(list);
    return camp;
  }
  function deleteCampaign(id) {
    const list = loadCampaigns().filter(c => c.id !== id);
    saveCampaigns(list);
  }

  // ── Activity Log ──
  function loadActivity() {
    return load(KEYS.activity) || [];
  }
  function logActivity(entry) {
    const list = loadActivity();
    list.unshift({
      id: 'act-' + Date.now(),
      date: new Date().toISOString(),
      campaign: entry.campaign || null,
      system: entry.system || null,
      tool: entry.tool || null,
      text: entry.text || '',
      href: entry.href || null,
    });
    // Keep last 50
    if (list.length > 50) list.length = 50;
    save(KEYS.activity, list);
  }

  // ── Jump Back In ──
  function loadJumpback() {
    return load(KEYS.jumpback) || [];
  }
  function trackJumpback(entry) {
    let list = loadJumpback();
    // Remove existing entry with same href
    list = list.filter(j => j.href !== entry.href);
    list.unshift({
      href: entry.href,
      label: entry.label || '',
      name: entry.name || '',
      detail: entry.detail || '',
      system: entry.system || null,
      ts: new Date().toISOString(),
    });
    // Keep last 10
    if (list.length > 10) list.length = 10;
    save(KEYS.jumpback, list);
  }

  // ── VTT Connections ──
  function loadVTTs() {
    return load(KEYS.vtts) || [];
  }
  function saveVTTs(list) {
    save(KEYS.vtts, list);
  }

  // ── Character list helpers (cross-system) ──
  // Returns characters from a specific system's localStorage list
  function getCharactersForSystem(systemId) {
    const sys = SYSTEM_DEFS.find(s => s.id === systemId);
    if (!sys) return [];
    const results = [];
    sys.tools.forEach(t => {
      if (t.charList) {
        const list = load(t.charList) || [];
        list.forEach((item, idx) => {
          results.push({ ...item, _toolId: t.id, _listKey: t.charList, _idx: idx });
        });
      }
    });
    return results;
  }

  // Get all characters across all systems
  function getAllCharacters() {
    const all = [];
    SYSTEM_DEFS.forEach(sys => {
      getCharactersForSystem(sys.id).forEach(c => {
        all.push({ ...c, _system: sys.id });
      });
    });
    return all;
  }

  // ── Migration from old MP Builder data ──
  function migrateFromMP() {
    if (load('gcc-migrated')) return;

    const mpCamps = load(KEYS.mpCamps) || [];
    const mpSel = localStorage.getItem(KEYS.mpCampSel) || '';
    const mpChars = load(KEYS.mpChars) || [];

    if (mpCamps.length > 0 && loadCampaigns().length === 0) {
      const newCamps = mpCamps.map(mc => ({
        id: mc.id,
        name: mc.name || 'MP Campaign',
        system: 'mp',
        players: 0,
        session: 0,
        lastPlayed: null,
        vttLabel: '',
        vttUrl: '',
        notes: '',
        characters: [],
        sessions: [],
        created: new Date().toISOString(),
      }));

      // Assign characters to campaigns by _campaign field
      mpChars.forEach((ch, idx) => {
        const campId = ch._campaign || mpSel || (mpCamps[0] && mpCamps[0].id);
        const camp = newCamps.find(c => c.id === campId);
        if (camp) {
          camp.characters.push({
            type: 'mp-char',
            listKey: 'mp-char-list',
            idx: idx,
            name: ch.name || 'Unnamed',
          });
        }
      });

      saveCampaigns(newCamps);
    }

    save('gcc-migrated', true);
  }

  // ── Init ──
  function init() {
    migrateFromMP();
  }

  // ── Public API ──
  return {
    KEYS,
    SYSTEM_DEFS,
    TEAM_LABELS,
    teamLabel,
    init,
    // Campaigns
    loadCampaigns,
    saveCampaigns,
    getCampaign,
    addCampaign,
    updateCampaign,
    deleteCampaign,
    // Activity
    loadActivity,
    logActivity,
    // Jumpback
    loadJumpback,
    trackJumpback,
    // VTTs
    loadVTTs,
    saveVTTs,
    // Characters
    getCharactersForSystem,
    getAllCharacters,
    // Helpers
    load,
    save,
  };

})();

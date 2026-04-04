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
        { id: 'fas-char', name: 'Character Sheet', href: null },
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
    // Seed demo data if empty
    if (loadCampaigns().length === 0) {
      seedDemoData();
    }
  }

  function seedDemoData() {
    const camps = [
      {
        id: 'camp-earth676',
        name: 'Earth 676',
        system: 'faserip',
        gm: 'Kurt',
        gmTitle: 'Judge',
        world: 'Earth-676 (Marvel)',
        genre: 'Bronze Age Superhero',
        pitch: 'Street-level supers in 1976 NYC.',
        status: 'active',
        players: 4,
        session: 47,
        lastPlayed: '2026-03-28',
        nextSession: '2026-04-11T19:00',
        schedule: 'Bi-weekly Fri 7–10:30pm CT',
        playMode: 'online',
        vttLabel: 'Roll20',
        vttUrl: 'https://app.roll20.net',
        vttPlatform: 'roll20',
        xpMethod: 'Karma',
        rulebooks: 'Basic FASERIP, Ultimate Powers Book',
        houseRules: '',
        pinned: true,
        notes: '',
        characters: [
          { name: 'Crosswise', sub: 'F-GD-EX-GD-TY', player: 'Johnny' },
          { name: 'Psyren', sub: 'TY-GD-EX-RM-EX', player: 'Felicia' },
          { name: 'Bulwark', sub: 'IN-RM-GD-TY-GD', player: 'Dave' },
          { name: 'Flashpoint', sub: 'GD-EX-RM-GD-TY', player: 'Mike' },
        ],
        sessions: [
          { date: '2026-03-28', text: 'Session 47 — Time-travel arc. Crosswise critically wounded.' },
          { date: '2026-03-14', text: 'Session 46 — Investigated AIM facility in Jersey City.' },
          { date: '2026-02-28', text: 'Session 45 — Fought Serpent Society, recovered vibranium.' },
        ],
        created: '2025-01-01T00:00:00Z',
      },
      {
        id: 'camp-greyhawk',
        name: 'Greyhawk Wars',
        system: 'add1e',
        gm: 'Kurt',
        gmTitle: 'DM',
        world: 'Greyhawk (Oerth)',
        genre: 'Sandbox / War Campaign',
        pitch: 'CY 582. The wars have begun. Survive, profit, or save the Flanaess.',
        status: 'active',
        players: 6,
        session: 112,
        lastPlayed: '2026-03-15',
        nextSession: null,
        schedule: 'Weekly Sat 6–10pm CT',
        playMode: 'online',
        vttLabel: 'Foundry',
        vttUrl: '',
        vttPlatform: 'foundry',
        xpMethod: 'Gold = XP + Combat XP',
        rulebooks: 'PHB, DMG, UA, MM, FF, Dragon #68–120',
        houseRules: 'Weapon speed, segment initiative, training costs',
        pinned: false,
        notes: '',
        characters: [
          { name: 'Aldric of Verbobonc', sub: 'Ftr 9', player: 'Tom' },
          { name: 'Mirenna', sub: 'M-U 7', player: 'Sarah' },
          { name: 'Brother Osric', sub: 'Clr 8', player: 'Dave' },
          { name: 'Kellan Swiftblade', sub: 'Thf 8', player: 'Mike' },
          { name: 'Elyn Dawnwood', sub: 'Rgr 7', player: 'Jen' },
          { name: 'Grumthar', sub: 'Ftr 6 / Thf 5', player: 'Chris' },
        ],
        sessions: [
          { date: '2026-03-15', text: 'Session 112 — Wilderness encounter near Vesve Forest.' },
          { date: '2026-03-01', text: 'Session 111 — Arrived at Highfolk, met envoy.' },
        ],
        created: '2024-01-01T00:00:00Z',
      },
      {
        id: 'camp-dracolich',
        name: 'Vault of the Dracolich',
        system: 'add2e',
        gm: 'Kurt',
        gmTitle: 'DM',
        world: 'Forgotten Realms',
        genre: 'Dungeon Crawl',
        pitch: 'Classic module run. Three delvers vs. an undead dragon.',
        status: 'hiatus',
        players: 3,
        session: 8,
        lastPlayed: '2026-02-02',
        nextSession: null,
        schedule: '',
        playMode: 'online',
        vttLabel: 'Foundry',
        vttUrl: '',
        vttPlatform: 'foundry',
        xpMethod: 'XP by the book',
        rulebooks: 'PHB, DMG',
        houseRules: '',
        pinned: false,
        notes: '',
        characters: [
          { name: 'Dain Ironforge', sub: 'Ftr 5', player: 'Tom' },
          { name: 'Seraphina', sub: 'Pr 6', player: 'Sarah' },
          { name: 'Thorn', sub: 'Thf 4', player: 'Chris' },
        ],
        sessions: [
          { date: '2026-02-02', text: 'Session 8 — Entered the lower crypts.' },
        ],
        created: '2025-09-01T00:00:00Z',
      },
    ];
    saveCampaigns(camps);

    // Seed some activity
    save(KEYS.activity, [
      { id: 'act-1', date: '2026-03-28T20:00:00Z', campaign: 'camp-earth676', system: 'faserip', text: 'Earth 676 — Session 47: Time-travel arc. Crosswise critically wounded.' },
      { id: 'act-2', date: '2026-03-22T18:00:00Z', campaign: 'camp-greyhawk', system: 'add1e', text: 'Greyhawk Wars — Wilderness encounter near the Vesve Forest.' },
      { id: 'act-3', date: '2026-03-15T19:00:00Z', system: 'mp', text: 'MP Builder — Updated Starbolt, added Energy Bolt and Force Field.' },
      { id: 'act-4', date: '2026-03-10T17:00:00Z', system: 'add1e', text: 'DMG Dungeon — Generated level 3, Temple of Elemental Evil.' },
      { id: 'act-5', date: '2026-03-04T16:00:00Z', system: 'chainmail', text: 'Chainmail — Updated unit roster for Emridy Meadows.' },
    ]);

    // Seed jumpback
    save(KEYS.jumpback, [
      { href: 'character.html?id=starbolt', label: 'MP · Character Sheet', name: 'Starbolt', detail: 'Edited 2 hours ago', system: 'mp', ts: '2026-04-02T10:00:00Z' },
      { href: '#fas-session-47', label: 'FASERIP · Session Log', name: 'Earth 676 — Session 47', detail: 'Time-travel arc', system: 'faserip', ts: '2026-03-28T20:00:00Z' },
      { href: '#add1-enc', label: 'AD&D 1e · Encounter Gen', name: 'Vesve Forest Encounters', detail: 'Mar 22', system: 'add1e', ts: '2026-03-22T18:00:00Z' },
      { href: '#add1-dun', label: 'AD&D 1e · Dungeon Builder', name: 'Temple of Elemental Evil L3', detail: 'Mar 10', system: 'add1e', ts: '2026-03-10T17:00:00Z' },
    ]);
  }

  // ── Public API ──
  return {
    KEYS,
    SYSTEM_DEFS,
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

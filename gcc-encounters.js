// gcc-encounters.js — AD&D 1e encounter engine for GCC
//
// Wraps the data in gcc-encounter-data.js with:
//   1. Hex-context resolver: (col,row) → terrain + region + table key
//   2. Encounter check: timing rule + frequency die per population
//   3. Table roll: regional/geographic overlay → DMG fallback
//   4. Reaction / distance / surprise rolls per DMG
//   5. Monster Manual lookup
//
// Pure logic, no DOM. Result panel rendering lives in
// gcc-encounter-panel.js. Foundry-specific bits (ChatMessage,
// game.settings, Actor creation, ARS integration) deliberately
// stripped — GCC has no Foundry context.
//
// Public API:
//   GCCEncounters.checkParty()       roll for the party's current hex
//   GCCEncounters.check({col, row})  roll for an arbitrary hex
//   GCCEncounters.lookupMonster(name) MM stats for a creature name
//   GCCEncounters.contextFor(col,row) inspect the resolved context
//                                     (debug; doesn't roll anything)

(function(){
  'use strict';

  // ── Terrain mapping ───────────────────────────────────────────────────────
  // GCC terrain enum has more variety than the DMG's 7 outdoor terrain
  // types. Map GCC's strings to DMG's. Water hexes return null because
  // v1 doesn't handle waterborne encounters.
  const TERRAIN_TO_DMG = {
    plains:        'plain',
    hardwood:      'forest',
    conifer:       'forest',
    jungle:        'forest',
    forest_hills:  'forest',  // ambiguous; the encounter mix leans forest
    hills:         'hills',
    mountains:     'mountains',
    desert:        'desert',
    barrens:       'scrub',
    swamp:         'marsh',
    // Water types are out of scope for v1 (would need underwater /
    // waterborne tables). Return null so the engine reports "no
    // encounters available for this hex" cleanly.
    water:            null,
    water_fresh:      null,
    water_inland_sea: null,
    water_coastal:    null,
    water_shallow:    null,
    water_deep:       null,
  };

  // ── Region → encounter table key ──────────────────────────────────────────
  // The adndEnc module groups regions that share monster ecology under
  // a single table key (e.g., Bissel/Gran March/Keoland share one
  // table because they share a frontier-march encounter mix). This
  // map translates BASE region names into those table keys. Regions
  // not listed have no political-overlay table; the engine falls
  // straight to the DMG terrain table for them.
  const REGION_TABLE_KEY = {
    // Central Flanaess
    'City of Greyhawk':      'greyhawk',
    'Domain of Greyhawk':    'greyhawk',
    'Wild Coast':            'wild_coast',
    'County of Urnst':       'county_duchy_urnst',
    'Duchy of Urnst':        'county_duchy_urnst',
    // Sheldomar
    'Kingdom of Keoland':    'bissel_gran_march_keoland',
    'Gran March':            'bissel_gran_march_keoland',
    'March of Bissel':       'bissel_gran_march_keoland',
    'Yeomanry':              'geoff_sterich_yeomanry',
    'Sterich':               'geoff_sterich_yeomanry',
    'Grand Duchy of Geoff':  'geoff_sterich_yeomanry',
    'County of Ulek':        'county_duchy_principality_ulek',
    'Duchy of Ulek':         'county_duchy_principality_ulek',
    'Principality of Ulek':  'county_duchy_principality_ulek',
    // North-west
    'Archclericy of Veluna': 'furyondy_shield_lands_veluna',
    'Kingdom of Furyondy':   'furyondy_shield_lands_veluna',
    'Shield Lands':          'furyondy_shield_lands_veluna',
    'Highfolk':              'highfolk',
    'Valley of the Highfolk':'highfolk',
    'Perrenland':            'ket_perrenland',
    'Horned Society':        'horned_society',
    'Empire of Iuz':         'iuz',
    'Bandit Kingdoms':       'bandit_kingdoms',
    'Ket':                   'ket_perrenland',
    // North / north-east
    'Rovers of the Barrens': 'rovers_of_the_barrens',
    'Theocracy of the Pale': 'pale_ratik_tenh',
    'Duchy of Tenh':         'pale_ratik_tenh',
    'Archbarony of Ratik':   'pale_ratik_tenh',
    'Bone March':            'bone_march',
    // Central / east
    'Kingdom of Nyrond':     null,  // no specific WoG table; falls to DMG
    'Great Kingdom':         'great_kingdom_medegia_north_province_south_province',
    'North Province':        'great_kingdom_medegia_north_province_south_province',
    'South Province':        'great_kingdom_medegia_north_province_south_province',
    'See of Medegia':        'great_kingdom_medegia_north_province_south_province',
    'County of Sunndi':      'scarlet_brotherhood_sunndi',
    'County of Idee':        'idee_irongate_onnwal',
    'State of Onnwal':       'idee_irongate_onnwal',
    'Free City of Irongate': 'idee_irongate_onnwal',
    'Scarlet Brotherhood':   'scarlet_brotherhood_sunndi',
    // South / sea
    'Hold of the Sea Princes': 'sea_princes',
    'Pomarj':                'pomarj',
    // Special
    'Celene':                'celene',
    // Geographic features that have their own tables — these win over
    // the political overlay when a hex is in both. The adndEnc engine's
    // GREYHAWK_GEOGRAPHICAL_TABLES handles these. Region names map to
    // those keys here.
    'Vesve Forest':          'vesve_forest_eastern',  // default to eastern half
    'Gnarley Forest':        'gnarley_forest',
    'Welkwood':              'welkwood',
    'Suss Forest':           'suss_forest',
    'Dim Forest':            'dim_forest',
    'Oytwood':               'oytwood',
    'Hornwood':              'hornwood',
    'Dreadwood':             'dreadwood',
    'Menowood':              'axewood_menowood_silverwood',
    'Celadon Forest':        'celadon_forest',
    'Adri Forest':           'adri_forest',
    'Phostwood':             'bramblewood_nutherwood_phostwood_udgru',
    'Burneal Forest':        'burneal_forest',
    'Fellreev Forest':       'fellreev_forest',
    'Forlorn Forest':        'forlorn_forest',
    'Gamboge Forest':        'gamboge_forest',
    'Spikey Forest':         'spikey_forest',
    'Loftwood':              'loftwood_timberway',
    'Grandwood Forest':      'grandwood',
    'Timberway Forest':      'loftwood_timberway',
    'Rieuwood':              'rieuwood',
    'Amedio Jungle':         'amedio_jungle_hepmonaland',
    // Mountains
    'Lortmil Mountains':     'lortmil_mountains',
    'Crystalmist Mountains': 'barrier_peaks_crystalmist_jotens',
    'Hellfurnaces':          'hellfurnaces',
    'Sulhaut Mountains':     'sulhaut_mountains',
    'Yatil Mountains':       'clatspur_range_yatil_mountains',
    'Clatspur Range':        'clatspur_range_yatil_mountains',
    'Barrier Peaks':         'barrier_peaks_crystalmist_jotens',
    'Jotens':                'barrier_peaks_crystalmist_jotens',
    'Griff Mountains':       'corusk_mountains_griff_mountains_rakers',
    'Corusk Mountains':      'corusk_mountains_griff_mountains_rakers',
    'Rakers':                'corusk_mountains_griff_mountains_rakers',
    'Glorioles':             'hestmark_highlands_glorioles',
    'Hestmark Highlands':    'hestmark_highlands_glorioles',
    'Drachensgrab Mountains':'blemu_hills_bluff_hills_drachensgrabs_howling_hills_spire_ridge_tors',
    'Ulsprue Mountains':     'ullsprue',
    // Hills
    'Cairn Hills':           'cairn_hills',
    'Kron Hills':            'kron_hills',
    'Abbor-Alz':             'abbor_alz',
    'Flinty Hills':          'flinty_hills_good_hills_gull_cliffs_headlands_hollow_highlands_iron_hills_little_hills_lorridges_stark_mounds',
    'Good Hills':            'flinty_hills_good_hills_gull_cliffs_headlands_hollow_highlands_iron_hills_little_hills_lorridges_stark_mounds',
    'Iron Hills':             'flinty_hills_good_hills_gull_cliffs_headlands_hollow_highlands_iron_hills_little_hills_lorridges_stark_mounds',
    'Headlands':              'flinty_hills_good_hills_gull_cliffs_headlands_hollow_highlands_iron_hills_little_hills_lorridges_stark_mounds',
    'Stark Mounds':           'flinty_hills_good_hills_gull_cliffs_headlands_hollow_highlands_iron_hills_little_hills_lorridges_stark_mounds',
    'Tusman Hills':           'sepia_uplands_tusman_hills_yecha_hills',
    'Yecha Hills':            'sepia_uplands_tusman_hills_yecha_hills',
    'Sepia Uplands':          'sepia_uplands_tusman_hills_yecha_hills',
    'Lorridges':              'flinty_hills_good_hills_gull_cliffs_headlands_hollow_highlands_iron_hills_little_hills_lorridges_stark_mounds',
    'Bluff Hills':            'blemu_hills_bluff_hills_drachensgrabs_howling_hills_spire_ridge_tors',
    'Blemu Hills':            'blemu_hills_bluff_hills_drachensgrabs_howling_hills_spire_ridge_tors',
    'Drachensgrab Hills':     'blemu_hills_bluff_hills_drachensgrabs_howling_hills_spire_ridge_tors',
    'Gull Cliffs':            'flinty_hills_good_hills_gull_cliffs_headlands_hollow_highlands_iron_hills_little_hills_lorridges_stark_mounds',
    'Hollow Highlands':       'flinty_hills_good_hills_gull_cliffs_headlands_hollow_highlands_iron_hills_little_hills_lorridges_stark_mounds',
    'Howling Hills':          'blemu_hills_bluff_hills_drachensgrabs_howling_hills_spire_ridge_tors',
    'Little Hills':           'flinty_hills_good_hills_gull_cliffs_headlands_hollow_highlands_iron_hills_little_hills_lorridges_stark_mounds',
    'Spine Ridge':            'blemu_hills_bluff_hills_drachensgrabs_howling_hills_spire_ridge_tors',
    'Tors':                   'blemu_hills_bluff_hills_drachensgrabs_howling_hills_spire_ridge_tors',
    // Swamps
    'Vast Swamp':             'vast_swamp',
    'Cold Marshes':           'cold_marshes',
    'Lone Heath':             'lone_heath',
    // Wastelands
    'Bright Desert':          'bright_desert',
    'Sea of Dust':            'sea_of_dust',
    'Land of Black Ice':      'land_of_black_ice',
    'Dry Steppes':            'dry_steppes',
    'Rift Canyon':            'rift_canyon',
  };

  // ── Dice ──────────────────────────────────────────────────────────────────
  // Tiny dice utility: roll 'NdM' / 'NdM+K' / 'NdM-K' / 'N-M' / fixed
  // numbers. Returns an integer. Number-appearing strings in the data
  // sometimes use '2-7' (range), '1d4+1' (formula), '2d4' (count), '1'
  // (fixed). Handle all four.
  function rollDice(formula){
    if (formula == null) return 1;
    if (typeof formula === 'number') return formula;
    const s = String(formula).trim().toLowerCase();
    if (s === '') return 1;
    const fixed = parseInt(s, 10);
    if (!isNaN(fixed) && String(fixed) === s) return fixed;
    // Range form '2-7'
    let m = s.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m){
      const lo = +m[1], hi = +m[2];
      return lo + Math.floor(Math.random() * (hi - lo + 1));
    }
    // Dice form 'NdM' / 'NdM+K' / 'NdM-K'
    m = s.match(/^(\d+)d(\d+)\s*([+-]\s*\d+)?$/);
    if (m){
      const n = +m[1], die = +m[2];
      const mod = m[3] ? +m[3].replace(/\s+/g,'') : 0;
      let total = 0;
      for (let i = 0; i < n; i++) total += 1 + Math.floor(Math.random() * die);
      return total + mod;
    }
    // Multiple dice expressions joined with + ('11d6 + 1d6')
    if (s.includes('+')){
      const parts = s.split('+').map(p => p.trim());
      return parts.reduce((sum, p) => sum + rollDice(p), 0);
    }
    // Fallback: 1
    return 1;
  }
  function d(sides){ return 1 + Math.floor(Math.random() * sides); }

  // ── Encounter check (timing rule + frequency die) ─────────────────────────
  function checkOccurs(dmgTerrain, timeOfDay, population){
    const D = window.GCCEncounterData;
    if (!D) return { occurs: false, reason: 'Encounter data not loaded' };
    const allowedTimes = D.DMG_OUTDOOR_TIMING_RULES[dmgTerrain] || [
      'morning','noon','evening','night',
    ];
    if (!allowedTimes.includes(timeOfDay)){
      return {
        occurs: false,
        reason: `No encounters in ${dmgTerrain} during ${timeOfDay}`,
        roll: null,
      };
    }
    const freq = D.DMG_ENCOUNTER_FREQUENCY[population] || D.DMG_ENCOUNTER_FREQUENCY.uninhabited;
    const roll = d(freq.die);
    return {
      occurs: roll <= freq.successOn,
      reason: roll <= freq.successOn ? 'Encounter!' : 'No encounter this check',
      roll,
      die: freq.die,
      successOn: freq.successOn,
    };
  }

  // ── Table roll (handles both DMG-style {min,max} rows and either
  //    'creature' or 'encounter' field name) ────────────────────────────────
  function rollOnTable(table){
    if (!Array.isArray(table) || table.length === 0) return null;
    const roll = d(100);
    for (const row of table){
      if (roll >= row.min && roll <= row.max){
        return {
          roll,
          monster:    row.creature || row.encounter || row.monster || '?',
          number:     row.number || row.numberAppearing || null,
          subtable:   row.subtable || null,
          useStandard: !!row.useStandard,
          note:       row.note || null,
          raw:        row,
        };
      }
    }
    return { roll, monster: '?', number: null, raw: null };
  }

  // ── Resolve subtable ──────────────────────────────────────────────────────
  // DMG outdoor rolls return things like { creature:'Demi-human',
  // subtable:'demi_human' }. Resolve once into a concrete monster.
  function resolveSubtable(result){
    const D = window.GCCEncounterData;
    if (!result.subtable) return result;
    const sub = D.DMG_SUBTABLES?.[result.subtable];
    if (!sub) return result;
    const subResult = rollOnTable(sub);
    if (!subResult) return result;
    return {
      ...result,
      monster: subResult.monster,
      number:  subResult.number || result.number,
      subtable: null,
      subtableUsed: result.subtable,
      subtableRoll: subResult.roll,
      note: subResult.note || result.note,
    };
  }

  // ── Reaction / distance / surprise (DMG) ──────────────────────────────────
  function rollReaction(){
    const r = 2 + Math.floor(Math.random()*6) + Math.floor(Math.random()*6);
    let label;
    if (r <= 4)       label = 'Hostile';
    else if (r <= 6)  label = 'Unfriendly';
    else if (r <= 8)  label = 'Neutral';
    else if (r <= 10) label = 'Indifferent';
    else              label = 'Friendly';
    return { roll: r, label };
  }
  // DMG p.48 outdoor encounter distance: base 6d4 inches (1" = 10 yd
  // outdoors → 60-240 yd). Terrain modifies EACH die before summing:
  //   Plain, desert, hills, mountains: no modification
  //   Scrub:  −1 per die rolling 3 or 4
  //   Forest: −1 per die on EVERY roll (00's possible — i.e. 0 dist =
  //           immediate confrontation)
  //   Marsh:  −1 per die rolling 2, 3, or 4
  // Surprise can further reduce the result (handled separately by the
  // caller, since surprise is its own roll).
  function rollDistance(dmgTerrain){
    const dieRolls = [];
    let modifiedSum = 0;
    for (let i = 0; i < 6; i++){
      const raw = d(4);
      let modified = raw;
      switch (dmgTerrain){
        case 'forest':
          modified = raw - 1;  // -1 always
          break;
        case 'marsh':
          if (raw >= 2 && raw <= 4) modified = raw - 1;
          break;
        case 'scrub':
          if (raw === 3 || raw === 4) modified = raw - 1;
          break;
        // plain, desert, hills, mountains: no modification
      }
      // Forest can produce 0 ("00's are possible" per DMG); other
      // terrains floor at 1 implicitly since their modifiers don't
      // reduce 1 to 0.
      if (modified < 0) modified = 0;
      dieRolls.push({ raw, modified });
      modifiedSum += modified;
    }
    // Convert inches to yards (outdoor scale: 1" = 10 yd).
    const yards = modifiedSum * 10;
    let formula = '6d4';
    if (dmgTerrain === 'forest') formula = '6d4 (each −1, forest)';
    else if (dmgTerrain === 'marsh') formula = '6d4 (each 2-4 −1, marsh)';
    else if (dmgTerrain === 'scrub') formula = '6d4 (each 3-4 −1, scrub)';
    formula += ' × 10 yd';
    return {
      yards,
      formula,
      raw: modifiedSum,    // sum in inches
      dieRolls,            // for debugging / display
    };
  }
  function rollSurprise(){
    const partyRoll = d(6);
    const monsterRoll = d(6);
    const partySurprised   = partyRoll <= 2;
    const monsterSurprised = monsterRoll <= 2;
    let label;
    if (partySurprised && monsterSurprised) label = 'Both surprised';
    else if (partySurprised)                label = 'Party surprised';
    else if (monsterSurprised)              label = 'Monster surprised';
    else                                    label = 'Neither surprised';
    return { partyRoll, monsterRoll, partySurprised, monsterSurprised, label };
  }

  // ── Monster Manual lookup ─────────────────────────────────────────────────
  // The MM is a flat array under MONSTER_MANUAL.monsters. Match by case-
  // insensitive name with light tolerance — a row like 'Hobgoblin' matches
  // the table-derived 'hobgoblins', 'Goblin' matches 'goblins', etc.
  let _mmIndex = null;
  function buildMMIndex(){
    const D = window.GCCEncounterData;
    if (!D || !D.MONSTER_MANUAL?.monsters) return new Map();
    const idx = new Map();
    for (const m of D.MONSTER_MANUAL.monsters){
      if (!m.name) continue;
      idx.set(m.name.toLowerCase(), m);
      // Singular fallback for 'Hobgoblins' → 'Hobgoblin'
      const singular = m.name.toLowerCase().replace(/s$/, '');
      if (!idx.has(singular)) idx.set(singular, m);
    }
    return idx;
  }
  function lookupMonster(name){
    if (!_mmIndex) _mmIndex = buildMMIndex();
    if (!name) return null;
    const k = String(name).toLowerCase().trim();
    if (_mmIndex.has(k)) return _mmIndex.get(k);
    // Try without trailing 's'
    if (_mmIndex.has(k.replace(/s$/, ''))) return _mmIndex.get(k.replace(/s$/, ''));
    // Try splitting on comma ('Wolf, worg' → try 'Wolf')
    const parts = k.split(',').map(p => p.trim());
    if (parts.length > 1){
      if (_mmIndex.has(parts[0])) return _mmIndex.get(parts[0]);
    }
    return null;
  }

  // ── Hex context resolver ──────────────────────────────────────────────────
  function contextFor(col, row){
    const ctx = {
      col, row,
      gccTerrain: null,
      dmgTerrain: null,
      regionName: null,
      regionCategory: null,
      tableKey: null,
      tableSource: null,  // 'geographic' | 'political' | 'dmg'
      population: 'uninhabited',
      // Default to 'morning' rather than 'noon' — the DMG plains
      // timing rule excludes noon, so noon would always block plains
      // encounters as a default. Morning is in every terrain's
      // allowed-times list so it's a safe baseline. Future CTT hook
      // will set this from the in-game time of day.
      timeOfDay: 'morning',
      climate: 'temperate',
    };
    if (typeof window.GCCTerrain !== 'undefined'){
      ctx.gccTerrain = window.GCCTerrain.get(col, row);
      ctx.dmgTerrain = TERRAIN_TO_DMG[ctx.gccTerrain] ?? null;
    }
    if (typeof window.GCCRegions !== 'undefined'){
      const m = window.GCCRegions.getMembership(col, row);
      if (m){
        ctx.regionName = m.name;
        const r = window.GCCRegions.getByName(m.name);
        ctx.regionCategory = r?.category || 'political';
        // popTier on the region (from REGION_POP_TIERS or per-region
        // override) drives encounter frequency. Falls through to the
        // ctx default ('uninhabited') if the region has no tier.
        if (r?.popTier) ctx.population = r.popTier;
        const k = REGION_TABLE_KEY[m.name];
        if (k){
          ctx.tableKey = k;
          ctx.tableSource = ctx.regionCategory === 'geographic'
            ? 'geographic' : 'political';
        }
      }
    }
    // Landmark-derived popTier override. Cities aren't enumerated in
    // REGION_POP_TIERS at the region level (a 30-mile-hex kingdom
    // averages out to 'patrolled'), but a hex containing or adjacent
    // Landmark-derived popTier resolution.
    //
    //   hex contains kind:'city' or kind:'town' landmark
    //     → ctx.settlement = the landmark. The party is IN a settlement,
    //       not in wilderness. Outdoor encounter rolls don't apply here
    //       — DMG city/town tables are a separate system (Phase 2 in
    //       this engine). check() detects ctx.settlement and short-
    //       circuits with a "city/town tables required" result.
    //
    //   hex within 1 of a kind:'city' landmark hex
    //     → upgrade popTier by one notch (uninhabited→patrolled,
    //       patrolled→dense). The party is in genuine outdoor terrain
    //       (the road approaches, surrounding farmland) but it's
    //       denser than the regional average. Town adjacency does NOT
    //       upgrade — towns at 30-mile-hex scale aren't dense enough
    //       for their surroundings to register differently from
    //       regional default.
    //
    //   otherwise
    //     → regional popTier (or default)
    //
    ctx.popTierSource = ctx.population === 'uninhabited' ? 'default' : 'region';
    ctx.settlement = null;
    if (typeof window.GCCLandmarks !== 'undefined'){
      const here = window.GCCLandmarks.getByHex(col, row);
      if (here?.kind === 'city' || here?.kind === 'town'){
        // Settlement hex — defer to city/town tables (TODO). Don't
        // touch popTier; the check() short-circuit handles the rest.
        ctx.settlement = here;
      } else {
        // Walk neighbor hexes (distance == 1) for a city. Towns
        // intentionally don't trigger this — see comment above.
        const hexDist = window.hexDistance;
        if (typeof hexDist === 'function'){
          let bumped = false;
          for (let dc = -1; dc <= 1 && !bumped; dc++){
            for (let dr = -1; dr <= 1 && !bumped; dr++){
              if (dc === 0 && dr === 0) continue;
              const nc = col + dc, nr = row + dr;
              if (hexDist(col, row, nc, nr) !== 1) continue;
              const lm = window.GCCLandmarks.getByHex(nc, nr);
              if (lm?.kind === 'city'){
                if (ctx.population === 'uninhabited'){
                  ctx.population = 'patrolled';
                  ctx.popTierSource = 'landmark:city-adjacent';
                } else if (ctx.population === 'patrolled'){
                  ctx.population = 'dense';
                  ctx.popTierSource = 'landmark:city-adjacent';
                }
                bumped = true;
              }
            }
          }
        }
      }
    }
    if (!ctx.tableKey && ctx.dmgTerrain){
      // Fall back to DMG outdoor table by terrain.
      ctx.tableKey = `__dmg__:${ctx.dmgTerrain}:${ctx.population}`;
      ctx.tableSource = 'dmg';
    }
    if (!ctx.tableKey && ctx.dmgTerrain){
      // Fall back to DMG outdoor table by terrain.
      ctx.tableKey = `__dmg__:${ctx.dmgTerrain}:${ctx.population}`;
      ctx.tableSource = 'dmg';
    }
    return ctx;
  }

  // ── Resolve "use standard tables" fallback ────────────────────────────────
  function rollDmgTerrain(dmgTerrain, population, climate){
    const D = window.GCCEncounterData;
    if (!D) return null;
    let tableSet;
    if (climate === 'arctic')         tableSet = D.DMG_ARCTIC_CONDITIONS;
    else if (climate === 'subarctic') tableSet = D.DMG_SUBARCTIC_CONDITIONS;
    // The DMG has two temperate table sets: _UNINHABITED (wandering
    // monsters dominate) and _INHABITED (more "Men, Patrol" results,
    // settlement-flavored). Both `dense` and `patrolled` populations
    // use the inhabited table; only `uninhabited` uses the wilderness
    // table.
    else if (population === 'dense' || population === 'patrolled')
                                      tableSet = D.DMG_TEMPERATE_INHABITED;
    else                              tableSet = D.DMG_TEMPERATE_UNINHABITED;
    const table = tableSet?.[dmgTerrain];
    if (!table) return null;
    const result = rollOnTable(table);
    return result ? resolveSubtable(result) : null;
  }

  // ── Main entry: roll an encounter for a hex ───────────────────────────────
  // Options:
  //   force: bool    — bypass timing rule + frequency die. The roll always
  //                    proceeds to table selection. Useful for a "force
  //                    encounter" GM action and for testing.
  function check(hexOrCtx, opts){
    opts = opts || {};
    if (typeof window.GCCEncounterData === 'undefined'){
      return { error: 'Encounter data not loaded — include gcc-encounter-data.js before gcc-encounters.js' };
    }
    const ctx = (hexOrCtx && hexOrCtx.gccTerrain !== undefined)
      ? hexOrCtx
      : contextFor(hexOrCtx.col, hexOrCtx.row);
    // Settlement hex — outdoor wilderness tables don't apply. The DMG
    // has separate city/town encounter tables (DMG_CITYTOWN_TABLES in
    // the data file) which aren't wired into this engine yet. Show a
    // clear placeholder rather than producing a nonsense outdoor roll
    // ("Bear, brown 1d4" inside Greyhawk City). Force flag does NOT
    // bypass this — forcing should still respect the table-system
    // boundary; a forced roll inside a city should fail loud, not
    // silently fall through to forest tables.
    if (ctx.settlement){
      const s = ctx.settlement;
      const kindLabel = s.kind === 'city' ? 'City' : 'Town';
      return {
        ctx,
        occurred: false,
        settlement: s,
        reason: `${kindLabel} hex (${s.name || 'unnamed'}) — see DMG city/town tables (TODO)`,
      };
    }
    if (ctx.dmgTerrain == null){
      return {
        ctx,
        occurred: false,
        reason: ctx.gccTerrain
          ? `No outdoor encounter table for terrain "${ctx.gccTerrain}" (water hexes need waterborne tables — Phase 2)`
          : 'Hex has no terrain set',
      };
    }
    let occurs;
    if (opts.force){
      occurs = { occurs: true, reason: 'Forced encounter', forced: true };
    } else {
      occurs = checkOccurs(ctx.dmgTerrain, ctx.timeOfDay, ctx.population);
      if (!occurs.occurs){
        return { ctx, occurred: false, ...occurs };
      }
    }

    // Pick the table. Geographic > political > DMG fallback.
    const D = window.GCCEncounterData;
    let result = null;
    let tableSourceUsed = ctx.tableSource;
    if (ctx.tableSource === 'geographic' && D.GREYHAWK_GEOGRAPHICAL_TABLES[ctx.tableKey]){
      result = rollOnTable(D.GREYHAWK_GEOGRAPHICAL_TABLES[ctx.tableKey]);
    } else if (ctx.tableSource === 'political' && D.GREYHAWK_REGIONAL_TABLES[ctx.tableKey]){
      result = rollOnTable(D.GREYHAWK_REGIONAL_TABLES[ctx.tableKey]);
    }
    // Fall back to DMG terrain if regional/geographic gave 'use standard'
    // or if no overlay table existed in the first place.
    if (!result || result.useStandard){
      const dmgResult = rollDmgTerrain(ctx.dmgTerrain, ctx.population, ctx.climate);
      if (dmgResult){
        // Preserve the regional roll for display when we fell through.
        if (result?.useStandard){
          dmgResult.fellThroughFrom = result;
        }
        result = dmgResult;
        tableSourceUsed = 'dmg';
      }
    }
    if (!result){
      return { ctx, occurred: false, reason: 'No encounter table matched', occurs };
    }

    // Resolve subtable if present (DMG 'Demi-human', 'Humanoid', etc.)
    if (result.subtable){
      result = resolveSubtable(result);
    }

    // Look up MM stats for the rolled monster.
    const mmStats = lookupMonster(result.monster);

    // Number appearing: prefer the table's number; fall back to MM data.
    // Some MM entries (especially "Men, *") use very large numberAppearing
    // values like '50d6' that represent settlement size, not a per-
    // encounter count. Detect those cases and present the formula
    // without rolling — the GM can roll if they want a specific count.
    let numberAppearing = result.number;
    let numberRolled = null;
    let numberSource = null;
    if (numberAppearing){
      numberRolled = rollDice(numberAppearing);
      numberSource = 'table';
    } else if (mmStats?.numberAppearing){
      numberAppearing = mmStats.numberAppearing;
      numberSource = 'mm';
      // Heuristic: only auto-roll MM numbers for non-"Men" categories.
      // For "Men" the MM number is settlement-scale.
      const isMen = (mmStats.category === 'Men') ||
                    /^men[,\s]/i.test(result.monster);
      if (!isMen){
        numberRolled = rollDice(numberAppearing);
      }
    }

    return {
      ctx,
      occurred: true,
      occurs,
      monster: result.monster,
      numberFormula: numberAppearing,
      numberRolled,
      numberSource,
      reaction: rollReaction(),
      distance: rollDistance(ctx.dmgTerrain),
      surprise: rollSurprise(),
      tableSourceUsed,
      tableRoll: result.roll,
      note: result.note,
      mmStats,
      raw: result,
    };
  }

  function checkParty(opts){
    if (typeof window.state === 'object' && window.state &&
        typeof window.state.partyCol === 'number'){
      return check({ col: window.state.partyCol, row: window.state.partyRow }, opts);
    }
    return { error: 'Party position not available' };
  }

  window.GCCEncounters = {
    check,
    checkParty,
    contextFor,
    lookupMonster,
    rollDice,           // exposed for testing
    REGION_TABLE_KEY,   // exposed for inspection
    TERRAIN_TO_DMG,     // exposed for inspection
  };
})();

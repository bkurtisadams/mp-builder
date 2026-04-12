// gcc-invite.js v1.0.0 — 2026-04-08
// Campaign invite system for Graycloak's Campaign Corner
// Requires: gcc-data.js, gcc-auth.js, gcc-sync.js (for Firestore access)
//
// Firestore structure:
//   invites/{code} → { campaignId, ownerUid, campaignName, system, created, active }
//   campaigns/{campaignId}/players/{uid} → { displayName, email, joined, role }
//   campaigns/{campaignId} → { ownerUid, name, system, created }

const GCCInvite = (function() {

  // ── Helpers ──
  function getDb() {
    return (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
  }

  function getUid() {
    return (typeof GCCAuth !== 'undefined' && GCCAuth.getUser()) ? GCCAuth.getUser().uid : null;
  }

  function getUserInfo() {
    const user = (typeof GCCAuth !== 'undefined') ? GCCAuth.getUser() : null;
    if (!user) return null;
    return { uid: user.uid, displayName: user.displayName || user.email.split('@')[0], email: user.email };
  }

  function genCode() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  // ══════════════════════════════════════
  // ── Create / Manage Invites ──
  // ══════════════════════════════════════

  async function createInvite(campaignId, campaignName, system) {
    const db = getDb();
    const uid = getUid();
    if (!db || !uid) return { ok: false, reason: 'Not signed in' };

    const code = genCode();
    const now = new Date().toISOString();

    try {
      // Create invite document
      await db.collection('invites').doc(code).set({
        campaignId: campaignId,
        ownerUid: uid,
        campaignName: campaignName || 'Unnamed Campaign',
        system: system || '',
        created: now,
        active: true,
      });

      // Ensure shared campaign document exists
      const campRef = db.collection('campaigns').doc(campaignId);
      const campSnap = await campRef.get();
      if (!campSnap.exists) {
        await campRef.set({
          ownerUid: uid,
          name: campaignName || 'Unnamed Campaign',
          system: system || '',
          created: now,
        });
      }

      // Add owner as first player (GM)
      const user = getUserInfo();
      if (user) {
        await campRef.collection('players').doc(uid).set({
          displayName: user.displayName,
          email: user.email,
          role: 'gm',
          joined: now,
        }, { merge: true });
      }

      return { ok: true, code: code };
    } catch(e) {
      console.error('[GCCInvite] createInvite failed:', e);
      return { ok: false, reason: e.message };
    }
  }

  async function deactivateInvite(code) {
    const db = getDb();
    if (!db) return;
    try {
      await db.collection('invites').doc(code).update({ active: false });
    } catch(e) {
      console.warn('[GCCInvite] deactivateInvite failed:', e);
    }
  }

  async function getInvitesForCampaign(campaignId) {
    const db = getDb();
    const uid = getUid();
    if (!db || !uid) return [];
    try {
      const snap = await db.collection('invites')
        .where('campaignId', '==', campaignId)
        .where('ownerUid', '==', uid)
        .get();
      const results = [];
      snap.forEach(doc => results.push({ code: doc.id, ...doc.data() }));
      return results;
    } catch(e) {
      console.warn('[GCCInvite] getInvitesForCampaign failed:', e);
      return [];
    }
  }

  // ══════════════════════════════════════
  // ── Join Campaign ──
  // ══════════════════════════════════════

  async function lookupInvite(code) {
    const db = getDb();
    if (!db) return null;
    try {
      const snap = await db.collection('invites').doc(code.toUpperCase()).get();
      if (!snap.exists) return null;
      const data = snap.data();
      if (!data.active) return null;
      return { code: snap.id, ...data };
    } catch(e) {
      console.warn('[GCCInvite] lookupInvite failed:', e);
      return null;
    }
  }

  async function joinCampaign(code) {
    const db = getDb();
    const user = getUserInfo();
    if (!db || !user) return { ok: false, reason: 'Not signed in' };

    try {
      // Verify invite
      const invite = await lookupInvite(code);
      if (!invite) return { ok: false, reason: 'Invalid or expired invite code' };

      // Add player to campaign
      const campRef = db.collection('campaigns').doc(invite.campaignId);
      await campRef.collection('players').doc(user.uid).set({
        displayName: user.displayName,
        email: user.email,
        role: 'player',
        joined: new Date().toISOString(),
      }, { merge: true });

      return { ok: true, campaignId: invite.campaignId, campaignName: invite.campaignName, system: invite.system };
    } catch(e) {
      console.error('[GCCInvite] joinCampaign failed:', e);
      return { ok: false, reason: e.message };
    }
  }

  // ══════════════════════════════════════
  // ── Player Roster ──
  // ══════════════════════════════════════

  async function getPlayers(campaignId) {
    const db = getDb();
    if (!db) return [];
    try {
      const snap = await db.collection('campaigns').doc(campaignId).collection('players').get();
      const players = [];
      snap.forEach(doc => players.push({ uid: doc.id, ...doc.data() }));
      return players;
    } catch(e) {
      console.warn('[GCCInvite] getPlayers failed:', e);
      return [];
    }
  }

  async function removePlayer(campaignId, playerUid) {
    const db = getDb();
    const uid = getUid();
    if (!db || !uid) return { ok: false };
    try {
      await db.collection('campaigns').doc(campaignId).collection('players').doc(playerUid).delete();
      return { ok: true };
    } catch(e) {
      console.warn('[GCCInvite] removePlayer failed:', e);
      return { ok: false, reason: e.message };
    }
  }

  // ══════════════════════════════════════
  // ── Shared Campaign Data ──
  // ══════════════════════════════════════

  // Fields the GM pushes to Firestore for players to see
  const SHARED_FIELDS = [
    'name', 'system', 'status', 'gm', 'gmTitle', 'world', 'genre',
    'pitch', 'description', 'schedule', 'playMode', 'vttLabel', 'vttUrl',
    'nextSession', 'startDate', 'xpMethod', 'rulebooks', 'houseRules',
    'sharedNotes', 'sessions', 'lore', 'campaignImage', 'hqImage', 'hqNotes',
    'characters',
  ];

  // Helper: resolve IDB image key to data URL
  async function idbGet(key) {
    return (typeof GCCImages !== 'undefined') ? await GCCImages.get(key) : null;
  }

  // Helper: upload an image field to Storage, return download URL
  async function uploadImg(val, storagePath) {
    if (typeof GCCStorage === 'undefined') return val || '';
    return await GCCStorage.uploadCampaignImage(val, storagePath, idbGet);
  }

  // Build a lightweight character snapshot from the full saved character data.
  // Uses the same resolveChar logic as campaign-detail but produces a plain object.
  function buildCharSnapshot(savedChar, systemId) {
    const snap = { _id: savedChar._id || '' };
    if (systemId === 'faserip') {
      snap.heroName = savedChar.heroName || savedChar.name || '';
      snap.playerName = savedChar.playerName || '';
      snap.origin = savedChar.origin || '';
      snap.characterType = savedChar.characterType || '';
      snap.abilities = savedChar.abilities || {};
      snap.health = savedChar.health || '';
      snap.karma = savedChar.karma || '';
      snap.resourcesRank = savedChar.resourcesRank || '';
      snap.popularityHero = savedChar.popularityHero;
      snap.portraitData = savedChar.portraitData || '';
    } else if (systemId === 'mp') {
      snap.name = savedChar.name || '';
      snap.player = savedChar.player || '';
      snap.archetype = savedChar.archetype || savedChar.className || '';
      snap.stats = savedChar.stats || {};
      snap.abilities = savedChar.abilities || [];
      snap.power = savedChar.power || '';
      snap.hitPts = savedChar.hitPts || '';
      snap.initiative = savedChar.initiative || '';
      snap.characterType = savedChar.characterType || '';
      snap._image = savedChar._image || savedChar.portrait || '';
    } else if (systemId === 'add1e') {
      snap.characterName = savedChar.characterName || savedChar.name || '';
      snap.player = savedChar.player || savedChar.playerName || '';
      snap.characterClass = savedChar.characterClass || '';
      snap.level = savedChar.level || '';
      snap.race = savedChar.race || '';
      snap.str = savedChar.str; snap.strPct = savedChar.strPct;
      snap.int = savedChar.int; snap.wis = savedChar.wis;
      snap.dex = savedChar.dex; snap.con = savedChar.con; snap.cha = savedChar.cha;
      snap.ac = savedChar.ac; snap.hpCurrent = savedChar.hpCurrent;
      snap.hpMax = savedChar.hpMax; snap.xpTotal = savedChar.xpTotal;
      snap.characterType = savedChar.characterType || '';
      snap.portrait = savedChar.portrait || '';
    }
    return snap;
  }

  async function pushSharedData(campaignId, camp) {
    const db = getDb();
    const uid = getUid();
    if (!db || !uid) return;
    try {
      const shared = { _updated: new Date().toISOString() };
      SHARED_FIELDS.forEach(f => {
        if (camp[f] !== undefined) shared[f] = camp[f];
      });
      delete shared.notes;

      const hasStorage = typeof GCCStorage !== 'undefined';
      const sp = `campaigns/${campaignId}/`;

      // ── Upload images to Firebase Storage ──
      if (hasStorage) {
        await GCCStorage.init().catch(() => null);

        // Banner
        if (shared.campaignImage) {
          shared.campaignImage = await uploadImg(shared.campaignImage, sp + 'banner');
        }
        // HQ image
        if (shared.hqImage) {
          shared.hqImage = await uploadImg(shared.hqImage, sp + 'hq');
        }
        // Session images
        if (shared.sessions) {
          for (let i = 0; i < shared.sessions.length; i++) {
            const s = shared.sessions[i];
            if (s.image) {
              s.image = await uploadImg(s.image, sp + 'ses_' + (s._id || i));
            }
            for (const sec of (s.sections || [])) {
              for (let j = 0; j < (sec.images || []).length; j++) {
                const img = sec.images[j];
                if (img.src) {
                  img.src = await uploadImg(img.src, sp + 'sec_' + (s._id || i) + '_' + j);
                }
              }
            }
          }
        }
        // Lore images
        if (shared.lore) {
          for (let i = 0; i < shared.lore.length; i++) {
            const l = shared.lore[i];
            if (l.image) {
              l.image = await uploadImg(l.image, sp + 'lore_' + (l._id || i));
            }
          }
        }
      }

      // ── Build character snapshots ──
      const chars = camp.characters || [];
      const snapshots = [];
      for (const ch of chars) {
        const refKey = ch.storageKey || ch.listKey || '';
        let saved = null;
        if (refKey) {
          try {
            const list = JSON.parse(localStorage.getItem(refKey)) || [];
            saved = ch._id ? list.find(x => x._id === ch._id) : null;
            if (!saved && ch.name) saved = list.find(x =>
              (x.heroName || x.characterName || x.name) === ch.name);
          } catch(e) {}
        }
        if (saved) {
          const snap = buildCharSnapshot(saved, camp.system);
          // Upload character portrait to Storage
          const portraitField = camp.system === 'faserip' ? 'portraitData'
            : camp.system === 'mp' ? '_image' : 'portrait';
          if (hasStorage && snap[portraitField]) {
            snap[portraitField] = await uploadImg(
              snap[portraitField], sp + 'char_' + (snap._id || ch.name));
          }
          snap._ref = { storageKey: refKey, name: ch.name, _id: ch._id };
          snapshots.push(snap);
        } else {
          // Can't resolve — push stub
          snapshots.push({ _id: ch._id || '', name: ch.name || '', _ref: ch });
        }
      }
      shared.characters = snapshots;

      await db.collection('campaigns').doc(campaignId).set(shared, { merge: true });
      console.log('[GCCInvite] Shared data pushed (' + (hasStorage ? 'with' : 'without') + ' Storage)');
    } catch(e) {
      console.warn('[GCCInvite] pushSharedData failed:', e);
    }
  }

  async function getSharedData(campaignId) {
    const db = getDb();
    if (!db) return null;
    try {
      const snap = await db.collection('campaigns').doc(campaignId).get();
      if (!snap.exists) return null;
      return snap.data();
    } catch(e) {
      console.warn('[GCCInvite] getSharedData failed:', e);
      return null;
    }
  }

  async function isOwner(campaignId) {
    const db = getDb();
    const uid = getUid();
    if (!db || !uid) return false;
    try {
      const snap = await db.collection('campaigns').doc(campaignId).get();
      if (!snap.exists) return false;
      return snap.data().ownerUid === uid;
    } catch(e) {
      return false;
    }
  }

  // ══════════════════════════════════════
  // ── Invite Link Helpers ──
  // ══════════════════════════════════════

  function buildInviteUrl(code) {
    const base = window.location.origin + window.location.pathname.replace(/[^\/]*$/, '');
    return base + 'index.html?invite=' + code;
  }

  function getInviteCodeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('invite') || null;
  }

  // ══════════════════════════════════════
  // ── Public API ──
  // ══════════════════════════════════════

  return {
    createInvite,
    deactivateInvite,
    getInvitesForCampaign,
    lookupInvite,
    joinCampaign,
    getPlayers,
    removePlayer,
    pushSharedData,
    getSharedData,
    isOwner,
    buildInviteUrl,
    getInviteCodeFromUrl,
  };

})();

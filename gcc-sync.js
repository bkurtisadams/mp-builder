// gcc-sync.js v1.0.0 — 2026-04-08
// Firestore sync layer for Graycloak's Campaign Corner
// Requires: gcc-data.js, gcc-auth.js, gcc-firebase-config.js
//
// Strategy:
//   - When signed out: localStorage only (no change from before)
//   - On first sign-in: upload localStorage data to Firestore (one-time)
//   - When signed in: load() reads from Firestore, save() writes to both
//   - localStorage always kept as cache/offline fallback
//
// Firestore structure:
//   users/{uid}/data/{storageKey} → { json: <JSON string>, _updated: <ISO date> }

const GCCSync = (function() {

  const FB_VERSION = '10.12.2';
  const FB_FIRESTORE_URL = `https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-firestore-compat.js`;

  let _db = null;
  let _uid = null;
  let _ready = false;
  let _readyCallbacks = [];

  // Keys we sync to Firestore (skip transient/migration flags)
  const SYNC_KEYS = [
    'gcc-campaigns',
    'gcc-activity',
    'gcc-jumpback',
    'gcc-vtts',
    'gcc-settings',
    'mp-char-list',
    'mp-veh-list',
    'gcc-faserip-chars',
    'gcc-add1e-chars',
  ];

  function isSyncKey(key) {
    return SYNC_KEYS.indexOf(key) !== -1;
  }

  // ── Load Firestore SDK ──
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + url));
      document.head.appendChild(s);
    });
  }

  async function initFirestore() {
    if (_db) return _db;
    try {
      await loadScript(FB_FIRESTORE_URL);
      _db = firebase.firestore();
      return _db;
    } catch(e) {
      console.error('[GCCSync] Firestore init failed:', e);
      return null;
    }
  }

  // ── Firestore document path for a key ──
  function docRef(key) {
    if (!_db || !_uid) return null;
    return _db.collection('users').doc(_uid).collection('data').doc(key);
  }

  // ── Cloud read/write ──
  async function cloudLoad(key) {
    const ref = docRef(key);
    if (!ref) return undefined;
    try {
      const snap = await ref.get();
      if (snap.exists) {
        const data = snap.data();
        // New format: stored as JSON string
        if (data.json !== undefined) {
          return JSON.parse(data.json);
        }
        // Legacy format: stored as raw value (from before this fix)
        if (data.value !== undefined) {
          return data.value;
        }
      }
      return undefined;
    } catch(e) {
      console.warn('[GCCSync] cloudLoad failed for', key, e);
      return undefined;
    }
  }

  async function cloudSave(key, val) {
    const ref = docRef(key);
    if (!ref) return;
    try {
      // Store as JSON string to avoid Firestore nested object/array depth limits
      await ref.set({ json: JSON.stringify(val), _updated: new Date().toISOString() });
    } catch(e) {
      console.warn('[GCCSync] cloudSave failed for', key, e);
    }
  }

  async function cloudDelete(key) {
    const ref = docRef(key);
    if (!ref) return;
    try {
      await ref.delete();
    } catch(e) {
      console.warn('[GCCSync] cloudDelete failed for', key, e);
    }
  }

  // ── First-time upload: push localStorage → Firestore ──
  const SYNC_FORMAT_VERSION = 2; // bump to force re-upload (v1=raw objects, v2=JSON strings)

  async function uploadLocalData() {
    if (!_db || !_uid) return;
    const flagKey = 'gcc-sync-uploaded-' + _uid;
    try {
      const stored = localStorage.getItem(flagKey);
      if (stored) {
        const ver = parseInt(stored, 10);
        if (ver >= SYNC_FORMAT_VERSION) return;
      }
    } catch(e) {}

    console.log('[GCCSync] Uploading local data to cloud (format v' + SYNC_FORMAT_VERSION + ')...');
    let count = 0;
    for (const key of SYNC_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          const val = JSON.parse(raw);
          await cloudSave(key, val);
          count++;
        }
      } catch(e) {
        console.warn('[GCCSync] upload skip for', key, e);
      }
    }
    console.log('[GCCSync] Uploaded', count, 'keys to cloud');

    try { localStorage.setItem(flagKey, String(SYNC_FORMAT_VERSION)); } catch(e) {}
  }

  // ── Pull cloud → localStorage (runs on sign-in after upload) ──
  async function pullCloudData() {
    if (!_db || !_uid) return;
    console.log('[GCCSync] Pulling cloud data to local cache...');
    let count = 0;
    for (const key of SYNC_KEYS) {
      try {
        const val = await cloudLoad(key);
        if (val !== undefined) {
          localStorage.setItem(key, JSON.stringify(val));
          count++;
        }
      } catch(e) {
        console.warn('[GCCSync] pull skip for', key, e);
      }
    }
    console.log('[GCCSync] Pulled', count, 'keys from cloud');
  }

  // ── Patch GCC.save / GCC.load to sync ──
  // We store references to the original functions and replace them
  let _origSave = null;
  let _origLoad = null;

  function patchGCC() {
    if (typeof GCC === 'undefined') return;
    if (_origSave) return; // already patched

    _origSave = GCC.save;
    _origLoad = GCC.load;

    // Replace save: always write to localStorage, also write to Firestore if signed in
    GCC.save = function(key, val) {
      _origSave(key, val);
      if (_uid && _db && isSyncKey(key)) {
        cloudSave(key, val).catch(e => console.warn('[GCCSync] background save failed:', key, e));
      }
    };

    // Replace load: if signed in and sync key, return cached localStorage
    // (which was pulled from cloud on sign-in). This keeps load() synchronous.
    // The cloud data was already pulled into localStorage during pullCloudData().
    GCC.load = function(key) {
      return _origLoad(key);
    };

    // Also patch saveCampaigns which calls save internally
    // (No extra patch needed — saveCampaigns calls GCC.save which is now patched)

    console.log('[GCCSync] GCC data layer patched for cloud sync');
  }

  // ── Auth state handler ──
  async function onAuthChange(user) {
    if (user) {
      _uid = user.uid;
      await initFirestore();
      patchGCC();
      await uploadLocalData();
      await pullCloudData();
      _ready = true;
      _readyCallbacks.forEach(fn => { try { fn(); } catch(e) {} });
      _readyCallbacks = [];
      // Dispatch event so pages can refresh their UI with cloud data
      window.dispatchEvent(new CustomEvent('gcc-sync-ready'));
      console.log('[GCCSync] Sync active for user:', user.email);
    } else {
      _uid = null;
      _ready = false;
      // Signed out — continue using localStorage only (GCC.save/load still patched but
      // the _uid check prevents cloud writes)
      window.dispatchEvent(new CustomEvent('gcc-sync-offline'));
    }
  }

  // ── Wait for sync to be ready ──
  function onReady(fn) {
    if (_ready) { fn(); return; }
    _readyCallbacks.push(fn);
  }

  function isActive() {
    return _ready && !!_uid && !!_db;
  }

  // ── Manual sync trigger (for UI "Sync Now" button later) ──
  async function syncNow() {
    if (!_uid || !_db) return { ok: false, reason: 'Not signed in' };
    // Push all sync keys to cloud
    let pushed = 0;
    for (const key of SYNC_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          await cloudSave(key, JSON.parse(raw));
          pushed++;
        }
      } catch(e) {}
    }
    return { ok: true, pushed };
  }

  // ── Manual pull trigger ──
  async function pullNow() {
    if (!_uid || !_db) return { ok: false, reason: 'Not signed in' };
    await pullCloudData();
    return { ok: true };
  }

  // ── Init: listen for auth changes ──
  function init() {
    if (typeof GCCAuth !== 'undefined' && GCCAuth.onAuthChange) {
      GCCAuth.onAuthChange(onAuthChange);
    } else {
      // Fallback: wait for auth to be available
      const check = setInterval(() => {
        if (typeof GCCAuth !== 'undefined' && GCCAuth.onAuthChange) {
          clearInterval(check);
          GCCAuth.onAuthChange(onAuthChange);
        }
      }, 100);
      // Give up after 10 seconds
      setTimeout(() => clearInterval(check), 10000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    isActive,
    onReady,
    syncNow,
    pullNow,
    SYNC_KEYS,
  };

})();
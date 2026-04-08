// gcc-firebase-config.js — Firebase project configuration
// ────────────────────────────────────────────────────────
// HOW TO SET UP:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (e.g. "gcc-campaign-corner")
// 3. Add a Web App (</> icon on project overview)
// 4. Copy your config values below
// 5. Enable Authentication → Email/Password in the Firebase console
// 6. (Optional) Enable Google sign-in provider
//
// These values are safe to commit — they identify your project
// but don't grant write access without auth.

const GCC_FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "000000000000",
  appId:             "YOUR_APP_ID",
};

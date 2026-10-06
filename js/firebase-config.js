/**
 * Reglas RTDB recomendadas (incluye marcador + hub PadelHub):
 * {
 *   "rules": {
 *     "matches": { "$code": { ".read": true, ".write": true } },
 *     "procup": { ".read": true, ".write": true }
 *   }
 * }
 */
/**
 * PadelHub — Firebase config (proyecto padelprofrias-141ef)
 *
 * IMPORTANTE:
 * 1. En Firebase Console → Build → Realtime Database → Create Database
 * 2. Copiá la URL exacta de la base (si no es la default, reemplazá databaseURL)
 * 3. Rules → publicá las reglas de lectura/escritura para matches (ver README)
 *
 * Nota: apiKey de cliente es pública por diseño; la seguridad está en las Rules.
 */
window.PADELHUB_FIREBASE = {
  apiKey: "AIzaSyBfRlBu_6mCrG7Q1YpgYyz0FLtxB9l0oeM",
  authDomain: "padelprofrias-141ef.firebaseapp.com",
  // Si al crear la DB Firebase te dio otra URL, pegala acá:
  databaseURL: "https://padelprofrias-141ef-default-rtdb.firebaseio.com",
  projectId: "padelprofrias-141ef",
  storageBucket: "padelprofrias-141ef.firebasestorage.app",
  messagingSenderId: "227077689025",
  appId: "1:227077689025:web:37098921b71007e9844e40",
  measurementId: "G-81M6WH9PTQ"
};

window.padelhubFirebaseReady = function () {
  const c = window.PADELHUB_FIREBASE || {};
  return !!(c.apiKey && c.databaseURL && c.projectId);
};

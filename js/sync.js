/**
 * PadelHub — Sync layer
 *
 * Priority:
 * 1) Firebase Realtime Database (if js/firebase-config.js is filled)
 * 2) PeerJS WebRTC (cross-network without backend)
 * 3) BroadcastChannel + localStorage (same origin / same browser)
 */
const Sync = (() => {
  const BC_NAME = "padelhub-v2";
  const LS_MIRROR = "padelhub_sync_mirror_v2";
  const PEER_PREFIX = "ph";
  const FB_PATH = "matches";

  let mode = null;
  let matchCode = null;
  let onState = null;
  let onStatus = null;

  let bc = null;
  let peer = null;
  let connections = [];
  let clientConn = null;
  let applyingRemote = false;
  let lastSentAt = 0;
  let reconnectTimer = null;
  let peerReady = false;

  // Firebase
  let fbApp = null;
  let fbDb = null;
  let fbRef = null;
  let fbUnsub = null;
  let fbEnabled = false;
  let lastFbWrite = 0;

  function status(level, text) {
    if (typeof onStatus === "function") onStatus({ level: level, text: text });
  }

  function peerIdFromCode(code) {
    const c = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return PEER_PREFIX + "-" + c;
  }

  function stripHistory(payload) {
    if (!payload || typeof payload !== "object") return payload;
    const copy = Object.assign({}, payload);
    copy.history = [];
    return copy;
  }

  function emitLocal(payload) {
    if (applyingRemote) return;
    if (typeof onState === "function") {
      applyingRemote = true;
      try {
        onState(payload);
      } finally {
        applyingRemote = false;
      }
    }
  }

  // ---------- BroadcastChannel + localStorage ----------
  function setupBroadcast() {
    try {
      bc = new BroadcastChannel(BC_NAME);
      bc.onmessage = function (e) {
        if (!e.data || e.data.type !== "state") return;
        if (e.data.code && matchCode && e.data.code !== matchCode) return;
        emitLocal(e.data.payload);
      };
    } catch (e) {
      bc = null;
    }
  }

  function setupStorageMirror() {
    window.addEventListener("storage", function (e) {
      if (e.key !== LS_MIRROR || !e.newValue) return;
      try {
        const msg = JSON.parse(e.newValue);
        if (!msg || msg.type !== "state") return;
        if (msg.code && matchCode && msg.code !== matchCode) return;
        emitLocal(msg.payload);
      } catch (err) {}
    });
  }

  function publishLocalChannels(payload) {
    const msg = {
      type: "state",
      code: matchCode,
      payload: stripHistory(payload),
      ts: Date.now()
    };
    try {
      if (bc) bc.postMessage(msg);
    } catch (e) {}
    try {
      localStorage.setItem(LS_MIRROR, JSON.stringify(msg));
    } catch (e) {}
  }

  // ---------- Firebase ----------
  function initFirebase() {
    fbEnabled = false;
    if (typeof window.padelhubFirebaseReady !== "function" || !window.padelhubFirebaseReady()) {
      return false;
    }
    if (typeof firebase === "undefined") {
      status("warn", "Firebase SDK no cargó — usando sync alternativo");
      return false;
    }
    try {
      const cfg = window.PADELHUB_FIREBASE;
      if (!firebase.apps.length) {
        fbApp = firebase.initializeApp(cfg);
      } else {
        fbApp = firebase.app();
      }
      fbDb = firebase.database();
      fbEnabled = true;
      return true;
    } catch (e) {
      console.warn("Firebase init error", e);
      status("err", "Firebase: error de configuración");
      fbEnabled = false;
      return false;
    }
  }

  function detachFirebase() {
    if (fbUnsub) {
      try { fbUnsub(); } catch (e) {}
      fbUnsub = null;
    }
    fbRef = null;
  }

  function attachFirebase() {
    detachFirebase();
    if (!fbEnabled || !fbDb || !matchCode) return;

    fbRef = fbDb.ref(FB_PATH + "/" + matchCode);

    const handler = function (snap) {
      const val = snap.val();
      if (!val || !val.state) return;
      // Avoid echo of our own fresh write (loose)
      if (mode === "controller" && val.updatedAt && Date.now() - val.updatedAt < 80) return;
      emitLocal(val.state);
    };

    fbRef.on("value", handler);
    fbUnsub = function () {
      fbRef.off("value", handler);
    };

    if (mode === "controller") {
      status("ok", "Firebase · sala #" + matchCode);
    } else {
      status("warn", "Firebase · escuchando #" + matchCode + "…");
      // First value will set status via data; also mark listening
      fbRef.once("value").then(function (snap) {
        if (snap.exists()) status("ok", "Firebase · conectado #" + matchCode);
        else status("warn", "Esperando al controlador #" + matchCode + "…");
      }).catch(function () {
        status("err", "Firebase · sin permiso de lectura");
      });
    }
  }

  function publishFirebase(payload) {
    if (!fbEnabled || !fbRef || mode !== "controller") return;
    const now = Date.now();
    if (now - lastFbWrite < 40) return;
    lastFbWrite = now;
    const body = {
      state: stripHistory(payload),
      updatedAt: now,
      mode: "controller"
    };
    fbRef.set(body).catch(function (err) {
      console.warn("Firebase write failed", err);
      status("err", "Firebase · error al escribir");
    });
  }

  // ---------- PeerJS (fallback when Firebase off) ----------
  function destroyPeer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    connections.forEach(function (c) {
      try { c.close(); } catch (e) {}
    });
    connections = [];
    if (clientConn) {
      try { clientConn.close(); } catch (e) {}
      clientConn = null;
    }
    if (peer) {
      try { peer.destroy(); } catch (e) {}
      peer = null;
    }
    peerReady = false;
  }

  function wireConnection(conn, role) {
    conn.on("open", function () {
      if (role === "host") {
        connections.push(conn);
        status("ok", "Peer · dispositivo conectado (" + connections.length + ")");
        if (window.__padelhubGetState) {
          try {
            conn.send({
              type: "state",
              code: matchCode,
              payload: stripHistory(window.__padelhubGetState()),
              ts: Date.now()
            });
          } catch (e) {}
        }
      } else {
        status("ok", "Peer · conectado al controlador");
      }
    });

    conn.on("data", function (data) {
      if (!data || data.type !== "state") return;
      if (data.code && matchCode && data.code !== matchCode) return;
      emitLocal(data.payload);
    });

    conn.on("close", function () {
      connections = connections.filter(function (c) { return c !== conn; });
      if (clientConn === conn) clientConn = null;
      if (fbEnabled) return; // Firebase is source of truth
      if (mode === "controller") {
        status(connections.length ? "ok" : "warn", connections.length ? "Peer · conectado (" + connections.length + ")" : "Peer · esperando pantallas…");
      } else {
        status("warn", "Peer · desconectado — reintentando…");
        scheduleReconnect();
      }
    });

    conn.on("error", function () {
      if (!fbEnabled) status("err", "Peer · error de conexión");
    });
  }

  function startHost() {
    if (typeof Peer === "undefined") return;
    destroyPeer();
    const id = peerIdFromCode(matchCode);
    if (!fbEnabled) status("warn", "Peer · abriendo sala #" + matchCode + "…");

    peer = new Peer(id, {
      debug: 0,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" }
        ]
      }
    });

    peer.on("open", function () {
      peerReady = true;
      if (!fbEnabled) status("warn", "Peer · sala #" + matchCode + " — esperando…");
    });

    peer.on("connection", function (conn) {
      wireConnection(conn, "host");
    });

    peer.on("error", function (err) {
      if (fbEnabled) return;
      const type = err && err.type;
      if (type === "unavailable-id") {
        status("err", "Código en uso en PeerJS. Reiniciá partido.");
      } else {
        status("warn", "Peer · " + (type || "error") + " — sync local");
      }
    });

    peer.on("disconnected", function () {
      try { peer.reconnect(); } catch (e) {}
    });
  }

  function startClient() {
    if (typeof Peer === "undefined") return;
    destroyPeer();
    if (!fbEnabled) status("warn", "Peer · buscando #" + matchCode + "…");

    peer = new Peer({
      debug: 0,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" }
        ]
      }
    });

    peer.on("open", function () {
      peerReady = true;
      connectToHost();
    });

    peer.on("error", function () {
      if (!fbEnabled) {
        status("warn", "Peer · reintentando…");
        scheduleReconnect();
      }
    });

    peer.on("disconnected", function () {
      if (!fbEnabled) scheduleReconnect();
    });
  }

  function connectToHost() {
    if (!peer || !peerReady) return;
    const hostId = peerIdFromCode(matchCode);
    try {
      if (clientConn) {
        try { clientConn.close(); } catch (e) {}
      }
      clientConn = peer.connect(hostId, { reliable: true });
      wireConnection(clientConn, "client");
    } catch (e) {
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (mode === "controller" || fbEnabled) return;
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      if (mode === "display" || mode === "spectator") {
        if (peer && peer.open) connectToHost();
        else startClient();
      }
    }, 2500);
  }

  function publishPeer(payload) {
    if (mode !== "controller") return;
    const msg = {
      type: "state",
      code: matchCode,
      payload: stripHistory(payload),
      ts: Date.now()
    };
    connections.forEach(function (c) {
      if (c.open) {
        try { c.send(msg); } catch (e) {}
      }
    });
  }

  // ---------- Public API ----------
  function init(opts) {
    onState = opts.onState;
    onStatus = opts.onStatus;
    setupBroadcast();
    setupStorageMirror();
    initFirebase();
  }

  function join(opts) {
    mode = opts.mode;
    matchCode = String(opts.matchCode || "").toUpperCase();
    destroyPeer();
    detachFirebase();

    if (!matchCode) {
      status("warn", "Sin código — solo sync local");
      return;
    }

    // Firebase first
    if (fbEnabled || initFirebase()) {
      attachFirebase();
    }

    // Peer always as secondary mesh (optional extra path)
    if (mode === "controller") {
      startHost();
      if (!fbEnabled) status("warn", "Sala #" + matchCode + " (Peer/local)");
    } else {
      startClient();
      if (!fbEnabled) status("warn", "Conectando a #" + matchCode + "…");
    }
  }

  function publish(payload) {
    if (applyingRemote) return;
    const now = Date.now();
    if (now - lastSentAt < 30) {
      publishLocalChannels(payload);
      return;
    }
    lastSentAt = now;
    publishLocalChannels(payload);
    publishFirebase(payload);
    publishPeer(payload);
  }

  function leave() {
    destroyPeer();
    detachFirebase();
    matchCode = null;
    mode = null;
    status("warn", "Desconectado");
  }

  function isFirebaseActive() {
    return fbEnabled;
  }

  return {
    init: init,
    join: join,
    publish: publish,
    leave: leave,
    isFirebaseActive: isFirebaseActive
  };
})();

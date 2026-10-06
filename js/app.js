/**
 * PadelHub — Main Application (full package)
 * Controller · Display · Spectator · PIN · Persistence · Timer · Animations · PWA-ready
 */
const App = (() => {
  const STORAGE_KEY = "padelhub_match_v2";
  const PREFS_KEY = "padelhub_prefs_v2";

  let state = Scoring.createInitialState();
  let mode = null; // controller | display | spectator
  let goldenOn = true;
  let advantageOn = false;
  let soundOn = true;
  let pinEnabled = false;
  let pinCode = "";
  let pinBuffer = "";
  let timerInterval = null;
  let goldModalTeam = null; // 'A' | 'B' when waiting player pick

  // Sync handled by js/sync.js (BroadcastChannel + localStorage + PeerJS)

  // ---------- Persistence ----------
  function saveState() {
    try {
      const toSave = { ...state, history: [], savedAt: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.savedAt && Date.now() - data.savedAt > 12 * 60 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  function clearSavedState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        goldenOn, advantageOn, soundOn, pinEnabled, pinCode
      }));
    } catch (e) {}
  }

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p.goldenOn === "boolean") goldenOn = p.goldenOn;
      if (typeof p.advantageOn === "boolean") advantageOn = p.advantageOn;
      if (typeof p.soundOn === "boolean") soundOn = p.soundOn;
      if (typeof p.pinEnabled === "boolean") pinEnabled = p.pinEnabled;
      if (typeof p.pinCode === "string") pinCode = p.pinCode;
    } catch (e) {}
  }

  function isMatchInProgress(s) {
    if (!s || s.matchOver) return false;
    return (
      s.pointsA > 0 || s.pointsB > 0 ||
      s.gamesA > 0 || s.gamesB > 0 ||
      s.setsA > 0 || s.setsB > 0 ||
      s.isTieBreak ||
      (s.events && s.events.length > 0)
    );
  }

  // ---------- Haptics / Fullscreen ----------
  function vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
  }

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function toggleFullscreen() {
    const el = document.documentElement;
    if (!isFullscreen()) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) req.call(el).catch(function () {});
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document).catch(function () {});
    }
    setTimeout(updateFullscreenButton, 150);
  }

  function updateFullscreenButton() {
    const btn = $("btn-fullscreen");
    if (btn) btn.textContent = isFullscreen() ? "⛶ Salir" : "⛶ Pantalla completa";
  }

  document.addEventListener("fullscreenchange", updateFullscreenButton);
  document.addEventListener("webkitfullscreenchange", updateFullscreenButton);

  // ---------- Sync bridge ----------
  function broadcast() {
    Sync.publish(state);
  }

  function applyRemoteState(payload) {
    if (!payload) return;
    Object.assign(state, payload);
    if (!state.history) state.history = [];
    render();
    if (mode === "display" || mode === "spectator") saveState();
  }

  function updateSyncStatus(info) {
    const level = info.level || "warn";
    const text = info.text || "";
    ["ctrl-sync", "disp-sync"].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      el.className = "text-[10px] font-semibold px-2 py-0.5 rounded-full border " + (
        level === "ok"
          ? "bg-lime-500/15 text-lime-400 border-lime-500/30"
          : level === "err"
            ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
            : "bg-amber-500/15 text-amber-400 border-amber-500/30"
      );
    });
  }

  // Expose state getter for host push-on-join
  window.__padelhubGetState = function () { return state; };

  Sync.init({
    onState: applyRemoteState,
    onStatus: updateSyncStatus
  });

  // ---------- DOM ----------
  function $(id) { return document.getElementById(id); }
  function show(el) { if (el) el.classList.remove("hidden"); }
  function hide(el) { if (el) el.classList.add("hidden"); }

  // ---------- Toggles UI ----------
  function setToggle(btnId, knobId, on) {
    const knob = $(knobId);
    const btn = $(btnId);
    if (!knob || !btn) return;
    if (on) {
      knob.classList.add("translate-x-5");
      btn.classList.remove("bg-slate-600");
      btn.classList.add("bg-lime-500");
    } else {
      knob.classList.remove("translate-x-5");
      btn.classList.remove("bg-lime-500");
      btn.classList.add("bg-slate-600");
    }
  }

  function toggleGolden() {
    goldenOn = !goldenOn;
    if (goldenOn) advantageOn = false;
    savePrefs();
    applyToggleUI();
  }

  function toggleAdvantage() {
    advantageOn = !advantageOn;
    if (advantageOn) goldenOn = false;
    savePrefs();
    applyToggleUI();
  }

  function toggleSound() {
    soundOn = !soundOn;
    Sounds.setEnabled(soundOn);
    savePrefs();
    applyToggleUI();
  }

  function togglePin() {
    if (!pinEnabled) {
      // Enable: ask for PIN
      pinBuffer = "";
      show($("modal-pin"));
      $("pin-title").textContent = "Crear PIN de controlador";
      $("pin-subtitle").textContent = "Ingresá 4 dígitos para proteger el marcador";
      updatePinDots();
      window._pinMode = "create";
    } else {
      pinEnabled = false;
      pinCode = "";
      savePrefs();
      applyToggleUI();
    }
  }

  function applyToggleUI() {
    setToggle("toggle-golden", "golden-knob", goldenOn);
    setToggle("toggle-advantage", "advantage-knob", advantageOn);
    setToggle("toggle-sound", "sound-knob", soundOn);
    setToggle("toggle-pin", "pin-knob", pinEnabled);
    Sounds.setEnabled(soundOn);
  }

  // ---------- PIN ----------
  function pinDigit(d) {
    if (pinBuffer.length >= 4) return;
    pinBuffer += String(d);
    updatePinDots();
    if (pinBuffer.length === 4) {
      setTimeout(function () {
        if (window._pinMode === "create") {
          pinCode = pinBuffer;
          pinEnabled = true;
          savePrefs();
          applyToggleUI();
          hide($("modal-pin"));
          pinBuffer = "";
        } else if (window._pinMode === "unlock") {
          if (pinBuffer === pinCode) {
            hide($("modal-pin"));
            pinBuffer = "";
            actuallyStart(window._pendingMode);
          } else {
            pinBuffer = "";
            updatePinDots();
            $("pin-subtitle").textContent = "PIN incorrecto. Intentá de nuevo.";
            vibrate([40, 30, 40]);
          }
        }
      }, 120);
    }
  }

  function pinBackspace() {
    pinBuffer = pinBuffer.slice(0, -1);
    updatePinDots();
  }

  function updatePinDots() {
    for (let i = 0; i < 4; i++) {
      const dot = $("pin-dot-" + i);
      if (dot) {
        if (i < pinBuffer.length) dot.classList.add("filled");
        else dot.classList.remove("filled");
      }
    }
  }

  function cancelPin() {
    hide($("modal-pin"));
    pinBuffer = "";
    window._pendingMode = null;
  }

  // ---------- Resume ----------
  function refreshResumeBanner() {
    const banner = $("resume-banner");
    const saved = loadState();
    if (!banner) return;
    if (isMatchInProgress(saved)) {
      banner.classList.remove("hidden");
      const score = saved.setsA + "-" + saved.setsB + " sets · " + saved.gamesA + "-" + saved.gamesB + " games";
      $("resume-summary").textContent =
        (saved.teamA || "") + " vs " + (saved.teamB || "") + "  ·  " + (saved.court || "") +
        (saved.matchCode ? "  ·  #" + saved.matchCode : "") + "  ·  " + score;
    } else {
      banner.classList.add("hidden");
    }
  }

  function resumeMatch(selectedMode) {
    const saved = loadState();
    if (!saved || !isMatchInProgress(saved)) {
      start(selectedMode);
      return;
    }
    if (selectedMode === "controller" && pinEnabled && pinCode) {
      window._pendingMode = selectedMode;
      window._pinMode = "unlock";
      pinBuffer = "";
      $("pin-title").textContent = "PIN del controlador";
      $("pin-subtitle").textContent = "Ingresá el PIN para continuar el partido";
      updatePinDots();
      show($("modal-pin"));
      // stash saved for after unlock
      window._resumeSaved = saved;
      return;
    }
    applySaved(saved, selectedMode);
  }

  function applySaved(saved, selectedMode) {
    state = Object.assign(Scoring.createInitialState(), saved, { history: [] });
    if ($("input-team-a")) $("input-team-a").value = state.teamA;
    if ($("input-team-b")) $("input-team-b").value = state.teamB;
    if ($("input-court")) $("input-court").value = state.court;
    goldenOn = state.goldenPoint !== false;
    advantageOn = !!state.useAdvantage;
    mode = selectedMode;
    Sounds.setEnabled(soundOn);
    hide($("setup-screen"));
    showModeView(mode);
    render();
    startTimerTick();
    Sync.join({ mode: mode, matchCode: state.matchCode });
    broadcast();
  }

  function discardSavedMatch() {
    if (!confirm("¿Borrar el partido guardado y empezar de cero?")) return;
    clearSavedState();
    refreshResumeBanner();
  }

  // ---------- Join existing room by code (display/spectator) ----------
  function joinByCode(selectedMode) {
    const input = $("input-join-code");
    const code = (input && input.value ? input.value : "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code || code.length < 4) {
      alert("Ingresá el código de 4 caracteres del controlador (ej. A3K9)");
      return;
    }
    // Optional PIN only for controller; display/spectator free
    clearSavedState();
    state = Scoring.createInitialState({
      teamA: "Pareja A",
      teamB: "Pareja B",
      court: "Cancha",
      matchCode: code,
      goldenPoint: goldenOn,
      useAdvantage: advantageOn && !goldenOn
    });
    // Force the code (createInitialState may generate new one)
    state.matchCode = code;
    Sounds.setEnabled(soundOn);
    mode = selectedMode || "display";
    hide($("setup-screen"));
    showModeView(mode);
    render();
    startTimerTick();
    Sync.join({ mode: mode, matchCode: code });
    updateSyncStatus({ level: "warn", text: "Conectando a #" + code + "…" });
  }

  // ---------- Start ----------
  function start(selectedMode) {
    if (selectedMode === "controller" && pinEnabled && pinCode) {
      window._pendingMode = selectedMode;
      window._pinMode = "unlock";
      window._resumeSaved = null;
      pinBuffer = "";
      $("pin-title").textContent = "PIN del controlador";
      $("pin-subtitle").textContent = "Ingresá el PIN para marcar puntos";
      updatePinDots();
      show($("modal-pin"));
      return;
    }
    actuallyStart(selectedMode);
  }

  function actuallyStart(selectedMode) {
    if (window._resumeSaved) {
      applySaved(window._resumeSaved, selectedMode);
      window._resumeSaved = null;
      return;
    }
    clearSavedState();
    const teamAName = ($("input-team-a") && $("input-team-a").value.trim()) || "Pareja A";
    const teamBName = ($("input-team-b") && $("input-team-b").value.trim()) || "Pareja B";
    const pA1 = ($("input-player-a1") && $("input-player-a1").value.trim()) || "";
    const pA2 = ($("input-player-a2") && $("input-player-a2").value.trim()) || "";
    const pB1 = ($("input-player-b1") && $("input-player-b1").value.trim()) || "";
    const pB2 = ($("input-player-b2") && $("input-player-b2").value.trim()) || "";
    const playersA = (pA1 && pA2) ? [pA1, pA2] : undefined;
    const playersB = (pB1 && pB2) ? [pB1, pB2] : undefined;
    state = Scoring.createInitialState({
      teamA: teamAName,
      teamB: teamBName,
      playersA: playersA,
      playersB: playersB,
      court: ($("input-court") && $("input-court").value.trim()) || "Cancha 1",
      goldenPoint: goldenOn,
      useAdvantage: advantageOn && !goldenOn
    });
    Sounds.setEnabled(soundOn);
    mode = selectedMode;
    hide($("setup-screen"));
    showModeView(mode);
    render();
    saveState();
    startTimerTick();
    Sync.join({ mode: mode, matchCode: state.matchCode });
    broadcast();
  }

  function showModeView(m) {
    hide($("controller-view"));
    hide($("display-view"));
    if (m === "controller") show($("controller-view"));
    else show($("display-view"));
    // Spectator = display without implying control
    if (m === "display" || m === "spectator") updateFullscreenButton();
    const hint = $("disp-hint");
    if (hint) {
      hint.textContent = m === "spectator"
        ? "Modo espectador (solo lectura)"
        : "Abrí el Controlador en otro dispositivo o pestaña para marcar puntos";
    }
  }

  function showSetup() {
    stopTimerTick();
    Sync.leave();
    hide($("controller-view"));
    hide($("display-view"));
    show($("setup-screen"));
    refreshResumeBanner();
  }

  // ---------- Timer ----------
  function startTimerTick() {
    stopTimerTick();
    timerInterval = setInterval(function () {
      updateTimerUI();
    }, 1000);
    updateTimerUI();
  }

  function stopTimerTick() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimerUI() {
    const t = Scoring.formatTime(Scoring.getElapsed(state));
    const el1 = $("ctrl-timer");
    const el2 = $("disp-timer");
    if (el1) el1.textContent = t;
    if (el2) el2.textContent = t;
  }

  // ---------- Actions ----------
  function canControl() {
    return mode === "controller";
  }

  function afterAction(result) {
    state = result.state;
    playSound(result.sound);
    if (result.flash) flashTeam(result.flash);
    if (result.sound === "matchWin") vibrate([60, 40, 60, 40, 120]);
    else if (result.sound === "set" || result.sound === "game") vibrate([40, 30, 60]);
    else if (result.sound === "golden") vibrate([30, 20, 30, 20, 50]);
    else if (result.sound) vibrate(35);
    render();
    saveState();
    broadcast();
  }

  function addPoint(team) {
    if (!canControl()) return;
    if (!state.draftDone) {
      updateSyncStatus({ level: "warn", text: "Primero elegí quién saca" });
      return;
    }
    // At 40-40 golden: open player picker
    if (Scoring.isDeuceGold(state) && state.goldenPoint) {
      goldModalTeam = team;
      showGoldModal(team);
      return;
    }
    afterAction(Scoring.addPoint(state, team, null));
  }

  function confirmGoldPoint(playerName) {
    if (!canControl() || !goldModalTeam) return;
    const team = goldModalTeam;
    goldModalTeam = null;
    hideGoldModal();
    afterAction(Scoring.addPoint(state, team, playerName));
  }

  function showGoldModal(team) {
    const modal = $("modal-gold");
    const list = $("gold-player-list");
    const title = $("gold-team-name");
    if (!modal || !list) return;
    const players = team === "A" ? (state.playersA || []) : (state.playersB || []);
    title.textContent = team === "A" ? state.teamA : state.teamB;
    list.innerHTML = players.map(function (p) {
      return '<button type="button" class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl" onclick="App.confirmGoldPoint(\'' + p.replace(/'/g, "\\'") + '\')">' + p + "</button>";
    }).join("");
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  }

  function hideGoldModal() {
    const modal = $("modal-gold");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
    goldModalTeam = null;
  }

  function selectServer(team, playerIndex) {
    if (!canControl()) return;
    afterAction(Scoring.selectInitialServer(state, team, playerIndex));
  }

  function addFault() {
    if (!canControl()) return;
    afterAction(Scoring.addFault(state));
  }

  function addLet() {
    if (!canControl()) return;
    afterAction(Scoring.addLet(state));
  }

  function toggleServe() {
    if (!canControl()) return;
    state = Scoring.toggleServe(state);
    vibrate(20);
    render();
    saveState();
    broadcast();
  }

  function undo() {
    if (!canControl()) return;
    afterAction(Scoring.undo(state));
  }

  function resetMatch() {
    if (!canControl()) return;
    if (!confirm("¿Reiniciar el partido completo?")) return;
    state = Scoring.reset(state);
    playSound("undo");
    vibrate(40);
    render();
    saveState();
    broadcast();
  }

  function playSound(name) {
    if (!name || !Sounds.isEnabled()) return;
    if (typeof Sounds[name] === "function") Sounds[name]();
  }

  function flashTeam(team) {
    const prefix = mode === "controller" ? "ctrl" : "disp";
    const points = $(prefix + "-points-" + team.toLowerCase());
    const card = $(prefix + "-card-" + team.toLowerCase());
    if (points) {
      points.classList.remove("flash-point");
      void points.offsetWidth;
      points.classList.add("flash-point");
    }
    if (card) {
      const cls = team === "A" ? "flash-card" : "flash-card-b";
      card.classList.remove("flash-card", "flash-card-b");
      void card.offsetWidth;
      card.classList.add(cls);
    }
  }

  // ---------- History (by set) ----------
  function showHistory() {
    const list = $("history-list");
    list.innerHTML = "";
    if (!state.events || state.events.length === 0) {
      list.innerHTML = '<p class="text-center text-slate-500 py-8">Todavía no hay puntos registrados</p>';
    } else {
      // Group by set (events are newest first)
      const bySet = {};
      state.events.forEach(function (ev) {
        const s = ev.set || 1;
        if (!bySet[s]) bySet[s] = [];
        bySet[s].push(ev);
      });
      const setNums = Object.keys(bySet).map(Number).sort(function (a, b) { return b - a; });
      setNums.forEach(function (sn) {
        const header = document.createElement("div");
        header.className = "history-set-header";
        header.textContent = "Set " + sn;
        list.appendChild(header);
        bySet[sn].forEach(function (ev) {
          const div = document.createElement("div");
          div.className = "history-item";
          const teamClass = ev.team === "A" ? "team-a" : ev.team === "B" ? "team-b" : "event";
          div.innerHTML = '<span class="time">' + ev.time + '</span><span class="' + teamClass + '">' + ev.text + "</span>";
          list.appendChild(div);
        });
      });
    }
    show($("modal-history"));
  }

  function hideHistory() { hide($("modal-history")); }

  // ---------- QR ----------
  function showQR() {
    const canvas = $("qr-canvas");
    let url = window.location.href.split("?")[0];
    url += "?view=display&code=" + encodeURIComponent(state.matchCode || "");
    QRCode.toCanvas(canvas, url, {
      width: 220,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" }
    }, function (err) { if (err) console.error(err); });
    $("qr-info").innerHTML =
      '<p class="font-semibold text-white">' + state.court + "</p>" +
      '<p class="match-code text-lime-400 text-lg">#' + state.matchCode + "</p>" +
      "<p>" + state.teamA + "</p>" +
      '<p class="text-slate-500 text-xs">vs</p>' +
      "<p>" + state.teamB + "</p>" +
      '<p class="text-xs text-slate-500 mt-2">Sets: ' + state.setsA + "-" + state.setsB + "</p>";
    show($("modal-qr"));
  }

  function hideQR() { hide($("modal-qr")); }

  // ---------- Edit names ----------
  function showEdit() {
    if (!canControl()) return;
    $("edit-team-a").value = state.teamA;
    $("edit-team-b").value = state.teamB;
    show($("modal-edit"));
  }

  function saveEdit() {
    state = Scoring.rename(state, $("edit-team-a").value.trim(), $("edit-team-b").value.trim());
    hide($("modal-edit"));
    render();
    saveState();
    broadcast();
  }

  function hideEdit() { hide($("modal-edit")); }

  // ---------- Export ----------
  function showExport() {
    const text = Scoring.exportText(state);
    $("export-text").value = text;
    show($("modal-export"));
  }

  function hideExport() { hide($("modal-export")); }

  function copyExport() {
    const ta = $("export-text");
    ta.select();
    try {
      navigator.clipboard.writeText(ta.value);
      $("export-copy-btn").textContent = "¡Copiado!";
      setTimeout(function () {
        $("export-copy-btn").textContent = "Copiar";
      }, 1500);
    } catch (e) {
      document.execCommand("copy");
    }
  }

  // ---------- Set boxes HTML ----------
  function renderSetBoxes(prefix, side) {
    const el = $(prefix + "-setboxes-" + side);
    if (!el) return;
    const hist = state.setHistory || [];
    let html = "";
    for (let i = 0; i < 3; i++) {
      if (hist[i]) {
        const val = side === "a" ? hist[i].a : hist[i].b;
        html += '<span class="set-box">' + val + "</span>";
      } else if (i === hist.length && !state.matchOver) {
        const val = side === "a" ? state.gamesA : state.gamesB;
        html += '<span class="set-box current">' + val + "</span>";
      } else {
        html += '<span class="set-box empty">—</span>';
      }
    }
    el.innerHTML = html;
  }

  function updateServeDetails(prefix) {
    const nameEl = $(prefix + "-server-name");
    const sideEl = $(prefix + "-serve-side");
    const attEl = $(prefix + "-serve-attempt");
    if (nameEl) nameEl.textContent = state.draftDone ? Scoring.currentServerName(state) : "—";
    if (sideEl) sideEl.textContent = state.serveSide === "LEFT" ? "Izquierda" : "Derecha";
    if (attEl) attEl.textContent = state.serveAttempt === 2 ? "2º saque" : "1º saque";
    // detail lines under cards
    const detA = $(prefix + "-serve-detail-a");
    const detB = $(prefix + "-serve-detail-b");
    if (detA) {
      if (state.draftDone && state.serve === "A") {
        detA.classList.remove("hidden");
        detA.innerHTML = 'Saca: <strong class="text-white">' + Scoring.currentServerName(state) + "</strong>";
      } else detA.classList.add("hidden");
    }
    if (detB) {
      if (state.draftDone && state.serve === "B") {
        detB.classList.remove("hidden");
        detB.innerHTML = 'Saca: <strong class="text-white">' + Scoring.currentServerName(state) + "</strong>";
      } else detB.classList.add("hidden");
    }
  }

  function updateDraftOverlay() {
    const ov = $("draft-overlay");
    if (!ov) return;
    if (mode === "controller" && state && !state.draftDone && !state.matchOver) {
      ov.classList.remove("hidden");
      ov.style.display = "flex";
      // fill player buttons
      const a = $("draft-players-a");
      const b = $("draft-players-b");
      if (a) {
        a.innerHTML = (state.playersA || []).map(function (p, i) {
          return '<button type="button" onclick="App.selectServer(\'A\',' + i + ')" class="bg-slate-700 hover:bg-lime-600 font-semibold p-2.5 rounded-lg text-xs">' + p + "</button>";
        }).join("");
      }
      if (b) {
        b.innerHTML = (state.playersB || []).map(function (p, i) {
          return '<button type="button" onclick="App.selectServer(\'B\',' + i + ')" class="bg-slate-700 hover:bg-blue-600 font-semibold p-2.5 rounded-lg text-xs">' + p + "</button>";
        }).join("");
      }
      const na = $("draft-name-a");
      const nb = $("draft-name-b");
      if (na) na.textContent = state.teamA;
      if (nb) nb.textContent = state.teamB;
    } else {
      ov.classList.add("hidden");
      ov.style.display = "none";
    }
  }

  // ---------- Render ----------
  function render() {
    if (mode === "controller") renderController();
    if (mode === "display" || mode === "spectator") renderDisplay();
    updateTimerUI();
  }

  function renderController() {
    $("ctrl-name-a").textContent = state.teamA;
    $("ctrl-name-b").textContent = state.teamB;
    $("ctrl-court").textContent = state.court;
    $("ctrl-code").textContent = "#" + state.matchCode;
    $("ctrl-points-a").textContent = Scoring.getPointLabel(state, "A");
    $("ctrl-points-b").textContent = Scoring.getPointLabel(state, "B");
    $("ctrl-sets-a").textContent = state.setsA;
    $("ctrl-sets-b").textContent = state.setsB;
    $("ctrl-games-a").textContent = state.gamesA;
    $("ctrl-games-b").textContent = state.gamesB;
    $("ctrl-serve-a").style.opacity = state.serve === "A" ? "1" : "0";
    $("ctrl-serve-b").style.opacity = state.serve === "B" ? "1" : "0";
    $("ctrl-status").textContent = state.status;
    updateServeDetails("ctrl");
    updateDraftOverlay();
    renderSetBoxes("ctrl", "a");
    renderSetBoxes("ctrl", "b");

    // Dynamic button labels with team names
    const btnA = $("btn-point-a");
    const btnB = $("btn-point-b");
    if (btnA) btnA.textContent = "+ " + state.teamA.toUpperCase();
    if (btnB) btnB.textContent = "+ " + state.teamB.toUpperCase();

    const pa = $("ctrl-points-a");
    const pb = $("ctrl-points-b");
    const aLead = state.isTieBreak ? state.tieA >= state.tieB : state.pointsA >= state.pointsB;
    const bLead = state.isTieBreak ? state.tieB > state.tieA : state.pointsB > state.pointsA;
    pa.className = "text-7xl font-black tracking-tighter leading-none " + (aLead ? "text-lime-400 score-glow" : "text-white");
    pb.className = "text-7xl font-black tracking-tighter leading-none " + (bLead ? "text-lime-400 score-glow" : "text-white");

    const badge = $("ctrl-mode-badge");
    if (state.isTieBreak) {
      badge.textContent = "TIE-BREAK";
      badge.className = "text-[10px] font-bold uppercase tracking-wider bg-violet-500/15 text-violet-400 border border-violet-500/30 px-2.5 py-1 rounded-full";
    } else if (state.goldenPoint) {
      badge.textContent = "Punto de Oro";
      badge.className = "text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full";
    } else if (state.useAdvantage) {
      badge.textContent = "Ventaja";
      badge.className = "text-[10px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-400 border border-sky-500/30 px-2.5 py-1 rounded-full";
    } else {
      badge.textContent = "Deuce";
      badge.className = "text-[10px] font-bold uppercase tracking-wider bg-slate-500/15 text-slate-400 border border-slate-500/30 px-2.5 py-1 rounded-full";
    }

    $("ctrl-status").className = state.matchOver
      ? "bg-lime-950 border border-lime-700 rounded-xl py-2.5 px-4 text-center text-sm font-bold text-lime-300"
      : "bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-center text-sm font-medium text-slate-300";
  }

  function renderDisplay() {
    $("disp-name-a").textContent = state.teamA;
    $("disp-name-b").textContent = state.teamB;
    $("disp-court").textContent = state.court;
    $("disp-code").textContent = "#" + state.matchCode;
    $("disp-points-a").textContent = Scoring.getPointLabel(state, "A");
    $("disp-points-b").textContent = Scoring.getPointLabel(state, "B");
    $("disp-sets-a").textContent = state.setsA;
    $("disp-sets-b").textContent = state.setsB;
    $("disp-games-a").textContent = state.gamesA;
    $("disp-games-b").textContent = state.gamesB;
    $("disp-serve-a").style.opacity = state.serve === "A" ? "1" : "0";
    $("disp-serve-b").style.opacity = state.serve === "B" ? "1" : "0";
    $("disp-status").textContent = state.status;
    updateServeDetails("disp");
    renderSetBoxes("disp", "a");
    renderSetBoxes("disp", "b");

    const pa = $("disp-points-a");
    const pb = $("disp-points-b");
    const aLead = state.isTieBreak ? state.tieA >= state.tieB : state.pointsA >= state.pointsB;
    const bLead = state.isTieBreak ? state.tieB > state.tieA : state.pointsB > state.pointsA;
    pa.className = "text-8xl md:text-9xl font-black tracking-tighter leading-none " + (aLead ? "text-lime-400 score-glow" : "text-white");
    pb.className = "text-8xl md:text-9xl font-black tracking-tighter leading-none " + (bLead ? "text-lime-400 score-glow" : "text-white");

    const badge = $("disp-mode-badge");
    if (state.isTieBreak) {
      badge.textContent = "MODO TIE-BREAK";
      badge.className = "text-xs font-bold uppercase tracking-wider bg-violet-500/10 text-violet-400 border border-violet-500/20 px-3 py-1.5 rounded-full";
    } else if (state.goldenPoint) {
      badge.textContent = "Punto de Oro Activo";
      badge.className = "text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-full";
    } else if (state.useAdvantage) {
      badge.textContent = "Ventaja Clásica";
      badge.className = "text-xs font-bold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20 px-3 py-1.5 rounded-full";
    } else {
      badge.textContent = "Deuce";
      badge.className = "text-xs font-bold uppercase tracking-wider bg-slate-500/10 text-slate-400 border border-slate-500/20 px-3 py-1.5 rounded-full";
    }

    $("disp-status").className = state.matchOver
      ? "bg-lime-950/80 border border-lime-700 rounded-2xl py-4 text-center text-lg font-bold text-lime-300"
      : "bg-slate-900/80 border border-slate-800 rounded-2xl py-4 text-center text-lg font-medium text-slate-300";
  }

  // ---------- Boot ----------
  function init() {
    loadPrefs();
    applyToggleUI();
    refreshResumeBanner();

    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const codeParam = (params.get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (view === "display" || view === "spectator") {
      if (codeParam) {
        if ($("input-join-code")) $("input-join-code").value = codeParam;
        joinByCode(view);
      } else {
        const saved = loadState();
        if (isMatchInProgress(saved)) {
          applySaved(saved, view);
        } else {
          mode = view;
          hide($("setup-screen"));
          showModeView(mode);
          render();
          startTimerTick();
          if (state.matchCode) Sync.join({ mode: mode, matchCode: state.matchCode });
        }
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    start: start,
    joinByCode: joinByCode,
    resumeMatch: resumeMatch,
    discardSavedMatch: discardSavedMatch,
    showSetup: showSetup,
    addPoint: addPoint,
    addFault: addFault,
    addLet: addLet,
    selectServer: selectServer,
    confirmGoldPoint: confirmGoldPoint,
    hideGoldModal: hideGoldModal,
    toggleServe: toggleServe,
    undo: undo,
    resetMatch: resetMatch,
    toggleGolden: toggleGolden,
    toggleAdvantage: toggleAdvantage,
    toggleSound: toggleSound,
    togglePin: togglePin,
    pinDigit: pinDigit,
    pinBackspace: pinBackspace,
    cancelPin: cancelPin,
    showHistory: showHistory,
    hideHistory: hideHistory,
    showQR: showQR,
    hideQR: hideQR,
    showEdit: showEdit,
    saveEdit: saveEdit,
    hideEdit: hideEdit,
    showExport: showExport,
    hideExport: hideExport,
    copyExport: copyExport,
    toggleFullscreen: toggleFullscreen
  };
})();

document.addEventListener("touchmove", function (e) {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

/**
 * PadelHub — Scoring Engine
 * Saque: sorteo, jugador exacto, lado L/R, 1º/2º saque, falta, let
 * Punto de Oro con jugador que definió
 */
const Scoring = (() => {
  const LABELS = ["0", "15", "30", "40"];

  function createInitialState(opts) {
    opts = opts || {};
    const playersA = opts.playersA || splitPlayers(opts.teamA || "Pareja A");
    const playersB = opts.playersB || splitPlayers(opts.teamB || "Pareja B");
    return {
      teamA: opts.teamA || playersA.join(" / "),
      teamB: opts.teamB || playersB.join(" / "),
      playersA: playersA,
      playersB: playersB,
      court: opts.court || "Cancha 1",
      matchCode: opts.matchCode || generateCode(),
      goldenPoint: opts.goldenPoint !== false,
      useAdvantage: opts.useAdvantage === true,
      setsToWin: opts.setsToWin || 2,

      pointsA: 0,
      pointsB: 0,
      gamesA: 0,
      gamesB: 0,
      setsA: 0,
      setsB: 0,
      setHistory: [],
      advantage: null,

      // Serve model
      draftDone: false,
      serve: "A",
      serverIndexA: 0,
      serverIndexB: 0,
      serveSide: "RIGHT",
      serveAttempt: 1,

      isTieBreak: false,
      tieA: 0,
      tieB: 0,

      status: "Sorteo de saque pendiente",
      matchOver: false,
      winner: null,
      startedAt: null,
      endedAt: null,
      lastScorer: null,

      events: [],
      history: []
    };
  }

  function splitPlayers(name) {
    const parts = String(name).split("/").map(function (s) { return s.trim(); }).filter(Boolean);
    if (parts.length >= 2) return [parts[0], parts[1]];
    if (parts.length === 1) return [parts[0], "Compañero"];
    return ["Jugador 1", "Jugador 2"];
  }

  function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  function snapshot(state) {
    const copy = JSON.parse(JSON.stringify(state));
    copy.history = [];
    return copy;
  }

  function addEvent(state, text, team, kind) {
    const now = new Date();
    const time = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    state.events.unshift({ time: time, text: text, team: team || null, kind: kind || "point", set: state.setsA + state.setsB + 1 });
    if (state.events.length > 120) state.events.pop();
  }

  function ensureTimer(state) {
    if (!state.startedAt) state.startedAt = Date.now();
  }

  function getElapsed(state) {
    if (!state.startedAt) return 0;
    if (state.matchOver && state.endedAt) return state.endedAt - state.startedAt;
    return Date.now() - state.startedAt;
  }

  function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  function currentServerName(state) {
    if (state.serve === "A") return (state.playersA || [])[state.serverIndexA || 0] || state.teamA;
    return (state.playersB || [])[state.serverIndexB || 0] || state.teamB;
  }

  function getPointLabel(state, team) {
    if (state.isTieBreak) return team === "A" ? state.tieA : state.tieB;
    if (!state.goldenPoint && state.useAdvantage && state.pointsA >= 3 && state.pointsB >= 3) {
      if (state.advantage === team) return "Ad";
      return "40";
    }
    const idx = team === "A" ? state.pointsA : state.pointsB;
    return LABELS[Math.min(idx, 3)] || "0";
  }

  function saveHistory(state) {
    state.history.push(snapshot(state));
    if (state.history.length > 50) state.history.shift();
  }

  /** Sorteo inicial: team A|B, playerIndex 0|1 */
  function selectInitialServer(state, team, playerIndex) {
    saveHistory(state);
    const idx = playerIndex === 1 ? 1 : 0;
    state.serve = team;
    state.serveSide = "RIGHT";
    state.serveAttempt = 1;
    state.draftDone = true;
    if (team === "A") state.serverIndexA = idx;
    else state.serverIndexB = idx;
    const name = currentServerName(state);
    state.status = "Saca " + name + " (derecha)";
    addEvent(state, "Sorteo: saca " + name, team, "info");
    return { state: state, sound: null, flash: null };
  }

  function afterPointServeAdjust(state) {
    // After each point (not game): reset attempt to 1, alternate side
    state.serveAttempt = 1;
    state.serveSide = state.serveSide === "RIGHT" ? "LEFT" : "RIGHT";
  }

  function rotateServerAfterGame(state) {
    const prevTeam = state.serve;
    const nextTeam = prevTeam === "A" ? "B" : "A";
    if (nextTeam === "A") {
      if (prevTeam === "A") state.serverIndexA = ((state.serverIndexA || 0) + 1) % 2;
      // if coming from B, keep serverIndexA (same partner continues sequence)
    } else {
      if (prevTeam === "B") state.serverIndexB = ((state.serverIndexB || 0) + 1) % 2;
    }
    state.serve = nextTeam;
    state.serveSide = "RIGHT";
    state.serveAttempt = 1;
  }

  function addPoint(state, team, scoredBy) {
    if (state.matchOver) return { state: state, sound: null, flash: null };
    if (!state.draftDone) return { state: state, sound: null, flash: null };
    ensureTimer(state);
    saveHistory(state);
    state.lastScorer = scoredBy || null;

    if (state.isTieBreak) return handleTieBreak(state, team, scoredBy);
    return handleRegular(state, team, scoredBy);
  }

  function addFault(state) {
    if (state.matchOver || !state.draftDone) return { state: state, sound: null, flash: null };
    ensureTimer(state);
    saveHistory(state);
    if (state.serveAttempt === 1) {
      state.serveAttempt = 2;
      state.status = "2º saque — " + currentServerName(state);
      addEvent(state, "Falta (1º saque)", state.serve, "fault");
      return { state: state, sound: "undo", flash: null };
    }
    // Double fault → point to receiver
    const receiver = state.serve === "A" ? "B" : "A";
    addEvent(state, "Doble falta → punto " + (receiver === "A" ? state.teamA : state.teamB), state.serve, "fault");
    if (state.isTieBreak) return handleTieBreak(state, receiver, null);
    return handleRegular(state, receiver, null);
  }

  function addLet(state) {
    if (state.matchOver || !state.draftDone) return { state: state, sound: null, flash: null };
    saveHistory(state);
    state.status = "Let — repite saque (" + currentServerName(state) + ")";
    addEvent(state, "Let (saque se repite)", state.serve, "info");
    return { state: state, sound: null, flash: null };
  }

  function handleRegular(state, team, scoredBy) {
    const isA = team === "A";
    const scorerTag = scoredBy ? " (" + scoredBy + ")" : "";

    if (!state.goldenPoint && state.useAdvantage) {
      return handleAdvantagePoint(state, team, scoredBy);
    }

    let pA = state.pointsA;
    let pB = state.pointsB;
    if (isA) pA++; else pB++;

    // Gold point at deuce
    if (state.goldenPoint && pA >= 4 && pB >= 4) {
      addEvent(state, "Punto de Oro → " + (isA ? state.teamA : state.teamB) + scorerTag, team, "golden");
      return winGame(state, team, "¡Punto de Oro! " + (isA ? state.teamA : state.teamB), "golden");
    }

    if (!state.goldenPoint && !state.useAdvantage) {
      if (pA >= 4 && pA - pB >= 2) {
        addEvent(state, "Juego → " + state.teamA + scorerTag, "A", "game");
        return winGame(state, "A", "Juego para " + state.teamA, "game");
      }
      if (pB >= 4 && pB - pA >= 2) {
        addEvent(state, "Juego → " + state.teamB + scorerTag, "B", "game");
        return winGame(state, "B", "Juego para " + state.teamB, "game");
      }
      state.pointsA = pA;
      state.pointsB = pB;
      afterPointServeAdjust(state);
      if (pA >= 3 && pB >= 3 && pA === pB) {
        state.status = "¡Deuce!";
        addEvent(state, "Deuce", null, "info");
        return { state: state, sound: "point", flash: team };
      }
      state.status = "Punto " + (isA ? state.teamA : state.teamB) + scorerTag;
      addEvent(state, "Punto → " + (isA ? state.teamA : state.teamB) + scorerTag, team, "point");
      return { state: state, sound: "point", flash: team };
    }

    if (state.goldenPoint) {
      if (pA >= 4 && pB < 3) {
        addEvent(state, "Juego → " + state.teamA + scorerTag, "A", "game");
        return winGame(state, "A", "Juego para " + state.teamA, "game");
      }
      if (pB >= 4 && pA < 3) {
        addEvent(state, "Juego → " + state.teamB + scorerTag, "B", "game");
        return winGame(state, "B", "Juego para " + state.teamB, "game");
      }
    }

    state.pointsA = Math.min(pA, 3);
    state.pointsB = Math.min(pB, 3);
    afterPointServeAdjust(state);

    if (state.pointsA === 3 && state.pointsB === 3) {
      state.status = state.goldenPoint ? "¡40-40! PUNTO DE ORO" : "¡Deuce!";
      addEvent(state, state.goldenPoint ? "Deuce → Punto de Oro" : "Deuce", null, "info");
      return { state: state, sound: "golden", flash: team };
    }

    state.status = "Punto " + (isA ? state.teamA : state.teamB) + scorerTag;
    addEvent(state, "Punto → " + (isA ? state.teamA : state.teamB) + scorerTag, team, "point");
    return { state: state, sound: "point", flash: team };
  }

  function handleAdvantagePoint(state, team, scoredBy) {
    const isA = team === "A";
    const scorerTag = scoredBy ? " (" + scoredBy + ")" : "";
    let pA = state.pointsA;
    let pB = state.pointsB;

    if (pA < 3 || pB < 3) {
      if (isA) pA++; else pB++;
      if (pA >= 4 && pB < 3) {
        state.pointsA = pA; state.pointsB = pB;
        addEvent(state, "Juego → " + state.teamA + scorerTag, "A", "game");
        return winGame(state, "A", "Juego para " + state.teamA, "game");
      }
      if (pB >= 4 && pA < 3) {
        state.pointsA = pA; state.pointsB = pB;
        addEvent(state, "Juego → " + state.teamB + scorerTag, "B", "game");
        return winGame(state, "B", "Juego para " + state.teamB, "game");
      }
      state.pointsA = Math.min(pA, 3);
      state.pointsB = Math.min(pB, 3);
      afterPointServeAdjust(state);
      if (state.pointsA === 3 && state.pointsB === 3) {
        state.advantage = null;
        state.status = "¡Deuce!";
        addEvent(state, "Deuce", null, "info");
      } else {
        state.status = "Punto " + (isA ? state.teamA : state.teamB) + scorerTag;
        addEvent(state, "Punto → " + (isA ? state.teamA : state.teamB) + scorerTag, team, "point");
      }
      return { state: state, sound: "point", flash: team };
    }

    if (!state.advantage) {
      state.advantage = team;
      afterPointServeAdjust(state);
      state.status = "Ventaja " + (isA ? state.teamA : state.teamB);
      addEvent(state, "Ventaja → " + (isA ? state.teamA : state.teamB) + scorerTag, team, "info");
      return { state: state, sound: "point", flash: team };
    }
    if (state.advantage === team) {
      state.advantage = null;
      addEvent(state, "Juego → " + (isA ? state.teamA : state.teamB) + scorerTag, team, "game");
      return winGame(state, team, "Juego para " + (isA ? state.teamA : state.teamB), "game");
    }
    state.advantage = null;
    afterPointServeAdjust(state);
    state.status = "¡Deuce!";
    addEvent(state, "Deuce", null, "info");
    return { state: state, sound: "point", flash: team };
  }

  function handleTieBreak(state, team, scoredBy) {
    if (team === "A") state.tieA++; else state.tieB++;
    const total = state.tieA + state.tieB;
    // First point same server, then every 2 points change server; side alternates each point
    afterPointServeAdjust(state);
    if (total === 1 || (total > 1 && (total - 1) % 2 === 0)) {
      // change serving team/player like game rotation partially
      const prev = state.serve;
      state.serve = prev === "A" ? "B" : "A";
      if (state.serve === "A" && prev === "A") state.serverIndexA = ((state.serverIndexA || 0) + 1) % 2;
      if (state.serve === "B" && prev === "B") state.serverIndexB = ((state.serverIndexB || 0) + 1) % 2;
    }
    const tag = scoredBy ? " (" + scoredBy + ")" : "";
    addEvent(state, "TB " + state.tieA + "-" + state.tieB + tag, team, "point");

    if (state.tieA >= 7 && state.tieA - state.tieB >= 2) {
      state.gamesA++;
      return endSet(state, "A");
    }
    if (state.tieB >= 7 && state.tieB - state.tieA >= 2) {
      state.gamesB++;
      return endSet(state, "B");
    }
    state.status = "Tie-break " + state.tieA + "-" + state.tieB + " · Saca " + currentServerName(state);
    return { state: state, sound: "point", flash: team };
  }

  function winGame(state, team, msg, soundHint) {
    state.pointsA = 0;
    state.pointsB = 0;
    state.advantage = null;
    if (team === "A") state.gamesA++; else state.gamesB++;
    rotateServerAfterGame(state);
    state.status = msg + " · Saca " + currentServerName(state);

    if (state.gamesA >= 6 && state.gamesA - state.gamesB >= 2) return endSet(state, "A");
    if (state.gamesB >= 6 && state.gamesB - state.gamesA >= 2) return endSet(state, "B");
    if (state.gamesA === 6 && state.gamesB === 6) {
      state.isTieBreak = true;
      state.tieA = 0;
      state.tieB = 0;
      state.status = "¡6-6! Tie-Break · Saca " + currentServerName(state);
      addEvent(state, "¡Comienza Tie-Break!", null, "info");
      return { state: state, sound: "set", flash: team };
    }
    return { state: state, sound: soundHint || "game", flash: team };
  }

  function endSet(state, winner) {
    state.setHistory.push({ a: state.gamesA, b: state.gamesB });
    state.isTieBreak = false;
    state.tieA = 0;
    state.tieB = 0;
    state.pointsA = 0;
    state.pointsB = 0;
    state.advantage = null;
    state.gamesA = 0;
    state.gamesB = 0;
    if (winner === "A") state.setsA++; else state.setsB++;
    rotateServerAfterGame(state);

    const last = state.setHistory[state.setHistory.length - 1];
    addEvent(state, "SET " + state.setHistory.length + " → " + (winner === "A" ? state.teamA : state.teamB) + " (" + last.a + "-" + last.b + ")", winner, "set");

    const need = state.setsToWin || 2;
    if (state.setsA >= need || state.setsB >= need) {
      state.matchOver = true;
      state.winner = winner;
      state.endedAt = Date.now();
      state.status = "🏆 ¡" + (winner === "A" ? state.teamA : state.teamB) + " GANA EL PARTIDO!";
      addEvent(state, "PARTIDO FINALIZADO → " + (winner === "A" ? state.teamA : state.teamB), winner, "match");
      return { state: state, sound: "matchWin", flash: winner };
    }
    state.status = "Set para " + (winner === "A" ? state.teamA : state.teamB) + " · " + state.setsA + "-" + state.setsB;
    return { state: state, sound: "set", flash: winner };
  }

  function toggleServe(state) {
    if (state.matchOver) return state;
    state.serve = state.serve === "A" ? "B" : "A";
    state.serveAttempt = 1;
    state.serveSide = "RIGHT";
    state.status = "Saque manual → " + currentServerName(state);
    return state;
  }

  function undo(state) {
    if (!state.history.length) return { state: state, sound: null, flash: null };
    const prev = state.history.pop();
    const hist = state.history;
    Object.assign(state, prev);
    state.history = hist;
    return { state: state, sound: "undo", flash: null };
  }

  function reset(state) {
    const fresh = createInitialState({
      teamA: state.teamA,
      teamB: state.teamB,
      playersA: state.playersA,
      playersB: state.playersB,
      court: state.court,
      matchCode: state.matchCode,
      goldenPoint: state.goldenPoint,
      useAdvantage: state.useAdvantage,
      setsToWin: state.setsToWin
    });
    fresh.status = "Partido reiniciado — sorteo pendiente";
    addEvent(fresh, "Partido reiniciado", null, "info");
    return fresh;
  }

  function rename(state, teamA, teamB, playersA, playersB) {
    if (teamA) state.teamA = teamA;
    if (teamB) state.teamB = teamB;
    if (playersA) state.playersA = playersA;
    if (playersB) state.playersB = playersB;
    return state;
  }

  function exportText(state) {
    const lines = [
      "PadelHub — Resultado",
      "Código: " + state.matchCode,
      "Cancha: " + state.court,
      state.teamA + "  vs  " + state.teamB,
      ""
    ];
    (state.setHistory || []).forEach(function (s, i) {
      lines.push("Set " + (i + 1) + ": " + s.a + " - " + s.b);
    });
    lines.push("Sets: " + state.setsA + " - " + state.setsB);
    lines.push("Duración: " + formatTime(getElapsed(state)));
    return lines.join("\n");
  }

  function isDeuceGold(state) {
    return !state.isTieBreak && state.goldenPoint && state.pointsA === 3 && state.pointsB === 3;
  }

  return {
    createInitialState: createInitialState,
    generateCode: generateCode,
    selectInitialServer: selectInitialServer,
    addPoint: addPoint,
    addFault: addFault,
    addLet: addLet,
    toggleServe: toggleServe,
    undo: undo,
    reset: reset,
    rename: rename,
    getPointLabel: getPointLabel,
    getElapsed: getElapsed,
    formatTime: formatTime,
    exportText: exportText,
    currentServerName: currentServerName,
    isDeuceGold: isDeuceGold
  };
})();

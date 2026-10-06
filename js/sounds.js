/**
 * PadelHub — Sound Engine
 * Generates simple tones with Web Audio API (no external files needed)
 */
const Sounds = (() => {
  let ctx = null;
  let enabled = true;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    return ctx;
  }

  function playTone(freq, duration = 0.12, type = "sine", volume = 0.25) {
    if (!enabled) return;
    try {
      const audio = getCtx();
      const osc = audio.createOscillator();
      const gain = audio.createGain();

      osc.type = type;
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(volume, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);

      osc.connect(gain);
      gain.connect(audio.destination);

      osc.start(audio.currentTime);
      osc.stop(audio.currentTime + duration);
    } catch (e) {
      // Silently fail if audio not available
    }
  }

  function point() {
    // Short high beep
    playTone(880, 0.1, "sine", 0.22);
  }

  function game() {
    // Two-tone ascending
    playTone(523, 0.12, "triangle", 0.28);
    setTimeout(() => playTone(784, 0.18, "triangle", 0.28), 130);
  }

  function set() {
    // Three-tone celebration
    playTone(523, 0.1, "square", 0.2);
    setTimeout(() => playTone(659, 0.1, "square", 0.2), 120);
    setTimeout(() => playTone(784, 0.25, "square", 0.25), 240);
  }

  function matchWin() {
    // Longer victory fanfare
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => playTone(f, 0.22, "triangle", 0.3), i * 160);
    });
  }

  function golden() {
    // Distinctive golden point sound
    playTone(440, 0.08, "sawtooth", 0.18);
    setTimeout(() => playTone(660, 0.08, "sawtooth", 0.18), 90);
    setTimeout(() => playTone(880, 0.15, "sawtooth", 0.22), 180);
  }

  function undo() {
    playTone(300, 0.08, "sine", 0.15);
  }

  function setEnabled(val) {
    enabled = !!val;
  }

  function isEnabled() {
    return enabled;
  }

  return {
    point,
    game,
    set,
    matchWin,
    golden,
    undo,
    setEnabled,
    isEnabled
  };
})();

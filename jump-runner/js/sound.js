// 极简音效：用 WebAudio 振荡器合成，无需音频素材文件。
// 运行环境不支持时自动静音，不影响游戏。
let actx = null;

function ensureCtx() {
  if (!actx) {
    try {
      if (typeof wx !== 'undefined' && typeof wx.createWebAudioContext === 'function') {
        actx = wx.createWebAudioContext();
      }
    } catch (e) { /* 忽略，保持静音 */ }
  }
  return actx;
}

function tone(freq, dur, type, vol, slide) {
  const a = ensureCtx();
  if (!a) return;
  try {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    if (slide) {
      o.frequency.linearRampToValueAtTime(freq + slide, a.currentTime + dur);
    }
    g.gain.value = vol || 0.12;
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g);
    g.connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur);
  } catch (e) { /* 忽略 */ }
}

module.exports = {
  jump() { tone(460, 0.1, 'square', 0.08, 220); },
  doubleJump() { tone(620, 0.1, 'square', 0.08, 300); },
  coin() {
    tone(988, 0.07, 'sine', 0.1);
    setTimeout(() => tone(1319, 0.1, 'sine', 0.1), 55);
  },
  hit() { tone(200, 0.3, 'sawtooth', 0.16, -130); },
  start() {
    tone(523, 0.08, 'triangle', 0.1);
    setTimeout(() => tone(784, 0.1, 'triangle', 0.1), 80);
  },
  tap() { tone(660, 0.05, 'triangle', 0.06); },
  buy() {
    tone(659, 0.08, 'triangle', 0.1);
    setTimeout(() => tone(880, 0.08, 'triangle', 0.1), 70);
    setTimeout(() => tone(1319, 0.12, 'triangle', 0.1), 140);
  },
  shieldGet() {
    tone(392, 0.1, 'triangle', 0.1);
    setTimeout(() => tone(587, 0.14, 'triangle', 0.1), 70);
  },
  shieldSave() {
    tone(330, 0.1, 'square', 0.1, 120);
    setTimeout(() => tone(494, 0.16, 'square', 0.08, 80), 80);
  },
  magnet() { tone(300, 0.22, 'sine', 0.12, 420); },
  slide() { tone(520, 0.14, 'sine', 0.08, -320); },
  milestone() {
    tone(659, 0.09, 'triangle', 0.1);
    setTimeout(() => tone(988, 0.13, 'triangle', 0.1), 90);
  },
  startBgm,
  stopBgm,
  setMuted,
  isMuted,
};

// ---- 背景音乐：五声音阶琶音，仅在游戏中播放，音量很轻 ----
let muted = false;
let bgmTimer = null;
let bgmStep = 0;
const SCALE = [262, 294, 330, 392, 440, 523, 587]; // C 大调五声
const MELODY = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 5, 6, 5, 4, 2];

function bgmStepPlay() {
  if (!ensureCtx()) return;
  const n = MELODY[bgmStep % MELODY.length];
  tone(SCALE[n], 0.16, 'triangle', 0.032);
  if (bgmStep % 4 === 0) {
    tone(SCALE[n] / 2, 0.34, 'sine', 0.045);
  }
  bgmStep++;
}

function startBgm() {
  if (muted || bgmTimer || !ensureCtx()) return;
  bgmStep = 0;
  bgmTimer = setInterval(bgmStepPlay, 165);
}

function stopBgm() {
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

function setMuted(m) {
  muted = !!m;
  if (muted) stopBgm();
}

function isMuted() {
  return muted;
}

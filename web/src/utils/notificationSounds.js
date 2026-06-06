let audioContext = null;
let unlocked = false;
let lastPlayedAt = 0;

const MIN_SOUND_GAP_MS = 10000;

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  return audioContext;
}

export async function unlockNotificationAudio() {
  const context = getAudioContext();
  if (!context) {
    return false;
  }

  if (context.state === "suspended") {
    await context.resume();
  }

  unlocked = context.state === "running";
  return unlocked;
}

function playTone(context, { frequency, duration, gain = 0.2, type = "sine", delay = 0 }) {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const startAt = context.currentTime + delay;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(gain, startAt + 0.03);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

function canPlaySound(force = false) {
  const now = Date.now();
  if (!force && now - lastPlayedAt < MIN_SOUND_GAP_MS) {
    return false;
  }

  lastPlayedAt = now;
  return true;
}

export async function playNotificationSound(type, options = {}) {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  await unlockNotificationAudio();

  if (type === "REMINDER") {
    if (!canPlaySound()) {
      return;
    }
    playTone(context, { frequency: 740, duration: 0.1, gain: 0.14, type: "sine" });
    return;
  }

  if (!canPlaySound(options.force)) {
    return;
  }

  if (type === "NEW_ORDER") {
    playTone(context, { frequency: 784, duration: 0.12, gain: 0.22, type: "sine" });
    playTone(context, { frequency: 988, duration: 0.14, gain: 0.2, type: "sine", delay: 0.13 });
    return;
  }

  if (type === "ORDER_READY") {
    playTone(context, { frequency: 659, duration: 0.16, gain: 0.18, type: "sine" });
    return;
  }

  if (type === "ORDER_CANCELLED") {
    playTone(context, { frequency: 330, duration: 0.18, gain: 0.16, type: "sine" });
  }
}

export function isNotificationAudioUnlocked() {
  return unlocked;
}

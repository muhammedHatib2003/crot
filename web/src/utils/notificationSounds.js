let audioContext = null;
let unlocked = false;

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

function playTone(context, { frequency, duration, gain = 0.55, type = "square", delay = 0 }) {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const startAt = context.currentTime + delay;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(gain, startAt + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

export async function playNotificationSound(type) {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  await unlockNotificationAudio();

  if (type === "NEW_ORDER") {
    playTone(context, { frequency: 880, duration: 0.16, gain: 0.7, delay: 0 });
    playTone(context, { frequency: 1175, duration: 0.16, gain: 0.7, delay: 0.2 });
    playTone(context, { frequency: 1480, duration: 0.22, gain: 0.75, delay: 0.4 });
    return;
  }

  if (type === "ORDER_READY") {
    playTone(context, { frequency: 620, duration: 0.12, gain: 0.55, delay: 0 });
    playTone(context, { frequency: 930, duration: 0.18, gain: 0.6, delay: 0.14 });
    playTone(context, { frequency: 1240, duration: 0.24, gain: 0.65, delay: 0.3 });
    return;
  }

  if (type === "ORDER_CANCELLED") {
    playTone(context, { frequency: 220, duration: 0.35, gain: 0.65, type: "sawtooth", delay: 0 });
    playTone(context, { frequency: 165, duration: 0.4, gain: 0.6, type: "sawtooth", delay: 0.22 });
  }
}

export function isNotificationAudioUnlocked() {
  return unlocked;
}

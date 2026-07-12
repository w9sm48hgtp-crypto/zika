/**
 * 消息提示音
 */
import { useSettingsStore } from '../stores/settingsStore';

let audioCtx: AudioContext | null = null;
let audioBuffer: AudioBuffer | null = null;
let loadPromise: Promise<void> | null = null;
let loadFailed = false;

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

async function loadSound(): Promise<void> {
  if (audioBuffer) return;
  if (loadFailed) return;
  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = (async () => {
    const resp = await fetch(import.meta.env.BASE_URL + 'message-sound.mp3');
    if (!resp.ok) { loadFailed = true; return; }
    const arrayBuf = await resp.arrayBuffer();
    const ctx = getCtx();
    if (!ctx) { loadFailed = true; return; }
    audioBuffer = await ctx.decodeAudioData(arrayBuf);
  })();

  await loadPromise;
}

// 首次交互时解锁 AudioContext + 预加载
if (typeof document !== 'undefined') {
  const unlock = async () => {
    const ctx = getCtx();
    if (ctx && ctx.state === 'suspended') await ctx.resume();
    if (!audioBuffer && !loadFailed) loadSound().catch(() => {});
  };
  document.addEventListener('click', unlock, { once: true });
  document.addEventListener('touchstart', unlock, { once: true });
}

export async function playMessageSound(): Promise<void> {
  try {
    const volume = useSettingsStore.getState().soundVolume;
    if (volume === 0) return; // 音量为 0 直接跳过

    if (loadFailed) return;
    await loadSound();
    if (!audioBuffer) return;

    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();
    if (ctx.state !== 'running') return;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    const gain = ctx.createGain();
    gain.gain.value = volume / 100 * 0.6; // 0-100 → 0-0.6
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
  } catch {
    // 静默忽略
  }
}

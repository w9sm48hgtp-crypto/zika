/**
 * 消息提示音
 */
import { useSettingsStore } from '../stores/settingsStore';

let audioCtx: AudioContext | null = null;
let audioBuffer: AudioBuffer | null = null;
let loadPromise: Promise<void> | null = null;

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
  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = (async () => {
    try {
      const resp = await fetch(import.meta.env.BASE_URL + 'message-sound.mp3');
      if (!resp.ok) return;
      const arrayBuf = await resp.arrayBuffer();
      const ctx = getCtx();
      if (!ctx) return;
      audioBuffer = await ctx.decodeAudioData(arrayBuf);
    } catch {
      // 加载失败不缓存结果，下次重试
      loadPromise = null;
    }
  })();

  await loadPromise;
}

// 每次用户交互时尝试恢复 AudioContext（不设 once，确保切后台回来后也能恢复）
if (typeof document !== 'undefined') {
  const unlock = async () => {
    const ctx = getCtx();
    if (ctx && ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { /* ignore */ }
    }
    if (!audioBuffer) loadSound().catch(() => {});
  };
  document.addEventListener('click', unlock);
  document.addEventListener('touchstart', unlock);
}

export async function playMessageSound(): Promise<void> {
  try {
    const volume = useSettingsStore.getState().soundVolume;
    if (volume === 0) return;

    await loadSound();
    if (!audioBuffer) return;

    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { /* ignore */ }
    }
    if (ctx.state !== 'running') return;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    const gain = ctx.createGain();
    gain.gain.value = volume / 100 * 0.6;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
  } catch {
    // 静默忽略
  }
}

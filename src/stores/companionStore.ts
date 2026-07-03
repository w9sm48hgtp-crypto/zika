import { create } from 'zustand';
import { db, type CompanionRecord } from '../db';

interface CompanionState {
  scene: CompanionRecord['scene'];
  customSceneName: string;
  mode: 'countUp' | 'countDown';
  targetMinutes: number;
  isRunning: boolean;
  startTime: number | null;
  elapsedSeconds: number;
  activeRecordId: number | null;
  records: CompanionRecord[];

  setScene: (scene: CompanionRecord['scene']) => void;
  setCustomSceneName: (name: string) => void;
  setMode: (mode: 'countUp' | 'countDown') => void;
  setTargetMinutes: (min: number) => void;
  startTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;
  cancelTimer: () => Promise<void>;
  tick: () => void;
  loadRecords: () => Promise<void>;
  deleteRecord: (id: number) => Promise<void>;
  checkRunningTimer: () => Promise<void>;
}

function formatSeconds(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export { formatSeconds };

export const useCompanionStore = create<CompanionState>((set, get) => ({
  scene: 'study',
  customSceneName: '',
  mode: 'countUp',
  targetMinutes: 30,
  isRunning: false,
  startTime: null,
  elapsedSeconds: 0,
  activeRecordId: null,
  records: [],

  setScene: (scene) => set({ scene, customSceneName: scene !== 'custom' ? '' : get().customSceneName }),
  setCustomSceneName: (name) => set({ customSceneName: name }),
  setMode: (mode) => set({ mode }),
  setTargetMinutes: (min) => set({ targetMinutes: Math.max(1, min) }),

  startTimer: async () => {
    const { scene, customSceneName, mode, targetMinutes } = get();
    const now = Date.now();
    const record: CompanionRecord = {
      scene,
      customSceneName: customSceneName || undefined,
      mode,
      targetDuration: mode === 'countDown' ? targetMinutes : undefined,
      startTime: now,
      status: 'running',
    };
    const id = await db.companionRecords.add(record);
    set({ isRunning: true, startTime: now, elapsedSeconds: 0, activeRecordId: id as number });
  },

  stopTimer: async () => {
    const { activeRecordId, elapsedSeconds } = get();
    if (activeRecordId != null) {
      await db.companionRecords.update(activeRecordId, {
        status: 'completed',
        endTime: Date.now(),
        actualDuration: elapsedSeconds,
      });
    }
    set({ isRunning: false, startTime: null, elapsedSeconds: 0, activeRecordId: null });
    await get().loadRecords();
  },

  cancelTimer: async () => {
    const { activeRecordId, elapsedSeconds } = get();
    if (activeRecordId != null) {
      await db.companionRecords.update(activeRecordId, {
        status: 'cancelled',
        endTime: Date.now(),
        actualDuration: elapsedSeconds,
      });
    }
    set({ isRunning: false, startTime: null, elapsedSeconds: 0, activeRecordId: null });
    await get().loadRecords();
  },

  tick: () => {
    const { isRunning, startTime } = get();
    if (!isRunning || !startTime) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    set({ elapsedSeconds: elapsed });
  },

  loadRecords: async () => {
    const records = await db.companionRecords
      .orderBy('startTime')
      .reverse()
      .limit(50)
      .toArray();
    set({ records });
  },

  deleteRecord: async (id) => {
    await db.companionRecords.delete(id);
    await get().loadRecords();
  },

  checkRunningTimer: async () => {
    const running = await db.companionRecords
      .where('status')
      .equals('running')
      .first();
    if (running?.id != null) {
      set({
        isRunning: true,
        startTime: running.startTime,
        scene: running.scene,
        customSceneName: running.customSceneName || '',
        mode: running.mode,
        targetMinutes: running.targetDuration || 30,
        activeRecordId: running.id,
        elapsedSeconds: Math.floor((Date.now() - running.startTime) / 1000),
      });
    }
  },
}));

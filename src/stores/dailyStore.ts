import { create } from 'zustand';
import { db, type DailyRecord, type MoodTag } from '../db';
import { pickPartnerDailyNote } from '../utils/cardExtractor';
import {
  predictNext, getPeriodDays, getPredictedDays,
  startPeriod, endPeriod, getOngoingPeriod, cancelLastPeriod, deletePeriodContaining,
  type Prediction,
} from '../utils/periodPredictor';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

interface DailyState {
  year: number;
  month: number;
  recordsMap: Record<string, DailyRecord>;
  moodTags: MoodTag[];
  periodDays: Set<string>;
  predictedDays: Set<string>;
  prediction: Prediction | null;
  selectedDate: string | null;
  selectedRecord: DailyRecord | null;

  loadMonth: (year: number, month: number) => Promise<void>;
  loadMoodTags: () => Promise<void>;
  goMonth: (delta: number) => void;
  selectDate: (date: string) => void;
  clearSelection: () => void;
  toggleUserMood: (tag: string) => Promise<void>;
  addUserNote: (note: string) => Promise<void>;
  editUserNote: (index: number, note: string) => Promise<void>;
  deleteUserNote: (index: number) => Promise<void>;
  addMoodTag: (name: string, category: MoodTag['category']) => Promise<void>;
  deleteMoodTag: (id: number) => Promise<void>;
  ongoingPeriod: boolean;
  startPeriod: (date: string) => Promise<void>;
  endPeriod: (date: string) => Promise<void>;
  cancelPeriod: () => Promise<void>;
  deleteCompletedPeriod: (date: string) => Promise<void>;
  refreshPeriod: () => Promise<void>;
}

export const useDailyStore = create<DailyState>((set, get) => ({
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  recordsMap: {},
  moodTags: [],
  periodDays: new Set(),
  predictedDays: new Set(),
  prediction: null,
  ongoingPeriod: false,
  selectedDate: null,
  selectedRecord: null,

  loadMonth: async (year, month) => {
    const totalDays = new Date(year, month, 0).getDate();
    const firstDay = dateStr(year, month, 1);
    const lastDay = dateStr(year, month, totalDays);
    const list = await db.dailyRecords
      .where('date')
      .between(firstDay, lastDay, true, true)
      .toArray();
    const map: Record<string, DailyRecord> = {};
    for (const r of list) map[r.date] = r;

    // 为今天及之前的缺失日期生成记录；未来日期不生成
    const today = todayStr();
    const tags = await db.moodTags.toArray();
    const hisTags = tags.filter(t => t.category === 'his' || t.category === 'both');
    const now = Date.now();
    const toAdd: DailyRecord[] = [];

    for (let d = 1; d <= totalDays; d++) {
      const ds = dateStr(year, month, d);
      if (ds > today) continue; // 未来日期不生成
      if (!map[ds]) {
        const partnerMoodTag = hisTags.length > 0
          ? hisTags[Math.floor(Math.random() * hisTags.length)].name
          : undefined;
        // 过去的日期立即揭晓，今天随机延迟
        const moodTime = ds === today
          ? now + Math.floor(Math.random() * 6 * 60 * 60 * 1000)
          : now;
        const record: DailyRecord = {
          date: ds,
          userNotes: [],
          userMoodTags: [],
          partnerMoodTag,
          partnerMoodTime: moodTime,
        };
        if (ds === today) {
          record.partnerNote = await pickPartnerDailyNote() || undefined;
        }
        toAdd.push(record);
      }
    }

    // 清理旧数据：移除所有非今天的伙伴状态
    for (const r of list) {
      if (r.date !== today && r.partnerMoodTag) {
        await db.dailyRecords.update(r.id!, { partnerMoodTag: undefined, partnerMoodTime: undefined });
        map[r.date] = { ...map[r.date], partnerMoodTag: undefined, partnerMoodTime: undefined };
      }
    }

    for (const r of toAdd) {
      const id = await db.dailyRecords.add(r);
      r.id = id as number;
      map[r.date] = r;
    }

    // 加载经期数据
    const periodDays = await getPeriodDays();
    const prediction = await predictNext();
    const predictedDays = getPredictedDays(prediction);
    const ongoing = await getOngoingPeriod();

    set({ year, month, recordsMap: map, periodDays, prediction, predictedDays, ongoingPeriod: !!ongoing });
  },

  loadMoodTags: async () => {
    const moodTags = await db.moodTags.orderBy('createdAt').toArray();
    set({ moodTags });
  },

  goMonth: (delta) => {
    const { year, month } = get();
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    if (newMonth > 12) { newMonth = 1; newYear++; }
    set({ year: newYear, month: newMonth });
    get().loadMonth(newYear, newMonth);
  },

  selectDate: (date) => {
    const { recordsMap } = get();
    const record = recordsMap[date] || {
      date,
      userNotes: [],
      userMoodTags: [],
    };
    set({ selectedDate: date, selectedRecord: record });
  },

  clearSelection: () => set({ selectedDate: null, selectedRecord: null }),

  toggleUserMood: async (tag) => {
    const { selectedDate, recordsMap } = get();
    if (!selectedDate) return;
    let record = recordsMap[selectedDate];
    // 如果该日期还没有记录，创建一个
    if (!record?.id) {
      const id = await db.dailyRecords.add({
        date: selectedDate,
        userNotes: [],
        userMoodTags: [],
      });
      record = { date: selectedDate, userNotes: [], userMoodTags: [], id: id as number };
    }
    const current = record.userMoodTags || [];
    let next: string[];
    if (current.includes(tag)) {
      next = current.filter(t => t !== tag);
    } else {
      if (current.length >= 3) return;
      next = [...current, tag];
    }
    await db.dailyRecords.update(record.id!, { userMoodTags: next });
    const updated = { ...record, userMoodTags: next };
    set({
      recordsMap: { ...recordsMap, [selectedDate]: updated },
      selectedRecord: updated,
    });
  },

  addUserNote: async (note) => {
    const { selectedDate, recordsMap } = get();
    if (!selectedDate) return;
    let record = recordsMap[selectedDate];
    if (!record?.id) {
      const id = await db.dailyRecords.add({
        date: selectedDate,
        userNotes: [],
        userMoodTags: [],
      });
      record = { date: selectedDate, userNotes: [], userMoodTags: [], id: id as number };
    }
    if ((record.userNotes?.length || 0) >= 3) return;
    const userNotes = [...(record.userNotes || []), note];
    await db.dailyRecords.update(record.id!, { userNotes });
    const updated = { ...record, userNotes };
    set({
      recordsMap: { ...recordsMap, [selectedDate]: updated },
      selectedRecord: updated,
    });
  },

  editUserNote: async (index, note) => {
    const { selectedDate, recordsMap } = get();
    if (!selectedDate) return;
    const record = recordsMap[selectedDate];
    if (!record?.id) return;
    const userNotes = [...(record.userNotes || [])];
    if (index < 0 || index >= userNotes.length) return;
    userNotes[index] = note;
    await db.dailyRecords.update(record.id, { userNotes });
    const updated = { ...record, userNotes };
    set({
      recordsMap: { ...recordsMap, [selectedDate]: updated },
      selectedRecord: updated,
    });
  },

  deleteUserNote: async (index) => {
    const { selectedDate, recordsMap } = get();
    if (!selectedDate) return;
    const record = recordsMap[selectedDate];
    if (!record?.id) return;
    const userNotes = (record.userNotes || []).filter((_, i) => i !== index);
    await db.dailyRecords.update(record.id, { userNotes });
    const updated = { ...record, userNotes };
    set({
      recordsMap: { ...recordsMap, [selectedDate]: updated },
      selectedRecord: updated,
    });
  },

  addMoodTag: async (name, category) => {
    const id = await db.moodTags.add({ name, category, createdAt: Date.now() });
    const newTag: MoodTag = { id: id as number, name, category, createdAt: Date.now() };
    set((s) => ({ moodTags: [...s.moodTags, newTag] }));
  },

  deleteMoodTag: async (id) => {
    await db.moodTags.delete(id);
    set((s) => ({ moodTags: s.moodTags.filter((t) => t.id !== id) }));
  },

  startPeriod: async (date) => {
    await startPeriod(date);
    await get().refreshPeriod();
  },

  endPeriod: async (date) => {
    await endPeriod(date);
    await get().refreshPeriod();
  },

  cancelPeriod: async () => {
    await cancelLastPeriod();
    await get().refreshPeriod();
  },

  deleteCompletedPeriod: async (date) => {
    await deletePeriodContaining(date);
    await get().refreshPeriod();
  },

  refreshPeriod: async () => {
    const periodDays = await getPeriodDays();
    const prediction = await predictNext();
    const predictedDays = getPredictedDays(prediction);
    const ongoing = await getOngoingPeriod();
    set({ periodDays, prediction, predictedDays, ongoingPeriod: !!ongoing });
  },
}));

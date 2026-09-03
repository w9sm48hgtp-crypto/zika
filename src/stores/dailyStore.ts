import { create } from 'zustand';
import { db, type DailyRecord, type MoodTag } from '../db';
import { pickPartnerDailyNote, pickNoteReply } from '../utils/cardExtractor';
import { getActiveDatesInRange } from '../utils/activeDays';
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
    // 你当天来过的日期（打开网站/聊天/陪伴/写字的痕迹），只有这些日子他才记录状态
    const activeSet = await getActiveDatesInRange(firstDay, lastDay);
    const now = Date.now();
    // 当天最晚揭晓时间：不超过今天 23:59:59.999
    const endOfToday = (() => {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    })();
    // 他的状态：当天内任意时间揭晓（随机 0~6 小时，最晚不跨天）
    const pickMoodTime = () => Math.min(
      now + Math.floor(Math.random() * 6 * 60 * 60 * 1000),
      endOfToday,
    );
    const toAdd: DailyRecord[] = [];

    for (let d = 1; d <= totalDays; d++) {
      const ds = dateStr(year, month, d);
      if (ds > today) continue; // 未来日期不生成
      if (!map[ds]) {
        // 只有"你来过"的那天才生成他的随机标签；没来过的日子不生成（避免脏标签）
        const isToday = ds === today;
        const isActive = isToday || activeSet.has(ds);
        const record: DailyRecord = {
          date: ds,
          userNotes: [],
          userMoodTags: [],
          partnerMoodTag: isActive && hisTags.length > 0
            ? hisTags[Math.floor(Math.random() * hisTags.length)].name
            : undefined,
          partnerMoodTime: isToday ? pickMoodTime() : (isActive ? now : undefined),
        };
        if (isToday) {
          record.partnerNote = await pickPartnerDailyNote() || undefined;
        }
        toAdd.push(record);
      }
    }

    for (const r of toAdd) {
      const id = await db.dailyRecords.add(r);
      r.id = id as number;
      map[r.date] = r;
    }

    // 今天已有记录但他的标签为空（如导入产生的空记录）→ 补一个随机标签。
    // 与用户自己是否记录无关，当天内随机时间揭晓
    const existingToday = map[today];
    if (existingToday?.id != null && !existingToday.partnerMoodTag && hisTags.length > 0) {
      const tag = hisTags[Math.floor(Math.random() * hisTags.length)].name;
      const moodTime = pickMoodTime();
      await db.dailyRecords.update(existingToday.id, { partnerMoodTag: tag, partnerMoodTime: moodTime });
      map[today] = { ...existingToday, partnerMoodTag: tag, partnerMoodTime: moodTime };
    }

    // 过去的日子：你当天来过、但记录里他的标签为空（如旧版本/导入产生的）→ 补上，立即显示
    for (const ds of Object.keys(map)) {
      if (ds >= today) continue;
      if (!activeSet.has(ds)) continue;
      const r = map[ds];
      if (!r?.id || r.partnerMoodTag || hisTags.length === 0) continue;
      const tag = hisTags[Math.floor(Math.random() * hisTags.length)].name;
      await db.dailyRecords.update(r.id, { partnerMoodTag: tag, partnerMoodTime: now });
      map[ds] = { ...r, partnerMoodTag: tag, partnerMoodTime: now };
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

    // 随机回复：50% 概率从字卡库抽取 1~3 条文字作为回复
    let partnerNote = record.partnerNote;
    if (Math.random() < 0.5) {
      const reply = await pickNoteReply();
      if (reply) {
        partnerNote = reply;
      }
    }

    await db.dailyRecords.update(record.id!, { userNotes, partnerNote });
    const updated = { ...record, userNotes, partnerNote };
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

import { create } from 'zustand';
import { db, type Letter } from '../db';
import { pickLetterReply } from '../utils/cardExtractor';

// 模块级 timer 管理
const pendingTimers = new Map<number, ReturnType<typeof setTimeout>>();

function cancelLetterTimer(id: number) {
  const t = pendingTimers.get(id);
  if (t) {
    clearTimeout(t);
    pendingTimers.delete(id);
  }
}

interface LetterState {
  letters: Letter[];
  loading: boolean;
  loadLetters: () => Promise<void>;
  sendLetter: (content: string) => Promise<number>;
  generateReply: (id: number) => Promise<void>;
  checkReplies: () => Promise<void>;
  deleteLetter: (id: number) => Promise<void>;
}

export const useLetterStore = create<LetterState>((set, get) => ({
  letters: [],
  loading: false,

  loadLetters: async () => {
    set({ loading: true });
    const letters = await db.letters.orderBy('sentAt').reverse().toArray();
    set({ letters, loading: false });
  },

  sendLetter: async (content) => {
    const now = Date.now();
    // 8-24小时随机延迟
    const delayMs = (8 * 60 * 60 * 1000) + Math.random() * (16 * 60 * 60 * 1000);
    const id = await db.letters.add({
      userContent: content,
      sentAt: now,
      repliedAt: now + delayMs,
    });

    // 预约回信
    const timer = setTimeout(async () => {
      pendingTimers.delete(id as number);
      // 回信时重新检查
      const letter = await db.letters.get(id as number);
      if (letter && !letter.replyContent) {
        const replyContent = await pickLetterReply();
        await db.letters.update(id as number, { replyContent });
        // 刷新列表
        const letters = await db.letters.orderBy('sentAt').reverse().toArray();
        set({ letters });
      }
    }, delayMs);
    pendingTimers.set(id as number, timer);

    await get().loadLetters();
    return id as number;
  },

  generateReply: async (id) => {
    cancelLetterTimer(id);
    const letter = await db.letters.get(id);
    if (!letter || letter.replyContent) return;
    const replyContent = await pickLetterReply();
    await db.letters.update(id, { replyContent });
    await get().loadLetters();
  },

  checkReplies: async () => {
    const { letters } = get();
    const now = Date.now();

    for (const letter of letters) {
      if (letter.replyContent) continue; // 已有回信
      if (!letter.repliedAt) continue;

      if (letter.repliedAt <= now) {
        // 回信时间已到，立即生成
        await get().generateReply(letter.id!);
      } else if (!pendingTimers.has(letter.id!)) {
        // 预约未来的回信
        const delay = letter.repliedAt - now;
        const timer = setTimeout(async () => {
          pendingTimers.delete(letter.id!);
          await get().generateReply(letter.id!);
        }, delay);
        pendingTimers.set(letter.id!, timer);
      }
    }
  },

  deleteLetter: async (id) => {
    cancelLetterTimer(id);
    await db.letters.delete(id);
    await get().loadLetters();
  },
}));

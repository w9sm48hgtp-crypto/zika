import { create } from 'zustand';
import { db, type Letter } from '../db';
import { pickLetterReply } from '../utils/cardExtractor';
import { useSettingsStore } from './settingsStore';

/** 格式化书信：自动添加称呼和落款 */
function formatLetter(content: string, recipientName: string, senderName: string, timestamp: number): string {
  const d = new Date(timestamp);
  const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  return `致${recipientName}：\n${content}\n${dateStr}\n${senderName}`;
}

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
    const settings = useSettingsStore.getState();
    const partnerName = settings.partnerName || '他';
    const userName = settings.userName || '我';

    // 自动格式化：致对方 + 内容 + 日期 + 我的名字
    const formatted = formatLetter(content, partnerName, userName, now);

    // 8-24小时随机延迟
    const delayMs = (8 * 60 * 60 * 1000) + Math.random() * (16 * 60 * 60 * 1000);
    const id = await db.letters.add({
      userContent: formatted,
      sentAt: now,
      repliedAt: now + delayMs,
    });

    // 预约回信
    const timer = setTimeout(async () => {
      pendingTimers.delete(id as number);
      const letter = await db.letters.get(id as number);
      if (letter && !letter.replyContent) {
        const rawReply = await pickLetterReply();
        const replyTime = Date.now();
        // 回信格式：致我 + 内容 + 日期 + 对方名字
        const formattedReply = formatLetter(rawReply, userName, partnerName, replyTime);
        await db.letters.update(id as number, { replyContent: formattedReply });
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
    const settings = useSettingsStore.getState();
    const partnerName = settings.partnerName || '他';
    const userName = settings.userName || '我';
    const rawReply = await pickLetterReply();
    const replyTime = Date.now();
    const formattedReply = formatLetter(rawReply, userName, partnerName, replyTime);
    await db.letters.update(id, { replyContent: formattedReply });
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

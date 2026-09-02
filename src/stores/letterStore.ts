import { create } from 'zustand';
import { db, type Letter } from '../db';
import { pickLetterReply } from '../utils/cardExtractor';
import { checkAndGenerateIncoming, getLetterNames } from '../utils/incomingLetter';

/** 格式化书信：自动添加称呼和落款 */
function formatLetter(content: string, recipientName: string, senderName: string, timestamp: number): string {
  const d = new Date(timestamp);
  const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  return `致${recipientName}：\n${content}\n${dateStr}\n${senderName}`;
}

/** 修复早期因设置未加载而写成"致我…他"的书信（仅当已设置自定义昵称时） */
function repairLetterText(text: string, userName: string, partnerName: string): string {
  if (userName === '我' && partnerName === '他') return text; // 从未设置自定义昵称，无需修复
  const lines = text.split('\n');
  if (lines.length < 3) return text;
  if (lines[0] !== '致我：') return text;
  if (!/^\d{4}年\d{1,2}月\d{1,2}日$/.test(lines[lines.length - 2])) return text;
  if (lines[lines.length - 1] !== '他') return text;
  const content = lines.slice(1, -2).join('\n');
  return `致${userName}：\n${content}\n${lines[lines.length - 2]}\n${partnerName}`;
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

export type LetterFilter = 'all' | 'sent' | 'incoming';

interface LetterState {
  letters: Letter[];
  loading: boolean;
  filter: LetterFilter;
  setFilter: (filter: LetterFilter) => void;
  loadLetters: () => Promise<void>;
  sendLetter: (content: string) => Promise<number>;
  generateReply: (id: number) => Promise<void>;
  checkReplies: () => Promise<void>;
  checkIncoming: () => Promise<number | null>;
  deleteLetter: (id: number) => Promise<void>;
}

export const useLetterStore = create<LetterState>((set, get) => ({
  letters: [],
  loading: false,
  filter: 'all' as LetterFilter,

  setFilter: (filter: LetterFilter) => {
    set({ filter });
    get().loadLetters();
  },

  loadLetters: async () => {
    set({ loading: true });
    const { filter } = get();
    let letters: Letter[];
    if (filter === 'sent') {
      letters = await db.letters.where('direction').equals('sent').reverse().sortBy('sentAt');
    } else if (filter === 'incoming') {
      letters = await db.letters.where('direction').equals('incoming').reverse().sortBy('sentAt');
    } else {
      letters = await db.letters.orderBy('sentAt').reverse().toArray();
    }
    // 修复历史错误昵称的书信（致我…他 → 自定义昵称）
    const names = await getLetterNames();
    let repaired = false;
    for (const l of letters) {
      const fixed = repairLetterText(l.userContent, names.userName, names.partnerName);
      const fixedReply = l.replyContent
        ? repairLetterText(l.replyContent, names.userName, names.partnerName)
        : l.replyContent;
      if (fixed !== l.userContent || fixedReply !== l.replyContent) {
        await db.letters.update(l.id!, { userContent: fixed, replyContent: fixedReply });
        l.userContent = fixed;
        l.replyContent = fixedReply;
        repaired = true;
      }
    }
    if (repaired) {
      // 重新读取，保持列表顺序与数据库一致
      letters = await db.letters.orderBy('sentAt').reverse().toArray();
    }
    set({ letters, loading: false });
  },

  sendLetter: async (content) => {
    const now = Date.now();
    const { partnerName, userName } = await getLetterNames();

    // 自动格式化：致对方 + 内容 + 日期 + 我的名字
    const formatted = formatLetter(content, partnerName, userName, now);

    // 8-24小时随机延迟
    const delayMs = (8 * 60 * 60 * 1000) + Math.random() * (16 * 60 * 60 * 1000);
    const id = await db.letters.add({
      direction: 'sent',
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
        // 回信格式：致我 + 内容 + 日期 + 对方名字（生成时再读一次昵称，防止中途改名）
        const freshNames = await getLetterNames();
        const formattedReply = formatLetter(rawReply, freshNames.userName, freshNames.partnerName, replyTime);
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
    const { partnerName, userName } = await getLetterNames();
    const rawReply = await pickLetterReply();
    const replyTime = Date.now();
    const formattedReply = formatLetter(rawReply, userName, partnerName, replyTime);
    await db.letters.update(id, { direction: 'sent', replyContent: formattedReply });
    await get().loadLetters();
  },

  checkIncoming: async () => {
    const id = await checkAndGenerateIncoming();
    if (id != null) {
      await get().loadLetters();
    }
    return id;
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

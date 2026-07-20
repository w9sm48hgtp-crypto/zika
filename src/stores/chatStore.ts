import { create } from 'zustand';
import { db, type ChatMessage, type Card } from '../db';
import { pickCardsWithRatio } from '../utils/cardExtractor';
import { playMessageSound } from '../utils/sound';
import { useSettingsStore } from './settingsStore';

// 模块级定时器，不受 React 组件卸载影响
let replyTimerId: ReturnType<typeof setTimeout> | null = null;
let replyKind: 'cards' | 'choice' | 'both' | null = null;
let replyChoiceContent: string = '';

/** 每次加载的消息条数 */
const MESSAGE_PAGE_SIZE = 50;
const MESSAGE_LOAD_MORE = 50;

async function executeCardsReply(
  addPartnerMessage: (card: Card, quoteId?: number, quoteContent?: string) => Promise<void>
) {
  const settings = useSettingsStore.getState();
  const min = settings.replyCountMin || 1;
  const max = settings.replyCountMax || 3;
  const count = min + Math.floor(Math.random() * (max - min + 1));

  const cards = await pickCardsWithRatio(
    count,
    settings.textRatio || 70,
    settings.nudgeRatio || 20,
    settings.stickerRatio || 10,
  );

  // 预先收集用户最近 2 回合的消息，作为引用候选池
  const allMsgs = await db.chatMessages.orderBy('timestamp').reverse().toArray();
  const quotePool: { id?: number; content: string }[] = [];
  let userRoundCount = 0;
  let inUserBlock = false;

  for (const msg of allMsgs) {
    if (msg.sender === 'user') {
      quotePool.push(msg);
      inUserBlock = true;
    } else {
      if (inUserBlock) {
        userRoundCount++;
        inUserBlock = false;
      }
      if (userRoundCount >= 2) break;
    }
  }
  if (inUserBlock && userRoundCount < 2) {
    userRoundCount++;
  }

  if (cards.length === 0) {
    const fallback: Card = { type: 'text', content: '先去「我的」给我加点字卡吧~', createdAt: Date.now(), updatedAt: Date.now() };
    // 单条消息也独立判断引用
    let qId: number | undefined;
    let qContent: string | undefined;
    if (quotePool.length > 0 && Math.random() < 0.05) {
      const picked = quotePool[Math.floor(Math.random() * quotePool.length)];
      qId = picked.id;
      qContent = picked.content;
    }
    await addPartnerMessage(fallback, qId, qContent);
  } else {
    for (let i = 0; i < cards.length; i++) {
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));
      // 每条回复消息独立 5% 概率引用，每次最多引用一句
      let qId: number | undefined;
      let qContent: string | undefined;
      if (quotePool.length > 0 && Math.random() < 0.05) {
        const picked = quotePool[Math.floor(Math.random() * quotePool.length)];
        qId = picked.id;
        qContent = picked.content;
      }
      await addPartnerMessage(cards[i], qId, qContent);
    }
  }
}

async function executeChoiceReply(choiceContent: string) {
  const lines = choiceContent.split('\n').filter(l => l.trim());
  const options = lines.slice(1);
  if (options.length === 0) return;
  const picked = options[Math.floor(Math.random() * options.length)];

  const msg: ChatMessage = { sender: 'partner', content: picked, msgType: 'choice_a', timestamp: Date.now() };
  const id = await db.chatMessages.add(msg);
  msg.id = id;
  useChatStore.setState((s) => ({ messages: [...s.messages, msg] }));
  // 收到回复播放提示音
  playMessageSound();
}

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  hasMore: boolean;

  loadMessages: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  sendMessage: (content: string, msgType?: ChatMessage['msgType'], quotedMessageId?: number, quotedContent?: string) => Promise<void>;
  addPartnerMessage: (card: Card, quoteId?: number, quoteContent?: string) => Promise<void>;
  setTyping: (v: boolean) => void;
  clearMessages: () => Promise<void>;
  deleteMessagesBefore: (timestamp: number) => Promise<number>;
  /** 启动回复定时器（模块级，切屏不中断） */
  scheduleReply: (kind: 'cards' | 'choice' | 'both', choiceContent?: string) => void;
  /** 取消待执行的回复 */
  cancelReply: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isTyping: false,
  hasMore: false,

  loadMessages: async () => {
    const total = await db.chatMessages.count();
    const messages = await db.chatMessages
      .orderBy('timestamp')
      .reverse()
      .limit(MESSAGE_PAGE_SIZE)
      .toArray();
    messages.reverse(); // 恢复时间正序
    set({ messages, hasMore: total > MESSAGE_PAGE_SIZE });
  },

  loadMoreMessages: async () => {
    const { messages } = get();
    if (messages.length === 0) return;
    const oldestTimestamp = messages[0].timestamp;
    const older = await db.chatMessages
      .where('timestamp')
      .below(oldestTimestamp)
      .reverse()
      .limit(MESSAGE_LOAD_MORE)
      .toArray();
    older.reverse(); // 恢复时间正序
    const totalBefore = await db.chatMessages
      .where('timestamp').below(oldestTimestamp).count();
    set({ messages: [...older, ...messages], hasMore: older.length < totalBefore });
  },

  sendMessage: async (content, msgType = 'text', quotedMessageId?, quotedContent?) => {
    const userMsg: ChatMessage = {
      sender: 'user',
      content,
      msgType,
      quotedMessageId,
      quotedContent,
      timestamp: Date.now(),
    };
    const id = await db.chatMessages.add(userMsg);
    userMsg.id = id;
    set((s) => ({ messages: [...s.messages, userMsg] }));
    // 发送消息播放提示音
    playMessageSound();
  },

  addPartnerMessage: async (card, quoteId?, quoteContent?) => {
    // 如果有引用，msgType 改为 quote
    const hasQuote = quoteId != null && quoteContent != null;
    // 防御性判断：如果内容本身是 data URL（如图片 base64），强制当图片处理
    // 防止字卡 type 标记错误导致 base64 被当纯文本发出去
    const isDataUrl = card.content.startsWith('data:');
    const msg: ChatMessage = {
      sender: 'partner',
      content: card.content,
      // 优先级：内容本身是 data URL 先判断（表情包+引用也不能当文字发）
      // → 有引用标记 → 表情包 → 拍一拍 → 默认文字
      msgType: isDataUrl ? 'image'
        : hasQuote ? 'quote'
        : card.type === 'sticker' ? 'image'
        : card.type === 'nudge' ? 'nudge'
        : 'text',
      quotedMessageId: quoteId,
      quotedContent: quoteContent,
      timestamp: Date.now(),
    };
    const id = await db.chatMessages.add(msg);
    msg.id = id;
    set((s) => ({ messages: [...s.messages, msg] }));
    // 收到回复播放提示音
    playMessageSound();
  },

  setTyping: (v) => set({ isTyping: v }),

  clearMessages: async () => {
    await db.chatMessages.clear();
    set({ messages: [], hasMore: false });
  },

  deleteMessagesBefore: async (timestamp: number) => {
    const toDelete = await db.chatMessages.where('timestamp').below(timestamp).toArray();
    if (toDelete.length > 0) {
      await db.chatMessages.bulkDelete(toDelete.map(m => m.id!));
    }
    // 重新加载
    await get().loadMessages();
    return toDelete.length;
  },

  scheduleReply: (kind, choiceContent) => {
    // 合并逻辑：如果已有待回复内容，合并类型（不取消旧的）
    if (replyKind && replyKind !== kind) {
      replyKind = 'both';
    } else {
      replyKind = kind;
    }
    // 合并 choiceContent（选择题只保留最新的内容）
    if (choiceContent) {
      replyChoiceContent = choiceContent;
    }
    // 清除旧定时器，重新计时
    if (replyTimerId) { clearTimeout(replyTimerId); replyTimerId = null; }

    set({ isTyping: true });

    const settings = useSettingsStore.getState();
    const min = settings.replyDelayMin || 120;
    const max = settings.replyDelayMax || 180;
    const delayMs = (min + Math.random() * (max - min)) * 1000; // 最短~最长之间随机秒数

    replyTimerId = setTimeout(async () => {
      replyTimerId = null;
      try {
        const addFn = get().addPartnerMessage;
        // 先回选择题，再回字卡
        if ((replyKind === 'choice' || replyKind === 'both') && replyChoiceContent) {
          await executeChoiceReply(replyChoiceContent);
        }
        if (replyKind === 'cards' || replyKind === 'both') {
          await executeCardsReply(addFn);
        }
      } catch (err) {
        console.error('reply error:', err);
      } finally {
        replyKind = null;
        replyChoiceContent = '';
        set({ isTyping: false });
      }
    }, delayMs);
  },

  cancelReply: () => {
    if (replyTimerId) {
      clearTimeout(replyTimerId);
      replyTimerId = null;
    }
    replyKind = null;
    replyChoiceContent = '';
    set({ isTyping: false });
  },
}));

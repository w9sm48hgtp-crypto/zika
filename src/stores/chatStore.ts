import { create } from 'zustand';
import { db, type ChatMessage, type Card } from '../db';
import { pickCardsWithRatio } from '../utils/cardExtractor';
import { playMessageSound } from '../utils/sound';
import { useSettingsStore } from './settingsStore';

// 模块级定时器，不受 React 组件卸载影响
let replyTimerId: ReturnType<typeof setTimeout> | null = null;
let replyKind: 'cards' | 'choice' | 'both' | null = null;
let replyChoiceContent: string = '';

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

  loadMessages: () => Promise<void>;
  sendMessage: (content: string, msgType?: ChatMessage['msgType'], quotedMessageId?: number, quotedContent?: string) => Promise<void>;
  addPartnerMessage: (card: Card, quoteId?: number, quoteContent?: string) => Promise<void>;
  setTyping: (v: boolean) => void;
  clearMessages: () => Promise<void>;
  /** 启动回复定时器（模块级，切屏不中断） */
  scheduleReply: (kind: 'cards' | 'choice' | 'both', choiceContent?: string) => void;
  /** 取消待执行的回复 */
  cancelReply: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isTyping: false,

  loadMessages: async () => {
    const messages = await db.chatMessages.orderBy('timestamp').toArray();
    set({ messages });
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
    const msg: ChatMessage = {
      sender: 'partner',
      content: card.content,
      msgType: hasQuote ? 'quote'
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
    set({ messages: [] });
  },

  scheduleReply: (kind, choiceContent) => {
    // 清除旧定时器
    if (replyTimerId) { clearTimeout(replyTimerId); replyTimerId = null; }

    replyKind = kind;
    replyChoiceContent = choiceContent || '';
    set({ isTyping: true });

    const settings = useSettingsStore.getState();
    const delayMs = (settings.replyDelay || 1) * 60 * 1000;

    replyTimerId = setTimeout(async () => {
      replyTimerId = null;
      try {
        const addFn = get().addPartnerMessage;
        if (replyKind === 'cards' || replyKind === 'both') {
          await executeCardsReply(addFn);
        }
        if ((replyKind === 'choice' || replyKind === 'both') && replyChoiceContent) {
          await executeChoiceReply(replyChoiceContent);
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

import { create } from 'zustand';
import { db, type ChatMessage, type Card } from '../db';
import { pickCardsWithRatio } from '../utils/cardExtractor';
import { useSettingsStore } from './settingsStore';

// 模块级定时器，不受 React 组件卸载影响
let replyTimerId: ReturnType<typeof setTimeout> | null = null;
let replyKind: 'cards' | 'choice' | 'both' | null = null;
let replyChoiceContent: string = '';

async function executeCardsReply(addPartnerMessage: (card: Card) => Promise<void>) {
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

  if (cards.length === 0) {
    const fallback: Card = { type: 'text', content: '先去「我的」给我加点字卡吧~', createdAt: Date.now(), updatedAt: Date.now() };
    await addPartnerMessage(fallback);
  } else {
    for (const card of cards) {
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));
      await addPartnerMessage(card);
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
}

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;

  loadMessages: () => Promise<void>;
  sendMessage: (content: string, msgType?: ChatMessage['msgType'], quotedMessageId?: number, quotedContent?: string) => Promise<void>;
  addPartnerMessage: (card: Card) => Promise<void>;
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
  },

  addPartnerMessage: async (card) => {
    const msg: ChatMessage = {
      sender: 'partner',
      content: card.content,
      msgType: card.type === 'sticker' ? 'image' : card.type === 'nudge' ? 'nudge' : 'text',
      timestamp: Date.now(),
    };
    const id = await db.chatMessages.add(msg);
    msg.id = id;
    set((s) => ({ messages: [...s.messages, msg] }));
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

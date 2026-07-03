import { create } from 'zustand';
import { db, type ChatMessage, type Card } from '../db';

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  replyQueue: Card[];

  loadMessages: () => Promise<void>;
  sendMessage: (content: string, msgType?: ChatMessage['msgType'], quotedMessageId?: number, quotedContent?: string) => Promise<void>;
  addPartnerMessage: (card: Card) => Promise<void>;
  setTyping: (v: boolean) => void;
  clearMessages: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isTyping: false,
  replyQueue: [],

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
}));

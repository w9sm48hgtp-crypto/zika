import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { pickCardsWithRatio, isWithinTenMinutes } from '../utils/cardExtractor';
import { ChatBubble } from '../components/chat/ChatBubble';
import { ChatInput } from '../components/chat/ChatInput';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { db, type ChatMessage, type Card } from '../db';
import styles from './ChatPage.module.css';

const SEED_CARDS = [
  '我也想你呀',
  '今天过得怎么样？',
  '要好好吃饭哦',
  '早点休息，别熬夜',
  '你真好',
  '有我在呢',
  '给你一个大大的拥抱',
  '今天的你也很好看',
  '辛苦了，注意休息',
  '记得喝水',
];

async function seedCardsIfEmpty() {
  const count = await db.cards.where('type').equals('text').count();
  if (count === 0) {
    const now = Date.now();
    const cards = SEED_CARDS.map((content) => ({
      type: 'text' as const,
      content,
      createdAt: now,
      updatedAt: now,
    }));
    await db.cards.bulkAdd(cards);
  }
}

function ChatPage() {
  const {
    messages, isTyping,
    loadMessages, sendMessage, addPartnerMessage, setTyping,
  } = useChatStore();
  const { partnerName, loadSettings } = useSettingsStore();

  const [quotedMessage, setQuotedMessage] = useState<ChatMessage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoaded = useRef(false);
  const choiceContentRef = useRef<string>('');
  const replyKindRef = useRef<'cards' | 'choice' | 'both' | null>(null);
  const doReplyRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!isLoaded.current) {
      isLoaded.current = true;
      seedCardsIfEmpty();
      loadSettings();
      loadMessages();
    }
  }, [loadSettings, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // 执行字卡回复
  const doCardsReply = useCallback(async () => {
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
  }, [addPartnerMessage]);

  // 执行选择题回复
  const doChoiceReply = useCallback(async (choiceContent: string) => {
    const lines = choiceContent.split('\n').filter(l => l.trim());
    const options = lines.slice(1);
    if (options.length === 0) return;
    const picked = options[Math.floor(Math.random() * options.length)];

    const msg: ChatMessage = { sender: 'partner', content: picked, msgType: 'choice_a', timestamp: Date.now() };
    const id = await db.chatMessages.add(msg);
    msg.id = id;
    useChatStore.setState((s) => ({ messages: [...s.messages, msg] }));
  }, []);

  // 统一回复入口
  const doReply = useCallback(async () => {
    try {
      const kind = replyKindRef.current;
      if (kind === 'cards' || kind === 'both') {
        await doCardsReply();
      }
      if ((kind === 'choice' || kind === 'both') && choiceContentRef.current) {
        await doChoiceReply(choiceContentRef.current);
      }
    } catch (err) {
      console.error('reply error:', err);
    } finally {
      setTyping(false);
      replyKindRef.current = null;
      choiceContentRef.current = '';
    }
  }, [setTyping, doCardsReply, doChoiceReply]);

  // 始终保持 ref 指向最新 doReply
  doReplyRef.current = doReply;

  // 启动回复定时器
  const scheduleReply = useCallback((kind: 'cards' | 'choice' | 'both', choiceContent?: string) => {
    if (replyTimerRef.current) { clearTimeout(replyTimerRef.current); replyTimerRef.current = null; }

    replyKindRef.current = kind;
    choiceContentRef.current = choiceContent || '';
    setTyping(true);

    const settings = useSettingsStore.getState();
    const delayMs = (settings.replyDelay || 1) * 60 * 1000;

    replyTimerRef.current = setTimeout(() => {
      replyTimerRef.current = null;
      doReplyRef.current();
    }, delayMs);
  }, [doReply, setTyping]);

  useEffect(() => {
    return () => { if (replyTimerRef.current) clearTimeout(replyTimerRef.current); };
  }, []);

  // 用户发送消息
  const handleSend = useCallback(async (
    content: string,
    type: 'text' | 'nudge' | 'sticker' | 'choice'
  ) => {
    const quoteId = quotedMessage?.id;
    const quoteContent = quotedMessage?.content;
    const msgType = type === 'sticker' ? 'image' : type === 'choice' ? 'choice_q' : type;

    await sendMessage(content, msgType, quoteId, quoteContent);
    setQuotedMessage(null);

    // 拍一拍和普通文字都触发字卡回复
    const hasChoice = (type === 'choice');
    const hasCards = (type === 'text' || type === 'nudge' || type === 'sticker');

    if (hasChoice && hasCards) {
      scheduleReply('both', content);
    } else if (hasChoice) {
      scheduleReply('choice', content);
    } else if (hasCards) {
      scheduleReply('cards');
    }
  }, [sendMessage, scheduleReply, quotedMessage]);

  const handleQuote = useCallback((msg: ChatMessage) => {
    if (quotedMessage?.id === msg.id) {
      setQuotedMessage(null);
    } else {
      setQuotedMessage(msg);
    }
  }, [quotedMessage]);

  const canBeQuotedByPartner = useCallback((msg: ChatMessage) => {
    if (msg.sender !== 'user') return false;
    return isWithinTenMinutes(msg.timestamp);
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.headerName}>{partnerName || '他'}</span>
      </header>

      <div className={styles.messageList}>
        {messages.length === 0 && (
          <div className={styles.emptyHint}>
            <p>发送第一条消息吧</p>
            <p className={styles.subHint}>也可以先去「我的」添加字卡</p>
          </div>
        )}

        {messages.map((msg) => {
          const quoted = msg.quotedMessageId
            ? messages.find((m) => m.id === msg.quotedMessageId)
            : null;
          return (
            <ChatBubble
              key={msg.id}
              message={msg}
              onQuote={(m) => {
                if (m.sender === 'user' || canBeQuotedByPartner(m)) {
                  handleQuote(m);
                }
              }}
              quotedMessage={quoted ?? null}
            />
          );
        })}

        {isTyping && (
          <div className={styles.typingArea}>
            <TypingIndicator />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {isTyping && (
        <div className={styles.typingBar}>
          {partnerName || '他'} 正在输入中...
        </div>
      )}

      <ChatInput
        onSend={handleSend}
        onQuoteCancel={() => setQuotedMessage(null)}
        quotedContent={quotedMessage?.content ?? null}
      />
    </div>
  );
}

export default ChatPage;

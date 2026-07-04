import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { isWithinTenMinutes } from '../utils/cardExtractor';
import { ChatBubble } from '../components/chat/ChatBubble';
import { ChatInput } from '../components/chat/ChatInput';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { db, type ChatMessage } from '../db';
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
    loadMessages, sendMessage, scheduleReply,
  } = useChatStore();
  const { partnerName, chatBackground, loadSettings } = useSettingsStore();

  const [quotedMessage, setQuotedMessage] = useState<ChatMessage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isLoaded = useRef(false);

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

      <div
        className={styles.messageList}
        style={chatBackground ? {
          backgroundImage: `url(${chatBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        } : undefined}
      >
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

      <ChatInput
        onSend={handleSend}
        onQuoteCancel={() => setQuotedMessage(null)}
        quotedContent={quotedMessage?.content ?? null}
      />
    </div>
  );
}

export default ChatPage;

import { useState, useRef, useCallback } from 'react';
import type { ChatMessage } from '../../db';
import { useSettingsStore } from '../../stores/settingsStore';
import styles from './ChatBubble.module.css';

/** 左滑超过此距离触发引用 */
const SWIPE_THRESHOLD = 60;
/** 左滑最大视觉偏移量 */
const MAX_SWIPE = 100;

interface Props {
  message: ChatMessage;
  onQuote?: (msg: ChatMessage) => void;
  quotedMessage?: ChatMessage | null;
}

export function ChatBubble({ message, onQuote, quotedMessage }: Props) {
  const { userAvatar, partnerAvatar, partnerName } = useSettingsStore();

  const isUser = message.sender === 'user';
  const avatar = isUser ? userAvatar : partnerAvatar;
  const name = isUser ? '我' : partnerName;

  // ── 左滑引用（触屏 + 鼠标） ──
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeOffsetRef = useRef(0);
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const isSwiping = useRef(false);

  /** 开始拖拽（触屏） */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!onQuote) return;
    const touch = e.touches[0];
    swipeStartX.current = touch.clientX;
    swipeStartY.current = touch.clientY;
    isSwiping.current = false;
    setSwipeOffset(0);
    swipeOffsetRef.current = 0;
  }, [onQuote]);

  /** 开始拖拽（鼠标） */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!onQuote) return;
    swipeStartX.current = e.clientX;
    swipeStartY.current = e.clientY;
    isSwiping.current = false;
    setSwipeOffset(0);
    swipeOffsetRef.current = 0;
  }, [onQuote]);

  const handleSwipeMove = useCallback((clientX: number, clientY: number) => {
    if (!onQuote) return;
    const dx = clientX - swipeStartX.current;
    const dy = Math.abs(clientY - swipeStartY.current);

    // 垂直移动为主 → 用户在滚动，不拦截
    if (dy > Math.abs(dx) && dy > 10) {
      if (isSwiping.current) {
        isSwiping.current = false;
        swipeOffsetRef.current = 0;
        setSwipeOffset(0);
      }
      return;
    }

    // 水平左滑
    if (dx < -10) {
      isSwiping.current = true;
      const offset = Math.max(dx, -MAX_SWIPE);
      swipeOffsetRef.current = offset;
      setSwipeOffset(offset);
    } else if (dx > 10) {
      // 右滑取消
      isSwiping.current = false;
      swipeOffsetRef.current = 0;
      setSwipeOffset(0);
    }
  }, [onQuote]);

  /** 拖拽中（触屏） */
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleSwipeMove(touch.clientX, touch.clientY);
    if (isSwiping.current) {
      e.preventDefault();
    }
  }, [handleSwipeMove]);

  /** 拖拽中（鼠标，仅左键按下时生效） */
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (e.buttons !== 1) return; // 左键没按下则忽略
    handleSwipeMove(e.clientX, e.clientY);
  }, [handleSwipeMove]);

  const handleSwipeEnd = useCallback(() => {
    if (!onQuote) return;
    if (swipeOffsetRef.current <= -SWIPE_THRESHOLD && isSwiping.current) {
      onQuote(message);
    }
    isSwiping.current = false;
    swipeOffsetRef.current = 0;
    setSwipeOffset(0);
  }, [onQuote, message]);

  /** 松手（触屏） */
  const handleTouchEnd = useCallback(() => {
    handleSwipeEnd();
  }, [handleSwipeEnd]);

  /** 松手（鼠标） */
  const handleMouseUp = useCallback(() => {
    handleSwipeEnd();
  }, [handleSwipeEnd]);

  // ── 左滑时的“引用”标签 ──
  const showQuoteLabel = onQuote && swipeOffset < -10;
  const quoteLabel = showQuoteLabel ? (
    <div
      className={styles.swipeQuoteLabel}
      style={{ opacity: Math.min(Math.abs(swipeOffset) / SWIPE_THRESHOLD, 1) }}
    >
      引用
    </div>
  ) : null;

  // ── 拍一拍：居中灰色小字，不可引用 ──
  if (message.msgType === 'nudge') {
    return (
      <div className={styles.nudgeRow}>
        <span className={styles.nudgeText}>{message.content}</span>
      </div>
    );
  }

  // ── 选择题问题 ──
  if (message.msgType === 'choice_q') {
    const lines = message.content.split('\n').filter(l => l.trim());
    const question = lines[0];
    const options = lines.slice(1);
    return (
      <div
        className={`${styles.bubbleRow} ${isUser ? styles.rowRight : styles.rowLeft}`}
        style={onQuote ? { overflow: 'hidden' } : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {quoteLabel}
        <div
          className={styles.swipeRow}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: swipeOffset === 0 ? 'transform 0.2s ease' : undefined,
            ...(isUser ? { flexDirection: 'row-reverse' as const } : {}),
          }}
        >
          <div className={styles.avatar}>
            {avatar ? (
              <img src={avatar} alt="" className={styles.avatarImg} />
            ) : (
              <div className={isUser ? styles.avatarPlaceholder : styles.avatarPlaceholderPartner}>
                {isUser ? '我' : name[0]}
              </div>
            )}
          </div>
          <div className={`${styles.choiceBox} ${isUser ? styles.choiceSelf : styles.choicePartner}`}>
            <div className={styles.choiceQuestion}>{question}</div>
            <div className={styles.choiceOptions}>
              {options.map((opt, i) => (
                <div key={i} className={styles.choiceOption}>{opt}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 选择题答案 ──
  if (message.msgType === 'choice_a') {
    return (
      <div
        className={`${styles.bubbleRow} ${isUser ? styles.rowRight : styles.rowLeft}`}
        style={onQuote ? { overflow: 'hidden' } : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {quoteLabel}
        <div
          className={styles.swipeRow}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: swipeOffset === 0 ? 'transform 0.2s ease' : undefined,
            ...(isUser ? { flexDirection: 'row-reverse' as const } : {}),
          }}
        >
          <div className={styles.avatar}>
            {avatar ? (
              <img src={avatar} alt="" className={styles.avatarImg} />
            ) : (
              <div className={isUser ? styles.avatarPlaceholder : styles.avatarPlaceholderPartner}>
                {isUser ? '我' : name[0]}
              </div>
            )}
          </div>
          <div className={`${styles.choiceBox} ${isUser ? styles.choiceSelf : styles.choicePartner}`}>
            <div className={styles.choiceAnswer}>{message.content}</div>
          </div>
        </div>
      </div>
    );
  }

  // ── 普通消息 ──
  const renderContent = () => {
    // 防御：内容本身是 data URL 则当图片渲染，防止类型标记错误导致 base64 乱码
    const isDataUrl = message.content.startsWith('data:');
    if (isDataUrl) return <img src={message.content} alt="" className={styles.sticker} />;

    switch (message.msgType) {
      case 'image':
        return <img src={message.content} alt="" className={styles.sticker} />;
      case 'quote':
        return <span>{message.content}</span>;
      default:
        return <span>{message.content}</span>;
    }
  };

  return (
    <div
      className={`${styles.bubbleRow} ${isUser ? styles.rowRight : styles.rowLeft}`}
      style={onQuote ? { overflow: 'hidden' } : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {quoteLabel}
      <div
        className={styles.swipeRow}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? 'transform 0.2s ease' : undefined,
          ...(isUser ? { flexDirection: 'row-reverse' as const } : {}),
        }}
      >
        <div className={styles.avatar}>
          {avatar ? (
            <img src={avatar} alt="" className={styles.avatarImg} />
          ) : (
            <div className={isUser ? styles.avatarPlaceholder : styles.avatarPlaceholderPartner}>
              {isUser ? '我' : name[0]}
            </div>
          )}
        </div>

        <div className={`${styles.bubble} ${isUser ? styles.bubbleSelf : styles.bubblePartner}`}>
          {message.quotedMessageId && quotedMessage && (
            <div className={styles.quoteBar}>
              {quotedMessage.msgType === 'image' || quotedMessage.content.startsWith('data:')
                ? '【图片】'
                : quotedMessage.content.slice(0, 50) + '...'}
            </div>
          )}
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

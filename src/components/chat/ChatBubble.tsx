import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChatMessage } from '../../db';
import { useSettingsStore } from '../../stores/settingsStore';
import styles from './ChatBubble.module.css';

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

  // 长按引用菜单
  const [quoteMenu, setQuoteMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!onQuote) return;
    clearLongPress();
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      setQuoteMenu({ x: touch.clientX, y: touch.clientY });
    }, 500);
  }, [onQuote, clearLongPress]);

  const handleTouchMove = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handleTouchEnd = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  // 鼠标长按（桌面端同样用长按）
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!onQuote) return;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      setQuoteMenu({ x: e.clientX, y: e.clientY });
    }, 500);
  }, [onQuote, clearLongPress]);

  const handleMouseUp = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handleMouseMove = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handleQuoteTap = useCallback(() => {
    onQuote?.(message);
    setQuoteMenu(null);
  }, [onQuote, message]);

  // 点击其他地方关闭引用菜单
  useEffect(() => {
    if (!quoteMenu) return;
    const close = () => setQuoteMenu(null);
    // 延迟添加监听，避免当前事件触发关闭
    const t = setTimeout(() => {
      document.addEventListener('click', close, { once: true });
      document.addEventListener('touchstart', close, { once: true });
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', close);
      document.removeEventListener('touchstart', close);
    };
  }, [quoteMenu]);

  // 拍一拍：居中灰色小字，无头像无气泡
  if (message.msgType === 'nudge') {
    return (
      <div className={styles.nudgeRow}>
        <span className={styles.nudgeText}>{message.content}</span>
      </div>
    );
  }

  // 选择题问题
  if (message.msgType === 'choice_q') {
    const lines = message.content.split('\n').filter(l => l.trim());
    const question = lines[0];
    const options = lines.slice(1);
    return (
      <div
        className={`${styles.bubbleRow} ${isUser ? styles.rowRight : styles.rowLeft}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
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
        {quoteMenu && (
          <div
            className={`${styles.quoteMenu} ${isUser ? styles.quoteMenuLeft : styles.quoteMenuRight}`}
            style={{ left: quoteMenu.x - 20, top: quoteMenu.y - 44 }}
            onClick={handleQuoteTap}
          >
            引用
          </div>
        )}
      </div>
    );
  }

  // 选择题答案
  if (message.msgType === 'choice_a') {
    return (
      <div
        className={`${styles.bubbleRow} ${isUser ? styles.rowRight : styles.rowLeft}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
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
        {quoteMenu && (
          <div
            className={`${styles.quoteMenu} ${isUser ? styles.quoteMenuLeft : styles.quoteMenuRight}`}
            style={{ left: quoteMenu.x - 20, top: quoteMenu.y - 44 }}
            onClick={handleQuoteTap}
          >
            引用
          </div>
        )}
      </div>
    );
  }

  // 普通消息
  const renderContent = () => {
    switch (message.msgType) {
      case 'image':
        return <img src={message.content} alt="" className={styles.sticker} />;
      case 'quote':
        // 引用内容已在上方 quoteBar 显示，气泡内只显示消息正文
        return <span>{message.content}</span>;
      default:
        return <span>{message.content}</span>;
    }
  };

  return (
    <div
      className={`${styles.bubbleRow} ${isUser ? styles.rowRight : styles.rowLeft}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
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
            {quotedMessage.content.slice(0, 50)}...
          </div>
        )}
        {renderContent()}
      </div>

      {quoteMenu && (
        <div
          className={`${styles.quoteMenu} ${isUser ? styles.quoteMenuLeft : styles.quoteMenuRight}`}
          style={{ left: quoteMenu.x - 20, top: quoteMenu.y - 44 }}
          onClick={handleQuoteTap}
        >
          引用
        </div>
      )}
    </div>
  );
}

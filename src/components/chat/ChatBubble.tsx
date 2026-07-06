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
      <div className={`${styles.bubbleRow} ${isUser ? styles.rowRight : styles.rowLeft}`}
        onDoubleClick={() => onQuote?.(message)}
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
    );
  }

  // 选择题答案
  if (message.msgType === 'choice_a') {
    return (
      <div className={`${styles.bubbleRow} ${isUser ? styles.rowRight : styles.rowLeft}`}
        onDoubleClick={() => onQuote?.(message)}
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
    );
  }

  // 普通消息
  const renderContent = () => {
    switch (message.msgType) {
      case 'image':
        return <img src={message.content} alt="" className={styles.sticker} />;
      case 'quote':
        return (
          <div>
            {message.quotedContent && (
              <div className={styles.quoteRef}>{message.quotedContent}</div>
            )}
            <span>{message.content}</span>
          </div>
        );
      default:
        return <span>{message.content}</span>;
    }
  };

  return (
    <div
      className={`${styles.bubbleRow} ${isUser ? styles.rowRight : styles.rowLeft}`}
      onDoubleClick={() => onQuote?.(message)}
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
    </div>
  );
}

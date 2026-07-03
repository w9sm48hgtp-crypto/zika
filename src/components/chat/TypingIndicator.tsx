import { useSettingsStore } from '../../stores/settingsStore';
import styles from './TypingIndicator.module.css';

export function TypingIndicator() {
  const { partnerAvatar, partnerName } = useSettingsStore();

  return (
    <div className={styles.container}>
      <div className={styles.avatar}>
        {partnerAvatar ? (
          <img src={partnerAvatar} alt="" className={styles.avatarImg} />
        ) : (
          <div className={styles.avatarPlaceholder}>{partnerName[0]}</div>
        )}
      </div>
      <div className={styles.bubble}>
        <span className={styles.text}>对方正在输入</span>
        <span className={styles.dots}>
          <span className={styles.dot} style={{ animationDelay: '0s' }}>.</span>
          <span className={styles.dot} style={{ animationDelay: '0.2s' }}>.</span>
          <span className={styles.dot} style={{ animationDelay: '0.4s' }}>.</span>
        </span>
      </div>
    </div>
  );
}

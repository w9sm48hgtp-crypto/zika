import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../../stores/settingsStore';
import styles from './SubPage.module.css';

function ChatSettingsPage() {
  const navigate = useNavigate();
  const {
    replyDelay, replyCountMin, replyCountMax,
    partnerName, vibrationEnabled,
    setReplyDelay, setReplyCountMin, setReplyCountMax,
    setPartnerName, setVibrationEnabled,
  } = useSettingsStore();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/profile')}>← 返回</button>
        <span className={styles.title}>聊天设置</span>
        <div className={styles.spacer} />
      </header>
      <div className={styles.body}>
        <div className="card">
          <div className={styles.settingRow}>
            <span>对方昵称</span>
            <input
              className={styles.settingInput}
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="他"
            />
          </div>

          <div className={styles.settingRow}>
            <span>回复延迟（分钟）</span>
            <div className={styles.stepper}>
              <button onClick={() => replyDelay > 1 && setReplyDelay(replyDelay - 1)}>−</button>
              <span className={styles.stepperVal}>{replyDelay}</span>
              <button onClick={() => replyDelay < 60 && setReplyDelay(replyDelay + 1)}>+</button>
            </div>
          </div>

          <div className={styles.settingRow}>
            <span>回复最少条数</span>
            <div className={styles.stepper}>
              <button onClick={() => replyCountMin > 1 && setReplyCountMin(replyCountMin - 1)}>−</button>
              <span className={styles.stepperVal}>{replyCountMin}</span>
              <button onClick={() => replyCountMin < replyCountMax && setReplyCountMin(replyCountMin + 1)}>+</button>
            </div>
          </div>

          <div className={styles.settingRow}>
            <span>回复最多条数</span>
            <div className={styles.stepper}>
              <button onClick={() => replyCountMax > replyCountMin && setReplyCountMax(replyCountMax - 1)}>−</button>
              <span className={styles.stepperVal}>{replyCountMax}</span>
              <button onClick={() => replyCountMax < 10 && setReplyCountMax(replyCountMax + 1)}>+</button>
            </div>
          </div>

          <div className={styles.settingRow}>
            <span>震动提醒</span>
            <button
              className={`${styles.toggle} ${vibrationEnabled ? styles.toggleOn : ''}`}
              onClick={() => setVibrationEnabled(!vibrationEnabled)}
              aria-label={vibrationEnabled ? '关闭震动提醒' : '开启震动提醒'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatSettingsPage;

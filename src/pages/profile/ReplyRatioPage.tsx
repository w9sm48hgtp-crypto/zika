import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../../stores/settingsStore';
import styles from './SubPage.module.css';

function ReplyRatioPage() {
  const navigate = useNavigate();
  const {
    textRatio, nudgeRatio, stickerRatio,
    setTextRatio, setNudgeRatio, setStickerRatio,
  } = useSettingsStore();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/profile')}>← 返回</button>
        <span className={styles.title}>回复出现比例</span>
        <div className={styles.spacer} />
      </header>
      <div className={styles.body}>
        <div className="card">
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-hint)', marginBottom: '12px' }}>
            设置不同字卡类型随机出现的概率百分比
          </p>

          <div className={styles.settingRow}>
            <span>文字字卡</span>
            <div className={styles.stepper}>
              <button onClick={() => textRatio > 0 && setTextRatio(textRatio - 10)}>−</button>
              <span className={styles.stepperVal}>{textRatio}%</span>
              <button onClick={() => setTextRatio(textRatio + 10)}>+</button>
            </div>
          </div>

          <div className={styles.settingRow}>
            <span>拍一拍</span>
            <div className={styles.stepper}>
              <button onClick={() => nudgeRatio > 0 && setNudgeRatio(nudgeRatio - 10)}>−</button>
              <span className={styles.stepperVal}>{nudgeRatio}%</span>
              <button onClick={() => setNudgeRatio(nudgeRatio + 10)}>+</button>
            </div>
          </div>

          <div className={styles.settingRow}>
            <span>表情包</span>
            <div className={styles.stepper}>
              <button onClick={() => stickerRatio > 0 && setStickerRatio(stickerRatio - 10)}>−</button>
              <span className={styles.stepperVal}>{stickerRatio}%</span>
              <button onClick={() => setStickerRatio(stickerRatio + 10)}>+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReplyRatioPage;

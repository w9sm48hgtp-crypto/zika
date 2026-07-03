import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../stores/settingsStore';
import { APP_VERSION } from '../version';
import { EncouragementManager } from '../components/settings/EncouragementManager';
import { SoundManager } from '../components/settings/SoundManager';
import { MoodTagManager } from '../components/settings/MoodTagManager';
import { PeriodMessageManager } from '../components/settings/PeriodMessageManager';
import styles from './ProfilePage.module.css';

function ProfilePage() {
  const navigate = useNavigate();
  const {
    replyDelay, replyCountMin, replyCountMax,
    textRatio, nudgeRatio, stickerRatio,
    userAvatar, partnerAvatar, partnerName, vibrationEnabled,
    loadSettings, setReplyDelay, setReplyCountMin, setReplyCountMax,
    setTextRatio, setNudgeRatio, setStickerRatio,
    setUserAvatar, setPartnerAvatar, setPartnerName, setVibrationEnabled,
  } = useSettingsStore();

  const userAvatarRef = useRef<HTMLInputElement>(null);
  const partnerAvatarRef = useRef<HTMLInputElement>(null);
  const isLoaded = useRef(false);

  useEffect(() => {
    if (!isLoaded.current) {
      isLoaded.current = true;
      loadSettings();
    }
  }, [loadSettings]);

  const handleAvatarUpload = (side: 'user' | 'partner') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (side === 'user') setUserAvatar(reader.result as string);
      else setPartnerAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="page">
      <h1 className="page-title">我的</h1>

      <div className={styles.sections}>
        {/* 头像设置 */}
        <div className="card" style={{ marginBottom: '12px' }}>
          <h3 className={styles.sectionTitle}>头像设置</h3>
          <div className={styles.avatarRow}>
            <div className={styles.avatarItem}>
              <div
                className={styles.avatarBox}
                onClick={() => userAvatarRef.current?.click()}
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="" className={styles.avatarImg} />
                ) : (
                  <span className={styles.avatarText}>我</span>
                )}
              </div>
              <span className={styles.avatarLabel}>我的头像</span>
              <input ref={userAvatarRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={handleAvatarUpload('user')} />
            </div>

            <div className={styles.avatarItem}>
              <div
                className={styles.avatarBox}
                onClick={() => partnerAvatarRef.current?.click()}
              >
                {partnerAvatar ? (
                  <img src={partnerAvatar} alt="" className={styles.avatarImg} />
                ) : (
                  <span className={styles.avatarText}>{partnerName?.[0] || '他'}</span>
                )}
              </div>
              <span className={styles.avatarLabel}>对方头像</span>
              <input ref={partnerAvatarRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={handleAvatarUpload('partner')} />
            </div>
          </div>
        </div>

        {/* 聊天设置 */}
        <div className="card" style={{ marginBottom: '12px' }}>
          <h3 className={styles.sectionTitle}>聊天设置</h3>

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
            >
              {vibrationEnabled ? '开' : '关'}
            </button>
          </div>
        </div>

        {/* 回复比例 */}
        <div className="card" style={{ marginBottom: '12px' }}>
          <h3 className={styles.sectionTitle}>回复出现比例（%）</h3>

          <div className={styles.settingRow}>
            <span>文字字卡</span>
            <div className={styles.stepper}>
              <button onClick={() => textRatio > 0 && setTextRatio(textRatio - 10)}>−</button>
              <span className={styles.stepperVal}>{textRatio}</span>
              <button onClick={() => setTextRatio(textRatio + 10)}>+</button>
            </div>
          </div>

          <div className={styles.settingRow}>
            <span>拍一拍</span>
            <div className={styles.stepper}>
              <button onClick={() => nudgeRatio > 0 && setNudgeRatio(nudgeRatio - 10)}>−</button>
              <span className={styles.stepperVal}>{nudgeRatio}</span>
              <button onClick={() => setNudgeRatio(nudgeRatio + 10)}>+</button>
            </div>
          </div>

          <div className={styles.settingRow}>
            <span>表情包</span>
            <div className={styles.stepper}>
              <button onClick={() => stickerRatio > 0 && setStickerRatio(stickerRatio - 10)}>−</button>
              <span className={styles.stepperVal}>{stickerRatio}</span>
              <button onClick={() => setStickerRatio(stickerRatio + 10)}>+</button>
            </div>
          </div>
        </div>

        {/* 鼓励语句管理 */}
        <h3 className={styles.sectionTitle} style={{ marginBottom: '8px', marginTop: '4px' }}>鼓励语句管理</h3>
        <div style={{ marginBottom: '12px' }}>
          <EncouragementManager />
        </div>

        {/* 白噪音管理 */}
        <h3 className={styles.sectionTitle} style={{ marginBottom: '8px' }}>白噪音管理</h3>
        <div style={{ marginBottom: '12px' }}>
          <SoundManager />
        </div>

        {/* 状态标签管理 */}
        <h3 className={styles.sectionTitle} style={{ marginBottom: '8px' }}>状态标签管理</h3>
        <div style={{ marginBottom: '12px' }}>
          <MoodTagManager />
        </div>

        {/* 生理期安慰语句 */}
        <h3 className={styles.sectionTitle} style={{ marginBottom: '8px' }}>生理期安慰语句</h3>
        <div style={{ marginBottom: '12px' }}>
          <PeriodMessageManager />
        </div>

        {/* 字卡库管理入口 */}
        <div className="card" style={{ marginBottom: '12px' }}>
          <button
            className={styles.navLink}
            onClick={() => navigate('/cards')}
          >
            <span>字卡库管理</span>
            <span className={styles.arrow}>›</span>
          </button>
        </div>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--color-text-hint)', fontSize: '12px', padding: '16px 0' }}>
        v{APP_VERSION}
      </p>
    </div>
  );
}

export default ProfilePage;

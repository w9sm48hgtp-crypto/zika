import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../../stores/settingsStore';
import styles from './SubPage.module.css';

function AvatarSettingsPage() {
  const navigate = useNavigate();
  const { userAvatar, partnerAvatar, partnerName, setUserAvatar, setPartnerAvatar } = useSettingsStore();
  const userAvatarRef = useRef<HTMLInputElement>(null);
  const partnerAvatarRef = useRef<HTMLInputElement>(null);

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
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/profile')}>← 返回</button>
        <span className={styles.title}>头像设置</span>
        <div className={styles.spacer} />
      </header>
      <div className={styles.body}>
        <div className="card">
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
      </div>
    </div>
  );
}

export default AvatarSettingsPage;

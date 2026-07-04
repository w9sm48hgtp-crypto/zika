import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../stores/settingsStore';
import { APP_VERSION } from '../version';
import styles from './ProfilePage.module.css';

const MENU_ITEMS = [
  { path: '/profile/avatar', label: '头像设置' },
  { path: '/profile/chat', label: '聊天设置' },
  { path: '/profile/chat-background', label: '聊天背景管理' },
  { path: '/profile/reply-ratio', label: '回复出现比例' },
  { path: '/cards', label: '字卡库管理' },
  { path: '/profile/sounds', label: '白噪音管理' },
  { path: '/profile/encouragement', label: '陪伴语句管理' },
  { path: '/profile/mood-tags', label: '状态标签管理' },
  { path: '/profile/period-messages', label: '生理期安慰语句' },
];

function ProfilePage() {
  const navigate = useNavigate();
  const { loadSettings } = useSettingsStore();
  const isLoaded = useRef(false);

  useEffect(() => {
    if (!isLoaded.current) {
      isLoaded.current = true;
      loadSettings();
    }
  }, [loadSettings]);

  return (
    <div className="page">
      <h1 className="page-title">我的</h1>

      <div className={styles.menuList}>
        {MENU_ITEMS.map(item => (
          <button
            key={item.path}
            className={styles.menuItem}
            onClick={() => navigate(item.path)}
          >
            <span>{item.label}</span>
            <span className={styles.arrow}>›</span>
          </button>
        ))}

        <button
          className={styles.menuItem}
          onClick={() => navigate('/data')}
        >
          <span>数据管理</span>
          <span className={styles.arrow}>›</span>
        </button>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--color-text-hint)', fontSize: '12px', padding: '24px 0 16px' }}>
        v{APP_VERSION}
      </p>
    </div>
  );
}

export default ProfilePage;

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../stores/settingsStore';
import { APP_VERSION } from '../version';
import subStyles from './profile/SubPage.module.css';
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
  const { loadSettings, keepScreenOn, setKeepScreenOn } = useSettingsStore();
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
        {/* 屏幕常亮开关 */}
        <div className={subStyles.settingRow} style={{ padding: '12px 16px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div>
            <span style={{ fontSize: 'var(--font-size-md)' }}>屏幕常亮</span>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-hint)', marginTop: '2px' }}>打开后使用期间屏幕不会自动熄灭</p>
          </div>
          <button
            className={`${subStyles.toggle} ${keepScreenOn ? subStyles.toggleOn : ''}`}
            onClick={() => setKeepScreenOn(!keepScreenOn)}
          >
            {keepScreenOn ? '开' : '关'}
          </button>
        </div>

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

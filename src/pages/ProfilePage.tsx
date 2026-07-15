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
  { path: '/cards', label: '内容管理' },
];

/** 短标题（≤5字）用方格卡片，长标题用通栏长条 */
function isCompact(label: string) {
  return label.length <= 5;
}

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
        <div className={subStyles.settingRow} style={{ width: '100%', padding: '12px 16px', background: 'var(--color-surface-gradient)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <span style={{ fontSize: 'var(--font-size-md)' }}>屏幕常亮</span>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-hint)', marginTop: '2px' }}>打开后使用期间屏幕不会自动熄灭</p>
          </div>
          <button
            className={`${subStyles.toggle} ${keepScreenOn ? subStyles.toggleOn : ''}`}
            onClick={() => setKeepScreenOn(!keepScreenOn)}
            aria-label={keepScreenOn ? '关闭屏幕常亮' : '开启屏幕常亮'}
          />
        </div>

        {MENU_ITEMS.map(item => (
          <button
            key={item.path}
            className={isCompact(item.label) ? styles.menuCard : styles.menuItem}
            onClick={() => navigate(item.path)}
          >
            <span>{item.label}</span>
            {!isCompact(item.label) && <span className={styles.arrow}>›</span>}
          </button>
        ))}

        <button
          className={styles.menuCard}
          onClick={() => navigate('/data')}
        >
          <span>数据管理</span>
        </button>
      </div>

      <div className={styles.versionWrap}>
        <p className={styles.versionText}>
          v{APP_VERSION}
        </p>
      </div>
    </div>
  );
}

export default ProfilePage;

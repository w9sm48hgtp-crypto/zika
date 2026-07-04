import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../../stores/settingsStore';
import styles from './SubPage.module.css';

function ChatBackgroundPage() {
  const navigate = useNavigate();
  const { chatBackground, setChatBackground } = useSettingsStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setChatBackground(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    setChatBackground('');
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/profile')}>← 返回</button>
        <span className={styles.title}>聊天背景管理</span>
        <div className={styles.spacer} />
      </header>
      <div className={styles.body}>
        {/* 预览区 */}
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
            当前聊天背景
          </p>
          <div
            style={{
              width: '100%',
              height: 200,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-bubble-partner-border)',
              background: chatBackground
                ? `url(${chatBackground}) center/cover no-repeat`
                : 'var(--color-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-hint)',
              fontSize: 'var(--font-size-sm)',
              overflow: 'hidden',
            }}
          >
            {!chatBackground && '默认背景'}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            className="btn"
            style={{
              width: '100%',
              padding: '12px 0',
              background: 'var(--color-accent-soft)',
              color: 'var(--color-accent)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-md)',
              fontWeight: 500,
            }}
            onClick={() => fileRef.current?.click()}
          >
            从相册选择
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
          <button
            className="btn"
            style={{
              width: '100%',
              padding: '12px 0',
              background: 'var(--color-bg)',
              color: 'var(--color-text-secondary)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-md)',
            }}
            onClick={handleReset}
          >
            恢复默认
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatBackgroundPage;

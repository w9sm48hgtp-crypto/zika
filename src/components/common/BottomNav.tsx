import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { db } from '../../db';

export function BottomNav() {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    // 首次加载时检查
    db.settings.get('hasUnreadIncoming').then(row => {
      setHasUnread(!!row?.value);
    });

    // 每30秒轮询一次（用户可能在其他页面，来信在后台生成）
    const timer = setInterval(async () => {
      const row = await db.settings.get('hasUnreadIncoming');
      setHasUnread(!!row?.value);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <nav className="bottom-nav safe-bottom">
      <NavLink to="/chat" className={({ isActive }) => isActive ? 'active' : ''}>
        聊天
      </NavLink>
      <NavLink to="/companion" className={({ isActive }) => isActive ? 'active' : ''}>
        陪伴
      </NavLink>
      <NavLink to="/daily" className={({ isActive }) => isActive ? 'active' : ''}>
        每日
      </NavLink>
      <NavLink to="/records" className={({ isActive }) => isActive ? 'active' : ''}>
        <span style={{ position: 'relative', display: 'inline-block' }}>
          记录
          {hasUnread && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-10px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#e05555',
            }} />
          )}
        </span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>
        我的
      </NavLink>
    </nav>
  );
}

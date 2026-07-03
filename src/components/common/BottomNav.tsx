import { NavLink } from 'react-router-dom';

export function BottomNav() {
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
      <NavLink to="/letters" className={({ isActive }) => isActive ? 'active' : ''}>
        书信
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>
        我的
      </NavLink>
    </nav>
  );
}

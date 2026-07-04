import { useNavigate } from 'react-router-dom';
import { EncouragementManager } from '../../components/settings/EncouragementManager';
import styles from './SubPage.module.css';

function EncouragementPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/profile')}>← 返回</button>
        <span className={styles.title}>陪伴语句管理</span>
        <div className={styles.spacer} />
      </header>
      <div className={styles.body}>
        <EncouragementManager />
      </div>
    </div>
  );
}

export default EncouragementPage;

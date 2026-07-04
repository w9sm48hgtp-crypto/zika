import { useNavigate } from 'react-router-dom';
import { MoodTagManager } from '../../components/settings/MoodTagManager';
import styles from './SubPage.module.css';

function MoodTagPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/profile')}>← 返回</button>
        <span className={styles.title}>状态标签管理</span>
        <div className={styles.spacer} />
      </header>
      <div className={styles.body}>
        <MoodTagManager />
      </div>
    </div>
  );
}

export default MoodTagPage;

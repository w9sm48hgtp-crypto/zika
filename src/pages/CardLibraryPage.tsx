import { useNavigate } from 'react-router-dom';
import { CardManager } from '../components/settings/CardManager';
import styles from './CardLibraryPage.module.css';

function CardLibraryPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/profile')}>
          ← 返回
        </button>
        <span className={styles.title}>字卡库管理</span>
        <div className={styles.spacer} />
      </header>
      <div className={styles.body}>
        <CardManager />
      </div>
    </div>
  );
}

export default CardLibraryPage;

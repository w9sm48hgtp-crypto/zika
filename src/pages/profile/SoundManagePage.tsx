import { useNavigate } from 'react-router-dom';
import { SoundManager } from '../../components/settings/SoundManager';
import styles from './SubPage.module.css';

function SoundManagePage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/profile')}>← 返回</button>
        <span className={styles.title}>白噪音管理</span>
        <div className={styles.spacer} />
      </header>
      <div className={styles.body}>
        <SoundManager />
      </div>
    </div>
  );
}

export default SoundManagePage;

import { useNavigate } from 'react-router-dom';
import { PeriodMessageManager } from '../../components/settings/PeriodMessageManager';
import styles from './SubPage.module.css';

function PeriodMessagePage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/profile')}>← 返回</button>
        <span className={styles.title}>生理期安慰语句</span>
        <div className={styles.spacer} />
      </header>
      <div className={styles.body}>
        <PeriodMessageManager />
      </div>
    </div>
  );
}

export default PeriodMessagePage;

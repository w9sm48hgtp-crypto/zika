import { useNavigate } from 'react-router-dom';
import styles from './DailyLifePage.module.css';

const ENTRIES = [
  {
    path: '/records/daily/notes',
    name: '文字便签',
    desc: '随手记录生活点滴',
  },
  {
    path: '/records/daily/album',
    name: '相册',
    desc: '分类管理照片，珍藏回忆',
  },
];

function DailyLifePage() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/records')}>←</button>
        <h1 className={styles.headerTitle}>日常</h1>
      </div>

      <div className={styles.entryList}>
        {ENTRIES.map(entry => (
          <button
            key={entry.path}
            className={styles.entryCard}
            onClick={() => navigate(entry.path)}
          >
            <div className={styles.entryInfo}>
              <span className={styles.entryName}>{entry.name}</span>
              <span className={styles.entryDesc}>{entry.desc}</span>
            </div>
            <span className={styles.entryArrow}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default DailyLifePage;

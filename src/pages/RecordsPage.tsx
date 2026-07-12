import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import styles from './RecordsPage.module.css';

function RecordsPage() {
  const navigate = useNavigate();
  const [letterCount, setLetterCount] = useState(0);

  useEffect(() => {
    db.letters.count().then(setLetterCount);
  }, []);

  const ENTRIES = [
    {
      path: '/records/letters',
      name: '书信',
      desc: letterCount > 0 ? `共 ${letterCount} 封信` : '给他写信，等他的回信',
    },
    {
      path: '/records/daily',
      name: '日常',
      desc: '文字便签 · 相册',
    },
  ];

  return (
    <div className="page">
      <h1 className="page-title">记录</h1>

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

export default RecordsPage;

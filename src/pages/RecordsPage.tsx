import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import styles from './RecordsPage.module.css';

function RecordsPage() {
  const navigate = useNavigate();
  const [letterCount, setLetterCount] = useState(0);
  const [anniversaryCount, setAnniversaryCount] = useState(0);

  useEffect(() => {
    db.letters.count().then(setLetterCount);
    db.anniversaries.count().then(setAnniversaryCount);
  }, []);

  const ENTRIES = [
    {
      path: '/records/letters',
      name: '书信',
      desc: letterCount > 0 ? `共 ${letterCount} 封信` : '给他写信，等他的回信',
    },
    {
      path: '/records/anniversaries',
      name: '纪念日',
      desc: anniversaryCount > 0 ? `共 ${anniversaryCount} 个纪念日` : '正数日 · 倒数日 · 每年同日',
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

      <svg
        className={styles.decoSvg}
        viewBox="0 0 390 260"
        width="100%"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* 气泡阴影 */}
          <filter id="bubbleShadow">
            <feDropShadow dx="0" dy="2" stdDeviation="6" flood-opacity="0.1" />
          </filter>
          {/* 装饰图白边+阴影 */}
          <filter id="decoOutline" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="0" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
            <feDropShadow dx="-1" dy="0" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
            <feDropShadow dx="0" dy="1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
            <feDropShadow dx="0" dy="-1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
            <feDropShadow dx="1" dy="1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
            <feDropShadow dx="-1" dy="-1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
            <feDropShadow dx="1" dy="-1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
            <feDropShadow dx="-1" dy="1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
            <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.15" />
          </filter>
        </defs>

        {/* 文字气泡 */}
        <rect x="12" y="20" width="220" height="218" rx="12" fill="#fff" filter="url(#bubbleShadow)" />
        <image
          x="32" y="34" width="180"
          href={`${import.meta.env.BASE_URL}decorations/text2.png`}
        />

        {/* 11号装饰图 */}
        <image
          x="250" y="50" width="120"
          href={`${import.meta.env.BASE_URL}decorations/11.png`}
          filter="url(#decoOutline)"
        />
      </svg>
    </div>
  );
}

export default RecordsPage;

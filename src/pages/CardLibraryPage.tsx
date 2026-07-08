import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardManager } from '../components/settings/CardManager';
import { SoundManager } from '../components/settings/SoundManager';
import { EncouragementManager } from '../components/settings/EncouragementManager';
import { MoodTagManager } from '../components/settings/MoodTagManager';
import { PeriodMessageManager } from '../components/settings/PeriodMessageManager';
import styles from './CardLibraryPage.module.css';

const TABS = [
  { key: 'cards', label: '字卡库' },
  { key: 'sounds', label: '白噪音' },
  { key: 'encouragement', label: '陪伴语句' },
  { key: 'mood', label: '状态标签' },
  { key: 'period', label: '生理期' },
];

function CardLibraryPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('cards');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/profile')}>
          ← 返回
        </button>
        <span className={styles.title}>内容管理</span>
        <div className={styles.spacer} />
      </header>

      <nav className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className={styles.body}>
        {tab === 'cards' && <CardManager />}
        {tab === 'sounds' && <SoundManager />}
        {tab === 'encouragement' && <EncouragementManager />}
        {tab === 'mood' && <MoodTagManager />}
        {tab === 'period' && <PeriodMessageManager />}
      </div>
    </div>
  );
}

export default CardLibraryPage;

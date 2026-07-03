import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, type CompanionRecord } from '../db';
import { formatSeconds } from '../stores/companionStore';
import styles from './CompanionHistoryPage.module.css';

const SCENE_LABEL: Record<string, string> = {
  study: '学习',
  eat: '吃饭',
  sleep: '睡眠',
  custom: '其他',
};

type CategoryFilter = 'study' | 'eat' | 'sleep' | 'custom' | 'total';

const CATEGORIES: { key: CategoryFilter; label: string }[] = [
  { key: 'study', label: '学习' },
  { key: 'eat', label: '吃饭' },
  { key: 'sleep', label: '睡眠' },
  { key: 'custom', label: '其他' },
  { key: 'total', label: '总计' },
];

interface TimeStats {
  today: number;
  week: number;
  month: number;
  year: number;
}

function getDayStart(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getWeekStart(date: Date): number {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getMonthStart(date: Date): number {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getYearStart(date: Date): number {
  const d = new Date(date);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function calcTimeStats(records: CompanionRecord[], category: CategoryFilter): TimeStats {
  const now = new Date();
  const todayStart = getDayStart(now);
  const weekStart = getWeekStart(now);
  const monthStart = getMonthStart(now);
  const yearStart = getYearStart(now);

  const stats: TimeStats = { today: 0, week: 0, month: 0, year: 0 };

  for (const r of records) {
    if (r.status !== 'completed') continue;
    // 筛选分类
    if (category !== 'total' && r.scene !== category) continue;

    const dur = r.actualDuration || 0;
    const time = r.startTime;

    if (time >= todayStart) stats.today += dur;
    if (time >= weekStart) stats.week += dur;
    if (time >= monthStart) stats.month += dur;
    if (time >= yearStart) stats.year += dur;
  }

  return stats;
}

const TIME_CARDS = [
  { key: 'today', label: '今天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'year', label: '本年' },
];

function CompanionHistoryPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<CompanionRecord[]>([]);
  const [category, setCategory] = useState<CategoryFilter>('total');
  const [timeStats, setTimeStats] = useState<TimeStats>({ today: 0, week: 0, month: 0, year: 0 });

  useEffect(() => {
    db.companionRecords
      .where('status')
      .anyOf(['completed', 'cancelled'])
      .reverse()
      .sortBy('startTime')
      .then((list) => {
        setRecords(list);
        setTimeStats(calcTimeStats(list, 'total'));
      });
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这条记录吗？')) return;
    await db.companionRecords.delete(id);
    const list = records.filter(r => r.id !== id);
    setRecords(list);
    setTimeStats(calcTimeStats(list, category));
  };

  const handleCategoryChange = (cat: CategoryFilter) => {
    setCategory(cat);
    setTimeStats(calcTimeStats(records, cat));
  };

  return (
    <div className="page">
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/companion')}>
          &lt; 返回
        </button>
        <span className={styles.headerTitle}>陪伴记录</span>
        <span className={styles.headerSpacer} />
      </header>

      {/* 分类选择 */}
      <div className={styles.catRow}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            className={`${styles.catPill} ${category === cat.key ? styles.catPillActive : ''}`}
            onClick={() => handleCategoryChange(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 分时段统计 */}
      <div className={styles.statsGrid}>
        {TIME_CARDS.map(card => (
          <div key={card.key} className={styles.statCard}>
            <div className={styles.statValue}>{formatSeconds(timeStats[card.key as keyof TimeStats])}</div>
            <div className={styles.statLabel}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* 记录列表 */}
      <div className={styles.listSection}>
        <h3 className={styles.listTitle}>全部记录</h3>
        {records.length === 0 ? (
          <p className={styles.empty}>暂无计时记录</p>
        ) : (
          <div className={styles.recordList}>
            {records.map((r) => (
              <div key={r.id} className={styles.recordItem}>
                <div className={styles.recordInfo}>
                  <span className={styles.recordScene}>
                    {r.scene === 'custom' ? (r.customSceneName || '自定义') : SCENE_LABEL[r.scene] || r.scene}
                  </span>
                  <span className={styles.recordMode}>
                    {r.mode === 'countUp' ? '正计时' : '倒计时'}
                    {r.targetDuration ? ` (目标${r.targetDuration}分)` : ''}
                  </span>
                  <span className={styles.recordDuration}>
                    {formatSeconds(r.actualDuration || 0)}
                  </span>
                  <span className={styles.recordTime}>
                    {new Date(r.startTime).toLocaleString('zh-CN', {
                      month: 'numeric', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  {r.status === 'cancelled' && (
                    <span className={styles.recordCancelled}>已取消</span>
                  )}
                </div>
                <button className={styles.recordDelete} onClick={() => handleDelete(r.id!)}>
                  删除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CompanionHistoryPage;

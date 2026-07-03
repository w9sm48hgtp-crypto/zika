import { useState, useEffect, useCallback } from 'react';
import { useDailyStore } from '../../stores/dailyStore';
import styles from './MoodTagManager.module.css';

const CATEGORIES = [
  { key: 'mine' as const, label: '我的' },
  { key: 'his' as const, label: '他的' },
  { key: 'both' as const, label: '通用' },
];

export function MoodTagManager() {
  const { moodTags, loadMoodTags, addMoodTag, deleteMoodTag } = useDailyStore();
  const [activeCat, setActiveCat] = useState<'mine' | 'his' | 'both'>('mine');
  const [newName, setNewName] = useState('');

  const load = useCallback(() => { loadMoodTags(); }, [loadMoodTags]);
  useEffect(() => { load(); }, [load]);

  const filtered = moodTags.filter(t => t.category === activeCat);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    await addMoodTag(name, activeCat);
    setNewName('');
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            className={`${styles.tab} ${activeCat === cat.key ? styles.tabActive : ''}`}
            onClick={() => { setActiveCat(cat.key); setNewName(''); }}
          >
            {cat.label}
            <span className={styles.count}>{moodTags.filter(t => t.category === cat.key).length}</span>
          </button>
        ))}
      </div>

      <div className={styles.content}>
        <div className={styles.addRow}>
          <input
            className={styles.input}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="添加新标签..."
          />
          <button className={styles.addBtn} onClick={handleAdd} disabled={!newName.trim()}>
            添加
          </button>
        </div>

        <div className={styles.tagList}>
          {filtered.map(tag => (
            <div key={tag.id} className={styles.tagItem}>
              <span className={styles.tagName}>{tag.name}</span>
              <button
                className={styles.tagDel}
                onClick={() => { if (confirm(`删除「${tag.name}」？`)) deleteMoodTag(tag.id!); }}
              >
                x
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className={styles.empty}>暂无标签</p>
          )}
        </div>
      </div>
    </div>
  );
}

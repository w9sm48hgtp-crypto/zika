import { useState, useEffect, useCallback } from 'react';
import { db } from '../../db';
import styles from './PeriodMessageManager.module.css';

const DEFAULTS = [
  '抱抱你，这几天要好好休息',
  '多喝热水，别着凉了',
  '我在呢，不舒服就告诉我',
  '辛苦啦，这几天对自己好一点',
  '给你揉揉肚子',
];

export function PeriodMessageManager() {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const row = await db.settings.get('periodMessages');
    if (row?.value && Array.isArray(row.value)) {
      setText((row.value as string[]).join('\n'));
    } else {
      setText(DEFAULTS.join('\n'));
      await db.settings.put({ key: 'periodMessages', value: DEFAULTS });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    await db.settings.put({ key: 'periodMessages', value: lines });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className={styles.container}>
      <textarea
        className={styles.textarea}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="每行一句安慰语句"
        rows={5}
      />
      <div className={styles.actions}>
        <button className="btn btn-outline" onClick={() => { setText(DEFAULTS.join('\n')); }}>
          恢复默认
        </button>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? '已保存' : '保存'}
        </button>
      </div>
    </div>
  );
}

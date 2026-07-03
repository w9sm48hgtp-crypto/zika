import { useState, useEffect, useCallback } from 'react';
import { db } from '../../db';
import styles from './EncouragementManager.module.css';

interface SceneMessages {
  start: string[];
  end: string[];
}

interface EncouragementData {
  study: SceneMessages;
  eat: SceneMessages;
  sleep: SceneMessages;
  other: SceneMessages;
}

const DEFAULTS: EncouragementData = {
  study: {
    start: ['一起加油吧', '有我在呢', '专注的样子很好看', '陪你一起努力'],
    end: ['辛苦啦', '做得真棒', '休息一下吧', '抱抱你'],
  },
  eat: {
    start: ['好好吃饭哦', '今天吃什么好吃的？', '要吃饱饱的'],
    end: ['吃饱了吗？', '好好吃的样子', '我也想吃'],
  },
  sleep: {
    start: ['晚安，好梦', '早点休息', '我会守着你的', '好好睡觉'],
    end: ['早安', '睡得好吗？', '新的一天开始了'],
  },
  other: {
    start: ['开始吧', '我陪着你呢', '加油'],
    end: ['结束啦', '休息一下吧', '很厉害哦'],
  },
};

const SCENES = [
  { key: 'study', label: '学习' },
  { key: 'eat', label: '吃饭' },
  { key: 'sleep', label: '睡眠' },
  { key: 'other', label: '其他' },
] as const;

function linesToArr(s: string): string[] {
  return s.split('\n').map(l => l.trim()).filter(l => l.length > 0);
}

function arrToLines(arr: string[]): string {
  return arr.join('\n');
}

export function EncouragementManager() {
  const [data, setData] = useState<EncouragementData>(DEFAULTS);
  const [activeScene, setActiveScene] = useState<string>('study');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const row = await db.settings.get('encouragementMessages');
    if (row?.value) {
      // 合并默认值，确保所有字段存在
      const merged = { ...DEFAULTS };
      const saved = row.value as Partial<EncouragementData>;
      for (const scene of ['study', 'eat', 'sleep', 'other'] as const) {
        if (saved[scene]) {
          merged[scene] = {
            start: saved[scene]!.start || DEFAULTS[scene].start,
            end: saved[scene]!.end || DEFAULTS[scene].end,
          };
        }
      }
      setData(merged);
    } else {
      setData(DEFAULTS);
      // 首次自动保存默认值
      await db.settings.put({ key: 'encouragementMessages', value: DEFAULTS });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const scene = data[activeScene as keyof EncouragementData];

  const handleSave = async () => {
    await db.settings.put({ key: 'encouragementMessages', value: data });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const updateStart = (text: string) => {
    setData(prev => ({
      ...prev,
      [activeScene]: { ...prev[activeScene as keyof EncouragementData], start: linesToArr(text) },
    }));
  };

  const updateEnd = (text: string) => {
    setData(prev => ({
      ...prev,
      [activeScene]: { ...prev[activeScene as keyof EncouragementData], end: linesToArr(text) },
    }));
  };

  const resetScene = () => {
    setData(prev => ({
      ...prev,
      [activeScene]: {
        start: [...DEFAULTS[activeScene as keyof EncouragementData].start],
        end: [...DEFAULTS[activeScene as keyof EncouragementData].end],
      },
    }));
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        {SCENES.map(s => (
          <button
            key={s.key}
            className={`${styles.tab} ${activeScene === s.key ? styles.tabActive : ''}`}
            onClick={() => setActiveScene(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        <div className={styles.block}>
          <h4 className={styles.label}>开始时</h4>
          <textarea
            className={styles.textarea}
            value={arrToLines(scene.start)}
            onChange={e => updateStart(e.target.value)}
            placeholder="每行一句鼓励语句"
            rows={4}
          />
        </div>

        <div className={styles.block}>
          <h4 className={styles.label}>结束时</h4>
          <textarea
            className={styles.textarea}
            value={arrToLines(scene.end)}
            onChange={e => updateEnd(e.target.value)}
            placeholder="每行一句鼓励语句"
            rows={4}
          />
        </div>

        <div className={styles.actions}>
          <button className="btn btn-outline" onClick={resetScene}>恢复默认</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? '已保存' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 从 settings 读取一条随机鼓励语句 */
export async function pickEncouragement(
  scene: string,
  timing: 'start' | 'end'
): Promise<string | null> {
  const row = await db.settings.get('encouragementMessages');
  const defaults = DEFAULTS;
  const s = scene === 'custom' ? 'other' : scene;
  const defaultMsgs = defaults[s as keyof EncouragementData]?.[timing] || [];

  if (!row?.value) {
    // 没有保存数据，用默认值
    if (defaultMsgs.length === 0) return null;
    return defaultMsgs[Math.floor(Math.random() * defaultMsgs.length)];
  }

  const saved = row.value as Partial<EncouragementData>;
  const savedMsgs = saved[s as keyof EncouragementData]?.[timing];
  const msgs = (savedMsgs && savedMsgs.length > 0) ? savedMsgs : defaultMsgs;
  if (msgs.length === 0) return null;
  return msgs[Math.floor(Math.random() * msgs.length)];
}

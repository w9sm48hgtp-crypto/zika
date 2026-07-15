import { useMemo } from 'react';
import styles from './PageDecoration.module.css';

/** 17张装饰图文件名 */
const DECO_FILES = Array.from({ length: 24 }, (_, i) => `${i + 1}.png`);

/** 预设位置：角落在CSS中定义 */
const POSITIONS = ['tl', 'tr', 'bl', 'br', 'ml', 'mr'] as const;

interface Props {
  /** 用不同seed让不同页面选不同图 */
  seed: string;
}

/** 简易 hash 函数，根据seed返回稳定的数字 */
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** 根据 seed 稳定选取 count 个不重复的装饰 */
function pickDecorations(seed: string, count: number) {
  const h = hashSeed(seed);
  const result: { file: string; position: typeof POSITIONS[number] }[] = [];

  for (let i = 0; i < count; i++) {
    const fileIdx = (h + i * 7) % DECO_FILES.length;
    const posIdx = (h + i * 13 + 3) % POSITIONS.length;
    result.push({
      file: DECO_FILES[fileIdx],
      position: POSITIONS[posIdx],
    });
  }

  return result;
}

export function PageDecoration({ seed }: Props) {
  const decos = useMemo(() => pickDecorations(seed, 2), [seed]);

  return (
    <div className={styles.container} aria-hidden="true">
      {decos.map((d, i) => (
        <img
          key={i}
          className={`${styles.deco} ${styles[`pos_${d.position}`]}`}
          src={`${import.meta.env.BASE_URL}decorations/${d.file}`}
          alt=""
        />
      ))}
    </div>
  );
}

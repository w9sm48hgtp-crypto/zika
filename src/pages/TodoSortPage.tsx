import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTodoStore } from '../stores/todoStore';
import type { TodoItem } from '../db';
import styles from './TodoSortPage.module.css';

function TodoSortPage() {
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId: string }>();
  const { categories, items, loadAll, reorderItems } = useTodoStore();
  const [sorted, setSorted] = useState<TodoItem[]>([]);
  const isLoaded = useRef(false);

  const catId = Number(categoryId);
  const cat = categories.find(c => c.id === catId);
  const title = catId === 0 ? '今日计划' : (cat?.name || '加载中...');

  useEffect(() => {
    if (!isLoaded.current) {
      isLoaded.current = true;
      loadAll();
    }
  }, [loadAll]);

  // 加载后同步排序列表
  useEffect(() => {
    const catItems = items
      .filter(i => i.categoryId === catId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    setSorted([...catItems]);
  }, [items, catId]);

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newSorted = [...sorted];
    [newSorted[index - 1], newSorted[index]] = [newSorted[index], newSorted[index - 1]];
    setSorted(newSorted);
    await reorderItems(catId, newSorted);
  };

  const handleMoveDown = async (index: number) => {
    if (index === sorted.length - 1) return;
    const newSorted = [...sorted];
    [newSorted[index], newSorted[index + 1]] = [newSorted[index + 1], newSorted[index]];
    setSorted(newSorted);
    await reorderItems(catId, newSorted);
  };

  return (
    <div className="page">
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/companion', { replace: true })}>
          ← 返回
        </button>
        <span className={styles.title}>排序：{title}</span>
        <div className={styles.spacer} />
      </header>

      <p className={styles.hint}>点击 ↑ ↓ 调整项目顺序，完成后返回即可</p>

      <div className={styles.itemList}>
        {sorted.map((item, index) => (
          <div
            key={item.id}
            className={`${styles.sortItem} ${item.completed ? styles.sortItemDone : ''}`}
          >
            <span className={styles.sortNum}>{index + 1}</span>
            <span className={`${styles.sortText} ${item.completed ? styles.sortTextDone : ''}`}>
              {item.completed ? '✓ ' : ''}{item.text}
            </span>
            <div className={styles.arrowBtns}>
              <button
                className={styles.arrowBtn}
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                title="上移"
              >
                ↑
              </button>
              <button
                className={styles.arrowBtn}
                onClick={() => handleMoveDown(index)}
                disabled={index === sorted.length - 1}
                title="下移"
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>

      {sorted.length === 0 && (
        <p className={styles.empty}>这个分类还没有项目</p>
      )}
    </div>
  );
}

export default TodoSortPage;

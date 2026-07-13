import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTodoStore, DAILY_CAT_ID } from '../../stores/todoStore';
import styles from './TodoList.module.css';

interface TodoListProps {
  partnerName: string;
}

/** 渲染一个项目行（编辑/展示两态） */
function TodoItemRow({
  item,
  onToggle,
  onDelete,
  onEdit,
}: {
  item: { id?: number; text: string; completed: boolean };
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number, text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSave = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== item.text) {
      onEdit(item.id!, trimmed);
    }
    setEditing(false);
    setEditText(item.text);
  };

  const handleCancel = () => {
    setEditing(false);
    setEditText(item.text);
  };

  const isDone = item.completed;

  return (
    <div className={`${styles.itemRow} ${isDone ? styles.itemDone : ''}`}>
      <button
        className={`${styles.checkBtn} ${isDone ? styles.checkDone : ''}`}
        onClick={() => onToggle(item.id!)}
        title={isDone ? '取消完成' : '标记完成'}
      >
        {isDone ? '✓' : '☐'}
      </button>

      {editing ? (
        <>
          <input
            className={styles.editInput}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
            autoFocus
          />
          <button className={styles.editSaveBtn} onClick={handleSave}>保存</button>
          <button className={styles.editCancelBtn} onClick={handleCancel}>取消</button>
        </>
      ) : (
        <>
          <span className={isDone ? styles.itemTextDone : styles.itemText}>{item.text}</span>
          <div style={{ position: 'relative' }}>
            <button
              className="moreBtn"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            >
              <span className="moreBtnDot" />
              <span className="moreBtnDot" />
              <span className="moreBtnDot" />
            </button>
            {menuOpen && (
              <>
                <div className="popupOverlay" onClick={() => setMenuOpen(false)} />
                <div className="popupMenu">
                  <button className="popupMenuItem" onClick={() => { setMenuOpen(false); setEditText(item.text); setEditing(true); }}>
                    编辑
                  </button>
                  <button className="popupMenuItem popupMenuItemDanger" onClick={() => { setMenuOpen(false); onDelete(item.id!); }}>
                    删除
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TodoList({ partnerName }: TodoListProps) {
  const navigate = useNavigate();
  const {
    totalCount, todayCount, categories, items, loading,
    loadAll, addDailyItem, editItem,
    addCategory, deleteCategory,
    addItem, toggleItem, deleteItem,
  } = useTodoStore();

  const [newCat, setNewCat] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [newItemMap, setNewItemMap] = useState<Record<number, string>>({});
  const [dailyText, setDailyText] = useState('');
  const [menuCatId, setMenuCatId] = useState<number | null>(null);
  const isLoaded = useRef(false);

  useEffect(() => {
    if (!isLoaded.current) {
      isLoaded.current = true;
      loadAll();
    }
  }, [loadAll]);

  // 定时检查跨天重置（每60秒）
  useEffect(() => {
    const { checkDailyReset } = useTodoStore.getState();
    const timer = setInterval(async () => {
      const didReset = await checkDailyReset();
      if (didReset) {
        loadAll(); // 发生了跨天重置，刷新界面
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, [loadAll]);

  // 页面恢复可见时检查跨天重置
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        const { checkDailyReset } = useTodoStore.getState();
        const didReset = await checkDailyReset();
        if (didReset) {
          loadAll();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadAll]);

  const handleAddCat = async () => {
    const name = newCat.trim();
    if (!name) return;
    await addCategory(name);
    setNewCat('');
    setAddingCat(false);
  };

  const handleAddItem = async (catId: number) => {
    const text = (newItemMap[catId] || '').trim();
    if (!text) return;
    await addItem(catId, text);
    setNewItemMap(prev => ({ ...prev, [catId]: '' }));
  };

  const handleAddDaily = async () => {
    const text = dailyText.trim();
    if (!text) return;
    await addDailyItem(text);
    setDailyText('');
  };

  const handleDeleteCat = async (catId: number) => {
    if (!confirm('确定删除这个分类和里面所有项目吗？')) return;
    await deleteCategory(catId);
  };

  const getCatItems = (catId: number) => {
    return items
      .filter(i => i.categoryId === catId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  };

  const companionName = partnerName || '他';

  if (loading) return <p className={styles.loading}>加载中...</p>;

  const dailyItems = getCatItems(DAILY_CAT_ID);
  const dailyUncompleted = dailyItems.filter(i => !i.completed);
  const dailyCompleted = dailyItems.filter(i => i.completed);

  return (
    <div className={styles.todoSection}>
      <h2 className={styles.sectionTitle}>To Do List</h2>

      {/* 累计计数器 */}
      <div className={styles.counterCard}>
        <p className={styles.counterTotal}>
          {companionName}已经累计陪你完成了 <strong>{totalCount}</strong> 项计划
        </p>
        <p className={styles.todayLabel}>今日完成：{todayCount} 项</p>
      </div>

      {/* 每日计划项目区 */}
      <div className={styles.dailyCard}>
        {/* 每日计划头部（排序按钮） */}
        {dailyItems.length > 0 && (
          <div className={styles.catHeader}>
            <span className={styles.catName}>今日计划</span>
            <div className={styles.catActions}>
              <div style={{ position: 'relative' }}>
                <button
                  className="moreBtn"
                  onClick={(e) => { e.stopPropagation(); setMenuCatId(menuCatId === 0 ? null : 0); }}
                >
                  <span className="moreBtnDot" />
                  <span className="moreBtnDot" />
                  <span className="moreBtnDot" />
                </button>
                {menuCatId === 0 && (
                  <>
                    <div className="popupOverlay" onClick={() => setMenuCatId(null)} />
                    <div className="popupMenu">
                      <button className="popupMenuItem" onClick={() => { setMenuCatId(null); navigate(`/companion/todo-sort/0`); }}>
                        排序
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {dailyUncompleted.map(item => (
          <TodoItemRow
            key={item.id}
            item={item}
            onToggle={toggleItem}
            onDelete={deleteItem}
            onEdit={editItem}
          />
        ))}

        {dailyCompleted.length > 0 && dailyUncompleted.length > 0 && (
          <div className={styles.doneDivider}>── 已完成 ──</div>
        )}
        {dailyCompleted.length > 0 && dailyUncompleted.length === 0 && dailyItems.length > 0 && (
          <div className={styles.doneDivider}>── 已完成 ──</div>
        )}

        {dailyCompleted.map(item => (
          <TodoItemRow
            key={item.id}
            item={item}
            onToggle={toggleItem}
            onDelete={deleteItem}
            onEdit={editItem}
          />
        ))}

        {/* 添加每日计划 */}
        <div className={styles.addItemRow}>
          <input
            className={styles.addItemInput}
            value={dailyText}
            onChange={e => setDailyText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddDaily(); }}
            placeholder="写一个今日计划..."
          />
          <button
            className={styles.addItemBtn}
            onClick={handleAddDaily}
            disabled={!dailyText.trim()}
          >
            添加
          </button>
        </div>
      </div>

      {/* 自定义分类 */}
      {categories.map(cat => {
        const catItems = getCatItems(cat.id!);
        const uncompleted = catItems.filter(i => !i.completed);
        const completed = catItems.filter(i => i.completed);
        const cid = cat.id!;

        return (
          <div key={cid} className={styles.categoryCard}>
            <div className={styles.catHeader}>
              <span className={styles.catName}>{cat.name}</span>
              <div className={styles.catActions}>
                <div style={{ position: 'relative' }}>
                  <button
                    className="moreBtn"
                    onClick={(e) => { e.stopPropagation(); setMenuCatId(menuCatId === cid ? null : cid); }}
                  >
                    <span className="moreBtnDot" />
                    <span className="moreBtnDot" />
                    <span className="moreBtnDot" />
                  </button>
                  {menuCatId === cid && (
                    <>
                      <div className="popupOverlay" onClick={() => setMenuCatId(null)} />
                      <div className="popupMenu">
                        <button className="popupMenuItem" onClick={() => { setMenuCatId(null); navigate(`/companion/todo-sort/${cid}`); }}>
                          排序
                        </button>
                        <button className="popupMenuItem popupMenuItemDanger" onClick={() => { setMenuCatId(null); handleDeleteCat(cid); }}>
                          删除分类
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {uncompleted.map(item => (
              <TodoItemRow
                key={item.id}
                item={item}
                onToggle={toggleItem}
                onDelete={deleteItem}
                onEdit={editItem}
              />
            ))}

            {completed.length > 0 && uncompleted.length > 0 && (
              <div className={styles.doneDivider}>── 已完成 ──</div>
            )}
            {completed.length > 0 && uncompleted.length === 0 && (
              <div className={styles.doneDivider}>── 已完成 ──</div>
            )}

            {completed.map(item => (
              <TodoItemRow
                key={item.id}
                item={item}
                onToggle={toggleItem}
                onDelete={deleteItem}
                onEdit={editItem}
              />
            ))}

            <div className={styles.addItemRow}>
              <input
                className={styles.addItemInput}
                value={newItemMap[cid] || ''}
                onChange={e => setNewItemMap(prev => ({ ...prev, [cid]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleAddItem(cid); }}
                placeholder="添加项目..."
              />
              <button
                className={styles.addItemBtn}
                onClick={() => handleAddItem(cid)}
                disabled={!(newItemMap[cid] || '').trim()}
              >
                添加
              </button>
            </div>
          </div>
        );
      })}

      {/* 新建分类 */}
      {addingCat ? (
        <div className={styles.addCatRow}>
          <input
            className={styles.addCatInput}
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddCat(); }}
            placeholder="分类名称..."
            autoFocus
          />
          <button className={styles.addCatConfirmBtn} onClick={handleAddCat} disabled={!newCat.trim()}>
            确认
          </button>
          <button className={styles.addCatCancelBtn} onClick={() => { setAddingCat(false); setNewCat(''); }}>
            取消
          </button>
        </div>
      ) : (
        <button className={styles.newCatBtn} onClick={() => setAddingCat(true)}>
          + 新建分类
        </button>
      )}
    </div>
  );
}

export default TodoList;

import { useState, useEffect, useCallback } from 'react';
import { db, type Card } from '../../db';
import styles from './CardManager.module.css';

type TabType = Card['type'];

const TABS: { key: TabType; label: string }[] = [
  { key: 'text', label: '文字' },
  { key: 'nudge', label: '拍一拍' },
  { key: 'sticker', label: '表情包' },
];

const STICKER_CATEGORIES = [
  { key: '便捷发', label: '便捷发' },
  { key: '他的回复', label: '他的回复' },
  { key: '通用', label: '通用' },
];

export function CardManager() {
  const [activeTab, setActiveTab] = useState<TabType>('text');
  const [cards, setCards] = useState<Card[]>([]);
  const [inputText, setInputText] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  // 分类
  const [categories, setCategories] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState('');

  // 批量选择
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 表情包上传时的分类
  const [stickerUploadCategory, setStickerUploadCategory] = useState<string>('通用');

  // 加载分类列表
  const loadCategories = useCallback(async () => {
    const row = await db.settings.get('categories');
    const list: string[] = (row?.value as string[]) || [];
    setCategories(list);
  }, []);

  const saveCategories = async (list: string[]) => {
    await db.settings.put({ key: 'categories', value: list });
    setCategories(list);
  };

  const loadCards = useCallback(async () => {
    let query = db.cards.where('type').equals(activeTab);
    const all = await query.reverse().sortBy('createdAt');
    // 客户端按分类过滤
    const filtered = filterCategory ? all.filter(c => c.category === filterCategory) : all;
    setCards(filtered);
    setSelectedIds(new Set());
  }, [activeTab, filterCategory]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { loadCards(); }, [loadCards]);

  // 批量添加（换行分割）
  const handleBatchAdd = async () => {
    const lines = inputText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;
    const now = Date.now();
    const newCards: Card[] = lines.map(content => ({
      type: activeTab, content, category: filterCategory || undefined, createdAt: now, updatedAt: now,
    }));
    await db.cards.bulkAdd(newCards);
    setInputText('');
    loadCards();
  };

  // 表情包上传
  const handleStickerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await db.cards.add({
        type: 'sticker',
        content: reader.result as string,
        category: stickerUploadCategory,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      loadCards();
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  // 单张操作
  const handleDelete = async (id: number) => { await db.cards.delete(id); loadCards(); };
  const startEdit = (card: Card) => { setEditId(card.id!); setEditText(card.content); };
  const saveEdit = async () => {
    if (editId == null) return;
    await db.cards.update(editId, { content: editText, updatedAt: Date.now() });
    setEditId(null); setEditText(''); loadCards();
  };

  // 切换选中
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === cards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cards.map(c => c.id!)));
    }
  };

  // 批量删除
  const batchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedIds.size} 条字卡吗？`)) return;
    await db.cards.bulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    loadCards();
  };

  // 批量移动到分类
  const batchMoveToCategory = async (cat: string) => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      await db.cards.update(id, { category: cat || undefined });
    }
    setSelectedIds(new Set());
    loadCards();
  };

  // 新增分类
  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || categories.includes(name)) return;
    await saveCategories([...categories, name]);
    setNewCategoryName('');
  };

  const deleteCategory = async (cat: string) => {
    await saveCategories(categories.filter(c => c !== cat));
    if (filterCategory === cat) setFilterCategory('');
    // 清除该分类下所有字卡的分类标记
    const affected = await db.cards.where('category').equals(cat).toArray();
    for (const c of affected) {
      await db.cards.update(c.id!, { category: undefined });
    }
    loadCards();
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button key={tab.key} className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => { setActiveTab(tab.key); setEditId(null); setFilterCategory(''); }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {/* 分类管理（仅文字 tab 显示） */}
        {activeTab === 'text' && (
          <div className={styles.catBar}>
            <select className={styles.catSelect} value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}>
              <option value="">全部分类</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <input className={styles.catInput} value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              placeholder="新建分类..." />
            <button className="btn btn-outline" onClick={addCategory} disabled={!newCategoryName.trim()}>添加</button>
            {filterCategory && (
              <button className={styles.catDel} onClick={() => deleteCategory(filterCategory)}>
                删除此分类
              </button>
            )}
          </div>
        )}

        {/* 输入区 */}
        {(activeTab === 'text' || activeTab === 'nudge') && (
          <div className={styles.addArea}>
            <textarea className={styles.textarea} value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={activeTab === 'text' ? '输入字卡内容，换行即为新字卡...' : '输入拍一拍内容，换行即为新字卡...'}
              rows={4} />
            <button className="btn btn-primary" onClick={handleBatchAdd} disabled={!inputText.trim()}>添加字卡</button>
            <p className={styles.hint}>
              当前 {activeTab === 'text' ? '文字' : '拍一拍'}字卡：{cards.length} 条
              {filterCategory && `（分类：${filterCategory}）`}
            </p>
          </div>
        )}

        {activeTab === 'sticker' && (
          <>
            {/* 分类过滤栏 */}
            <div className={styles.catBar}>
              <select className={styles.catSelect} value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}>
                <option value="">全部分类</option>
                {STICKER_CATEGORIES.map(cat => <option key={cat.key} value={cat.key}>{cat.label}</option>)}
              </select>
            </div>

            <div className={styles.addArea}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <select className={styles.catSelect} value={stickerUploadCategory}
                  onChange={e => setStickerUploadCategory(e.target.value)}>
                  {STICKER_CATEGORIES.map(cat => <option key={cat.key} value={cat.key}>{cat.label}</option>)}
                </select>
                <label className={styles.uploadBtn}>
                  [图片] 选择图片上传
                  <input type="file" accept="image/*" onChange={handleStickerUpload} style={{ display: 'none' }} />
                </label>
              </div>
              <p className={styles.hint}>
                当前表情包：{cards.length} 个
                {filterCategory && `（分类：${filterCategory}）`}
              </p>
            </div>
          </>
        )}

        {/* 批量操作栏 */}
        {selectedIds.size > 0 && (
          <div className={styles.batchBar}>
            <span>已选 {selectedIds.size} 条</span>
            <button className="btn btn-outline" onClick={batchDelete}>批量删除</button>
            {activeTab === 'text' && categories.length > 0 && (
              <select className={styles.catSelect} onChange={e => { if (e.target.value) batchMoveToCategory(e.target.value); }}
                value="">
                <option value="">移动到...</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            )}
            {activeTab === 'sticker' && (
              <select className={styles.catSelect} onChange={e => { if (e.target.value) batchMoveToCategory(e.target.value); }}
                value="">
                <option value="">移动到...</option>
                {STICKER_CATEGORIES.map(cat => <option key={cat.key} value={cat.key}>{cat.label}</option>)}
              </select>
            )}
            <button className={styles.actionBtn} onClick={selectAll}>
              {selectedIds.size === cards.length ? '取消全选' : '全选'}
            </button>
          </div>
        )}

        {/* 字卡列表 */}
        <div className={styles.cardList}>
          {cards.map(card => (
            <div key={card.id} className={`${styles.cardItem} ${selectedIds.has(card.id!) ? styles.cardSelected : ''}`}>
              {editId === card.id ? (
                <div className={styles.editRow}>
                  {card.type === 'sticker' ? (
                    <img src={card.content} alt="" className={styles.stickerPreview} />
                  ) : (
                    <input className={styles.editInput} value={editText}
                      onChange={e => setEditText(e.target.value)} autoFocus />
                  )}
                  <button className="btn btn-primary" onClick={saveEdit}>保存</button>
                  <button className="btn btn-outline" onClick={() => setEditId(null)}>取消</button>
                </div>
              ) : (
                <div className={styles.cardRow}>
                  <input type="checkbox" className={styles.checkbox}
                    checked={selectedIds.has(card.id!)}
                    onChange={() => toggleSelect(card.id!)} />
                  <div className={styles.cardContent}>
                    {card.type === 'sticker' ? (
                      <div>
                        <img src={card.content} alt="" className={styles.stickerPreview} />
                        {card.category && <span className={styles.catTag}>{card.category}</span>}
                      </div>
                    ) : (
                      <div>
                        <span>{card.content}</span>
                        {card.category && <span className={styles.catTag}>{card.category}</span>}
                      </div>
                    )}
                  </div>
                  <div className={styles.cardActions}>
                    <button className={styles.actionBtn} onClick={() => startEdit(card)}>编辑</button>
                    <button className={styles.actionBtnDanger} onClick={() => handleDelete(card.id!)}>删除</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {cards.length === 0 && <p className={styles.empty}>暂无字卡，在上方添加</p>}
        </div>
      </div>
    </div>
  );
}

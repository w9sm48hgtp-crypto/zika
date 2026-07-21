import { useState, useEffect, useCallback, useRef } from 'react';
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

  // 搜索
  const [searchText, setSearchText] = useState('');

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
    let filtered = filterCategory ? all.filter(c => c.category === filterCategory) : all;
    // 搜索过滤（模糊匹配）
    if (searchText.trim()) {
      const kw = searchText.trim().toLowerCase();
      filtered = filtered.filter(c => {
        if (c.type === 'sticker') {
          // 表情包无法搜索 base64 内容，只搜分类名
          return (c.category || '').toLowerCase().includes(kw);
        }
        return c.content.toLowerCase().includes(kw);
      });
    }
    setCards(filtered);
    setSelectedIds(new Set());
  }, [activeTab, filterCategory, searchText]);

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
  const [stickerUploading, setStickerUploading] = useState(false);
  const [stickerBatchCount, setStickerBatchCount] = useState(0);
  const stickerInputRef = useRef<HTMLInputElement>(null);

  // 处理选中的文件（通用逻辑）
  const processStickerFiles = async (files: File[]) => {
    setStickerUploading(true);
    let added = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      await db.cards.add({
        type: 'sticker',
        content: dataUrl,
        category: stickerUploadCategory,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      added++;
    }
    setStickerUploading(false);
    setStickerBatchCount(prev => prev + added);
    loadCards();
  };

  // 优先用 File System Access API（支持多选），不支持则回退到 <input multiple>
  const pickStickerFiles = async () => {
    try {
      if ('showOpenFilePicker' in window) {
        const fileHandles = await (window as any).showOpenFilePicker({
          types: [{
            description: '图片',
            accept: { 'image/*': ['.png', '.gif', '.jpg', '.jpeg', '.webp', '.bmp', '.svg'] }
          }],
          multiple: true,
        });
        const files: File[] = [];
        for (const handle of fileHandles) {
          const file = await handle.getFile();
          files.push(file);
        }
        if (files.length > 0) {
          await processStickerFiles(files);
        }
        return;
      }
    } catch (err: any) {
      // 用户取消（AbortError）静默处理；其他错误回退到传统方式
      if (err?.name === 'AbortError') return;
    }
    // 回退：用传统 <input multiple>
    stickerInputRef.current?.click();
  };

  // 传统 <input multiple> 的 onChange 处理（回退方案）
  const handleStickerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processStickerFiles(Array.from(files));
    if (e.target) e.target.value = '';
  };

  // 继续添加
  const continueStickerUpload = () => {
    pickStickerFiles();
  };

  // 完成添加：重置计数
  const finishStickerUpload = () => {
    setStickerBatchCount(0);
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

  // 查重：同类型+同内容只保留最早的一条，删掉多余的
  const handleDedup = async () => {
    const all = await db.cards.where('type').equals(activeTab).toArray();
    const seen = new Map<string, number>(); // key: content, value: 保留的 id
    const toDelete: number[] = [];

    for (const card of all) {
      const key = card.content;
      if (seen.has(key)) {
        toDelete.push(card.id!);
      } else {
        seen.set(key, card.id!);
      }
    }

    if (toDelete.length === 0) {
      alert('没有发现重复字卡');
      return;
    }

    if (!confirm(`发现 ${toDelete.length} 条重复字卡，确定删除吗？（保留最早添加的）`)) return;
    await db.cards.bulkDelete(toDelete);
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
        {/* 搜索 + 查重 */}
        <div className={styles.toolBar}>
          <input
            className={styles.searchInput}
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="搜索字卡..."
          />
          {searchText && (
            <button className={styles.clearSearchBtn} onClick={() => setSearchText('')}>✕</button>
          )}
          <button className={styles.dedupBtn} onClick={handleDedup}>
            查重
          </button>
        </div>

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
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                <select className={styles.catSelect} value={stickerUploadCategory}
                  onChange={e => setStickerUploadCategory(e.target.value)}>
                  {STICKER_CATEGORIES.map(cat => <option key={cat.key} value={cat.key}>{cat.label}</option>)}
                </select>
                {stickerBatchCount > 0 ? (
                  <>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      已添加 {stickerBatchCount} 个
                    </span>
                    <button className={styles.uploadBtn} onClick={continueStickerUpload} disabled={stickerUploading}>
                      {stickerUploading ? '上传中...' : '继续添加'}
                    </button>
                    <button
                      onClick={finishStickerUpload}
                      style={{
                        padding: '10px 20px',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--color-bg)',
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-md)',
                        cursor: 'pointer',
                      }}
                    >
                      完成
                    </button>
                  </>
                ) : (
                  <button className={styles.uploadBtn} onClick={pickStickerFiles} disabled={stickerUploading}>
                    [图片] {stickerUploading ? '上传中...' : '选择图片上传（可多选）'}
                  </button>
                )}
                {/* 隐藏的 input，作为 File System Access API 不支持时的回退 */}
                <input ref={stickerInputRef} type="file" accept="image/*" multiple onChange={handleStickerUpload} style={{ display: 'none' }} />
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

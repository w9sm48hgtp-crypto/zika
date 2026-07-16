import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, type Anniversary } from '../db';
import styles from './AnniversaryPage.module.css';

/** 计算天数并生成显示文字 */
function calcDays(ann: Anniversary): { text: string; days: number; isToday: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = ann.date.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);

  if (ann.type === 'count_up') {
    const days = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
    return { text: `已经 ${days} 天`, days, isToday: days === 0 };
  }

  if (ann.type === 'count_down') {
    const days = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (days > 0) return { text: `还有 ${days} 天`, days, isToday: false };
    if (days === 0) return { text: '就是今天', days: 0, isToday: true };
    return { text: `已过 ${Math.abs(days)} 天`, days, isToday: false };
  }

  // annual: 每年同日
  const thisYear = new Date(today.getFullYear(), m - 1, d);
  thisYear.setHours(0, 0, 0, 0);
  let next: Date;
  if (thisYear.getTime() >= today.getTime()) {
    next = thisYear;
  } else {
    next = new Date(today.getFullYear() + 1, m - 1, d);
  }
  next.setHours(0, 0, 0, 0);
  const days = Math.floor((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return { text: '今天 🎂', days: 0, isToday: true };
  return { text: `还有 ${days} 天`, days, isToday: false };
}

function AnniversaryPage() {
  const navigate = useNavigate();
  const [list, setList] = useState<Anniversary[]>([]);

  // 表单
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formType, setFormType] = useState<Anniversary['type']>('count_up');

  // 三点菜单
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const loadList = useCallback(async () => {
    const items = await db.anniversaries.orderBy('id').toArray();
    setList(items);
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const openAdd = () => {
    setEditId(null);
    setFormName('');
    setFormDate('');
    setFormType('count_up');
    setShowForm(true);
  };

  const openEdit = (ann: Anniversary) => {
    setEditId(ann.id!);
    setFormName(ann.name);
    setFormDate(ann.date);
    setFormType(ann.type);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formDate) return;
    try {
      if (editId != null) {
        await db.anniversaries.update(editId, { name: formName.trim(), date: formDate, type: formType });
      } else {
        await db.anniversaries.add({
          name: formName.trim(),
          date: formDate,
          type: formType,
          createdAt: Date.now(),
        });
      }
      setShowForm(false);
      setEditId(null);
      await loadList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert('保存失败：' + msg + '\n\n请尝试刷新页面后重试。');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这个纪念日吗？')) return;
    await db.anniversaries.delete(id);
    loadList();
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/records')}>← 返回</button>
        <span className={styles.title}>纪念日</span>
        <div className={styles.spacer} />
      </header>

      <div className={styles.body}>
        {list.length === 0 && !showForm && (
          <div className={styles.emptyHint}>
            <p>还没有纪念日</p>
            <p className={styles.subHint}>点击下方按钮添加</p>
          </div>
        )}

        {list.map(ann => {
          const { text, isToday } = calcDays(ann);
          const dateObj = new Date(ann.date + 'T00:00:00');
          const dateLabel = ann.type === 'annual'
            ? `每年 ${dateObj.getMonth() + 1}月${dateObj.getDate()}日`
            : `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;

          return (
            <div key={ann.id} className={`${styles.card} ${isToday ? styles.cardToday : ''}`}>
              <div className={styles.cardLeft}>
                <span className={styles.cardName}>{ann.name}</span>
                <span className={styles.cardDate}>
                  {dateLabel}
                  <span className={styles.typeTag}>
                    {ann.type === 'count_up' ? '正数' : ann.type === 'count_down' ? '倒数' : '每年'}
                  </span>
                </span>
              </div>
              <div className={styles.cardRight}>
                <span className={`${styles.cardDays} ${isToday ? styles.daysToday : ''}`}>
                  {text}
                </span>
                <div className={styles.menuWrap}>
                  <button
                    className="moreBtn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === ann.id ? null : ann.id!);
                    }}
                  >
                    <span className="moreBtnDot" />
                    <span className="moreBtnDot" />
                    <span className="moreBtnDot" />
                  </button>
                  {menuOpenId === ann.id && (
                    <>
                      <div className="popupOverlay" onClick={() => setMenuOpenId(null)} />
                      <div className="popupMenu">
                        <button className="popupMenuItem" onClick={() => { setMenuOpenId(null); openEdit(ann); }}>
                          编辑
                        </button>
                        <button className="popupMenuItem popupMenuItemDanger" onClick={() => { setMenuOpenId(null); handleDelete(ann.id!); }}>
                          删除
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* 新增/编辑表单 */}
        {showForm && (
          <div className={styles.form}>
            <h3 className={styles.formTitle}>{editId != null ? '编辑纪念日' : '添加纪念日'}</h3>

            <label className={styles.formLabel}>名称</label>
            <input
              className={styles.formInput}
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="例如：在一起、他的生日..."
            />

            <label className={styles.formLabel}>日期</label>
            <input
              className={styles.formInput}
              type="date"
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
            />

            <label className={styles.formLabel}>类型</label>
            <div className={styles.typeRow}>
              {([
                { key: 'count_up' as const, label: '正数日', desc: '从这天起已经过了多少天' },
                { key: 'count_down' as const, label: '倒数日', desc: '距离这天还有多少天' },
                { key: 'annual' as const, label: '每年同日', desc: '每年同一天（如生日）' },
              ]).map(opt => (
                <button
                  key={opt.key}
                  className={`${styles.typeBtn} ${formType === opt.key ? styles.typeBtnActive : ''}`}
                  onClick={() => setFormType(opt.key)}
                >
                  <span className={styles.typeBtnLabel}>{opt.label}</span>
                  <span className={styles.typeBtnDesc}>{opt.desc}</span>
                </button>
              ))}
            </div>

            <div className={styles.formActions}>
              <button className={styles.saveBtn} onClick={handleSave} disabled={!formName.trim() || !formDate}>
                {editId != null ? '保存修改' : '添加'}
              </button>
              <button className={styles.cancelBtn} onClick={() => { setShowForm(false); setEditId(null); }}>
                取消
              </button>
            </div>
          </div>
        )}

        {!showForm && (
          <button className={styles.addBtn} onClick={openAdd}>
            + 添加纪念日
          </button>
        )}

        <svg
          className={styles.decoSvg}
          viewBox="0 0 390 150"
          width="100%"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="bubbleShadow">
              <feDropShadow dx="0" dy="2" stdDeviation="6" flood-opacity="0.1" />
            </filter>
            <filter id="pageDecoFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="1" dy="0" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
              <feDropShadow dx="-1" dy="0" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
              <feDropShadow dx="0" dy="1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
              <feDropShadow dx="0" dy="-1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
              <feDropShadow dx="1" dy="1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
              <feDropShadow dx="-1" dy="-1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
              <feDropShadow dx="1" dy="-1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
              <feDropShadow dx="-1" dy="1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
              <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.15" />
            </filter>
          </defs>
          {/* 文字气泡 — 高度和23号图一致 */}
          <rect x="32" y="20" width="210" height="110" rx="12" fill="#fff" filter="url(#bubbleShadow)" />
          <image
            x="48" y="32" width="178"
            href={`${import.meta.env.BASE_URL}decorations/text1.png`}
          />
          {/* 23号装饰图 */}
          <image
            x="252" y="20" width="110"
            href={`${import.meta.env.BASE_URL}decorations/23.png`}
            filter="url(#pageDecoFilter)"
          />
        </svg>
      </div>
    </div>
  );
}

export default AnniversaryPage;

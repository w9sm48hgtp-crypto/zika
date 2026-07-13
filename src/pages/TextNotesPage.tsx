import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, type StickyNote } from '../db';
import styles from './TextNotesPage.module.css';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function TextNotesPage() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [menuNoteId, setMenuNoteId] = useState<number | null>(null);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    setLoading(true);
    const list = await db.stickyNotes.orderBy('createdAt').reverse().toArray();
    setNotes(list);
    setLoading(false);
  };

  const handleAdd = async () => {
    const content = newContent.trim();
    if (!content) return;
    const now = Date.now();
    await db.stickyNotes.add({ content, createdAt: now, updatedAt: now });
    setNewContent('');
    setIsAdding(false);
    await loadNotes();
  };

  const handleEdit = (note: StickyNote) => {
    setEditingId(note.id!);
    setEditContent(note.content);
  };

  const handleSaveEdit = async () => {
    if (editingId == null) return;
    const content = editContent.trim();
    if (!content) return;
    await db.stickyNotes.update(editingId, { content, updatedAt: Date.now() });
    setEditingId(null);
    setEditContent('');
    await loadNotes();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这条便签吗？')) return;
    await db.stickyNotes.delete(id);
    if (editingId === id) {
      setEditingId(null);
      setEditContent('');
    }
    await loadNotes();
  };

  return (
    <div className="page">
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/records/daily')}>←</button>
        <h1 className={styles.headerTitle}>文字便签</h1>
      </div>

      {/* 添加按钮 */}
      {!isAdding && (
        <button className={styles.addNoteBtn} onClick={() => setIsAdding(true)}>
          ＋ 写一张便签
        </button>
      )}

      {/* 添加区 */}
      {isAdding && (
        <div className={styles.noteCard}>
          <div className={styles.editRow}>
            <textarea
              className={styles.editInput}
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="写下你想记录的事..."
              autoFocus
            />
            <div className={styles.editButtons}>
              <button className={styles.cancelBtn} onClick={() => { setIsAdding(false); setNewContent(''); }}>取消</button>
              <button className={styles.saveBtn} onClick={handleAdd} disabled={!newContent.trim()}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 便签列表 */}
      {loading ? (
        <p className={styles.emptyHint}>加载中...</p>
      ) : notes.length === 0 && !isAdding ? (
        <div className={styles.emptyHint}>
          <span className={styles.emptyIcon}>📝</span>
          还没有便签，写一张吧
        </div>
      ) : (
        <div className={styles.noteList}>
          {notes.map(note => (
            <div key={note.id} className={styles.noteCard}>
              {editingId === note.id ? (
                <div className={styles.editRow}>
                  <textarea
                    className={styles.editInput}
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    autoFocus
                  />
                  <div className={styles.editButtons}>
                    <button className={styles.cancelBtn} onClick={() => { setEditingId(null); setEditContent(''); }}>取消</button>
                    <button className={styles.saveBtn} onClick={handleSaveEdit} disabled={!editContent.trim()}>保存</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className={styles.noteContent}>{note.content}</p>
                  <p className={styles.noteTime}>{formatTime(note.createdAt)}</p>
                  <div className={styles.noteActions}>
                    <div style={{ position: 'relative' }}>
                      <button
                        className="moreBtn"
                        onClick={(e) => { e.stopPropagation(); setMenuNoteId(menuNoteId === note.id ? null : note.id!); }}
                      >
                        <span className="moreBtnDot" />
                        <span className="moreBtnDot" />
                        <span className="moreBtnDot" />
                      </button>
                      {menuNoteId === note.id && (
                        <>
                          <div className="popupOverlay" onClick={() => setMenuNoteId(null)} />
                          <div className="popupMenu">
                            <button className="popupMenuItem" onClick={() => { setMenuNoteId(null); handleEdit(note); }}>
                              编辑
                            </button>
                            <button className="popupMenuItem popupMenuItemDanger" onClick={() => { setMenuNoteId(null); handleDelete(note.id!); }}>
                              删除
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TextNotesPage;

import { useEffect, useRef, useState } from 'react';
import { useDailyStore } from '../stores/dailyStore';
import { useSettingsStore } from '../stores/settingsStore';
import { pickPeriodMessage } from '../utils/periodPredictor';
import styles from './DailyPage.module.css';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateCN(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekDays[d.getDay()]}`;
}

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDow = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function DailyPage() {
  const {
    year, month, recordsMap, moodTags,
    periodDays, predictedDays,
    selectedDate, selectedRecord,
    loadMonth, loadMoodTags, goMonth,
    selectDate, clearSelection,
    toggleUserMood, addUserNote, editUserNote, deleteUserNote,
    ongoingPeriod, startPeriod, endPeriod, cancelPeriod, deleteCompletedPeriod,
  } = useDailyStore();
  const { partnerName, loadSettings } = useSettingsStore();

  const [newNote, setNewNote] = useState('');
  const [editingNoteIdx, setEditingNoteIdx] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [comfortMsg, setComfortMsg] = useState<string | null>(null);
  const isLoaded = useRef(false);

  useEffect(() => {
    if (!isLoaded.current) {
      isLoaded.current = true;
      loadSettings();
      loadMoodTags();
      loadMonth(year, month);
    }
  }, [loadSettings, loadMoodTags, loadMonth, year, month]);

  // 选中日期时刷新安慰语句
  useEffect(() => {
    if (selectedDate && periodDays.has(selectedDate)) {
      pickPeriodMessage().then(m => setComfortMsg(m));
    } else {
      setComfortMsg(null);
    }
  }, [selectedDate, periodDays]);

  const today = todayStr();
  const calendarDays = getCalendarDays(year, month);
  const companionName = partnerName || '他';

  const userMoodTags = moodTags.filter(t => t.category === 'mine' || t.category === 'both');
  const selectedTags = selectedRecord?.userMoodTags || [];
  const isPeriodDay = selectedDate ? periodDays.has(selectedDate) : false;

  const handleDayClick = (day: number | null) => {
    if (day == null) return;
    const ds = dateStr(year, month, day);
    selectDate(ds);
  };

  const handleAddNote = async () => {
    const note = newNote.trim();
    if (!note) return;
    await addUserNote(note);
    setNewNote('');
  };

  const handleEditNote = (index: number, text: string) => {
    setEditingNoteIdx(index);
    setEditingNoteText(text);
  };

  const handleSaveNote = async () => {
    if (editingNoteIdx == null) return;
    await editUserNote(editingNoteIdx, editingNoteText.trim());
    setEditingNoteIdx(null);
    setEditingNoteText('');
  };

  const handleStartPeriod = async () => {
    if (!selectedDate) return;
    await startPeriod(selectedDate);
  };

  const handleEndPeriod = async () => {
    if (!selectedDate) return;
    await endPeriod(selectedDate);
  };

  const userNotes = selectedRecord?.userNotes || [];
  const partnerRevealed = selectedRecord?.partnerMoodTime
    ? Date.now() >= selectedRecord.partnerMoodTime
    : true;

  return (
    <div className="page">
      <h1 className="page-title">每日</h1>

      {/* 月历 */}
      <div className={styles.calendar}>
        <div className={styles.monthNav}>
          <button className={styles.monthBtn} onClick={() => goMonth(-1)}>&lt;</button>
          <span className={styles.monthLabel}>{year}年{month}月</span>
          <button className={styles.monthBtn} onClick={() => goMonth(1)}>&gt;</button>
        </div>

        <div className={styles.weekRow}>
          {WEEKDAYS.map(w => (
            <div key={w} className={styles.weekHeader}>{w}</div>
          ))}
        </div>

        <div className={styles.dayGrid}>
          {calendarDays.map((day, i) => {
            if (day == null) return <div key={`e${i}`} className={styles.dayCell} />;
            const ds = dateStr(year, month, day);
            const record = recordsMap[ds];
            const isTodayCell = ds === today;
            const isSelected = ds === selectedDate;
            const hasPeriod = periodDays.has(ds);
            const hasPredicted = predictedDays.has(ds);
            const tags = record?.userMoodTags || [];

            return (
              <button
                key={ds}
                className={`${styles.dayCell} ${styles.dayBtn}
                  ${isTodayCell ? styles.dayToday : ''}
                  ${isSelected ? styles.daySelected : ''}
                  ${hasPeriod ? styles.dayPeriod : ''}
                  ${hasPredicted && !hasPeriod ? styles.dayPredicted : ''}`}
                onClick={() => handleDayClick(day)}
              >
                <span className={styles.dayNum}>{day}</span>
                {record?.partnerMoodTag && record?.partnerMoodTime && Date.now() >= record.partnerMoodTime && ds <= today ? (
                  <span className={styles.dayTagPartner}>{record.partnerMoodTag}</span>
                ) : null}
                {tags.length > 0 && (
                  <span className={styles.dayTag}>
                    {tags.length === 1 ? tags[0] : `${tags[0]}+${tags.length - 1}`}
                  </span>
                )}
                {record?.partnerNote && <span className={styles.dayDot} />}
              </button>
            );
          })}
        </div>

        {/* 图例 */}
        <div className={styles.legend}>
          <span className={styles.legendItem}><span className={styles.legendDotPeriod} /> 经期</span>
          <span className={styles.legendItem}><span className={styles.legendDotPredicted} /> 预测</span>
        </div>
      </div>

      {/* 日期详情面板 */}
      {selectedDate && (
        <div className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <span className={styles.detailDate}>{formatDateCN(selectedDate)}</span>
            <button className={styles.detailClose} onClick={clearSelection}>x</button>
          </div>

          {/* 我的状态 */}
          <div className={styles.detailSectionBox}>
            <h4 className={styles.detailTitle}>
              我的状态
              {selectedTags.length > 0 && <span className={styles.tagCount}>（{selectedTags.length}/3）</span>}
            </h4>
            <div className={styles.moodRow}>
              {userMoodTags.map(tag => (
                <button
                  key={tag.id}
                  className={`${styles.moodPill} ${selectedTags.includes(tag.name) ? styles.moodPillActive : ''}`}
                  onClick={() => toggleUserMood(tag.name)}
                >
                  {tag.name}
                </button>
              ))}
              {userMoodTags.length === 0 && (
                <span className={styles.hint}>请在「我的」中添加状态标签</span>
              )}
            </div>
          </div>

          {/* 生理期记录 */}
          <div className={styles.detailSectionBox}>
            <h4 className={styles.detailTitle}>生理期记录</h4>
            {!ongoingPeriod && !isPeriodDay && (
              <button className={styles.periodToggle} onClick={handleStartPeriod}>
                标记为经期开始
              </button>
            )}
            {ongoingPeriod && (
              <div className={styles.periodBtnRow}>
                <button className={`${styles.periodToggle} ${styles.periodToggleOn}`} onClick={handleEndPeriod}>
                  {isPeriodDay ? '经期中（点击标记结束）' : '标记为经期结束'}
                </button>
                <button className={styles.periodCancel} onClick={() => { if (confirm('取消本次经期记录？')) cancelPeriod(); }}>
                  取消记录
                </button>
              </div>
            )}
            {!ongoingPeriod && isPeriodDay && (
              <div className={styles.periodBtnRow}>
                <span className={styles.detailHint}>经期日</span>
                <button className={styles.periodCancel}
                  onClick={() => { if (confirm('删除这条经期记录？')) deleteCompletedPeriod(selectedDate!); }}>
                  删除记录
                </button>
              </div>
            )}
            {comfortMsg && (
              <p className={styles.comfortMsg}>{comfortMsg}</p>
            )}
          </div>

          {/* 我的小纸条 */}
          <div className={styles.detailSectionBox}>
            <h4 className={styles.detailTitle}>我的小纸条</h4>
            {userNotes.map((note, i) => (
              <div key={i} className={styles.noteItem}>
                {editingNoteIdx === i ? (
                  <div className={styles.noteEditRow}>
                    <input className={styles.noteInput} value={editingNoteText}
                      onChange={e => setEditingNoteText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveNote(); }} autoFocus />
                    <button className={styles.noteSave} onClick={handleSaveNote}>保存</button>
                    <button className={styles.noteCancel} onClick={() => setEditingNoteIdx(null)}>取消</button>
                  </div>
                ) : (
                  <div className={styles.noteRow}>
                    <span className={styles.noteText}>{note}</span>
                    <div className={styles.noteActions}>
                      <button className={styles.noteEditBtn} onClick={() => handleEditNote(i, note)}>编辑</button>
                      <button className={styles.noteDelBtn} onClick={() => deleteUserNote(i)}>删除</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {userNotes.length < 3 && (
              <div className={styles.addNoteRow}>
                <input className={styles.noteInput} value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }}
                  placeholder={`写第 ${userNotes.length + 1} 条小纸条...`} />
                <button className={styles.noteSave} onClick={handleAddNote} disabled={!newNote.trim()}>添加</button>
              </div>
            )}
          </div>

          {/* 他的状态 */}
          <div className={styles.detailSectionBox}>
            <h4 className={styles.detailTitle}>他的状态</h4>
            {partnerRevealed && selectedRecord?.partnerMoodTag ? (
              <p className={styles.detailAccent}>{companionName}今天觉得「{selectedRecord.partnerMoodTag}」</p>
            ) : (
              <p className={styles.detailHint}>{companionName}还没有记录今日状态</p>
            )}
          </div>

          {/* 他的留言 */}
          <div className={styles.detailSectionBox}>
            <h4 className={styles.detailTitle}>他的留言</h4>
            {selectedRecord?.partnerNote ? (
              <p className={styles.detailMsg}>{selectedRecord.partnerNote}</p>
            ) : (
              <p className={styles.detailHint}>还没有留言</p>
            )}
          </div>
        </div>
      )}

      {!selectedDate && (
        <p className={styles.tapHint}>点击日期查看详情</p>
      )}
    </div>
  );
}

export default DailyPage;

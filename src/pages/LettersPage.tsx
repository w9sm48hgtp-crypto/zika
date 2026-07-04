import { useEffect, useRef, useState } from 'react';
import { useLetterStore } from '../stores/letterStore';
import { db } from '../db';
import styles from './LettersPage.module.css';

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatReplyTime(ts: number): string {
  const now = Date.now();
  const diffMs = ts - now;
  if (diffMs <= 0) return '即将回信';
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return '不到1小时后回信';
  return `约${diffHours}小时后回信`;
}

function LettersPage() {
  const { letters, loading, loadLetters, sendLetter, checkReplies, deleteLetter } = useLetterStore();

  const [isComposing, setIsComposing] = useState(false);
  const [letterText, setLetterText] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isLoaded = useRef(false);

  useEffect(() => {
    if (!isLoaded.current) {
      isLoaded.current = true;
      loadLetters().then(() => {
        checkReplies();
      });
    }
  }, [loadLetters, checkReplies]);

  const handleSend = async () => {
    const content = letterText.trim();
    if (!content || sending) return;
    setSending(true);
    const id = await sendLetter(content);
    setSending(false);
    setLetterText('');
    setIsComposing(false);

    // 从 DB 读取回信时间显示 toast
    const letter = await db.letters.get(id);
    if (letter?.repliedAt) {
      setToast(formatReplyTime(letter.repliedAt));
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这封信和回信吗？')) return;
    if (expandedId === id) setExpandedId(null);
    await deleteLetter(id);
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="page">
      <h1 className="page-title">书信</h1>

      {/* 累计信数 */}
      <p className={styles.letterCount}>共 {letters.length} 封信</p>

      {/* 写新信按钮 */}
      {!isComposing && (
        <button className={styles.composeBtn} onClick={() => setIsComposing(true)}>
          ✉ 写一封信给他
        </button>
      )}

      {/* 写信区 */}
      {isComposing && (
        <div className={styles.composeArea}>
          <div className={styles.composeHeader}>
            <span className={styles.composeTitle}>写一封信</span>
            <button className={styles.composeCancel} onClick={() => { setIsComposing(false); setLetterText(''); }}>
              取消
            </button>
          </div>
          <textarea
            className={styles.letterInput}
            value={letterText}
            onChange={e => setLetterText(e.target.value)}
            placeholder="写下你想对他说的话..."
            autoFocus
          />
          <div className={styles.composeFooter}>
            <span className={styles.charCount}>{letterText.length} 字</span>
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!letterText.trim() || sending}
            >
              {sending ? '发送中...' : '寄出'}
            </button>
          </div>
        </div>
      )}

      {/* 书信列表 */}
      {loading ? (
        <p className={styles.emptyHint}>加载中...</p>
      ) : letters.length === 0 ? (
        <div className={styles.emptyHint}>
          <span className={styles.emptyIcon}>📮</span>
          还没有写过信
        </div>
      ) : (
        <div className={styles.letterList}>
          {letters.map(letter => {
            const isExpanded = expandedId === letter.id;
            const hasReply = !!letter.replyContent;
            const replyPending = !hasReply && letter.repliedAt != null && letter.repliedAt > Date.now();

            return (
              <div key={letter.id} className={styles.letterCard}>
                {/* 头部：日期 + 状态 */}
                <div className={styles.letterCardHeader} onClick={() => toggleExpand(letter.id!)}>
                  <div className={styles.letterMeta}>
                    <span className={styles.letterDate}>{formatDate(letter.sentAt)}</span>
                    {hasReply ? (
                      <span className={`${styles.letterStatus} ${styles.statusReplied}`}>已回信</span>
                    ) : replyPending ? (
                      <span className={`${styles.letterStatus} ${styles.statusWaiting}`}>等待回信</span>
                    ) : (
                      <span className={`${styles.letterStatus} ${styles.statusReplied}`}>已回信</span>
                    )}
                  </div>
                  <span className={`${styles.letterArrow} ${isExpanded ? styles.letterArrowOpen : ''}`}>▼</span>
                </div>

                {/* 预览（折叠时） */}
                {!isExpanded && (
                  <div className={styles.letterPreview}>
                    {letter.userContent.slice(0, 50)}{letter.userContent.length > 50 ? '...' : ''}
                  </div>
                )}

                {/* 展开详情 */}
                {isExpanded && (
                  <div className={styles.letterBody}>
                    {/* 我的信 */}
                    <div className={styles.letterContent}>{letter.userContent}</div>

                    {/* 回信 */}
                    {hasReply ? (
                      <div className={styles.replySection}>
                        <div className={styles.replyLabel}>他的回信</div>
                        <div className={styles.replyContent}>{letter.replyContent}</div>
                      </div>
                    ) : replyPending ? (
                      <div className={styles.replySection}>
                        <div className={styles.replyPending}>
                          📬 回信还在路上...
                          <br />
                          <span className={styles.replyPendingTime}>{formatReplyTime(letter.repliedAt!)}</span>
                        </div>
                      </div>
                    ) : null}

                    {/* 删除 */}
                    <div className={styles.letterActions}>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(letter.id!)}>
                        删除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 发送成功 Toast */}
      {toast && (
        <div className={styles.sentToast}>
          <div>信件已寄出 ✉</div>
          <div className={styles.sentToastTime}>{toast}</div>
        </div>
      )}
    </div>
  );
}

export default LettersPage;

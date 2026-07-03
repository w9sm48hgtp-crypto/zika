import { useState, useRef, useCallback } from 'react';
import { db, type Card } from '../../db';
import styles from './ChatInput.module.css';

interface Props {
  onSend: (content: string, type: 'text' | 'nudge' | 'sticker' | 'choice') => void;
  onQuoteCancel?: () => void;
  quotedContent?: string | null;
}

export function ChatInput({ onSend, onQuoteCancel, quotedContent }: Props) {
  const [text, setText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [choiceMode, setChoiceMode] = useState(false);
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [stickerLibrary, setStickerLibrary] = useState<Card[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, choiceMode ? 'choice' : 'text');
    setText('');
    setShowMenu(false);
    setChoiceMode(false);
  }, [text, choiceMode, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !choiceMode) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, choiceMode]);

  const handleNudge = useCallback(() => {
    onSend('拍了拍你', 'nudge');
    setShowMenu(false);
  }, [onSend]);

  const handleChoiceMode = useCallback(() => {
    setChoiceMode(true);
    setText('');
    setShowMenu(false);
  }, []);

  const openStickerPanel = useCallback(async () => {
    setShowMenu(false);
    const all = await db.cards.where('type').equals('sticker').toArray();
    const available = all.filter(c => !c.category || c.category === '便捷发' || c.category === '通用');
    setStickerLibrary(available);
    setShowStickerPanel(true);
  }, []);

  const handleStickerPick = useCallback((card: Card) => {
    onSend(card.content, 'sticker');
    setShowStickerPanel(false);
  }, [onSend]);

  const handleStickerUploadFromPanel = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      // 保存到字卡库，默认分类「便捷发」
      await db.cards.add({ type: 'sticker', content: dataUrl, category: '便捷发', createdAt: Date.now(), updatedAt: Date.now() });
      onSend(dataUrl, 'sticker');
      setShowStickerPanel(false);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [onSend]);

  const cancelChoice = useCallback(() => {
    setChoiceMode(false);
    setText('');
  }, []);

  return (
    <div className={styles.container}>
      {quotedContent && (
        <div className={styles.quotePreview}>
          <span className={styles.quoteText}>引用: {quotedContent.slice(0, 30)}...</span>
          <button onClick={onQuoteCancel} className={styles.quoteCancel}>x</button>
        </div>
      )}

      {choiceMode && (
        <div className={styles.choiceHint}>
          <span>选择题模式：第一行输入问题，下面每行一个选项</span>
          <button onClick={cancelChoice} className={styles.choiceCancel}>取消</button>
        </div>
      )}

      <div className={styles.inputRow}>
        <button
          className={styles.plusBtn}
          onClick={() => setShowMenu(!showMenu)}
        >
          +
        </button>

        {choiceMode ? (
          <textarea
            className={styles.choiceInput}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"今天吃什么？\n火锅\n日料\n烧烤"}
            rows={3}
          />
        ) : (
          <input
            className={styles.textInput}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            enterKeyHint="send"
          />
        )}

        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!text.trim()}
        >
          发送
        </button>
      </div>

      {showMenu && !showStickerPanel && (
        <div className={styles.menu}>
          <button className={styles.menuItem} onClick={handleNudge}>
            拍一拍
          </button>
          <button className={styles.menuItem} onClick={openStickerPanel}>
            表情包
          </button>
          <button className={styles.menuItem} onClick={handleChoiceMode}>
            选择题
          </button>
        </div>
      )}

      {showStickerPanel && (
        <div className={styles.stickerPanel}>
          <div className={styles.stickerPanelHeader}>
            <span>选择表情包</span>
            <button className={styles.choiceCancel} onClick={() => setShowStickerPanel(false)}>关闭</button>
          </div>
          {stickerLibrary.length === 0 ? (
            <p className={styles.stickerEmpty}>暂无表情包，请上传</p>
          ) : (
            <div className={styles.stickerGrid}>
              {stickerLibrary.map(card => (
                <button key={card.id} className={styles.stickerItem}
                  onClick={() => handleStickerPick(card)}>
                  <img src={card.content} alt="" />
                </button>
              ))}
            </div>
          )}
          <label className={styles.stickerUploadBtn}>
            [图片] 上传新表情包
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleStickerUploadFromPanel}
            />
          </label>
        </div>
      )}
    </div>
  );
}

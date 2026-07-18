import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { EXPORT_MODULES, exportModules, downloadJson, estimateModuleSizes, formatSize } from '../utils/exportData';
import { parseImportData, importModules } from '../utils/importData';
import { db, type Card } from '../db';
import type { ImportPreview } from '../utils/importData';
import { DATA_TYPE_META, exportTextData, importTextData, type DataType } from '../utils/textDataExchange';
import styles from './DataManagePage.module.css';

/** 清理聊天记录的天数选项 */
const CLEANUP_OPTIONS = [
  { days: 1, label: '1天前' },
  { days: 3, label: '3天前' },
  { days: 7, label: '7天前' },
  { days: 14, label: '14天前' },
  { days: 30, label: '30天前' },
];

function DataManagePage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  // 导出状态
  const [exportSelected, setExportSelected] = useState<Set<string>>(new Set(EXPORT_MODULES.map(m => m.key)));
  const [moduleSizes, setModuleSizes] = useState<Record<string, number>>({});
  const [exporting, setExporting] = useState(false);

  // JSON 导出弹窗（当系统分享不可用时展示 JSON 文本）
  const [exportJsonText, setExportJsonText] = useState<string | null>(null);
  const exportJsonPreRef = useRef<HTMLPreElement>(null);

  // 导入状态
  const [importPreview, setImportPreview] = useState<ImportPreview[] | null>(null);
  const [importData, setImportData] = useState<unknown>(null);
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 粘贴 JSON 导入
  const [importJsonText, setImportJsonText] = useState('');
  const [importJsonMsg, setImportJsonMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 清理聊天记录状态
  const [cleanupDays, setCleanupDays] = useState<number | null>(null); // 选中的天数，null=未选
  const [cleanupCount, setCleanupCount] = useState<number | null>(null); // 待清理条数
  const [cleanupCounting, setCleanupCounting] = useState(false);
  const [cleanupDeleting, setCleanupDeleting] = useState(false);
  const [cleanupDone, setCleanupDone] = useState(false);

  // 字卡文本导出/导入
  const [cardTextExport, setCardTextExport] = useState<string | null>(null);
  const [cardTextImport, setCardTextImport] = useState('');
  const [cardImportMsg, setCardImportMsg] = useState<string | null>(null);

  // 文字数据交换（6种纯文字数据）
  const [exchangeType, setExchangeType] = useState<DataType>('periodMessages');
  const [exchangeExport, setExchangeExport] = useState<string | null>(null);
  const [exchangeImport, setExchangeImport] = useState('');
  const [exchangeMsg, setExchangeMsg] = useState<string | null>(null);

  // 导出字卡为换行文本（按分类分组，不含表情包）
  const handleCardTextExport = useCallback(async () => {
    const cards = await db.cards.toArray();
    // 过滤掉表情包
    const textCards = cards.filter(c => c.type !== 'sticker');

    // 按分类分组
    const grouped: Record<string, Card[]> = {};
    const uncategorized: Card[] = [];
    for (const c of textCards) {
      if (c.category) {
        if (!grouped[c.category]) grouped[c.category] = [];
        grouped[c.category].push(c);
      } else {
        uncategorized.push(c);
      }
    }

    const lines: string[] = [];
    for (const [cat, catCards] of Object.entries(grouped)) {
      lines.push(`【${cat}】`);
      for (const c of catCards) {
        lines.push(c.type === 'nudge' ? `[拍一拍] ${c.content}` : c.content);
      }
      lines.push(''); // 空行分隔
    }
    if (uncategorized.length > 0) {
      lines.push('【未分类】');
      for (const c of uncategorized) {
        lines.push(c.type === 'nudge' ? `[拍一拍] ${c.content}` : c.content);
      }
    }

    setCardTextExport(lines.join('\n'));
  }, []);

  // 全选导出文本（不复制，用户自行长按复制）
  const cardPreRef = useRef<HTMLPreElement>(null);
  const handleSelectAllCard = useCallback(() => {
    if (!cardPreRef.current) return;
    const range = document.createRange();
    range.selectNodeContents(cardPreRef.current);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  // 导入换行文本为字卡（支持【分类名】标题行）
  const handleCardTextImport = useCallback(async () => {
    if (!cardTextImport.trim()) return;
    const rawLines = cardTextImport.split('\n');
    let count = 0;
    let skipped = 0;
    let currentCategory = '';

    for (const raw of rawLines) {
      const line = raw.trim();
      if (!line) continue;

      // 检测分类标题行：【xxx】
      const catMatch = line.match(/^【(.+)】$/);
      if (catMatch) {
        currentCategory = catMatch[1] === '未分类' ? '' : catMatch[1];
        continue;
      }

      let type: Card['type'] = 'text';
      let content = line;
      if (line.startsWith('[拍一拍] ')) {
        type = 'nudge';
        content = line.slice(6);
      }
      if (!content) continue;

      // 查重
      const exists = await db.cards.where({ type, content }).first();
      if (!exists) {
        await db.cards.add({ type, content, category: currentCategory, createdAt: Date.now(), updatedAt: Date.now() });
        count++;
      } else {
        skipped++;
      }
    }
    setCardImportMsg(`已导入 ${count} 条字卡（跳过 ${skipped} 条重复）`);
    setCardTextImport('');
    estimateModuleSizes().then(setModuleSizes);
  }, [cardTextImport]);

  // 文字数据交换：导出
  const handleExchangeExport = useCallback(async (type: DataType) => {
    const text = await exportTextData(type);
    setExchangeExport(text);
    setExchangeMsg(null);
  }, []);

  // 全选导出文本（不复制，用户自行长按复制）
  const exchangePreRef = useRef<HTMLPreElement>(null);
  const handleSelectAllExchange = useCallback(() => {
    if (!exchangePreRef.current) return;
    const range = document.createRange();
    range.selectNodeContents(exchangePreRef.current);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  // 文字数据交换：导入
  const handleExchangeImport = useCallback(async () => {
    if (!exchangeImport.trim()) return;
    const result = await importTextData(exchangeType, exchangeImport);
    setExchangeMsg(`已导入 ${result.count} 条（跳过 ${result.skipped} 条重复）`);
    setExchangeImport('');
    estimateModuleSizes().then(setModuleSizes);
  }, [exchangeType, exchangeImport]);

  // 点击清理按钮：先统计
  const handleCleanupCheck = useCallback(async (days: number) => {
    setCleanupDone(false);
    setCleanupDays(days);
    setCleanupCounting(true);
    setCleanupCount(null);
    try {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const count = await db.chatMessages.where('timestamp').below(cutoff).count();
      setCleanupCount(count);
    } catch (err) {
      console.error('Cleanup count failed:', err);
      setCleanupDays(null);
    } finally {
      setCleanupCounting(false);
    }
  }, []);

  // 确认删除
  const handleCleanupConfirm = useCallback(async () => {
    if (cleanupDays == null) return;
    setCleanupDeleting(true);
    try {
      const cutoff = Date.now() - cleanupDays * 24 * 60 * 60 * 1000;
      await db.chatMessages.where('timestamp').below(cutoff).delete();
      setCleanupDone(true);
      setCleanupDays(null);
      setCleanupCount(null);
    } catch (err) {
      console.error('Cleanup failed:', err);
    } finally {
      setCleanupDeleting(false);
    }
  }, [cleanupDays]);

  // 取消清理
  const handleCleanupCancel = useCallback(() => {
    setCleanupDays(null);
    setCleanupCount(null);
    setCleanupDone(false);
  }, []);

  // 加载各模块大小
  useEffect(() => {
    estimateModuleSizes().then(setModuleSizes);
  }, []);

  // 导出
  const toggleExport = (key: string) => {
    setExportSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleExport = async () => {
    if (exportSelected.size === 0) return;

    // 检查总大小，超过 10MB 提示用户去掉图片/音频模块
    const sizes = await estimateModuleSizes();
    let totalSize = 0;
    for (const key of exportSelected) {
      totalSize += sizes[key] || 0;
    }
    const SIZE_LIMIT = 10 * 1024 * 1024; // 10MB
    if (totalSize > SIZE_LIMIT) {
      const sizeStr = formatSize(totalSize);
      const hasCards = exportSelected.has('cards');
      const hasSoundTracks = exportSelected.has('soundTracks');
      let tip = `导出数据约 ${sizeStr}，可能超出当前环境内存限制导致闪退。\n\n`;
      if (hasCards || hasSoundTracks) {
        tip += '建议先取消勾选"字卡库"和"白噪音音乐库"（它们包含图片和音频，体积较大），\n';
        tip += '这两个模块可单独用文字导出功能备份。\n\n';
      }
      tip += '确定要继续导出吗？';
      if (!confirm(tip)) return;
    }

    setExporting(true);
    try {
      const data = await exportModules(Array.from(exportSelected));
      const now = new Date();
      const filename = `zika-backup-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.json`;
      const result = await downloadJson(data, filename);
      if (!result.success) {
        // 分享不可用 → 展示 JSON 文本让用户手动复制
        setExportJsonText(result.jsonStr);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('导出失败：数据过大或环境不支持。\n\n建议减少选中模块，或将字卡库、白噪音改用文字导出。');
    } finally {
      setExporting(false);
    }
  };

  // 导入
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = parseImportData(reader.result as string);
      if (!result) {
        setImportMsg({ type: 'error', text: '文件格式不正确，无法解析' });
        return;
      }
      setImportData(result.data);
      setImportPreview(result.preview);
      setImportSelected(new Set(result.preview.map(p => p.key)));
    };
    reader.onerror = () => {
      setImportMsg({ type: 'error', text: '文件读取失败' });
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const toggleImport = (key: string) => {
    setImportSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleImport = async () => {
    if (!importData || importSelected.size === 0) return;
    setImporting(true);
    setImportMsg(null);
    try {
      await importModules(importData as { version: string; exportedAt: string; modules: Record<string, unknown> }, Array.from(importSelected));
      setImportMsg({ type: 'success', text: `已成功导入 ${importSelected.size} 个模块的数据` });
      setImportPreview(null);
      setImportData(null);
      // 刷新大小显示
      estimateModuleSizes().then(setModuleSizes);
    } catch (err) {
      console.error('Import failed:', err);
      setImportMsg({ type: 'error', text: '导入失败，请重试' });
    } finally {
      setImporting(false);
    }
  };

  const handleCancelImport = () => {
    setImportPreview(null);
    setImportData(null);
    setImportMsg(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // 全选 JSON 导出文本
  const handleSelectAllExportJson = useCallback(() => {
    if (!exportJsonPreRef.current) return;
    const range = document.createRange();
    range.selectNodeContents(exportJsonPreRef.current);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  // 粘贴 JSON 导入
  const handleImportJsonText = useCallback(async () => {
    if (!importJsonText.trim()) return;
    setImportJsonMsg(null);
    const result = parseImportData(importJsonText);
    if (!result) {
      setImportJsonMsg({ type: 'error', text: 'JSON 格式不正确，无法解析' });
      return;
    }
    setImportData(result.data);
    setImportPreview(result.preview);
    setImportSelected(new Set(result.preview.map(p => p.key)));
    setImportJsonText('');
    setImportJsonMsg({ type: 'success', text: `已解析，${result.preview.length} 个模块可导入，请在下方勾选并确认导入` });
  }, [importJsonText]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/profile')}>← 返回</button>
        <span className={styles.title}>数据管理</span>
        <div className={styles.spacer} />
      </header>
      <div className={styles.body}>
        {/* 存储说明 */}
        <div className={styles.infoCard}>
          <h4 className={styles.infoTitle}>存储说明</h4>
          <p className={styles.infoText}>
            所有数据存储在手机浏览器的 IndexedDB 中，<strong>不会被浏览器自动清理</strong>。
            聊天记录不会偷偷消失。纯文本数据占用极小，图片和音频是主要占用来源，
            建议定期清理不用的表情包和白噪音。
          </p>
        </div>

        {/* 导出区 */}
        <div className="card" style={{ marginBottom: '12px' }}>
          <h3 className={styles.sectionTitle}>导出数据</h3>
          <p className={styles.sectionHint}>选择要导出的模块，点击下载 JSON 备份文件</p>

          <div className={styles.moduleList}>
            {EXPORT_MODULES.map(mod => (
              <label key={mod.key} className={styles.moduleItem}>
                <input
                  type="checkbox"
                  checked={exportSelected.has(mod.key)}
                  onChange={() => toggleExport(mod.key)}
                  className={styles.checkbox}
                />
                <div className={styles.moduleInfo}>
                  <span className={styles.moduleLabel}>{mod.label}</span>
                  <span className={styles.moduleDesc}>
                    {mod.description}
                    {moduleSizes[mod.key] !== undefined && ` · ${formatSize(moduleSizes[mod.key])}`}
                  </span>
                </div>
              </label>
            ))}
          </div>

          <button
            className={styles.primaryBtn}
            onClick={handleExport}
            disabled={exportSelected.size === 0 || exporting}
          >
            {exporting ? '导出中...' : '导出选中模块'}
          </button>
        </div>

        {/* JSON 导出弹窗 — 分享 API 不可用时展示 */}
        {exportJsonText != null && (
          <div className={styles.modalOverlay} onClick={() => setExportJsonText(null)}>
            <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
              <p className={styles.sectionHint} style={{ marginBottom: '8px' }}>
                全选复制以下 JSON 内容，粘贴到备忘录或文件中保存
              </p>
              <pre ref={exportJsonPreRef} className={styles.textExportPre} style={{ maxHeight: '50vh' }}>
                {exportJsonText}
              </pre>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button className={styles.primaryBtn} style={{ flex: 1 }} onClick={handleSelectAllExportJson}>
                  全选
                </button>
                <button className={styles.cancelBtn} onClick={() => setExportJsonText(null)}>
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 导入区 */}
        <div className="card">
          <h3 className={styles.sectionTitle}>导入数据</h3>
          <p className={styles.sectionHint}>选择之前导出的 JSON 备份文件，合并导入数据（不会覆盖已有内容）</p>

          {!importPreview ? (
            <>
              <button
                className={styles.outlineBtn}
                onClick={() => fileRef.current?.click()}
              >
                选择备份文件
              </button>

              {/* 粘贴 JSON 导入 */}
              <div style={{ marginTop: '12px' }}>
                <p className={styles.sectionHint} style={{ marginBottom: '6px' }}>
                  或粘贴 JSON 备份内容直接导入
                </p>
                <textarea
                  className={styles.textImportArea}
                  value={importJsonText}
                  onChange={e => { setImportJsonText(e.target.value); setImportJsonMsg(null); }}
                  placeholder="将之前导出的 JSON 全文粘贴到这里..."
                  rows={5}
                />
                <button
                  className={styles.primaryBtn}
                  style={{ marginTop: '8px' }}
                  onClick={handleImportJsonText}
                  disabled={!importJsonText.trim()}
                >
                  解析粘贴内容
                </button>
                {importJsonMsg && (
                  <p className={`${styles.importMsg} ${importJsonMsg.type === 'success' ? styles.msgSuccess : styles.msgError}`}>
                    {importJsonMsg.text}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className={styles.importPreviewArea}>
              <p className={styles.sectionHint}>
                文件导出时间：{new Date((importData as { exportedAt: string }).exportedAt).toLocaleString()}
              </p>
              <div className={styles.moduleList}>
                {importPreview.map(mod => (
                  <label key={mod.key} className={styles.moduleItem}>
                    <input
                      type="checkbox"
                      checked={importSelected.has(mod.key)}
                      onChange={() => toggleImport(mod.key)}
                      className={styles.checkbox}
                    />
                    <div className={styles.moduleInfo}>
                      <span className={styles.moduleLabel}>{mod.label}</span>
                      <span className={styles.moduleDesc}>{mod.count} 条 · {mod.size}</span>
                    </div>
                  </label>
                ))}
              </div>
              <div className={styles.importActions}>
                <button
                  className={styles.primaryBtn}
                  onClick={handleImport}
                  disabled={importSelected.size === 0 || importing}
                >
                  {importing ? '导入中...' : '确认导入'}
                </button>
                <button className={styles.cancelBtn} onClick={handleCancelImport}>
                  取消
                </button>
              </div>
            </div>
          )}

          {importMsg && (
            <p className={`${styles.importMsg} ${importMsg.type === 'success' ? styles.msgSuccess : styles.msgError}`}>
              {importMsg.text}
            </p>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>

        {/* 字卡文本导出/导入 */}
        <div className="card" style={{ marginTop: '12px' }}>
          <h3 className={styles.sectionTitle}>字卡文本导出 / 导入</h3>
          <p className={styles.sectionHint}>按分类导出文字和拍一拍，全选后可手动复制；导入时支持【分类名】标题行自动归类</p>

          {/* 导出 */}
          <button
            className={styles.outlineBtn}
            style={{ marginBottom: cardTextExport != null ? '8px' : '12px' }}
            onClick={handleCardTextExport}
          >
            导出字卡文本
          </button>

          {cardTextExport != null && (
            <div style={{ marginBottom: '12px' }}>
              <pre ref={cardPreRef} className={styles.textExportPre}>
                {cardTextExport || '（暂无字卡）'}
              </pre>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  className={styles.primaryBtn}
                  style={{ flex: 1 }}
                  onClick={handleSelectAllCard}
                >
                  全选
                </button>
                <button
                  className={styles.cancelBtn}
                  onClick={() => setCardTextExport(null)}
                >
                  收起
                </button>
              </div>
            </div>
          )}

          {/* 导入 */}
          <textarea
            className={styles.textImportArea}
            value={cardTextImport}
            onChange={e => { setCardTextImport(e.target.value); setCardImportMsg(null); }}
            placeholder="在此粘贴字卡文本，每行一条&#10;拍一拍请加 [拍一拍] 前缀&#10;支持【分类名】标题行自动归类"
            rows={4}
          />
          <button
            className={styles.primaryBtn}
            style={{ marginTop: '8px' }}
            onClick={handleCardTextImport}
            disabled={!cardTextImport.trim()}
          >
            导入文本为字卡
          </button>
          {cardImportMsg && (
            <p className={`${styles.importMsg} ${cardImportMsg.includes('失败') ? styles.msgError : styles.msgSuccess}`}>
              {cardImportMsg}
            </p>
          )}
        </div>

        {/* 文字数据交换（6种纯文字数据） */}
        <div className="card" style={{ marginTop: '12px' }}>
          <h3 className={styles.sectionTitle}>文字数据导出 / 导入</h3>
          <p className={styles.sectionHint}>选择数据类型，导出为可读文本保存到备忘录；支持相同格式导入回来</p>

          {/* 类型选择 */}
          <div className={styles.cleanupButtons} style={{ marginBottom: '10px' }}>
            {(Object.entries(DATA_TYPE_META) as [DataType, typeof DATA_TYPE_META[DataType]][]).map(([key, meta]) => (
              <button
                key={key}
                className={styles.cleanupBtn}
                style={exchangeType === key ? { background: 'var(--color-accent-soft)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' } : undefined}
                onClick={() => { setExchangeType(key); setExchangeExport(null); setExchangeImport(''); setExchangeMsg(null); }}
              >
                {meta.label}
              </button>
            ))}
          </div>

          <p className={styles.sectionHint}>{DATA_TYPE_META[exchangeType].desc}</p>

          {/* 导出 */}
          <button
            className={styles.outlineBtn}
            style={{ marginBottom: exchangeExport != null ? '8px' : '12px' }}
            onClick={() => handleExchangeExport(exchangeType)}
          >
            导出{DATA_TYPE_META[exchangeType].label}
          </button>

          {exchangeExport != null && (
            <div style={{ marginBottom: '12px' }}>
              <pre ref={exchangePreRef} className={styles.textExportPre}>
                {exchangeExport || '（暂无数据）'}
              </pre>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  className={styles.primaryBtn}
                  style={{ flex: 1 }}
                  onClick={handleSelectAllExchange}
                >
                  全选
                </button>
                <button
                  className={styles.cancelBtn}
                  onClick={() => setExchangeExport(null)}
                >
                  收起
                </button>
              </div>
            </div>
          )}

          {/* 导入 */}
          <textarea
            className={styles.textImportArea}
            value={exchangeImport}
            onChange={e => { setExchangeImport(e.target.value); setExchangeMsg(null); }}
            placeholder={exchangeType === 'periodMessages' ? '每行一条安慰语句，如：\n多喝热水呀\n别难过，有我在' :
              exchangeType === 'stickyNotes' ? '每行一条便签，如：\n今天记得买水果\n明天要开会' :
              exchangeType === 'anniversaries' ? '每行一条，格式：名称 | 日期 | 类型\n如：第一次见面 | 2024-01-15 | 正数日\n类型：正数日 / 倒数日 / 每年同日' :
              exchangeType === 'moodTags' ? '每行一条，格式：[分类] 标签名\n如：[我的] 开心\n分类：我的 / 他的 / 通用' :
              exchangeType === 'todoItems' ? '第一行：总完成：N，后面每行一条待办\n完成的加 ✓，如：\n总完成：42\n【学习】背单词\n【生活】买菜 ✓' :
              exchangeType === 'encouragementMessages' ? '每行一条，格式：[场景-开始/结束] 语句\n如：[学习-开始] 一起加油吧\n场景：学习 / 吃饭 / 睡眠 / 其他' :
              exchangeType === 'letters' ? '每行一条书信，格式：[时间] 写/回：内容\n如：[2024-01-15 14:30] 写：想你啦\n[2024-01-15 14:35] 回：我也想你' :
              exchangeType === 'companionRecords' ? '每行一条陪伴记录\n格式：[时间] 场景 | 模式 | 目标 | 实际 | 状态\n如：[2024-01-15 14:30] 学习 | 倒计时 | 目标60分 | 实际45分 | 已完成' :
              '每行一条每日记录\n格式：[日期] 纸条：xxx；xxx | 他说：xxx | 标签：xxx\n如：[2024-01-15] 纸条：开心的一天；想你了 | 他说：我也想你 | 标签：开心, 想念'}
            rows={4}
          />
          <button
            className={styles.primaryBtn}
            style={{ marginTop: '8px' }}
            onClick={handleExchangeImport}
            disabled={!exchangeImport.trim()}
          >
            导入为{DATA_TYPE_META[exchangeType].label}
          </button>
          {exchangeMsg && (
            <p className={`${styles.importMsg} ${exchangeMsg.includes('失败') ? styles.msgError : styles.msgSuccess}`}>
              {exchangeMsg}
            </p>
          )}
        </div>

        {/* 清理聊天记录 */}
        <div className="card" style={{ marginTop: '12px' }}>
          <h3 className={styles.sectionTitle}>清理聊天记录</h3>
          <p className={styles.sectionHint}>删除指定天数前的聊天消息，释放存储空间。操作不可恢复，请先导出备份。</p>

          <div className={styles.cleanupButtons}>
            {CLEANUP_OPTIONS.map(opt => (
              <button
                key={opt.days}
                className={styles.cleanupBtn}
                onClick={() => handleCleanupCheck(opt.days)}
                disabled={cleanupCounting || cleanupDeleting}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 统计中 */}
          {cleanupCounting && (
            <p className={styles.cleanupHint}>正在统计...</p>
          )}

          {/* 确认对话框 */}
          {cleanupDays != null && cleanupCount != null && !cleanupCounting && (
            <div className={styles.cleanupConfirm}>
              <p className={styles.cleanupConfirmText}>
                {cleanupCount > 0
                  ? `将删除 ${cleanupCount} 条 ${cleanupDays} 天前的聊天记录，确定吗？`
                  : `没有 ${cleanupDays} 天前的聊天记录。`}
              </p>
              {cleanupCount > 0 && (
                <div className={styles.cleanupConfirmActions}>
                  <button
                    className={styles.cleanupDangerBtn}
                    onClick={handleCleanupConfirm}
                    disabled={cleanupDeleting}
                  >
                    {cleanupDeleting ? '删除中...' : '确认删除'}
                  </button>
                  <button
                    className={styles.cancelBtn}
                    onClick={handleCleanupCancel}
                    disabled={cleanupDeleting}
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 完成提示 */}
          {cleanupDone && (
            <p className={styles.cleanupSuccess}>聊天记录已清理完成。</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default DataManagePage;

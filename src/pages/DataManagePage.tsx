import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { EXPORT_MODULES, exportModules, downloadJson, estimateModuleSizes, formatSize } from '../utils/exportData';
import { parseImportData, importModules } from '../utils/importData';
import { db } from '../db';
import type { ImportPreview } from '../utils/importData';
import { DATA_TYPE_META, DATA_CATEGORIES, exportTextData, importTextData, type DataType } from '../utils/textDataExchange';
import { getActiveDatesInRange } from '../utils/activeDays';
import {
  saveCloudConfig, getCloudConfig, getLastBackupTime, getLastBackupError,
  backupToCloud, listCloudBackups, restoreFromCloud, type CloudBackupInfo,
  getCloudBackupIntervalMin, saveCloudBackupIntervalMin, CLOUD_INTERVAL_OPTIONS,
} from '../utils/cloudBackup';
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

  // ===== JSON 导出状态 =====
  const [exportSelected, setExportSelected] = useState<Set<string>>(new Set(EXPORT_MODULES.map(m => m.key)));
  const [moduleSizes, setModuleSizes] = useState<Record<string, number>>({});
  const [exporting, setExporting] = useState(false);
  const [exportJsonText, setExportJsonText] = useState<string | null>(null);
  const exportJsonPreRef = useRef<HTMLPreElement>(null);

  // ===== JSON 导入状态 =====
  const [importPreview, setImportPreview] = useState<ImportPreview[] | null>(null);
  const [importData, setImportData] = useState<unknown>(null);
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importJsonText, setImportJsonText] = useState('');
  const [importJsonMsg, setImportJsonMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ===== 清理聊天记录状态 =====
  const [cleanupDays, setCleanupDays] = useState<number | null>(null);
  const [cleanupCount, setCleanupCount] = useState<number | null>(null);
  const [cleanupCounting, setCleanupCounting] = useState(false);
  const [cleanupDeleting, setCleanupDeleting] = useState(false);
  const [cleanupDone, setCleanupDone] = useState(false);

  // ===== 文字数据交换 =====
  const [exchangeType, setExchangeType] = useState<DataType>('cardText');
  const [exchangeExport, setExchangeExport] = useState<string | null>(null);
  const [exchangeImport, setExchangeImport] = useState('');
  const [exchangeMsg, setExchangeMsg] = useState<string | null>(null);

  // ===== 云备份 =====
  const [cloudConfigOpen, setCloudConfigOpen] = useState(false);
  const [cloudUser, setCloudUser] = useState('');
  const [cloudRepoName, setCloudRepoName] = useState('zika-backup');
  const [cloudToken, setCloudToken] = useState('');
  const [cloudConfigured, setCloudConfigured] = useState(false);
  const [cloudLastAt, setCloudLastAt] = useState<number | null>(null);
  const [cloudLastErr, setCloudLastErr] = useState<string | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudMsg, setCloudMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [restoreList, setRestoreList] = useState<CloudBackupInfo[] | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [cloudIntervalMin, setCloudIntervalMin] = useState(720);

  // ===== 清理历史脏标签状态 =====
  const [tagCleanupCount, setTagCleanupCount] = useState<number | null>(null);
  const [tagCleanupCounting, setTagCleanupCounting] = useState(false);
  const [tagCleanupDeleting, setTagCleanupDeleting] = useState(false);
  const [tagCleanupDone, setTagCleanupDone] = useState(false);

  // 加载云备份配置和状态
  useEffect(() => {
    (async () => {
      const config = await getCloudConfig();
      if (config) {
        const [owner, name] = config.repo.split('/');
        setCloudUser(owner ?? '');
        setCloudRepoName(name ?? '');
        setCloudToken(config.token);
        setCloudConfigured(true);
      }
      setCloudLastAt(await getLastBackupTime());
      setCloudLastErr(await getLastBackupError());
      setCloudIntervalMin(await getCloudBackupIntervalMin());
    })();
  }, []);

  // 自动备份成功后刷新"上次备份"时间显示
  useEffect(() => {
    const onBackupDone = async () => {
      setCloudLastAt(await getLastBackupTime());
      setCloudLastErr(null);
    };
    window.addEventListener('zika:cloudBackupDone', onBackupDone);
    return () => window.removeEventListener('zika:cloudBackupDone', onBackupDone);
  }, []);

  // 加载各模块大小
  useEffect(() => {
    estimateModuleSizes().then(setModuleSizes);
  }, []);

  // ========== JSON 导出 ==========

  const toggleExport = (key: string) => {
    setExportSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleExport = async () => {
    if (exportSelected.size === 0) return;

    // 检查总大小
    const sizes = await estimateModuleSizes();
    let totalSize = 0;
    for (const key of exportSelected) {
      totalSize += sizes[key] || 0;
    }
    const SIZE_LIMIT = 10 * 1024 * 1024;
    if (totalSize > SIZE_LIMIT) {
      const sizeStr = formatSize(totalSize);
      let tip = `导出数据约 ${sizeStr}，可能超出当前环境内存限制导致闪退。\n\n`;
      tip += '建议先取消勾选"表情包"和"白噪音音乐库"（包含图片和音频，体积较大）。\n\n';
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
        setExportJsonText(result.jsonStr);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('导出失败：数据过大或环境不支持。\n\n建议减少选中模块。');
    } finally {
      setExporting(false);
    }
  };

  const handleSelectAllExportJson = useCallback(() => {
    if (!exportJsonPreRef.current) return;
    const range = document.createRange();
    range.selectNodeContents(exportJsonPreRef.current);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  // ========== JSON 导入 ==========

  /** 解析 JSON 并展示预览 */
  const showImportPreview = useCallback((jsonStr: string) => {
    const result = parseImportData(jsonStr);
    if (!result) {
      setImportJsonMsg({ type: 'error', text: 'JSON 格式不正确，无法解析' });
      return;
    }
    setImportData(result.data);
    setImportPreview(result.preview);
    setImportSelected(new Set(result.preview.map(p => p.key)));
    setImportJsonText('');
    setImportJsonMsg({ type: 'success', text: `已解析，${result.preview.length} 个模块可导入，请在下方勾选并确认导入` });
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportMsg(null);
    setImportJsonMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      showImportPreview(reader.result as string);
    };
    reader.onerror = () => {
      setImportJsonMsg({ type: 'error', text: '文件读取失败' });
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const handleImportJsonText = useCallback(() => {
    if (!importJsonText.trim()) return;
    setImportMsg(null);
    showImportPreview(importJsonText);
  }, [importJsonText, showImportPreview]);

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
    setImportJsonMsg(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ========== 清理聊天记录 ==========

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

  const handleCleanupCancel = useCallback(() => {
    setCleanupDays(null);
    setCleanupCount(null);
    setCleanupDone(false);
  }, []);

  // ========== 清理历史脏标签 ==========

  /** 找出历史脏标签：过去日期、有他的标签、用户没写过任何内容（纸条/标签/留言都没有）、且你当天没来过 */
  const findDirtyTagRecords = useCallback(async () => {
    const today = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const all = await db.dailyRecords.toArray();
    const candidates = all.filter(r =>
      r.date < today &&
      r.partnerMoodTag &&
      !(r.userNotes && r.userNotes.length > 0) &&
      !(r.userMoodTags && r.userMoodTags.length > 0) &&
      !r.partnerNote,
    );
    if (candidates.length === 0) return candidates;
    // 你当天来过（有打开网站/聊天/陪伴/写信痕迹）的日子，他的状态是合理的，不清
    const dates = candidates.map(r => r.date).sort();
    const activeSet = await getActiveDatesInRange(dates[0], today);
    return candidates.filter(r => !activeSet.has(r.date));
  }, []);

  const handleTagCleanupCheck = useCallback(async () => {
    setTagCleanupDone(false);
    setTagCleanupCounting(true);
    setTagCleanupCount(null);
    try {
      const dirty = await findDirtyTagRecords();
      setTagCleanupCount(dirty.length);
    } catch (err) {
      console.error('Tag cleanup count failed:', err);
    } finally {
      setTagCleanupCounting(false);
    }
  }, [findDirtyTagRecords]);

  const handleTagCleanupConfirm = useCallback(async () => {
    setTagCleanupDeleting(true);
    try {
      const dirty = await findDirtyTagRecords();
      for (const r of dirty) {
        await db.dailyRecords.update(r.id!, { partnerMoodTag: '', partnerMoodTime: 0 });
      }
      setTagCleanupDone(true);
      setTagCleanupCount(null);
    } catch (err) {
      console.error('Tag cleanup failed:', err);
    } finally {
      setTagCleanupDeleting(false);
    }
  }, [findDirtyTagRecords]);

  const handleTagCleanupCancel = useCallback(() => {
    setTagCleanupCount(null);
    setTagCleanupDone(false);
  }, []);

  /** 切换云备份间隔 */
  const handleCloudIntervalChange = useCallback(async (minutes: number) => {
    setCloudIntervalMin(minutes);
    await saveCloudBackupIntervalMin(minutes);
  }, []);

  // ========== 文字数据交换 ==========

  const handleExchangeExport = useCallback(async (type: DataType) => {
    const text = await exportTextData(type);
    setExchangeExport(text);
    setExchangeMsg(null);
  }, []);

  const exchangePreRef = useRef<HTMLPreElement>(null);
  const handleSelectAllExchange = useCallback(() => {
    if (!exchangePreRef.current) return;
    const range = document.createRange();
    range.selectNodeContents(exchangePreRef.current);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  const handleExchangeImport = useCallback(async () => {
    if (!exchangeImport.trim()) return;
    const result = await importTextData(exchangeType, exchangeImport);
    setExchangeMsg(`已导入 ${result.count} 条（跳过 ${result.skipped} 条）`);
    setExchangeImport('');
  }, [exchangeType, exchangeImport]);

  /** 根据当前选中类型生成 placeholder */
  const getImportPlaceholder = (type: DataType): string => {
    switch (type) {
      case 'cardText':
        return '每行一条字卡，拍一拍加 [拍一拍] 前缀\n支持【分类名】标题行自动归类';
      case 'warmMessages':
        return '每行一条，格式：[阶段] 留言内容\n如：[经期] 多喝热水呀\n阶段：经期 / 卵泡期 / 排卵期 / 黄体期 / 通用';
      case 'encouragementMessages':
        return '每行一条，格式：[场景-开始/结束] 语句\n如：[学习-开始] 一起加油吧\n场景：学习 / 吃饭 / 睡眠 / 其他';
      case 'companionRecords':
        return '每行一条陪伴记录\n格式：[时间] 场景 | 模式 | 目标 | 实际 | 状态\n如：[2024-01-15 14:30] 学习 | 倒计时 | 目标60分 | 实际45分 | 已完成';
      case 'todoItems':
        return '第一行：总完成：N，后面每行一条待办\n完成的加 ✓，如：\n总完成：42\n【学习】背单词\n【生活】买菜 ✓';
      case 'dailyRecords':
        return '每行一条每日记录\n格式：[日期] 纸条：xxx；xxx | 他说：xxx | 我的标签：xxx | 他的标签：xxx\n如：[2024-01-15] 纸条：开心；想你了 | 他说：我也想你 | 我的标签：开心, 想念 | 他的标签：温柔';
      case 'periodRecords':
        return '每行一条，格式：开始日~结束日 | 备注\n如：2024-01-15 ~ 2024-01-20 | 这次比较短';
      case 'periodMessages':
        return '每行一条安慰语句，如：\n多喝热水呀\n别难过，有我在';
      case 'letters':
        return '每行一条书信\n用户写的信：[时间] 写：内容\n回信紧跟下一行：[时间] 回：内容\n系统来信：[时间] 来信：内容\n如：[2024-01-15 14:30] 写：想你啦\n[2024-01-15 14:35] 回：我也想你\n[2024-01-16 09:00] 来信：今天天气真好';
      case 'anniversaries':
        return '每行一条，格式：名称 | 日期 | 类型\n如：第一次见面 | 2024-01-15 | 正数日\n类型：正数日 / 倒数日 / 每年同日';
      case 'stickyNotes':
        return '每行一条便签，如：\n今天记得买水果\n明天要开会';
      case 'moodTags':
        return '每行一条，格式：[分类] 标签名\n如：[我的] 开心\n分类：我的 / 他的 / 通用';
    }
  };

  // ========== 云备份 ==========

  const handleSaveCloudConfig = async () => {
    if (!cloudUser.trim() || !cloudRepoName.trim() || !cloudToken.trim()) {
      setCloudMsg({ type: 'error', text: '请填写 GitHub 用户名、仓库名和令牌' });
      return;
    }
    await saveCloudConfig({
      repo: `${cloudUser.trim()}/${cloudRepoName.trim()}`,
      token: cloudToken.trim(),
    });
    setCloudConfigured(true);
    setCloudConfigOpen(false);
    setCloudMsg({ type: 'success', text: '云备份设置已保存' });
  };

  const handleCloudBackup = async () => {
    if (cloudBusy) return;
    setCloudBusy(true);
    setCloudMsg(null);
    const result = await backupToCloud();
    setCloudMsg({ type: result.ok ? 'success' : 'error', text: result.message });
    if (result.ok) {
      setCloudLastAt(await getLastBackupTime());
      setCloudLastErr(null);
    }
    setCloudBusy(false);
  };

  const handleOpenRestoreList = async () => {
    if (cloudBusy) return;
    setCloudBusy(true);
    setCloudMsg(null);
    try {
      const list = await listCloudBackups();
      if (list.length === 0) {
        setCloudMsg({ type: 'error', text: '云端还没有备份，请先点「立即备份到云端」' });
      } else {
        setRestoreList(list);
      }
    } catch (err) {
      setCloudMsg({ type: 'error', text: err instanceof Error ? err.message : '获取云端备份列表失败' });
    }
    setCloudBusy(false);
  };

  const handleConfirmRestore = async (name: string) => {
    if (restoreLoading) return;
    const ok = confirm(
      `确定要从云端恢复这个备份吗？\n\n${formatBackupName(name)}\n\n恢复会覆盖当前应用里的全部数据，且不可撤销。`,
    );
    if (!ok) return;
    setRestoreLoading(true);
    const result = await restoreFromCloud(name);
    if (result.ok) {
      alert('已从云端恢复完成，即将重新打开应用');
      window.location.reload();
    } else {
      setCloudMsg({ type: 'error', text: result.message });
      setRestoreLoading(false);
    }
  };

  /** 把备份文件名转成可读时间，如 backup-20260903-143000.json.gz → 2026-09-03 14:30:00 */
  function formatBackupName(name: string): string {
    const m = name.match(/backup-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
    if (!m) return name;
    return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/profile')}>← 返回</button>
        <span className={styles.title}>数据管理</span>
        <div className={styles.spacer} />
      </header>
      <div className={styles.body}>

        {/* ==================== 零、云备份 ==================== */}
        <div className="card" style={{ marginBottom: '12px' }}>
          <h3 className={styles.sectionTitle}>云端备份</h3>
          <p className={styles.sectionHint}>
            每 12 小时自动把全部数据备份到你的 GitHub 私有仓库，只有你本人能访问。数据丢失时可一键从云端恢复。
          </p>

          <p className={styles.cloudStatus}>
            上次云备份：{cloudLastAt ? new Date(cloudLastAt).toLocaleString('zh-CN') : '从未备份'}
            {cloudLastErr && cloudConfigured && ` · 上次自动备份失败：${cloudLastErr}`}
          </p>

          <div className={styles.cloudIntervalRow}>
            <span>自动备份间隔</span>
            <select
              className={styles.cloudIntervalSelect}
              value={cloudIntervalMin}
              onChange={e => handleCloudIntervalChange(Number(e.target.value))}
            >
              {CLOUD_INTERVAL_OPTIONS.map(opt => (
                <option key={opt.minutes} value={opt.minutes}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.cloudBtnRow}>
            <button
              className={styles.primaryBtn}
              onClick={handleCloudBackup}
              disabled={!cloudConfigured || cloudBusy}
            >
              {cloudBusy ? '处理中...' : '立即备份到云端'}
            </button>
            <button
              className={styles.outlineBtn}
              onClick={handleOpenRestoreList}
              disabled={!cloudConfigured || cloudBusy}
            >
              从云端恢复
            </button>
          </div>

          <button className={styles.cloudConfigToggle} onClick={() => setCloudConfigOpen(o => !o)}>
            {cloudConfigOpen ? '收起云备份设置' : `云备份设置${cloudConfigured ? '（已配置）' : '（未配置）'}`}
          </button>

          {cloudConfigOpen && (
            <div className={styles.cloudForm}>
              <input
                className={styles.cloudInput}
                value={cloudUser}
                onChange={e => setCloudUser(e.target.value)}
                placeholder="GitHub 用户名"
              />
              <input
                className={styles.cloudInput}
                value={cloudRepoName}
                onChange={e => setCloudRepoName(e.target.value)}
                placeholder="备份仓库名（默认 zika-backup）"
              />
              <input
                className={styles.cloudInput}
                type="password"
                value={cloudToken}
                onChange={e => setCloudToken(e.target.value)}
                placeholder="访问令牌（在 GitHub 设置里生成）"
                autoComplete="off"
              />
              <button className={styles.primaryBtn} onClick={handleSaveCloudConfig}>
                保存设置
              </button>
            </div>
          )}

          {cloudMsg && (
            <p className={`${styles.importMsg} ${cloudMsg.type === 'success' ? styles.msgSuccess : styles.msgError}`}>
              {cloudMsg.text}
            </p>
          )}
        </div>

        {/* 从云端恢复 — 备份列表弹窗 */}
        {restoreList != null && (
          <div className={styles.modalOverlay} onClick={() => { if (!restoreLoading) setRestoreList(null); }}>
            <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
              <p className={styles.sectionHint} style={{ marginBottom: '8px' }}>
                选择要恢复的备份（点击即开始恢复，最新备份在最上面）
              </p>
              <div className={styles.backupList}>
                {restoreList.map(b => (
                  <button
                    key={b.name}
                    className={styles.backupItem}
                    onClick={() => handleConfirmRestore(b.name)}
                    disabled={restoreLoading}
                  >
                    <span>{formatBackupName(b.name)}</span>
                    <span className={styles.backupSize}>{formatSize(b.size)}</span>
                  </button>
                ))}
              </div>
              <button className={styles.cancelBtn} style={{ marginTop: '10px' }} onClick={() => setRestoreList(null)}>
                取消
              </button>
            </div>
          </div>
        )}

        {/* ==================== 一、JSON 导入/导出 ==================== */}
        <div className="card" style={{ marginBottom: '12px' }}>
          <h3 className={styles.sectionTitle}>JSON 导入 / 导出</h3>
          <p className={styles.sectionHint}>
            表情包、白噪音音频、聊天设置（头像/昵称等）、相册照片 —— 这些含图片或音频的数据只能用 JSON 格式备份
          </p>

          {/* ---- 导出 ---- */}
          <p className={styles.subTitle}>导出</p>
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

          {/* ---- 导入 ---- */}
          <div className={styles.sectionDivider} />
          <p className={styles.subTitle}>导入</p>

          {!importPreview ? (
            <>
              <textarea
                className={styles.textImportArea}
                value={importJsonText}
                onChange={e => { setImportJsonText(e.target.value); setImportJsonMsg(null); }}
                placeholder="将之前导出的 JSON 备份内容粘贴到这里..."
                rows={4}
              />
              <div className={styles.jsonImportActions}>
                <button
                  className={styles.primaryBtn}
                  onClick={handleImportJsonText}
                  disabled={!importJsonText.trim()}
                >
                  解析粘贴内容
                </button>
                <button
                  className={styles.outlineBtn}
                  onClick={() => fileRef.current?.click()}
                >
                  选择文件
                </button>
              </div>
              {importJsonMsg && (
                <p className={`${styles.importMsg} ${importJsonMsg.type === 'success' ? styles.msgSuccess : styles.msgError}`}>
                  {importJsonMsg.text}
                </p>
              )}
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

        {/* JSON 导出弹窗 */}
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

        {/* ==================== 二、文字导入/导出 ==================== */}
        <div className="card" style={{ marginBottom: '12px' }}>
          <h3 className={styles.sectionTitle}>文字导入 / 导出</h3>
          <p className={styles.sectionHint}>
            所有纯文字数据按分类整理，导出为可读文本保存；支持相同格式导入回来
          </p>

          {/* 类型选择 — select + optgroup 按5分类 */}
          <select
            className={styles.typeSelect}
            value={exchangeType}
            onChange={e => {
              setExchangeType(e.target.value as DataType);
              setExchangeExport(null);
              setExchangeImport('');
              setExchangeMsg(null);
            }}
          >
            {DATA_CATEGORIES.map(cat => (
              <optgroup key={cat.key} label={cat.label}>
                {(Object.entries(DATA_TYPE_META) as [string, { label: string; desc: string; category: string }][])
                  .filter(([, meta]) => meta.category === cat.key)
                  .map(([key, meta]) => (
                    <option key={key} value={key}>{meta.label}</option>
                  ))}
              </optgroup>
            ))}
          </select>

          <p className={styles.sectionHint} style={{ marginTop: '6px' }}>
            {DATA_TYPE_META[exchangeType].desc}
          </p>

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
                <button className={styles.primaryBtn} style={{ flex: 1 }} onClick={handleSelectAllExchange}>
                  全选
                </button>
                <button className={styles.cancelBtn} onClick={() => setExchangeExport(null)}>
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
            placeholder={getImportPlaceholder(exchangeType)}
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

        {/* ==================== 三、清理聊天记录 ==================== */}
        <div className="card">
          <h3 className={styles.sectionTitle}>清理聊天记录</h3>
          <p className={styles.sectionHint}>删除指定天数前的聊天消息，释放存储空间。操作不可恢复，请先备份。</p>

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

          {cleanupCounting && (
            <p className={styles.cleanupHint}>正在统计...</p>
          )}

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

          {cleanupDone && (
            <p className={styles.cleanupSuccess}>聊天记录已清理完成。</p>
          )}
        </div>

        {/* ==================== 四、清理历史脏标签 ==================== */}
        <div className="card">
          <h3 className={styles.sectionTitle}>清理历史脏标签</h3>
          <p className={styles.sectionHint}>
            早期版本会给没打开过的日期也随机填上"他的标签"。清理后，凡是没写过纸条/没选过标签/没留言的日期，标签都会清空，显示为"那天没有记录他的状态"。你写过内容的日期不会被影响。
          </p>

          {!tagCleanupDone && (
            <button
              className={styles.outlineBtn}
              onClick={handleTagCleanupCheck}
              disabled={tagCleanupCounting || tagCleanupDeleting}
            >
              {tagCleanupCounting ? '正在统计...' : '检查需要清理的日期'}
            </button>
          )}

          {tagCleanupCounting && (
            <p className={styles.cleanupHint}>正在统计...</p>
          )}

          {tagCleanupCount != null && !tagCleanupCounting && (
            <div className={styles.cleanupConfirm}>
              <p className={styles.cleanupConfirmText}>
                {tagCleanupCount > 0
                  ? `将清空 ${tagCleanupCount} 个日期的「他的标签」（不影响你写过内容的日期），确定吗？`
                  : '没有需要清理的日期，很干净。'}
              </p>
              {tagCleanupCount > 0 && (
                <div className={styles.cleanupConfirmActions}>
                  <button
                    className={styles.cleanupDangerBtn}
                    onClick={handleTagCleanupConfirm}
                    disabled={tagCleanupDeleting}
                  >
                    {tagCleanupDeleting ? '清理中...' : '确认清理'}
                  </button>
                  <button
                    className={styles.cancelBtn}
                    onClick={handleTagCleanupCancel}
                    disabled={tagCleanupDeleting}
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          )}

          {tagCleanupDone && (
            <p className={styles.cleanupSuccess}>历史脏标签已清理完成。</p>
          )}
        </div>

      </div>
    </div>
  );
}

export default DataManagePage;

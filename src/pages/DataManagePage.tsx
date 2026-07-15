import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { EXPORT_MODULES, exportModules, downloadJson, estimateModuleSizes, formatSize } from '../utils/exportData';
import { parseImportData, importModules } from '../utils/importData';
import { db } from '../db';
import type { ImportPreview } from '../utils/importData';
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

  // 导入状态
  const [importPreview, setImportPreview] = useState<ImportPreview[] | null>(null);
  const [importData, setImportData] = useState<unknown>(null);
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 清理聊天记录状态
  const [cleanupDays, setCleanupDays] = useState<number | null>(null); // 选中的天数，null=未选
  const [cleanupCount, setCleanupCount] = useState<number | null>(null); // 待清理条数
  const [cleanupCounting, setCleanupCounting] = useState(false);
  const [cleanupDeleting, setCleanupDeleting] = useState(false);
  const [cleanupDone, setCleanupDone] = useState(false);

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
    setExporting(true);
    try {
      const data = await exportModules(Array.from(exportSelected));
      const now = new Date();
      const filename = `zika-backup-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.json`;
      downloadJson(data, filename);
    } catch (err) {
      console.error('Export failed:', err);
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

        {/* 导入区 */}
        <div className="card">
          <h3 className={styles.sectionTitle}>导入数据</h3>
          <p className={styles.sectionHint}>选择之前导出的 JSON 备份文件，合并导入数据（不会覆盖已有内容）</p>

          {!importPreview ? (
            <button
              className={styles.outlineBtn}
              onClick={() => fileRef.current?.click()}
            >
              选择备份文件
            </button>
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

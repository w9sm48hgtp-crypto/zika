import { db } from '../db';

// ===== 云备份 =====
// 把全部数据打包上传到 GitHub 私有仓库，实现自动云端存档
// 配置（令牌/仓库名）存在 settings 表中，不会包含在本地导出文件里

const KEY_TOKEN = 'cloudBackupToken';
const KEY_REPO = 'cloudBackupRepo'; // 格式 owner/repo
const KEY_LAST_AT = 'cloudBackupLastAt'; // 上次成功备份时间戳
const KEY_LAST_ERR = 'cloudBackupLastError'; // 最近一次自动备份失败原因
const KEY_INTERVAL = 'cloudBackupIntervalMin'; // 自动备份间隔（分钟）

/** 自动备份间隔选项（分钟） */
export const CLOUD_INTERVAL_OPTIONS = [
  { label: '5分钟', minutes: 5 },
  { label: '10分钟', minutes: 10 },
  { label: '30分钟', minutes: 30 },
  { label: '1小时', minutes: 60 },
  { label: '2小时', minutes: 120 },
  { label: '6小时', minutes: 360 },
  { label: '12小时', minutes: 720 },
];
/** 默认自动备份间隔：12 小时 */
export const DEFAULT_CLOUD_INTERVAL_MIN = 720;
/** 云端最多保留的备份份数 */
const KEEP_BACKUPS = 10;

const API_BASE = 'https://api.github.com';

export interface CloudConfig {
  repo: string; // 格式 owner/repo
  token: string;
}

/** 全部数据表名（与 db/index.ts 保持一致） */
const ALL_TABLES = [
  'cards', 'chatMessages', 'companionRecords', 'dailyRecords', 'moodTags',
  'letters', 'periodRecords', 'warmMessages', 'soundTracks', 'settings',
  'todoCategories', 'todoItems', 'photoAlbums', 'photos', 'stickyNotes', 'anniversaries',
] as const;

// ===== 配置读写 =====

export async function getCloudConfig(): Promise<CloudConfig | null> {
  const [tokenRow, repoRow] = await Promise.all([
    db.settings.get(KEY_TOKEN),
    db.settings.get(KEY_REPO),
  ]);
  if (!tokenRow?.value || !repoRow?.value) return null;
  return { token: String(tokenRow.value), repo: String(repoRow.value) };
}

export async function saveCloudConfig(config: CloudConfig): Promise<void> {
  await db.settings.put({ key: KEY_TOKEN, value: config.token });
  await db.settings.put({ key: KEY_REPO, value: config.repo.trim() });
}

export async function getLastBackupTime(): Promise<number | null> {
  const row = await db.settings.get(KEY_LAST_AT);
  return typeof row?.value === 'number' ? row.value : null;
}

export async function getLastBackupError(): Promise<string | null> {
  const row = await db.settings.get(KEY_LAST_ERR);
  return row?.value ? String(row.value) : null;
}

/** 读取自动备份间隔（分钟），未设置或非法值用默认 12 小时 */
export async function getCloudBackupIntervalMin(): Promise<number> {
  const row = await db.settings.get(KEY_INTERVAL);
  const v = Number(row?.value);
  return CLOUD_INTERVAL_OPTIONS.some(o => o.minutes === v) ? v : DEFAULT_CLOUD_INTERVAL_MIN;
}

export async function saveCloudBackupIntervalMin(minutes: number): Promise<void> {
  await db.settings.put({ key: KEY_INTERVAL, value: minutes });
}

// ===== GitHub API =====

async function ghRequest(path: string, init: RequestInit = {}, token?: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

/** 把 HTTP 状态码翻译成用户能看懂的中文提示 */
function friendlyError(status: number, repo: string): string {
  switch (status) {
    case 401:
      return '令牌无效，请检查云备份设置';
    case 403:
      return '令牌权限不足，请检查令牌的读写权限';
    case 404:
      return `云端仓库不存在（${repo}），请先创建仓库`;
    case 422:
      return '上传失败：令牌没有写入权限';
    default:
      return `云端请求失败（错误码 ${status}）`;
  }
}

// ===== 二进制编解码 =====

function bytesToBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ===== 压缩（图片音频较多时能大幅缩小体积） =====

async function gzipBytes(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  try {
    if (typeof CompressionStream === 'undefined') return bytes;
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return bytes;
  }
}

async function gunzipIfNeeded(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  // gzip 魔数 1f 8b
  if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }
  return bytes;
}

// ===== 核心逻辑 =====

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function backupFilename(now: Date): string {
  return `backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json.gz`;
}

/** 收集全部表的数据 */
async function collectAllData(): Promise<Record<string, unknown[]>> {
  const data: Record<string, unknown[]> = {};
  for (const name of ALL_TABLES) {
    data[name] = await db.table(name).toArray();
  }
  return data;
}

/** 备份全部数据到云端 */
export async function backupToCloud(): Promise<{ ok: boolean; message: string }> {
  const config = await getCloudConfig();
  if (!config) return { ok: false, message: '尚未配置云备份' };

  try {
    const data = await collectAllData();
    const json = JSON.stringify({
      app: 'zika',
      formatVersion: 1,
      createdAt: new Date().toISOString(),
      tables: data,
    });
    const raw = new TextEncoder().encode(json);
    const compressed = await gzipBytes(raw);
    const content = bytesToBase64(compressed);

    const now = new Date();
    const filename = backupFilename(now);
    const res = await ghRequest(
      `/repos/${config.repo}/contents/backups/${filename}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          message: `字卡云备份 ${now.toLocaleString('zh-CN')}`,
          content,
        }),
      },
      config.token,
    );
    if (!res.ok) return { ok: false, message: friendlyError(res.status, config.repo) };

    await db.settings.put({ key: KEY_LAST_AT, value: Date.now() });
    await db.settings.delete(KEY_LAST_ERR);
    // 通知页面刷新"上次备份"显示
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zika:cloudBackupDone'));
    }
    // 清理旧备份，只保留最近 KEEP_BACKUPS 份
    await pruneOldBackups(config).catch(() => {});
    return { ok: true, message: '已成功备份到云端' };
  } catch (err) {
    console.error('[cloudBackup] backup failed:', err);
    return { ok: false, message: '网络错误，请稍后重试' };
  }
}

/** 删除云端最旧的多余备份 */
async function pruneOldBackups(config: CloudConfig): Promise<void> {
  const res = await ghRequest(`/repos/${config.repo}/contents/backups`, undefined, config.token);
  if (!res.ok) return;
  const list: { name?: string; sha?: string }[] = await res.json();
  if (!Array.isArray(list)) return;
  const backups = list
    .filter(f => f.name?.startsWith('backup-'))
    .sort((a, b) => (b.name ?? '').localeCompare(a.name ?? ''));
  for (const old of backups.slice(KEEP_BACKUPS)) {
    if (!old.name || !old.sha) continue;
    await ghRequest(
      `/repos/${config.repo}/contents/backups/${encodeURIComponent(old.name)}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ message: '清理旧备份', sha: old.sha }),
      },
      config.token,
    ).catch(() => {});
  }
}

export interface CloudBackupInfo {
  name: string;
  size: number;
}

/** 列出云端的所有备份（最新的在最前） */
export async function listCloudBackups(): Promise<CloudBackupInfo[]> {
  const config = await getCloudConfig();
  if (!config) return [];
  const res = await ghRequest(`/repos/${config.repo}/contents/backups`, undefined, config.token);
  if (!res.ok) throw new Error(friendlyError(res.status, config.repo));
  const list: { name?: string; size?: number }[] = await res.json();
  if (!Array.isArray(list)) return [];
  return list
    .filter(f => f.name?.startsWith('backup-'))
    .map(f => ({ name: f.name ?? '', size: f.size ?? 0 }))
    .sort((a, b) => b.name.localeCompare(a.name));
}

/** 从云端恢复指定备份（覆盖式：清空当前数据后写入备份内容） */
export async function restoreFromCloud(name: string): Promise<{ ok: boolean; message: string }> {
  const config = await getCloudConfig();
  if (!config) return { ok: false, message: '尚未配置云备份' };

  try {
    // 先记住当前云备份配置，恢复后写回（避免被备份里的旧配置覆盖）
    const currentConfig = await getCloudConfig();

    const res = await ghRequest(
      `/repos/${config.repo}/contents/backups/${encodeURIComponent(name)}`,
      undefined,
      config.token,
    );
    if (!res.ok) return { ok: false, message: friendlyError(res.status, config.repo) };
    const file: { content?: string } = await res.json();
    if (!file.content) return { ok: false, message: '备份文件为空' };

    const bytes = base64ToBytes(String(file.content).replace(/\s/g, ''));
    const decompressed = await gunzipIfNeeded(bytes);
    const parsed = JSON.parse(new TextDecoder().decode(decompressed));
    const tables = parsed?.tables;
    if (!tables || typeof tables !== 'object') return { ok: false, message: '备份文件格式不正确' };

    await db.transaction('rw', db.tables, async () => {
      for (const name of ALL_TABLES) {
        const rows = Array.isArray(tables[name]) ? tables[name] : [];
        await db.table(name).clear();
        if (rows.length > 0) await db.table(name).bulkPut(rows as never[]);
      }
    });

    if (currentConfig) await saveCloudConfig(currentConfig);
    await db.settings.put({ key: KEY_LAST_AT, value: Date.now() });
    return { ok: true, message: '已从云端恢复' };
  } catch (err) {
    console.error('[cloudBackup] restore failed:', err);
    return { ok: false, message: '恢复失败，请重试' };
  }
}

/** 打开应用时自动检查：超过设置的间隔没备份就静默上传 */
export async function maybeAutoBackup(): Promise<void> {
  const config = await getCloudConfig();
  if (!config) return;
  const intervalMs = (await getCloudBackupIntervalMin()) * 60 * 1000;
  const lastAt = await getLastBackupTime();
  if (lastAt != null && Date.now() - lastAt < intervalMs) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const result = await backupToCloud();
  if (result.ok) {
    console.log('[cloudBackup] auto backup done');
  } else {
    // 静默失败：记录原因，下次打开时重试
    await db.settings.put({ key: KEY_LAST_ERR, value: result.message });
    console.log('[cloudBackup] auto backup failed:', result.message);
  }
}

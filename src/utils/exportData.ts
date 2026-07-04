import { db } from '../db';

/** 导出数据模块定义 */
export interface ExportModule {
  key: string;
  label: string;
  description: string;
}

export const EXPORT_MODULES: ExportModule[] = [
  { key: 'cards', label: '字卡库', description: '文字字卡、拍一拍、表情包' },
  { key: 'soundTracks', label: '白噪音音乐库', description: '上传的白噪音音频文件' },
  { key: 'periodMessages', label: '生理期安慰语句', description: '经期安慰语句列表' },
  { key: 'chatSettings', label: '聊天设置', description: '头像、昵称、回复延迟、条数、震动等' },
  { key: 'encouragementMessages', label: '陪伴鼓励语句', description: '各场景开始/结束鼓励语句' },
  { key: 'moodTags', label: '状态标签', description: '我的/他的/通用状态标签' },
];

export interface ExportData {
  version: string;
  exportedAt: string;
  modules: Record<string, unknown>;
}

/** 导出指定模块的数据 */
export async function exportModules(moduleKeys: string[]): Promise<ExportData> {
  const modules: Record<string, unknown> = {};

  for (const key of moduleKeys) {
    switch (key) {
      case 'cards': {
        const cards = await db.cards.toArray();
        modules.cards = cards;
        break;
      }
      case 'soundTracks': {
        const tracks = await db.soundTracks.toArray();
        modules.soundTracks = tracks;
        break;
      }
      case 'periodMessages': {
        const row = await db.settings.get('periodMessages');
        modules.periodMessages = row?.value ?? [];
        break;
      }
      case 'chatSettings': {
        const keys = ['userAvatar', 'partnerAvatar', 'partnerName', 'replyDelay',
          'replyCountMin', 'replyCountMax', 'textRatio', 'nudgeRatio', 'stickerRatio',
          'vibrationEnabled'];
        const settings: Record<string, unknown> = {};
        for (const k of keys) {
          const row = await db.settings.get(k);
          settings[k] = row?.value ?? null;
        }
        modules.chatSettings = settings;
        break;
      }
      case 'encouragementMessages': {
        const row = await db.settings.get('encouragementMessages');
        modules.encouragementMessages = row?.value ?? null;
        break;
      }
      case 'moodTags': {
        const tags = await db.moodTags.toArray();
        modules.moodTags = tags;
        break;
      }
    }
  }

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    modules,
  };
}

/** 估算各模块数据大小（字节） */
export async function estimateModuleSizes(): Promise<Record<string, number>> {
  const sizes: Record<string, number> = {};

  const cards = await db.cards.toArray();
  sizes.cards = new Blob([JSON.stringify(cards)]).size;

  const tracks = await db.soundTracks.toArray();
  sizes.soundTracks = new Blob([JSON.stringify(tracks)]).size;

  const pm = await db.settings.get('periodMessages');
  sizes.periodMessages = new Blob([JSON.stringify(pm?.value ?? [])]).size;

  const settingKeys = ['userAvatar', 'partnerAvatar', 'partnerName', 'replyDelay',
    'replyCountMin', 'replyCountMax', 'textRatio', 'nudgeRatio', 'stickerRatio',
    'vibrationEnabled'];
  const settings: Record<string, unknown> = {};
  for (const k of settingKeys) {
    const row = await db.settings.get(k);
    settings[k] = row?.value ?? null;
  }
  sizes.chatSettings = new Blob([JSON.stringify(settings)]).size;

  const em = await db.settings.get('encouragementMessages');
  sizes.encouragementMessages = new Blob([JSON.stringify(em?.value ?? null)]).size;

  const tags = await db.moodTags.toArray();
  sizes.moodTags = new Blob([JSON.stringify(tags)]).size;

  return sizes;
}

/** 格式化字节数为可读字符串 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 触发浏览器下载 */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

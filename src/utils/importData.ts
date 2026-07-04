import { db } from '../db';
import type { ExportData } from './exportData';

export interface ImportPreview {
  key: string;
  label: string;
  count: number;
  size: string;
}

/** 解析导入文件并返回预览信息 */
export function parseImportData(json: string): { data: ExportData; preview: ImportPreview[] } | null {
  try {
    const data: ExportData = JSON.parse(json);
    if (!data.version || !data.modules) {
      return null;
    }

    const preview: ImportPreview[] = [];
    for (const [key, value] of Object.entries(data.modules)) {
      let count = 0;
      let size = '0 B';
      if (Array.isArray(value)) {
        count = value.length;
        size = formatImportSize(new Blob([JSON.stringify(value)]).size);
      } else if (value && typeof value === 'object') {
        count = Object.keys(value).length;
        size = formatImportSize(new Blob([JSON.stringify(value)]).size);
      }
      preview.push({ key, label: getModuleLabel(key), count, size });
    }

    return { data, preview };
  } catch {
    return null;
  }
}

/** 导入指定模块的数据（合并模式） */
export async function importModules(data: ExportData, moduleKeys: string[]): Promise<void> {
  for (const key of moduleKeys) {
    const value = data.modules[key];
    if (value === undefined) continue;

    switch (key) {
      case 'cards': {
        if (!Array.isArray(value)) continue;
        const existing = await db.cards.toArray();
        const existingContents = new Set(existing.map(c => c.content));
        const toAdd = value.filter((c: { content: string }) => !existingContents.has(c.content))
          .map(({ id, ...rest }: { id?: number; type: string; content: string; category?: string; createdAt?: number }) => ({
            type: rest.type,
            content: rest.content,
            category: rest.category,
            createdAt: rest.createdAt || Date.now(),
            updatedAt: Date.now(),
          }));
        if (toAdd.length > 0) await db.cards.bulkAdd(toAdd as any);
        break;
      }
      case 'soundTracks': {
        if (!Array.isArray(value)) continue;
        const existing = await db.soundTracks.toArray();
        const existingNames = new Set(existing.map(t => t.name));
        const toAdd = value.filter((t: { name: string }) => !existingNames.has(t.name))
          .map(({ id, ...rest }: { id?: number; name: string; scene: string; audioData: string; createdAt?: number }) => ({
            name: rest.name,
            scene: rest.scene,
            audioData: rest.audioData,
            createdAt: rest.createdAt || Date.now(),
          }));
        if (toAdd.length > 0) await db.soundTracks.bulkAdd(toAdd as any);
        break;
      }
      case 'periodMessages': {
        if (!Array.isArray(value)) continue;
        const existing = await db.settings.get('periodMessages');
        const existingList: string[] = (existing?.value as string[]) || [];
        const merged = [...new Set([...existingList, ...value])];
        await db.settings.put({ key: 'periodMessages', value: merged });
        break;
      }
      case 'chatSettings': {
        if (!value || typeof value !== 'object') continue;
        const record = value as Record<string, unknown>;
        const keys = ['userAvatar', 'partnerAvatar', 'partnerName', 'replyDelay',
          'replyCountMin', 'replyCountMax', 'textRatio', 'nudgeRatio', 'stickerRatio',
          'vibrationEnabled'];
        for (const k of keys) {
          if (record[k] !== undefined && record[k] !== null) {
            // 头像不覆盖已有的
            if ((k === 'userAvatar' || k === 'partnerAvatar') && record[k] === '') continue;
            await db.settings.put({ key: k, value: record[k] });
          }
        }
        break;
      }
      case 'encouragementMessages': {
        if (!value || typeof value !== 'object') continue;
        const existing = await db.settings.get('encouragementMessages');
        if (!existing?.value) {
          await db.settings.put({ key: 'encouragementMessages', value });
        }
        // 已有则不覆盖
        break;
      }
      case 'moodTags': {
        if (!Array.isArray(value)) continue;
        const existing = await db.moodTags.toArray();
        const existingNames = new Set(existing.map(t => t.name));
        const toAdd = value.filter((t: { name: string }) => !existingNames.has(t.name))
          .map(({ id, ...rest }: { id?: number; name: string; category: string; createdAt?: number }) => ({
            name: rest.name,
            category: rest.category,
            createdAt: rest.createdAt || Date.now(),
          }));
        if (toAdd.length > 0) await db.moodTags.bulkAdd(toAdd as any);
        break;
      }
    }
  }
}

function getModuleLabel(key: string): string {
  const map: Record<string, string> = {
    cards: '字卡库',
    soundTracks: '白噪音音乐库',
    periodMessages: '生理期安慰语句',
    chatSettings: '聊天设置',
    encouragementMessages: '陪伴鼓励语句',
    moodTags: '状态标签',
  };
  return map[key] || key;
}

function formatImportSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

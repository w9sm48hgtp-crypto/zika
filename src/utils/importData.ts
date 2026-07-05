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
      case 'dailyRecords': {
        if (!Array.isArray(value)) continue;
        const existing = await db.dailyRecords.toArray();
        const existingDates = new Set(existing.map(r => r.date));
        const toAdd = value.filter((r: { date: string }) => !existingDates.has(r.date))
          .map(({ id, ...rest }: { id?: number; date: string; userNotes?: string[]; partnerNote?: string; userMoodTags?: string[]; partnerMoodTag?: string; partnerMoodTime?: number }) => ({
            date: rest.date,
            userNotes: rest.userNotes || [],
            partnerNote: rest.partnerNote,
            userMoodTags: rest.userMoodTags || [],
            partnerMoodTag: rest.partnerMoodTag,
            partnerMoodTime: rest.partnerMoodTime,
          }));
        if (toAdd.length > 0) await db.dailyRecords.bulkAdd(toAdd as any);
        break;
      }
      case 'letters': {
        if (!Array.isArray(value)) continue;
        const toAdd = value.map(({ id, ...rest }: { id?: number; userContent: string; replyContent?: string; sentAt: number; repliedAt?: number }) => ({
          userContent: rest.userContent,
          replyContent: rest.replyContent,
          sentAt: rest.sentAt,
          repliedAt: rest.repliedAt,
        }));
        if (toAdd.length > 0) await db.letters.bulkAdd(toAdd as any);
        break;
      }
      case 'companionRecords': {
        if (!Array.isArray(value)) continue;
        const toAdd = value.map(({ id, ...rest }: { id?: number; scene: string; customSceneName?: string; mode: string; targetDuration?: number; actualDuration?: number; startTime: number; endTime?: number; status: string }) => ({
          scene: rest.scene,
          customSceneName: rest.customSceneName,
          mode: rest.mode,
          targetDuration: rest.targetDuration,
          actualDuration: rest.actualDuration,
          startTime: rest.startTime,
          endTime: rest.endTime,
          status: rest.status,
        }));
        if (toAdd.length > 0) await db.companionRecords.bulkAdd(toAdd as any);
        break;
      }
      case 'todo': {
        if (!value || typeof value !== 'object') continue;
        const todoData = value as { stats?: { totalCount: number; todayCount: number; todayDate: string }; categories?: unknown[]; items?: unknown[] };

        // 合并统计数据（保留较大的历史总计）
        if (todoData.stats) {
          const existingRow = await db.settings.get('todoStats');
          const existing: { totalCount: number; todayCount: number; todayDate: string } = (existingRow?.value as any) ?? { totalCount: 0, todayCount: 0, todayDate: '' };
          const mergedStats = {
            totalCount: Math.max(existing.totalCount, todoData.stats.totalCount),
            todayCount: existing.todayCount + todoData.stats.todayCount,
            todayDate: existing.todayDate || todoData.stats.todayDate,
          };
          await db.settings.put({ key: 'todoStats', value: mergedStats });
        }

        // 合并分类（同名不重复创建）
        if (Array.isArray(todoData.categories)) {
          const existingCats = await db.todoCategories.toArray();
          const existingNames = new Set(existingCats.map(c => c.name));
          const toAdd = todoData.categories
            .filter((c: any) => !existingNames.has(c.name))
            .map((c: any) => ({
              name: c.name,
              sortOrder: c.sortOrder ?? Date.now(),
              createdAt: c.createdAt ?? Date.now(),
            }));
          if (toAdd.length > 0) await db.todoCategories.bulkAdd(toAdd as any);
        }

        // 合并项目（同分类下同文本不重复创建）
        if (Array.isArray(todoData.items)) {
          const existingItems = await db.todoItems.toArray();
          // 重新加载分类以获取新导入的 ID
          const allCats = await db.todoCategories.toArray();
          const toAdd: any[] = [];
          for (const item of todoData.items as any[]) {
            // 按文本 + 分类匹配
            const dup = existingItems.find(
              ei => ei.text === item.text && ei.categoryId === item.categoryId
            );
            if (!dup) {
              // 尝试匹配到新分类 ID（名称匹配）
              let catId = item.categoryId;
              const oldCat = (todoData.categories as any[])?.find((c: any) => c.id === item.categoryId);
              if (oldCat) {
                const newCat = allCats.find(c => c.name === oldCat.name);
                if (newCat) catId = newCat.id!;
              }
              toAdd.push({
                categoryId: catId,
                text: item.text,
                completed: item.completed ?? false,
                sortOrder: item.sortOrder ?? Date.now(),
                createdAt: item.createdAt ?? Date.now(),
              });
            }
          }
          if (toAdd.length > 0) await db.todoItems.bulkAdd(toAdd as any);
        }
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
    dailyRecords: '每日记录',
    letters: '书信',
    companionRecords: '陪伴记录',
    todo: 'Todo 计划',
  };
  return map[key] || key;
}

function formatImportSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  { key: 'dailyRecords', label: '每日记录', description: '每日心情、小纸条、留言、生理期记录' },
  { key: 'letters', label: '书信', description: '所有写信和回信内容' },
  { key: 'companionRecords', label: '陪伴记录', description: '学习/吃饭/睡觉/自定义陪伴计时记录' },
  { key: 'todo', label: 'Todo 计划', description: '累计完成数、每日计划、自定义分类和项目' },
  { key: 'stickyNotes', label: '文字便签', description: '日常随手记录的文字便签' },
  { key: 'photoAlbums', label: '相册数据', description: '相册分类、照片及说明' },
  { key: 'anniversaries', label: '纪念日', description: '正数日、倒数日、每年同日' },
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
      case 'dailyRecords': {
        const records = await db.dailyRecords.toArray();
        modules.dailyRecords = records;
        break;
      }
      case 'letters': {
        const letters = await db.letters.toArray();
        modules.letters = letters;
        break;
      }
      case 'companionRecords': {
        const records = await db.companionRecords.toArray();
        modules.companionRecords = records;
        break;
      }
      case 'todo': {
        const statsRow = await db.settings.get('todoStats');
        const categories = await db.todoCategories.toArray();
        const todoItems = await db.todoItems.toArray();
        modules.todo = {
          stats: statsRow?.value ?? { totalCount: 0, todayCount: 0, todayDate: '' },
          categories,
          items: todoItems,
        };
        break;
      }
      case 'stickyNotes': {
        const notes = await db.stickyNotes.toArray();
        modules.stickyNotes = notes;
        break;
      }
      case 'photoAlbums': {
        const albums = await db.photoAlbums.toArray();
        const photos = await db.photos.toArray();
        modules.photoAlbums = { albums, photos };
        break;
      }
      case 'anniversaries': {
        const anniversaries = await db.anniversaries.toArray();
        modules.anniversaries = anniversaries;
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

  // 字卡库和白噪音用 count() 粗略估算，避免加载 base64 数据占满内存导致闪退
  const cardCount = await db.cards.count();
  sizes.cards = cardCount * 5000; // 纯文字约200B，表情包可达100KB+，取粗略平均值
  const trackCount = await db.soundTracks.count();
  sizes.soundTracks = trackCount * 500000;

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

  const dailyRecords = await db.dailyRecords.toArray();
  sizes.dailyRecords = new Blob([JSON.stringify(dailyRecords)]).size;

  const letters = await db.letters.toArray();
  sizes.letters = new Blob([JSON.stringify(letters)]).size;

  const companionRecords = await db.companionRecords.toArray();
  sizes.companionRecords = new Blob([JSON.stringify(companionRecords)]).size;

  const todoStatsRow = await db.settings.get('todoStats');
  const todoCategories = await db.todoCategories.toArray();
  const todoItemsAll = await db.todoItems.toArray();
  sizes.todo = new Blob([JSON.stringify({
    stats: todoStatsRow?.value ?? {},
    categories: todoCategories,
    items: todoItemsAll,
  })]).size;

  const stickyNotes = await db.stickyNotes.toArray();
  sizes.stickyNotes = new Blob([JSON.stringify(stickyNotes)]).size;

  const albumList = await db.photoAlbums.toArray();
  const photoList = await db.photos.toArray();
  sizes.photoAlbums = new Blob([JSON.stringify({ albums: albumList, photos: photoList })]).size;

  const anniversaries = await db.anniversaries.toArray();
  sizes.anniversaries = new Blob([JSON.stringify(anniversaries)]).size;

  return sizes;
}

/** 格式化字节数为可读字符串 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 触发浏览器导出（逐层回退：系统分享 → 剪贴板 → 新窗口） */
export async function downloadJson(data: unknown, _filename: string): Promise<void> {
  const jsonStr = JSON.stringify(data);

  // 方案1：系统分享面板（纯文本，不需要 File 构造函数）
  if (navigator.share) {
    try {
      await navigator.share({ text: jsonStr, title: '字卡数据备份' });
      return;
    } catch {
      // 用户取消 → 什么都不做
      return;
    }
  }

  // 方案2：复制到剪贴板
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(jsonStr);
      alert('数据已复制到剪贴板！请打开备忘录粘贴保存。');
      return;
    } catch {
      // 继续回退
    }
  }

  // 方案3：新窗口显示（最后回退）
  const w = window.open('');
  if (w) {
    w.document.write('<html><body><pre style="white-space:pre-wrap;word-break:break-all;font-size:12px;">' +
      jsonStr.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') +
      '</pre></body></html>');
    w.document.close();
  } else {
    alert('导出失败：浏览器阻止了新窗口。请在地址栏中允许弹出窗口后重试。');
  }
}

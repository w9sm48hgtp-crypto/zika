import { db } from '../db';

/** 导出数据模块定义 */
export interface ExportModule {
  key: string;
  label: string;
  description: string;
}

/** JSON 导出模块 — 仅保留文字无法实现的部分 */
export const EXPORT_MODULES: ExportModule[] = [
  { key: 'stickers', label: '表情包', description: '字卡中的表情包图片' },
  { key: 'soundTracks', label: '白噪音音乐库', description: '上传的白噪音音频文件' },
  { key: 'chatSettings', label: '聊天设置', description: '头像、昵称、回复延迟、条数、震动等' },
  { key: 'photoAlbums', label: '相册数据', description: '相册分类、照片及说明' },
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
      case 'stickers': {
        // 只导出表情包（sticker 类型），不含文字和拍一拍
        const cards = await db.cards.where('type').equals('sticker').toArray();
        modules.stickers = cards;
        break;
      }
      case 'soundTracks': {
        const tracks = await db.soundTracks.toArray();
        modules.soundTracks = tracks;
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
      case 'photoAlbums': {
        const albums = await db.photoAlbums.toArray();
        const photos = await db.photos.toArray();
        modules.photoAlbums = { albums, photos };
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

  // 表情包：只统计 sticker 类型，用 count 估算避免加载 base64
  const stickerCount = await db.cards.where('type').equals('sticker').count();
  sizes.stickers = stickerCount * 100000; // 表情包平均约 100KB

  const trackCount = await db.soundTracks.count();
  sizes.soundTracks = trackCount * 500000;

  const settingKeys = ['userAvatar', 'partnerAvatar', 'partnerName', 'replyDelay',
    'replyCountMin', 'replyCountMax', 'textRatio', 'nudgeRatio', 'stickerRatio',
    'vibrationEnabled'];
  const settings: Record<string, unknown> = {};
  for (const k of settingKeys) {
    const row = await db.settings.get(k);
    settings[k] = row?.value ?? null;
  }
  sizes.chatSettings = new Blob([JSON.stringify(settings)]).size;

  const albumList = await db.photoAlbums.toArray();
  const photoList = await db.photos.toArray();
  sizes.photoAlbums = new Blob([JSON.stringify({ albums: albumList, photos: photoList })]).size;

  return sizes;
}

/** 格式化字节数为可读字符串 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 触发浏览器导出（系统分享文本 → 系统分享文件 → 返回 JSON 文本供页面展示）
 *  返回 { success: true } 表示分享成功
 *  返回 { success: false, jsonStr } 表示分享失败，调用方应展示 JSON 文本让用户手动复制 */
export async function downloadJson(data: unknown, filename: string): Promise<{ success: boolean; jsonStr: string }> {
  const jsonStr = JSON.stringify(data);

  // 方案1：系统分享面板 — 纯文本
  if (navigator.share) {
    try {
      await navigator.share({ text: jsonStr, title: '字卡数据备份' });
      return { success: true, jsonStr };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: true, jsonStr }; // 用户取消不算失败
      }
    }
  }

  // 方案2：分享为 .json 文件
  if (navigator.share && navigator.canShare) {
    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const file = new File([blob], filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '字卡数据备份' });
        return { success: true, jsonStr };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: true, jsonStr };
      }
    }
  }

  // 分享不可用或失败 → 返回 JSON 文本让页面展示
  return { success: false, jsonStr };
}

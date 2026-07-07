import { create } from 'zustand';
import { db } from '../db';

interface SettingsState {
  replyDelay: number;
  replyCountMin: number;
  replyCountMax: number;
  textRatio: number;        // 文字字卡出现比例 %
  nudgeRatio: number;       // 拍一拍出现比例 %
  stickerRatio: number;     // 表情包出现比例 %
  userAvatar: string;
  partnerAvatar: string;
  partnerName: string;
  vibrationEnabled: boolean;
  keepScreenOn: boolean;
  chatBackground: string;

  loadSettings: () => Promise<void>;
  setReplyDelay: (v: number) => Promise<void>;
  setReplyCountMin: (v: number) => Promise<void>;
  setReplyCountMax: (v: number) => Promise<void>;
  setTextRatio: (v: number) => Promise<void>;
  setNudgeRatio: (v: number) => Promise<void>;
  setStickerRatio: (v: number) => Promise<void>;
  setUserAvatar: (v: string) => Promise<void>;
  setPartnerAvatar: (v: string) => Promise<void>;
  setPartnerName: (v: string) => Promise<void>;
  setVibrationEnabled: (v: boolean) => Promise<void>;
  setKeepScreenOn: (v: boolean) => Promise<void>;
  setChatBackground: (v: string) => Promise<void>;
}

const defaultSettings: Record<string, unknown> = {
  replyDelay: 1,
  replyCountMin: 1,
  replyCountMax: 3,
  textRatio: 70,
  nudgeRatio: 20,
  stickerRatio: 10,
  userAvatar: '',
  partnerAvatar: '',
  partnerName: '他',
  vibrationEnabled: true,
  keepScreenOn: false,
  chatBackground: '',
};

async function getSetting(key: string): Promise<unknown> {
  const row = await db.settings.get(key);
  return row?.value ?? defaultSettings[key];
}

async function saveSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

export const useSettingsStore = create<SettingsState>((set) => ({
  replyDelay: 1,
  replyCountMin: 1,
  replyCountMax: 3,
  textRatio: 70,
  nudgeRatio: 20,
  stickerRatio: 10,
  userAvatar: '',
  partnerAvatar: '',
  partnerName: '他',
  vibrationEnabled: true,
  keepScreenOn: false,
  chatBackground: '',

  loadSettings: async () => {
    const keys = ['replyDelay', 'replyCountMin', 'replyCountMax', 'textRatio', 'nudgeRatio', 'stickerRatio',
      'userAvatar', 'partnerAvatar', 'partnerName', 'vibrationEnabled', 'keepScreenOn', 'chatBackground'];
    const vals = await Promise.all(keys.map(getSetting));
    set({
      replyDelay: vals[0] as number,
      replyCountMin: vals[1] as number,
      replyCountMax: vals[2] as number,
      textRatio: vals[3] as number,
      nudgeRatio: vals[4] as number,
      stickerRatio: vals[5] as number,
      userAvatar: vals[6] as string,
      partnerAvatar: vals[7] as string,
      partnerName: vals[8] as string,
      vibrationEnabled: vals[9] as boolean,
      keepScreenOn: vals[10] as boolean,
      chatBackground: vals[11] as string,
    });
  },

  setReplyDelay: async (v) => { await saveSetting('replyDelay', v); set({ replyDelay: v }); },
  setReplyCountMin: async (v) => { await saveSetting('replyCountMin', v); set({ replyCountMin: v }); },
  setReplyCountMax: async (v) => { await saveSetting('replyCountMax', v); set({ replyCountMax: v }); },
  setTextRatio: async (v) => { await saveSetting('textRatio', v); set({ textRatio: v }); },
  setNudgeRatio: async (v) => { await saveSetting('nudgeRatio', v); set({ nudgeRatio: v }); },
  setStickerRatio: async (v) => { await saveSetting('stickerRatio', v); set({ stickerRatio: v }); },
  setUserAvatar: async (v) => { await saveSetting('userAvatar', v); set({ userAvatar: v }); },
  setPartnerAvatar: async (v) => { await saveSetting('partnerAvatar', v); set({ partnerAvatar: v }); },
  setPartnerName: async (v) => { await saveSetting('partnerName', v); set({ partnerName: v }); },
  setVibrationEnabled: async (v) => { await saveSetting('vibrationEnabled', v); set({ vibrationEnabled: v }); },
  setKeepScreenOn: async (v) => { await saveSetting('keepScreenOn', v); set({ keepScreenOn: v }); },
  setChatBackground: async (v) => { await saveSetting('chatBackground', v); set({ chatBackground: v }); },
}));

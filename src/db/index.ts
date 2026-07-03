import Dexie, { type EntityTable } from 'dexie';

// ===== 数据模型接口 =====

/** 字卡 */
export interface Card {
  id?: number;
  type: 'text' | 'nudge' | 'sticker'; // 文字 | 拍一拍 | 表情包
  content: string; // 文字内容或图片 base64/dataURL
  category?: string; // 文字字卡分类
  createdAt: number; // timestamp
  updatedAt: number;
}

/** 聊天消息 */
export interface ChatMessage {
  id?: number;
  sender: 'user' | 'partner';
  content: string;
  msgType: 'text' | 'nudge' | 'image' | 'quote' | 'choice_q' | 'choice_a';
  quotedMessageId?: number;
  quotedContent?: string; // 冗余存储被引用内容
  timestamp: number;
}

/** 陪伴记录 */
export interface CompanionRecord {
  id?: number;
  scene: 'study' | 'eat' | 'sleep' | 'custom';
  customSceneName?: string;
  mode: 'countUp' | 'countDown';
  targetDuration?: number; // 倒计时目标分钟数
  actualDuration?: number; // 实际秒数（完成后才有）
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'cancelled';
}

/** 每日记录 */
export interface DailyRecord {
  id?: number;
  date: string; // YYYY-MM-DD
  userNotes: string[]; // 用户小纸条 1~3条
  partnerNote?: string; // 另一半留言
  userMoodTags?: string[]; // 用户选的状态标签 1~3个
  partnerMoodTag?: string; // 另一半随机标签
  partnerMoodTime?: number; // 另一半状态出现时间
}

/** 情绪标签 */
export interface MoodTag {
  id?: number;
  name: string;
  category: 'mine' | 'his' | 'both'; // 我的 | 他的 | 通用
  createdAt: number;
}

/** 书信 */
export interface Letter {
  id?: number;
  userContent: string;
  replyContent?: string;
  sentAt: number;
  repliedAt?: number;
}

/** 生理期记录 */
export interface PeriodRecord {
  id?: number;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  notes?: string;
}

/** 温暖留言 */
export interface WarmMessage {
  id?: number;
  phase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | 'general';
  content: string;
  createdAt: number;
}

/** 白噪音 */
export interface SoundTrack {
  id?: number;
  name: string;
  scene: 'study' | 'eat' | 'sleep' | 'other';
  audioData: string; // base64 dataURL
  createdAt: number;
}

/** 应用设置 */
export interface AppSettings {
  key: string;
  value: unknown;
}

// ===== 数据库类 =====
class ZiKaDatabase extends Dexie {
  cards!: EntityTable<Card, 'id'>;
  chatMessages!: EntityTable<ChatMessage, 'id'>;
  companionRecords!: EntityTable<CompanionRecord, 'id'>;
  dailyRecords!: EntityTable<DailyRecord, 'id'>;
  moodTags!: EntityTable<MoodTag, 'id'>;
  letters!: EntityTable<Letter, 'id'>;
  periodRecords!: EntityTable<PeriodRecord, 'id'>;
  warmMessages!: EntityTable<WarmMessage, 'id'>;
  soundTracks!: EntityTable<SoundTrack, 'id'>;
  settings!: EntityTable<AppSettings, 'key'>;

  constructor() {
    super('ZiKaDatabase');

    this.version(1).stores({
      cards: '++id, type, createdAt',
      chatMessages: '++id, sender, timestamp',
      companionRecords: '++id, scene, startTime, status',
      dailyRecords: '++id, date',
      moodTags: '++id, name',
      letters: '++id, sentAt',
      periodRecords: '++id, startDate',
      warmMessages: '++id, phase',
      settings: 'key',
    });

    // v2: 新增 category 索引
    this.version(2).stores({
      cards: '++id, type, category, createdAt',
    });

    // v3: 新增白噪音表
    this.version(3).stores({
      soundTracks: '++id, scene, createdAt',
    });

    // v4: moodTags 加 category 字段
    this.version(4).stores({
      moodTags: '++id, category, createdAt',
    }).upgrade(async (tx) => {
      const tags = await tx.table('moodTags').toArray();
      for (const tag of tags) {
        if (!tag.category) {
          await tx.table('moodTags').update(tag.id, { category: 'both' });
        }
      }
    });

    // v5: DailyRecord.userMoodTag → userMoodTags 数组
    this.version(5).stores({
      dailyRecords: '++id, date',
    }).upgrade(async (tx) => {
      const records = await tx.table('dailyRecords').toArray();
      for (const r of records) {
        if (r.userMoodTag != null && !r.userMoodTags) {
          await tx.table('dailyRecords').update(r.id, {
            userMoodTags: [r.userMoodTag],
          });
        }
      }
    });
  }
}

export const db = new ZiKaDatabase();

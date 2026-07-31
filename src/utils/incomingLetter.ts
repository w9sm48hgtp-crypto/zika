import { db } from '../db';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * 来信生成工具
 * 系统自动从字卡库随机选 7-15 条文字字卡，模拟"他写给你的信"
 * 频率约一周 4-7 封（每 24-42 小时随机一封）
 */

/** 格式化书信 */
function formatLetter(
  content: string,
  recipientName: string,
  senderName: string,
  timestamp: number
): string {
  const d = new Date(timestamp);
  const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  return `致${recipientName}：\n${content}\n${dateStr}\n${senderName}`;
}

/** 生成一封来信 */
export async function generateIncomingLetter(): Promise<number | null> {
  const settings = useSettingsStore.getState();
  const partnerName = settings.partnerName || '他';
  const userName = settings.userName || '我';

  // 从字卡库随机选 7-15 条文字字卡
  const textCards = await db.cards
    .where('type')
    .equals('text')
    .toArray();

  if (textCards.length < 7) return null; // 字卡不足

  const count = 7 + Math.floor(Math.random() * 9); // 7-15
  const shuffled = [...textCards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));
  const joinedContent = selected.map(c => c.content).join('\n\n');

  const now = Date.now();
  const formatted = formatLetter(joinedContent, userName, partnerName, now);

  const id = await db.letters.add({
    direction: 'incoming',
    userContent: formatted,
    sentAt: now,
  });

  return id as number;
}

/** 检查是否需要生成新的来信（页面打开时调用）
 *  频率：距离上次来信 24-42 小时后自动生成 */
export async function checkAndGenerateIncoming(): Promise<number | null> {
  const row = await db.settings.get('lastIncomingLetterTime');
  const lastTime = (row?.value as number) || 0;
  const now = Date.now();

  // 随机间隔 24-42 小时
  const minInterval = 24 * 60 * 60 * 1000;
  const maxInterval = 42 * 60 * 60 * 1000;
  const randomInterval = minInterval + Math.random() * (maxInterval - minInterval);

  if (now - lastTime < randomInterval) return null;

  const id = await generateIncomingLetter();
  if (id != null) {
    await db.settings.put({ key: 'lastIncomingLetterTime', value: now });
    // 设置未读标记，用于底部导航红点提示
    await db.settings.put({ key: 'hasUnreadIncoming', value: true });
  }
  return id;
}

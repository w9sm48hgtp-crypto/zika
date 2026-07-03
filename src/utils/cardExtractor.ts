import { db, type Card } from '../db';

/**
 * 按比例随机抽取字卡（用于聊天回复）
 * 根据 textRatio / nudgeRatio / stickerRatio 加权决定每张卡的类型
 */
export async function pickCardsWithRatio(
  count: number,
  textRatio: number,
  nudgeRatio: number,
  stickerRatio: number
): Promise<Card[]> {
  const allCards = await db.cards.toArray();
  if (allCards.length === 0) return [];

  // 按类型分组
  const byType: Record<string, Card[]> = { text: [], nudge: [], sticker: [] };
  for (const c of allCards) {
    if (c.type === 'sticker') {
      // 只取另一半可用的：无分类(旧数据兼容)、他的回复、通用
      if (!c.category || c.category === '他的回复' || c.category === '通用') {
        byType.sticker.push(c);
      }
    } else {
      byType[c.type]?.push(c);
    }
  }

  const result: Card[] = [];
  const total = textRatio + nudgeRatio + stickerRatio || 100;

  for (let i = 0; i < count; i++) {
    const rand = Math.random() * total;
    let targetType: Card['type'];

    if (rand < textRatio) {
      targetType = 'text';
    } else if (rand < textRatio + nudgeRatio) {
      targetType = 'nudge';
    } else {
      targetType = 'sticker';
    }

    // 如果该类型没有字卡，回退到有卡的类型
    const candidates = byType[targetType]?.length ? byType[targetType]
      : byType.text?.length ? byType.text
      : byType.sticker?.length ? byType.sticker
      : byType.nudge;

    if (!candidates?.length) break;

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    result.push(picked);
  }

  return result;
}

/**
 * 从字卡库中随机抽取字卡（排除指定类型）
 */
export async function pickRandomCards(
  count: number,
  excludeTypes: Card['type'][] = []
): Promise<Card[]> {
  let query = db.cards.toCollection();
  if (excludeTypes.length > 0) {
    query = query.filter((c) => !excludeTypes.includes(c.type));
  }
  const allCards = await query.toArray();
  if (allCards.length === 0) return [];

  const shuffled = [...allCards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export async function pickPartnerDailyNote(): Promise<string> {
  const cards = await pickRandomCards(3, ['nudge', 'sticker']);
  return cards.map((c) => c.content).join(' ');
}

export async function pickLetterReply(): Promise<string> {
  const count = 10 + Math.floor(Math.random() * 6);
  const cards = await pickRandomCards(count, ['nudge', 'sticker']);
  return cards.map((c) => c.content).join('\n\n');
}

export function isWithinTenMinutes(timestamp: number): boolean {
  return Date.now() - timestamp < 10 * 60 * 1000;
}

import { db } from '../db';

/** Date → 'YYYY-MM-DD' */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 记录"今天来过"：写入 settings.activeDates（最多保留最近 60 天）。
 * 云备份整库打包设置表，所以这份记录会随云备份一起恢复。
 */
export async function markTodayActive(): Promise<void> {
  try {
    const today = dateKey(new Date());
    const row = await db.settings.get('activeDates');
    const list: string[] = Array.isArray(row?.value) ? (row.value as string[]) : [];
    if (list[list.length - 1] === today) return; // 今天已记录过
    const next = [...list, today].slice(-60);
    await db.settings.put({ key: 'activeDates', value: next });
  } catch {
    // 记录失败不影响主流程
  }
}

/**
 * 统计日期范围内"你当天来过"的日期集合。
 * 依据：打开网站的记录（activeDates）+ 当天有聊天消息 / 陪伴计时 / 写过的信。
 * 系统自动生成的来信不算"来过"。
 */
export async function getActiveDatesInRange(startDate: string, endDate: string): Promise<Set<string>> {
  const set = new Set<string>();
  const startTs = new Date(`${startDate}T00:00:00`).getTime();
  const endTs = new Date(`${endDate}T23:59:59.999`).getTime();

  // 1) 打开网站的记录
  try {
    const row = await db.settings.get('activeDates');
    const list: string[] = Array.isArray(row?.value) ? (row.value as string[]) : [];
    for (const d of list) {
      if (d >= startDate && d <= endDate) set.add(d);
    }
  } catch { /* 忽略读取失败 */ }

  // 2) 聊天消息
  const msgs = await db.chatMessages.where('timestamp').between(startTs, endTs, true, true).toArray();
  for (const m of msgs) set.add(dateKey(new Date(m.timestamp)));

  // 3) 陪伴计时
  const companions = await db.companionRecords.where('startTime').between(startTs, endTs, true, true).toArray();
  for (const c of companions) set.add(dateKey(new Date(c.startTime)));

  // 4) 我写过的信（系统来信不算）
  const letters = await db.letters.where('sentAt').between(startTs, endTs, true, true).toArray();
  for (const l of letters) {
    if (l.direction === 'sent') set.add(dateKey(new Date(l.sentAt)));
  }

  return set;
}

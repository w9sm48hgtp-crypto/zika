import { db, type PeriodRecord } from '../db';

const DEFAULT_CYCLE_DAYS = 28;
const DEFAULT_PERIOD_DAYS = 5;

export interface Prediction {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

/** 从历史记录计算平均周期和经期长度，预测下一次 */
export async function predictNext(): Promise<Prediction | null> {
  const records = await db.periodRecords
    .orderBy('startDate')
    .toArray();

  if (records.length === 0) return null;

  // 计算平均周期长度
  let totalCycle = 0;
  let cycleCount = 0;
  for (let i = 1; i < records.length; i++) {
    const prev = new Date(records[i - 1].startDate);
    const curr = new Date(records[i].startDate);
    const diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0 && diff < 100) { // 过滤异常值
      totalCycle += diff;
      cycleCount++;
    }
  }
  const avgCycle = cycleCount > 0 ? Math.round(totalCycle / cycleCount) : DEFAULT_CYCLE_DAYS;

  // 计算平均经期长度
  let totalLen = 0;
  let lenCount = 0;
  for (const r of records) {
    if (r.endDate) {
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (diff > 0 && diff < 15) {
        totalLen += diff;
        lenCount++;
      }
    }
  }
  const avgLen = lenCount > 0 ? Math.round(totalLen / lenCount) : DEFAULT_PERIOD_DAYS;

  // 预测下次
  const lastRecord = records[records.length - 1];
  const lastStart = new Date(lastRecord.startDate);
  const predictedStart = new Date(lastStart);
  predictedStart.setDate(predictedStart.getDate() + avgCycle);
  const predictedEnd = new Date(predictedStart);
  predictedEnd.setDate(predictedEnd.getDate() + avgLen - 1);

  return {
    startDate: formatDate(predictedStart),
    endDate: formatDate(predictedEnd),
  };
}

/** 获取所有已记录的经期日期集合（进行中的自动算到今天） */
export async function getPeriodDays(): Promise<Set<string>> {
  const records = await db.periodRecords.toArray();
  const days = new Set<string>();
  for (const r of records) {
    const start = new Date(r.startDate);
    const end = r.endDate ? new Date(r.endDate) : new Date(); // 没有结束日期则到今天
    const cur = new Date(start);
    while (cur <= end) {
      days.add(formatDate(cur));
      cur.setDate(cur.getDate() + 1);
    }
  }
  return days;
}

/** 获取预测的经期日期集合 */
export function getPredictedDays(prediction: Prediction | null): Set<string> {
  const days = new Set<string>();
  if (!prediction) return days;
  const start = new Date(prediction.startDate);
  const end = new Date(prediction.endDate);
  const cur = new Date(start);
  while (cur <= end) {
    days.add(formatDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/** 获取进行中的经期记录（没有结束日期的） */
export async function getOngoingPeriod(): Promise<PeriodRecord | null> {
  const records = await db.periodRecords.orderBy('startDate').reverse().toArray();
  return records.find(r => !r.endDate) || null;
}

/** 标记经期开始 */
export async function startPeriod(dateStr: string): Promise<void> {
  // 如果已有进行中的，不允许重复开始
  const ongoing = await getOngoingPeriod();
  if (ongoing) return;
  await db.periodRecords.add({ startDate: dateStr });
}

/** 标记经期结束 */
export async function endPeriod(dateStr: string): Promise<void> {
  const ongoing = await getOngoingPeriod();
  if (!ongoing) return;
  if (dateStr < ongoing.startDate) return;
  await db.periodRecords.update(ongoing.id!, { endDate: dateStr });
}

/** 删除包含指定日期的已完成的经期记录 */
export async function deletePeriodContaining(dateStr: string): Promise<void> {
  const records = await db.periodRecords.orderBy('startDate').toArray();
  for (const r of records) {
    if (!r.endDate) continue; // 跳过进行中的
    const start = new Date(r.startDate);
    const end = new Date(r.endDate);
    const target = new Date(dateStr);
    if (target >= start && target <= end) {
      await db.periodRecords.delete(r.id!);
      return;
    }
  }
}

/** 取消最近一次经期标记（删除进行中的，或已完成的最后一条记录） */
export async function cancelLastPeriod(): Promise<void> {
  const ongoing = await getOngoingPeriod();
  if (ongoing) {
    await db.periodRecords.delete(ongoing.id!);
    return;
  }
  // 删除最近一条已完成的记录
  const records = await db.periodRecords.orderBy('startDate').reverse().toArray();
  if (records.length > 0) {
    await db.periodRecords.delete(records[0].id!);
  }
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 获取随机安慰语句 */
export async function pickPeriodMessage(): Promise<string | null> {
  const row = await db.settings.get('periodMessages');
  const defaults = [
    '抱抱你，这几天要好好休息',
    '多喝热水，别着凉了',
    '我在呢，不舒服就告诉我',
    '辛苦啦，这几天对自己好一点',
    '给你揉揉肚子',
  ];
  const messages: string[] = (row?.value as string[]) || defaults;
  if (messages.length === 0) return null;
  return messages[Math.floor(Math.random() * messages.length)];
}

/** 检查日期是否在预测经期前 3 天内，返回提醒语句 */
export function getPeriodWarning(dateStr: string, prediction: Prediction | null): string | null {
  if (!prediction) return null;
  const target = new Date(dateStr);
  const predStart = new Date(prediction.startDate);
  const diff = Math.round((predStart.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  if (diff >= 0 && diff <= 3) {
    if (diff === 0) return '经期预计今天开始，注意休息';
    return `经期预计还有 ${diff} 天，注意调整作息`;
  }
  return null;
}

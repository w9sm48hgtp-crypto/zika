/**
 * 文字数据交换工具
 * 将纯文本数据以换行格式导出/导入，方便在备忘录等地方手动保存
 */
import { db } from '../db';

// ===== 类型定义 =====

export interface ExchangeResult {
  count: number;
  skipped: number;
}

export type DataType =
  | 'periodMessages'
  | 'stickyNotes'
  | 'anniversaries'
  | 'moodTags'
  | 'todoItems'
  | 'encouragementMessages';

export const DATA_TYPE_META: Record<DataType, { label: string; desc: string }> = {
  periodMessages: { label: '生理期安慰语句', desc: '经期随机发来的安慰语句' },
  stickyNotes: { label: '文字便签', desc: '随手记录的文字便签' },
  anniversaries: { label: '纪念日', desc: '正数日 / 倒数日 / 每年同日' },
  moodTags: { label: '状态标签', desc: '我的 / 他的 / 通用状态标签' },
  todoItems: { label: 'Todo 待办', desc: '待办项目及完成状态' },
  encouragementMessages: { label: '陪伴鼓励语句', desc: '各场景开始/结束鼓励语句' },
};

// ===== 导出函数 =====

/** 生理期安慰语句 → 每行一句 */
export async function exportPeriodMessages(): Promise<string> {
  const row = await db.settings.get('periodMessages');
  const list: string[] = (row?.value as string[]) || [];
  return list.join('\n');
}

/** 文字便签 → 每行一条 */
export async function exportStickyNotes(): Promise<string> {
  const notes = await db.stickyNotes.orderBy('createdAt').toArray();
  return notes.map(n => n.content).join('\n');
}

/** 纪念日 → 名称 | 日期 | 类型 */
export async function exportAnniversaries(): Promise<string> {
  const items = await db.anniversaries.orderBy('createdAt').toArray();
  const typeMap: Record<string, string> = { count_up: '正数日', count_down: '倒数日', annual: '每年同日' };
  return items.map(a => `${a.name} | ${a.date} | ${typeMap[a.type] || a.type}`).join('\n');
}

/** 状态标签 → [分类] 标签名 */
export async function exportMoodTags(): Promise<string> {
  const tags = await db.moodTags.orderBy('createdAt').toArray();
  const catMap: Record<string, string> = { mine: '我的', his: '他的', both: '通用' };
  return tags.map(t => `[${catMap[t.category] || t.category}] ${t.name}`).join('\n');
}

/** Todo 待办 → 总完成：N + 【分类名】待办文字（已完成的加 ✓） */
export async function exportTodoItems(): Promise<string> {
  const statsRow = await db.settings.get('todoStats');
  const stats = (statsRow?.value as { totalCount?: number } | undefined) || {};
  const totalCount = stats.totalCount || 0;

  const categories = await db.todoCategories.toArray();
  const catMap = new Map(categories.map(c => [c.id!, c.name]));
  const items = await db.todoItems.orderBy('sortOrder').toArray();

  const lines = [`总完成：${totalCount}`];
  for (const i of items) {
    const catName = catMap.get(i.categoryId) || '默认';
    const check = i.completed ? '✓ ' : '';
    lines.push(`【${catName}】${check}${i.text}`);
  }
  return lines.join('\n');
}

/** 陪伴鼓励语句 → [场景-开始/结束] 语句 */
export async function exportEncouragementMessages(): Promise<string> {
  const row = await db.settings.get('encouragementMessages');
  const data = row?.value as Record<string, { start: string[]; end: string[] }> | undefined;
  const sceneLabels: Record<string, string> = {
    study: '学习', eat: '吃饭', sleep: '睡眠', other: '其他',
  };
  const lines: string[] = [];
  if (data) {
    for (const [scene, msgs] of Object.entries(data)) {
      const label = sceneLabels[scene] || scene;
      for (const msg of msgs.start || []) {
        lines.push(`[${label}-开始] ${msg}`);
      }
      for (const msg of msgs.end || []) {
        lines.push(`[${label}-结束] ${msg}`);
      }
    }
  }
  return lines.join('\n');
}

// ===== 导入函数 =====

/** 生理期安慰语句 — 每行一句，去重合并 */
export async function importPeriodMessages(text: string): Promise<ExchangeResult> {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const existing = await db.settings.get('periodMessages');
  const existingList: string[] = (existing?.value as string[]) || [];
  const existingSet = new Set(existingList);
  let count = 0;
  for (const line of lines) {
    if (!existingSet.has(line)) {
      existingList.push(line);
      existingSet.add(line);
      count++;
    }
  }
  await db.settings.put({ key: 'periodMessages', value: existingList });
  return { count, skipped: lines.length - count };
}

/** 文字便签 — 每行一条，去重 */
export async function importStickyNotes(text: string): Promise<ExchangeResult> {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const existing = await db.stickyNotes.toArray();
  const existingContents = new Set(existing.map(n => n.content));
  let count = 0;
  for (const line of lines) {
    if (!existingContents.has(line)) {
      await db.stickyNotes.add({ content: line, createdAt: Date.now(), updatedAt: Date.now() });
      existingContents.add(line);
      count++;
    }
  }
  return { count, skipped: lines.length - count };
}

/** 纪念日 — 名称 | 日期 | 类型 */
export async function importAnniversaries(text: string): Promise<ExchangeResult> {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const typeMap: Record<string, string> = { '正数日': 'count_up', '倒数日': 'count_down', '每年同日': 'annual' };
  const existing = await db.anniversaries.toArray();
  const existingKeys = new Set(existing.map(a => `${a.name}|${a.date}|${a.type}`));
  let count = 0;
  for (const line of lines) {
    const parts = line.split('|').map(s => s.trim());
    if (parts.length < 3) continue;
    const [name, date, typeLabel] = parts;
    const type = typeMap[typeLabel];
    if (!type) continue;
    // 简单日期校验
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const key = `${name}|${date}|${type}`;
    if (existingKeys.has(key)) continue;
    await db.anniversaries.add({ name, date, type: type as 'count_up' | 'count_down' | 'annual', createdAt: Date.now() });
    existingKeys.add(key);
    count++;
  }
  return { count, skipped: lines.length - count };
}

/** 状态标签 — [分类] 标签名 */
export async function importMoodTags(text: string): Promise<ExchangeResult> {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const catMap: Record<string, string> = { '我的': 'mine', '他的': 'his', '通用': 'both' };
  const existing = await db.moodTags.toArray();
  const existingNames = new Set(existing.map(t => t.name));
  let count = 0;
  for (const line of lines) {
    const match = line.match(/^\[(.+)\]\s+(.+)$/);
    if (!match) continue;
    const catLabel = match[1].trim();
    const name = match[2].trim();
    const category = catMap[catLabel];
    if (!category || !name) continue;
    if (existingNames.has(name)) continue;
    await db.moodTags.add({ name, category: category as 'mine' | 'his' | 'both', createdAt: Date.now() });
    existingNames.add(name);
    count++;
  }
  return { count, skipped: lines.length - count };
}

/** Todo 待办 — 总完成：N + 【分类名】待办（✓ 已完成），去重 */
export async function importTodoItems(text: string): Promise<ExchangeResult> {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const categories = await db.todoCategories.toArray();
  const existingItems = await db.todoItems.toArray();
  let count = 0;
  let hasTotalLine = false;

  for (const line of lines) {
    // 总完成数标题行
    const totalMatch = line.match(/^总完成：(\d+)$/);
    if (totalMatch) {
      hasTotalLine = true;
      const importedTotal = parseInt(totalMatch[1], 10);
      if (!isNaN(importedTotal)) {
        const statsRow = await db.settings.get('todoStats');
        const existing = (statsRow?.value as { totalCount: number } | undefined) || { totalCount: 0 };
        const merged = Math.max(existing.totalCount, importedTotal);
        await db.settings.put({ key: 'todoStats', value: { ...existing, totalCount: merged } });
      }
      continue;
    }

    const match = line.match(/^【(.+?)】(✓?\s*)(.+)$/);
    if (!match) continue;
    const catName = match[1].trim();
    const completed = match[2].includes('✓');
    const itemText = match[3].trim();
    if (!itemText) continue;
    // 查找或创建分类
    let cat = categories.find(c => c.name === catName);
    if (!cat) {
      const id = await db.todoCategories.add({ name: catName, sortOrder: Date.now(), createdAt: Date.now() });
      cat = { id: id as number, name: catName, sortOrder: Date.now(), createdAt: Date.now() };
      categories.push(cat);
    }
    // 去重
    const dup = existingItems.find(ei => ei.text === itemText && ei.categoryId === cat!.id);
    if (dup) continue;
    const sortOrder = existingItems.filter(ei => ei.categoryId === cat!.id).length;
    await db.todoItems.add({
      categoryId: cat.id!,
      text: itemText,
      completed,
      sortOrder,
      createdAt: Date.now(),
    });
    existingItems.push({ categoryId: cat.id!, text: itemText, completed, sortOrder, createdAt: Date.now() });
    count++;
  }
  return { count, skipped: lines.length - count - (hasTotalLine ? 1 : 0) };
}

/** 陪伴鼓励语句 — [场景-开始/结束] 语句 */
export async function importEncouragementMessages(text: string): Promise<ExchangeResult> {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const sceneMap: Record<string, string> = {
    '学习': 'study', '吃饭': 'eat', '睡眠': 'sleep', '其他': 'other',
  };
  const data: Record<string, { start: string[]; end: string[] }> = {
    study: { start: [], end: [] },
    eat: { start: [], end: [] },
    sleep: { start: [], end: [] },
    other: { start: [], end: [] },
  };
  let count = 0;
  for (const line of lines) {
    const match = line.match(/^\[(.+)-(.+)\]\s+(.+)$/);
    if (!match) continue;
    const sceneLabel = match[1].trim();
    const phase = match[2].trim();
    const msg = match[3].trim();
    const scene = sceneMap[sceneLabel];
    if (!scene || !msg) continue;
    if (phase === '开始' || phase === '结束') {
      const key = phase === '开始' ? 'start' : 'end';
      if (!data[scene][key].includes(msg)) {
        data[scene][key].push(msg);
        count++;
      }
    }
  }
  // 合并到已有数据
  const existing = await db.settings.get('encouragementMessages');
  const existingData = (existing?.value as Record<string, { start: string[]; end: string[] }>) || {};
  for (const scene of Object.keys(data)) {
    if (!existingData[scene]) existingData[scene] = { start: [], end: [] };
    for (const msg of data[scene].start) {
      if (!existingData[scene].start.includes(msg)) existingData[scene].start.push(msg);
    }
    for (const msg of data[scene].end) {
      if (!existingData[scene].end.includes(msg)) existingData[scene].end.push(msg);
    }
  }
  await db.settings.put({ key: 'encouragementMessages', value: existingData });
  const totalLines = lines.length;
  return { count, skipped: totalLines - count };
}

// ===== 统一调度 =====

const EXPORTERS: Record<DataType, () => Promise<string>> = {
  periodMessages: exportPeriodMessages,
  stickyNotes: exportStickyNotes,
  anniversaries: exportAnniversaries,
  moodTags: exportMoodTags,
  todoItems: exportTodoItems,
  encouragementMessages: exportEncouragementMessages,
};

const IMPORTERS: Record<DataType, (text: string) => Promise<ExchangeResult>> = {
  periodMessages: importPeriodMessages,
  stickyNotes: importStickyNotes,
  anniversaries: importAnniversaries,
  moodTags: importMoodTags,
  todoItems: importTodoItems,
  encouragementMessages: importEncouragementMessages,
};

export async function exportTextData(type: DataType): Promise<string> {
  return EXPORTERS[type]();
}

export async function importTextData(type: DataType, text: string): Promise<ExchangeResult> {
  return IMPORTERS[type](text);
}

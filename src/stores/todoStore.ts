import { create } from 'zustand';
import { db, type TodoCategory, type TodoItem, type TodoStats } from '../db';

/** 每日计划的特殊 categoryId */
const DAILY_CAT_ID = 0;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isAfter5AM(): boolean {
  return new Date().getHours() >= 5;
}

interface TodoState {
  totalCount: number;
  todayCount: number;
  categories: TodoCategory[];
  items: TodoItem[];        // 全部项目（含每日计划 + 自定义分类）
  loading: boolean;

  loadAll: () => Promise<void>;
  addDailyItem: (text: string) => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
  addItem: (categoryId: number, text: string) => Promise<void>;
  editItem: (id: number, text: string) => Promise<void>;
  toggleItem: (id: number) => Promise<void>;
  deleteItem: (id: number) => Promise<void>;
  reorderItems: (categoryId: number, sortedItems: TodoItem[]) => Promise<void>;
}

export const useTodoStore = create<TodoState>((set, get) => ({
  totalCount: 0,
  todayCount: 0,
  categories: [],
  items: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });

    // 加载统计数据
    const statsRow = await db.settings.get('todoStats');
    let stats: TodoStats = statsRow?.value as TodoStats | undefined ?? { totalCount: 0, todayCount: 0, todayDate: '' };

    // 凌晨5点后跨天：清空每日计划项目 + 重置今日计数
    const shouldReset = stats.todayDate !== todayStr() && isAfter5AM();
    if (shouldReset) {
      // 删除所有每日计划项目（categoryId = 0）
      await db.todoItems.where('categoryId').equals(DAILY_CAT_ID).delete();
      stats.todayCount = 0;
      stats.todayDate = todayStr();
      await db.settings.put({ key: 'todoStats', value: stats });
    } else if (stats.todayDate !== todayStr()) {
      stats.todayDate = todayStr();
      await db.settings.put({ key: 'todoStats', value: stats });
    }

    const categories = await db.todoCategories.orderBy('sortOrder').toArray();
    const items = await db.todoItems.orderBy('sortOrder').toArray();

    set({
      totalCount: stats.totalCount,
      todayCount: stats.todayCount,
      categories,
      items,
      loading: false,
    });
  },

  /** 添加每日计划项目（categoryId = 0） */
  addDailyItem: async (text: string) => {
    const { items } = get();
    const dailyItems = items.filter(i => i.categoryId === DAILY_CAT_ID);
    const maxOrder = dailyItems.reduce((max, i) => Math.max(max, i.sortOrder), 0);
    const newItem: TodoItem = {
      categoryId: DAILY_CAT_ID,
      text: text.trim(),
      completed: false,
      sortOrder: maxOrder + 1,
      createdAt: Date.now(),
    };
    const id = await db.todoItems.add(newItem);
    set({ items: [...items, { ...newItem, id }] });
  },

  addCategory: async (name: string) => {
    const { categories } = get();
    const maxOrder = categories.reduce((max, c) => Math.max(max, c.sortOrder), 0);
    const cat: TodoCategory = {
      name: name.trim(),
      sortOrder: maxOrder + 1,
      createdAt: Date.now(),
    };
    const id = await db.todoCategories.add(cat);
    set({ categories: [...categories, { ...cat, id }] });
  },

  deleteCategory: async (id: number) => {
    await db.todoCategories.delete(id);
    await db.todoItems.where('categoryId').equals(id).delete();
    const categories = get().categories.filter(c => c.id !== id);
    const items = get().items.filter(i => i.categoryId !== id);
    set({ categories, items });
  },

  addItem: async (categoryId: number, text: string) => {
    const { items } = get();
    const catItems = items.filter(i => i.categoryId === categoryId);
    const maxOrder = catItems.reduce((max, i) => Math.max(max, i.sortOrder), 0);
    const newItem: TodoItem = {
      categoryId,
      text: text.trim(),
      completed: false,
      sortOrder: maxOrder + 1,
      createdAt: Date.now(),
    };
    const id = await db.todoItems.add(newItem);
    set({ items: [...items, { ...newItem, id }] });
  },

  toggleItem: async (id: number) => {
    const { items, totalCount, todayCount } = get();
    const item = items.find(i => i.id === id);
    if (!item) return;

    const newCompleted = !item.completed;
    const catItems = items.filter(i => i.categoryId === item.categoryId);

    if (newCompleted) {
      const maxOrder = catItems.reduce((max, i) => Math.max(max, i.sortOrder), 0);
      await db.todoItems.update(id, { completed: true, sortOrder: maxOrder + 1 });
      const stats: TodoStats = { totalCount: totalCount + 1, todayCount: todayCount + 1, todayDate: todayStr() };
      await db.settings.put({ key: 'todoStats', value: stats });
      set({
        totalCount: totalCount + 1,
        todayCount: todayCount + 1,
        items: items.map(i => i.id === id ? { ...i, completed: true, sortOrder: maxOrder + 1 } : i),
      });
    } else {
      const uncompletedMax = catItems
        .filter(i => !i.completed && i.id !== id)
        .reduce((max, i) => Math.max(max, i.sortOrder), 0);
      const newOrder = uncompletedMax + 1;
      await db.todoItems.update(id, { completed: false, sortOrder: newOrder });
      const stats: TodoStats = { totalCount: Math.max(0, totalCount - 1), todayCount: Math.max(0, todayCount - 1), todayDate: todayStr() };
      await db.settings.put({ key: 'todoStats', value: stats });
      set({
        totalCount: Math.max(0, totalCount - 1),
        todayCount: Math.max(0, todayCount - 1),
        items: items.map(i => i.id === id ? { ...i, completed: false, sortOrder: newOrder } : i),
      });
    }
  },

  editItem: async (id: number, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await db.todoItems.update(id, { text: trimmed });
    set({ items: get().items.map(i => i.id === id ? { ...i, text: trimmed } : i) });
  },

  deleteItem: async (id: number) => {
    await db.todoItems.delete(id);
    set({ items: get().items.filter(i => i.id !== id) });
  },

  reorderItems: async (categoryId: number, sortedItems: TodoItem[]) => {
    for (let i = 0; i < sortedItems.length; i++) {
      const newOrder = i + 1;
      if (sortedItems[i].sortOrder !== newOrder) {
        await db.todoItems.update(sortedItems[i].id!, { sortOrder: newOrder });
      }
    }
    const allItems = await db.todoItems.orderBy('sortOrder').toArray();
    set({ items: allItems });
  },
}));

export { DAILY_CAT_ID };

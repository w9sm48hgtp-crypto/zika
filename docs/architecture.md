# 系统架构说明 — 「字卡」

> 版本：v1 | 更新日期：2026-07-03

---

## 架构概览

```
┌────────────────────────────────────┐
│         浏览器 (华为手机)            │
│                                    │
│  ┌──────────┐  ┌───────────────┐  │
│  │  React UI │  │ Service Worker│  │
│  │  (页面+组件)│  │  (离线/缓存)   │  │
│  └────┬─────┘  └───────────────┘  │
│       │                            │
│  ┌────┴─────┐  ┌───────────────┐  │
│  │  Zustand │  │   Dexie.js    │  │
│  │ (状态层)  │◄─┤ (IndexedDB)    │  │
│  └──────────┘  └───────────────┘  │
│                                    │
│  ┌────────────────────────────┐   │
│  │     Browser APIs            │   │
│  │  Notification | Vibration   │   │
│  └────────────────────────────┘   │
└────────────────────────────────────┘
```

## 数据流

```
用户操作 → Zustand Action → Dexie CRUD → IndexedDB
                ↓
          React 组件重渲染
```

1. 所有数据操作通过 `src/db/` 下的 store 函数封装
2. 页面组件通过 `src/stores/` 中的 Zustand hooks 获取状态
3. 组件不直接操作 IndexedDB

## 路由映射

| 路径 | 页面 | 底部导航 |
|------|------|----------|
| `/chat` | ChatPage | 聊天 |
| `/companion` | CompanionPage | 陪伴 |
| `/daily` | DailyPage | 每日 |
| `/letters` | LettersPage | 书信 |
| `/profile` | ProfilePage | 我的 |
| `/` | → 重定向到 `/chat` | - |

## 数据库表

| 表名 | 主键 | 用途 |
|------|------|------|
| cards | ++id | 字卡库 |
| chatMessages | ++id | 聊天消息 |
| companionRecords | ++id | 陪伴记录 |
| dailyRecords | ++id | 每日记录 |
| moodTags | ++id | 情绪标签 |
| letters | ++id | 书信 |
| periodRecords | ++id | 生理期记录 |
| warmMessages | ++id | 温暖留言 |
| settings | key | 应用设置 |

## 关键策略

- **字卡抽取**：每次回复从符合条件的字卡中随机选取，不重复连续出现
- **生理期预测**：基于最近 3 次周期平均值推算
- **书信回信**：发信后 24 小时触发，由 10~15 条随机字卡组成
- **每日重置**：以本地时间零点为界

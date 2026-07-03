# 技术选型说明 — 「字卡」

> 版本：v1 | 更新日期：2026-07-03

---

## 技术栈一览

| 层面 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 应用类型 | PWA | - | 跨平台，免安装，可添加到桌面 |
| 前端框架 | React | 18+ | UI 组件化 |
| 类型系统 | TypeScript | 5+ | 类型安全 |
| 构建工具 | Vite | 6+ | 开发/构建 |
| 路由 | React Router | v6+ | 页面路由 |
| 状态管理 | Zustand | 5+ | 轻量状态 |
| 本地存储 | Dexie.js | 4+ | IndexedDB 封装 |
| PWA 插件 | vite-plugin-pwa | 1+ | SW + Manifest |
| 样式方案 | CSS 变量 + App.css | - | 全局设计令牌 + 样式 |

## 为什么不选其他方案

| 被否决 | 原因 |
|--------|------|
| 鸿蒙原生 | 开发门槛高，需上架商店 |
| React Native | 仍需构建 APK，安装门槛 |
| Vue | 个人偏好 React 生态 |
| localStorage | 容量仅 5MB，不够存图片 |
| Tailwind CSS | 增加学习成本，CSS 变量更直观 |

## PWA 优势（对本项目）

- 华为手机浏览器打开即用
- 添加到桌面后，几乎与原生 App 体验一致
- 无需应用商店审核
- Service Worker 支持离线访问
- Notification API 支持通知提醒

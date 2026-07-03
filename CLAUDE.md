# CLAUDE.md — 「字卡」恋爱陪伴App

> 这是给 Claude Code AI 助手的工作指引文件。
> 每个开发会话开始时，Claude 应首先阅读此文件。

---

## 项目概述

**字卡**是一款 PWA 恋爱陪伴应用，仅供一位用户个人使用。
核心功能：模拟与另一半的字卡聊天、陪伴计时、每日记录、书信、生理期追踪。
数据全部本地存储（IndexedDB），不上传任何服务器。

## 用户说明

- 用户是编程零基础的小白
- 只用华为手机访问（Android 浏览器）
- 不需要上架应用商店
- 所有解释应通俗易懂

## 关键文件路径

### 项目文档（docs/）

| 文件 | 用途 | 何时读 |
|------|------|--------|
| [docs/requirements.md](docs/requirements.md) | 完整需求规格 | 开始任何功能前 |
| [docs/tech-stack.md](docs/tech-stack.md) | 技术选型说明 | 不确定该用什么库时 |
| [docs/design-spec.md](docs/design-spec.md) | UI 设计规范（颜色/字体/间距） | 写任何 UI 代码前 |
| [docs/architecture.md](docs/architecture.md) | 系统架构 + 数据流 | 理解整体结构 |
| [docs/development-plan.md](docs/development-plan.md) | 分阶段开发计划 | 确认当前阶段和进度 |

### 开发日志（dev-logs/）

每天开发结束后，在该文件夹创建 `YYYY-MM-DD.md` 文件，格式：
```markdown
# 开发日志 YYYY-MM-DD

## 今日完成
- xxx

## 待办事项
- xxx

## 遇到的问题
- xxx
```

### 源码结构

```
src/
├── main.tsx          # 应用入口
├── App.tsx           # 根组件 + 路由
├── App.css           # 全局布局样式
├── index.css         # CSS 变量 + 重置
├── db/index.ts       # Dexie 数据库 + 所有数据接口
├── stores/           # Zustand 状态管理
├── hooks/            # 自定义 Hooks
├── utils/            # 工具函数
├── components/       # 可复用组件
│   ├── common/       # 通用组件
│   ├── chat/         # 聊天相关
│   ├── companion/    # 陪伴计时
│   ├── daily/        # 每日记录
│   ├── letters/      # 书信
│   ├── period/       # 生理期
│   └── settings/     # 设置
└── pages/            # 页面级组件
```

## 开发工作流

1. **开始前**：查看 [docs/development-plan.md](docs/development-plan.md) 确认当前应做的阶段
2. **写代码前**：阅读 [docs/design-spec.md](docs/design-spec.md) 对齐 UI 风格
3. **数据操作**：永远通过 `src/db/index.ts` 中定义的 Dexie 表操作，不直接使用 localStorage
4. **样式**：优先使用 `src/index.css` 中的 CSS 变量，不写硬编码颜色值
5. **每阶段完成后**：暂停，等用户确认再进入下一阶段
6. **每日结束后**：更新 [dev-logs/](dev-logs/) 日志
7. **遇到需求疑问**：参考 [docs/requirements.md](docs/requirements.md)，仍有疑问则问用户

## 技术约束

- 纯前端 PWA，无后端服务器
- 所有数据存 IndexedDB（Dexie.js 封装）
- 最大显示宽度 480px（手机适配）
- 不引入大型 UI 库（如 Ant Design）
- 图片用 base64 存 IndexedDB 或 FileReader API 处理

## 启动方式

```bash
npm run dev      # 开发服务器（手机同 WiFi 可访问）
npm run build    # 生产构建
npm run preview  # 预览生产构建
```

## 与用户协作原则

- 每阶段完成后暂停并确认
- 用通俗语言解释技术决策
- 尊重用户的审美偏好（简洁温暖）
- 优先保证核心功能稳定，再考虑花哨特性

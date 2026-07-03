# UI 设计规范 — 「字卡」

> 版本：v1 | 更新日期：2026-07-03

---

## 设计原则

- **简洁**：无多余装饰，信息层级清晰
- **温暖**：米白色系为主，柔和圆角
- **直观**：操作路径短，按钮位置顺手

## 色彩系统

| 令牌 | 色值 | 用途 |
|------|------|------|
| `--color-bg` | `#FFF8F0` | 页面背景 |
| `--color-bg-warm` | `#FFF3E6` | 暖色背景区 |
| `--color-surface` | `#FFFFFF` | 卡片/输入框背景 |
| `--color-text-primary` | `#4A3728` | 主文字 |
| `--color-text-secondary` | `#8B7355` | 次要文字 |
| `--color-text-hint` | `#B8A898` | 提示文字 |
| `--color-bubble-self` | `#FFF3E0` | 用户气泡 |
| `--color-bubble-partner` | `#FFF8F0` | 对方气泡 |
| `--color-accent` | `#D4956B` | 强调色/主按钮 |
| `--color-success` | `#8FAF7E` | 完成状态 |
| `--color-warning` | `#E8C98E` | 提醒状态 |
| `--color-danger` | `#D4958B` | 错误/删除 |

## 字体

```
font-family: -apple-system, BlinkMacSystemFont,
  'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
  'Microsoft YaHei', sans-serif;
```

| 级别 | 字号 | 用途 |
|------|------|------|
| xs | 11px | 辅助信息 |
| sm | 13px | 次要文字、时间 |
| md | 15px | 正文 |
| lg | 17px | 标题 |
| xl | 20px | 页面标题 |

## 间距

| 令牌 | 值 | 用途 |
|------|------|------|
| xs | 4px | 紧凑间距 |
| sm | 8px | 元素内间距 |
| md | 12px | 元素间间距 |
| lg | 16px | 区块间距 |
| xl | 20px | 段落间距 |
| 2xl | 24px | 大区块间距 |

## 圆角

| 令牌 | 值 | 用途 |
|------|------|------|
| sm | 8px | 小元素 |
| md | 12px | 卡片 |
| lg | 16px | 大气泡 |
| xl | 20px | 大卡片 |
| full | 9999px | 按钮/头像 |

## 底部导航

- 高度：56px
- 纯文字，无图标
- 激活态用强调色 `#D4956B`
- 等距分布 5 个 tab

## 聊天界面

- 用户气泡：`#FFF3E0` 底 + `#F5D5B8` 边框
- 对方气泡：`#FFF8F0` 底 + `#EDE0D4` 边框
- 头像：圆形，用户可替换

## 移动端适配

- 最大宽度 480px，居中显示
- 防止 iOS 橡皮筋效果
- 底部适配安全区域

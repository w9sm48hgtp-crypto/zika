import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ===== Service Worker 强制更新检查 =====
// 解决第三方 WebView（如"一个木函"）缓存过于激进的问题

let updateTimer: ReturnType<typeof setTimeout> | null = null

/** 强制触发一次 service worker 更新检查 */
function checkForUpdate() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready.then((reg) => {
    // 如果有等待中的 SW，说明之前就检测到了更新，直接通知它 skipWaiting
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      return
    }
    // 否则手动触发一次更新检查
    reg.update().catch(() => {})
  })
}

/** 监听 SW 状态变化，有新版本就刷新页面 */
navigator.serviceWorker?.ready.then((reg) => {
  reg.addEventListener('updatefound', () => {
    const newWorker = reg.installing
    if (!newWorker) return
    newWorker.addEventListener('statechange', () => {
      // 新 SW 安装完毕且没有旧 SW 控制页面时，直接激活
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        console.log('[SW] 检测到新版本，即将刷新...')
        setTimeout(() => window.location.reload(), 300)
      }
    })
  })
})

// 每次页面从后台切回前台时，强制检查更新
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // 清除之前的定时器，避免重复检查
    if (updateTimer) clearTimeout(updateTimer)
    updateTimer = setTimeout(() => {
      checkForUpdate()
      updateTimer = null
    }, 500) // 等半秒，避免用户快速切换时频繁触发
  }
})

// 首次加载后 1 秒也检查一次
setTimeout(checkForUpdate, 1000)

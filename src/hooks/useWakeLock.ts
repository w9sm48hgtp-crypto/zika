import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * 屏幕常亮 Hook
 * 使用 Wake Lock API 防止屏幕自动熄灭
 * 当 keepScreenOn 设置为 true 时激活
 */
export function useWakeLock() {
  const keepScreenOn = useSettingsStore((s) => s.keepScreenOn);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function requestWakeLock() {
      // 不支持 Wake Lock API 的浏览器直接返回
      if (!('wakeLock' in navigator)) return;

      try {
        // 先释放旧的锁
        if (wakeLockRef.current) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        }

        if (!keepScreenOn || cancelled) return;

        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('[WakeLock] 屏幕常亮已启用');

        // 监听锁的释放（用户切换标签页等）
        wakeLockRef.current.addEventListener('release', () => {
          console.log('[WakeLock] 屏幕常亮锁已释放');
          wakeLockRef.current = null;
        });
      } catch (err) {
        // 用户交互不足或浏览器不支持时会失败
        console.warn('[WakeLock] 请求失败:', err);
      }
    }

    // 当页面从后台恢复时重新获取锁
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && keepScreenOn && !wakeLockRef.current) {
        requestWakeLock();
      }
    }

    requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // 组件卸载时释放锁
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [keepScreenOn]);
}

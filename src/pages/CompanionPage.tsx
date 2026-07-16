import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompanionStore, formatSeconds } from '../stores/companionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { pickEncouragement } from '../components/settings/EncouragementManager';
import { db, type SoundTrack, type CompanionRecord } from '../db';
import TodoList from '../components/companion/TodoList';
import styles from './CompanionPage.module.css';

const SCENES: { key: CompanionRecord['scene']; label: string }[] = [
  { key: 'study', label: '学习' },
  { key: 'eat', label: '吃饭' },
  { key: 'sleep', label: '睡眠' },
  { key: 'custom', label: '自定义' },
];

const SCENE_LABEL: Record<string, string> = {
  study: '学习',
  eat: '吃饭',
  sleep: '睡眠',
  custom: '自定义',
};

const DURATION_PRESETS = [
  { minutes: 15, label: '15 分钟' },
  { minutes: 30, label: '30 分钟' },
  { minutes: 60, label: '1 小时' },
  { minutes: 120, label: '2 小时' },
];

function CompanionPage() {
  const navigate = useNavigate();
  const {
    scene, customSceneName, mode, targetMinutes,
    isRunning, startTime, elapsedSeconds,
    setScene, setCustomSceneName, setMode, setTargetMinutes,
    startTimer, stopTimer, cancelTimer, tick,
    checkRunningTimer,
  } = useCompanionStore();
  const { vibrationEnabled, partnerName, loadSettings } = useSettingsStore();

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoaded = useRef(false);
  const notifiedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 鼓励语句
  const [startMsg, setStartMsg] = useState<string | null>(null);
  const [endMsg, setEndMsg] = useState<string | null>(null);
  const endMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 白噪音
  const [soundTracks, setSoundTracks] = useState<SoundTrack[]>([]);
  const [selectedSoundId, setSelectedSoundId] = useState<number | null>(null);

  // 初始化
  useEffect(() => {
    if (!isLoaded.current) {
      isLoaded.current = true;
      loadSettings();
      checkRunningTimer();
    }
  }, [loadSettings, checkRunningTimer]);

  // 加载白噪音列表
  const loadSounds = useCallback(async () => {
    const list = await db.soundTracks.orderBy('createdAt').reverse().toArray();
    setSoundTracks(list);
  }, []);

  useEffect(() => { loadSounds(); }, [loadSounds]);

  // 计时器心跳
  useEffect(() => {
    if (isRunning) {
      notifiedRef.current = false;
      tickRef.current = setInterval(() => { tick(); }, 1000);
    } else {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [isRunning, tick]);

  // 倒计时到零检测
  useEffect(() => {
    if (!isRunning || mode !== 'countDown' || !startTime) return;
    const targetSeconds = targetMinutes * 60;
    if (elapsedSeconds >= targetSeconds && !notifiedRef.current) {
      notifiedRef.current = true;
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('陪伴计时', { body: '时间到啦！', icon: '/icons/icon-192x192.png' });
        }
      } catch { /* WebView 可能不支持 Notification */ }
      if (vibrationEnabled && navigator.vibrate) {
        navigator.vibrate([300, 100, 300]);
      }
      // 结束时鼓励语句
      pickEncouragement(scene, 'end').then(msg => {
        if (msg) setEndMsg(msg);
      });
      // 停止白噪音
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setSelectedSoundId(null);
      stopTimer();
    }
  }, [isRunning, mode, targetMinutes, startTime, elapsedSeconds, vibrationEnabled, stopTimer, scene]);

  // 结束语句自动消失
  useEffect(() => {
    if (endMsg) {
      endMsgTimerRef.current = setTimeout(() => setEndMsg(null), 5000);
    }
    return () => { if (endMsgTimerRef.current) clearTimeout(endMsgTimerRef.current); };
  }, [endMsg]);

  // 清理
  useEffect(() => {
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };
  }, []);

  // 请求通知权限并开始
  const handleStart = async () => {
    try {
      // 非阻塞请求通知权限（安卓 WebView 可能不支持 Notification API）
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch { /* 通知权限请求失败不影响计时器启动 */ }

    // 先启动计时器，不等待鼓励语句
    startTimer().catch(() => {});
    setEndMsg(null);

    // 鼓励语句异步加载（不阻塞计时）
    try {
      const msg = await pickEncouragement(scene, 'start');
      setStartMsg(msg);
    } catch { /* 鼓励语句加载失败不影响计时 */ }
  };

  // 手动结束
  const handleStop = async () => {
    const msg = await pickEncouragement(scene, 'end');
    if (msg) setEndMsg(msg);
    setStartMsg(null);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setSelectedSoundId(null);
    await stopTimer();
  };

  // 取消
  const handleCancel = async () => {
    setStartMsg(null);
    setEndMsg(null);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setSelectedSoundId(null);
    await cancelTimer();
  };

  // 白噪音播放
  const handleSoundChange = (trackId: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const id = trackId ? Number(trackId) : null;
    setSelectedSoundId(id);
    if (id) {
      const track = soundTracks.find(t => t.id === id);
      if (track) {
        const audio = new Audio(track.audioData);
        audio.loop = true;
        audio.play().catch(() => {});
        audioRef.current = audio;
      }
    }
  };

  const stopSound = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setSelectedSoundId(null);
  };

  // 倒计时显示剩余时间
  const displaySeconds = mode === 'countDown' && isRunning
    ? Math.max(0, targetMinutes * 60 - elapsedSeconds)
    : elapsedSeconds;

  const sceneName = scene === 'custom' ? (customSceneName || '自定义') : SCENE_LABEL[scene];
  const companionName = partnerName || '他';
  const sceneAction = scene === 'custom'
    ? `陪你${sceneName}`
    : scene === 'study' ? `陪你一起学习`
    : scene === 'eat' ? `陪你一起吃饭`
    : `陪你一起睡觉`;

  // 当前场景可用的白噪音
  const sceneSounds = soundTracks.filter(t => !t.scene || t.scene === scene);

  return (
    <div className="page">
      <h1 className="page-title">陪伴</h1>

      <div className={styles.card}>
        {/* 装饰图 */}
        <svg
          className={styles.timerDeco}
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="timerDecoFilter" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="1" dy="0" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
              <feDropShadow dx="-1" dy="0" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
              <feDropShadow dx="0" dy="1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
              <feDropShadow dx="0" dy="-1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
              <feDropShadow dx="1" dy="1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
              <feDropShadow dx="-1" dy="-1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
              <feDropShadow dx="1" dy="-1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
              <feDropShadow dx="-1" dy="1" stdDeviation="0" flood-color="#fff" flood-opacity="1" />
              <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.15" />
            </filter>
          </defs>
          <image
            width="100" height="100"
            href={`${import.meta.env.BASE_URL}decorations/6.png`}
            filter="url(#timerDecoFilter)"
          />
        </svg>

        {/* 场景选择 */}
        <div className={styles.sceneRow}>
          {SCENES.map((s) => (
            <button
              key={s.key}
              className={`${styles.scenePill} ${scene === s.key ? styles.scenePillActive : ''}`}
              onClick={() => setScene(s.key)}
              disabled={isRunning}
            >
              {s.label}
            </button>
          ))}
        </div>

        {scene === 'custom' && (
          <input
            className={styles.customInput}
            value={customSceneName}
            onChange={(e) => setCustomSceneName(e.target.value)}
            placeholder="输入场景名称..."
            disabled={isRunning}
          />
        )}

        {/* 计时器显示 */}
        <div className={styles.timerDisplay}>
          <div className={styles.timerCompanion}>
            {companionName} {sceneAction}
          </div>
          <div className={styles.timerValue}>{formatSeconds(displaySeconds)}</div>
          <div className={styles.timerLabel}>
            {isRunning && mode === 'countDown' ? '还剩' : ''}
            {!isRunning && mode === 'countDown' && `目标：${targetMinutes} 分钟`}
          </div>
        </div>

        {/* 鼓励语句 - 开始时 */}
        {startMsg && isRunning && (
          <div className={styles.encouragementBanner}>{startMsg}</div>
        )}

        {/* 鼓励语句 - 结束时 */}
        {endMsg && (
          <div className={styles.encouragementToast}>{endMsg}</div>
        )}

        {/* 白噪音选择器 */}
        {isRunning && sceneSounds.length > 0 && (
          <div className={styles.soundRow}>
            <span className={styles.soundLabel}>白噪音</span>
            <select
              className={styles.soundSelect}
              value={selectedSoundId ?? ''}
              onChange={e => handleSoundChange(e.target.value)}
            >
              <option value="">不播放</option>
              {sceneSounds.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {selectedSoundId && (
              <button className={styles.soundStop} onClick={stopSound}>停止</button>
            )}
          </div>
        )}

        {/* 模式切换 */}
        {!isRunning && (
          <>
            <div className={styles.modeRow}>
              <button
                className={`${styles.modeBtn} ${mode === 'countUp' ? styles.modeBtnActive : ''}`}
                onClick={() => setMode('countUp')}
              >
                正计时
              </button>
              <button
                className={`${styles.modeBtn} ${mode === 'countDown' ? styles.modeBtnActive : ''}`}
                onClick={() => setMode('countDown')}
              >
                倒计时
              </button>
            </div>

            {mode === 'countDown' && (
              <div className={styles.durationSection}>
                <div className={styles.presetRow}>
                  {DURATION_PRESETS.map((p) => (
                    <button
                      key={p.minutes}
                      className={`${styles.presetBtn} ${targetMinutes === p.minutes ? styles.presetBtnActive : ''}`}
                      onClick={() => setTargetMinutes(p.minutes)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className={styles.customDuration}>
                  <span>自定义：</span>
                  <input
                    type="number"
                    className={styles.durationInput}
                    value={targetMinutes}
                    onChange={(e) => setTargetMinutes(Number(e.target.value) || 1)}
                    min={1}
                    max={480}
                  />
                  <span>分钟</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* 控制按钮 */}
        <div className={styles.controlRow}>
          {!isRunning ? (
            <button className={styles.startBtn} onClick={handleStart}>
              开始
            </button>
          ) : (
            <>
              <button className={styles.stopBtn} onClick={handleStop}>
                结束
              </button>
              <button className={styles.cancelBtn} onClick={handleCancel}>
                取消
              </button>
            </>
          )}
        </div>
      </div>

      {/* 历史记录入口 */}
      <button className={styles.historyBtn} onClick={() => navigate('/companion/history')}>
        查看陪伴记录
      </button>

      {/* 每日 Todo List */}
      <TodoList partnerName={partnerName || '他'} />
    </div>
  );
}

export default CompanionPage;

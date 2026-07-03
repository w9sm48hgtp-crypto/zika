import { useState, useEffect, useCallback, useRef } from 'react';
import { db, type SoundTrack } from '../../db';
import styles from './SoundManager.module.css';

const SCENE_LABELS: Record<string, string> = {
  study: '学习',
  eat: '吃饭',
  sleep: '睡眠',
  other: '其他',
};

const SCENES = [
  { key: 'study' as const, label: '学习' },
  { key: 'eat' as const, label: '吃饭' },
  { key: 'sleep' as const, label: '睡眠' },
  { key: 'other' as const, label: '其他' },
];

export function SoundManager() {
  const [tracks, setTracks] = useState<SoundTrack[]>([]);
  const [name, setName] = useState('');
  const [scene, setScene] = useState<SoundTrack['scene']>('study');
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadTracks = useCallback(async () => {
    const list = await db.soundTracks.orderBy('createdAt').reverse().toArray();
    setTracks(list);
  }, []);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  const handleUploadClick = () => {
    setError('');
    if (!name.trim()) {
      setError('请先输入声音名称');
      return;
    }
    fileRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
      });

      await db.soundTracks.add({
        name: name.trim(),
        scene,
        audioData: dataUrl,
        createdAt: Date.now(),
      });
      setName('');
      setUploading(false);
      loadTracks();
    } catch (err) {
      setError('上传失败，请重试');
      setUploading(false);
    }

    // 清除 input 以便可以重新选择同一文件
    if (e.target) e.target.value = '';
  };

  const handleDelete = async (id: number) => {
    if (playingId === id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
    }
    await db.soundTracks.delete(id);
    loadTracks();
  };

  const handlePlay = (track: SoundTrack) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
    } else {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      const audio = new Audio(track.audioData);
      audio.loop = true;
      audio.play().catch(() => {});
      audioRef.current = audio;
      setPlayingId(track.id!);
    }
  };

  return (
    <div className={styles.container}>
      {/* 上传区 */}
      <div className={styles.uploadRow}>
        <input
          className={styles.nameInput}
          value={name}
          onChange={e => { setName(e.target.value); setError(''); }}
          placeholder="输入声音名称"
        />
        <select className={styles.sceneSelect} value={scene} onChange={e => setScene(e.target.value as SoundTrack['scene'])}>
          {SCENES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button
          className={styles.uploadBtn}
          onClick={handleUploadClick}
          disabled={uploading}
        >
          {uploading ? '上传中...' : '选择音频文件'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {/* 列表 */}
      <div className={styles.list}>
        {tracks.length === 0 && !uploading && (
          <p className={styles.empty}>暂无白噪音，请先输入名称再上传音频文件</p>
        )}
        {tracks.map(track => (
          <div key={track.id} className={styles.item}>
            <div className={styles.itemInfo}>
              <span className={styles.itemName}>{track.name}</span>
              <span className={styles.itemScene}>{SCENE_LABELS[track.scene] || track.scene}</span>
            </div>
            <div className={styles.itemActions}>
              <button
                className={playingId === track.id ? styles.stopBtn : styles.playBtn}
                onClick={() => handlePlay(track)}
              >
                {playingId === track.id ? '停止' : '试听'}
              </button>
              <button className={styles.delBtn} onClick={() => handleDelete(track.id!)}>删除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, type Photo } from '../db';
import styles from './PhotoDetailPage.module.css';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function PhotoDetailPage() {
  const navigate = useNavigate();
  const { photoId } = useParams<{ photoId: string }>();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCaption, setEditingCaption] = useState(false);
  const [caption, setCaption] = useState('');

  useEffect(() => {
    loadPhoto();
  }, [photoId]);

  const loadPhoto = async () => {
    if (!photoId) return;
    setLoading(true);
    const id = parseInt(photoId);
    const p = await db.photos.get(id);
    if (!p) {
      setLoading(false);
      return;
    }
    setPhoto(p);
    setCaption(p.caption || '');

    // 加载同相册的所有照片（用于导航）
    const list = await db.photos
      .where('albumId')
      .equals(p.albumId)
      .sortBy('createdAt');
    setAllPhotos(list);
    setLoading(false);
  };

  const handleSaveCaption = async () => {
    if (!photo) return;
    await db.photos.update(photo.id!, { caption: caption.trim() });
    setPhoto({ ...photo, caption: caption.trim() });
    setEditingCaption(false);
  };

  const handleDelete = async () => {
    if (!photo) return;
    if (!confirm('确定删除这张照片吗？')) return;
    await db.photos.delete(photo.id!);
    navigate(-1);
  };

  const currentIndex = allPhotos.findIndex(p => p.id === photo?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allPhotos.length - 1;

  const goTo = (index: number) => {
    const p = allPhotos[index];
    if (p?.id != null) {
      navigate(`/records/daily/album/${p.id}`, { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="page">
        <p className={styles.loading}>加载中...</p>
      </div>
    );
  }

  if (!photo) {
    return (
      <div className="page">
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>←</button>
          <h1 className={styles.headerTitle}>照片</h1>
        </div>
        <p className={styles.loading}>照片不存在或已删除</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>←</button>
        <h1 className={styles.headerTitle}>照片详情</h1>
      </div>

      {/* 照片 */}
      <div className={styles.photoContainer}>
        <img className={styles.photoImage} src={photo.dataUrl} alt={photo.caption || '照片'} />

        {/* 说明 */}
        <div className={styles.captionSection}>
          {editingCaption ? (
            <div>
              <input
                className={styles.captionInput}
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="添加照片说明..."
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSaveCaption(); }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className={styles.saveCaptionBtn} onClick={handleSaveCaption}>保存</button>
                <button className={styles.cancelCaptionBtn} onClick={() => { setEditingCaption(false); setCaption(photo.caption || ''); }}>取消</button>
              </div>
            </div>
          ) : (
            <>
              {photo.caption ? (
                <p className={styles.captionText}>{photo.caption}</p>
              ) : (
                <p className={styles.captionLabel}>暂无说明</p>
              )}
              <p className={styles.photoTime}>{formatTime(photo.createdAt)}</p>
            </>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className={styles.actions}>
        {!editingCaption && (
          <button className={styles.editCaptionBtn} onClick={() => setEditingCaption(true)}>
            {photo.caption ? '编辑说明' : '添加说明'}
          </button>
        )}
        <button className={styles.deleteBtn} onClick={handleDelete}>删除照片</button>
      </div>

      {/* 前后导航 */}
      {allPhotos.length > 1 && (
        <div className={styles.navButtons}>
          <button className={styles.navBtn} disabled={!hasPrev} onClick={() => goTo(currentIndex - 1)}>
            ← 上一张
          </button>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-hint)', alignSelf: 'center' }}>
            {currentIndex + 1} / {allPhotos.length}
          </span>
          <button className={styles.navBtn} disabled={!hasNext} onClick={() => goTo(currentIndex + 1)}>
            下一张 →
          </button>
        </div>
      )}
    </div>
  );
}

export default PhotoDetailPage;

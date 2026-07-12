import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, type PhotoAlbum, type Photo } from '../db';
import styles from './AlbumPage.module.css';

function AlbumPage() {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [photosMap, setPhotosMap] = useState<Record<number, Photo[]>>({});
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const albumList = await db.photoAlbums.orderBy('sortOrder').toArray();
    setAlbums(albumList);

    // 加载每个相册的照片（最多取前 9 张用于预览）
    const map: Record<number, Photo[]> = {};
    for (const album of albumList) {
      const photos = await db.photos
        .where('albumId')
        .equals(album.id!)
        .sortBy('createdAt');
      map[album.id!] = photos;
    }
    setPhotosMap(map);
    setLoading(false);
  };

  const handleAddAlbum = async () => {
    const name = newName.trim();
    if (!name) return;
    const maxOrder = albums.reduce((max, a) => Math.max(max, a.sortOrder), 0);
    await db.photoAlbums.add({
      name,
      sortOrder: maxOrder + 1,
      createdAt: Date.now(),
    });
    setNewName('');
    setIsAdding(false);
    await loadData();
  };

  const handleDeleteAlbum = async (id: number) => {
    if (!confirm('确定删除这个相册及其所有照片吗？')) return;
    // 删除相册下所有照片
    const photos = await db.photos.where('albumId').equals(id).toArray();
    for (const p of photos) {
      await db.photos.delete(p.id!);
    }
    await db.photoAlbums.delete(id);
    if (expandedId === id) setExpandedId(null);
    await loadData();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadTarget == null) return;

    // 读取为 base64
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      await db.photos.add({
        albumId: uploadTarget,
        caption: '',
        dataUrl,
        createdAt: Date.now(),
      });
      await loadData();
    };
    reader.readAsDataURL(file);

    // 重置以便再次选择同一文件
    e.target.value = '';
  };

  const openUpload = (albumId: number) => {
    setUploadTarget(albumId);
    fileInputRef.current?.click();
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="page">
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/records/daily')}>←</button>
        <h1 className={styles.headerTitle}>相册</h1>
        <button className={styles.addAlbumBtn} onClick={() => setIsAdding(true)}>＋ 新建</button>
      </div>

      {/* 新建分类 */}
      {isAdding && (
        <div className={styles.addRow}>
          <input
            className={styles.albumInput}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="相册名称，如「我们的日常」"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleAddAlbum(); }}
          />
          <button className={styles.albumSaveBtn} onClick={handleAddAlbum} disabled={!newName.trim()}>创建</button>
          <button className={styles.albumCancelBtn} onClick={() => { setIsAdding(false); setNewName(''); }}>取消</button>
        </div>
      )}

      {/* 隐藏文件输入 */}
      <input
        ref={fileInputRef}
        className={styles.hiddenInput}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
      />

      {/* 分类列表 */}
      {loading ? (
        <p className={styles.emptyHint}>加载中...</p>
      ) : albums.length === 0 && !isAdding ? (
        <div className={styles.emptyHint}>
          <span className={styles.emptyIcon}>📷</span>
          还没有相册，创建一个吧
        </div>
      ) : (
        <div className={styles.albumList}>
          {albums.map(album => {
            const photos = photosMap[album.id!] || [];
            const isExpanded = expandedId === album.id;
            const displayPhotos = photos.slice(0, 9);

            return (
              <div key={album.id} className={styles.albumCard}>
                <div className={styles.albumCardHeader} onClick={() => toggleExpand(album.id!)}>
                  <span>
                    <span className={styles.albumName}>{album.name}</span>
                    <span className={styles.albumCount}>({photos.length})</span>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                      className={styles.albumAddPhoto}
                      onClick={e => { e.stopPropagation(); openUpload(album.id!); }}
                    >
                      ＋ 添加
                    </button>
                    <button
                      className={styles.albumDelete}
                      onClick={e => { e.stopPropagation(); handleDeleteAlbum(album.id!); }}
                    >
                      删除
                    </button>
                    <span className={`${styles.albumArrow} ${isExpanded ? styles.albumArrowOpen : ''}`}>▼</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className={styles.photoGrid}>
                    {displayPhotos.map(photo => (
                      <img
                        key={photo.id}
                        className={styles.photoThumb}
                        src={photo.dataUrl}
                        alt={photo.caption || '照片'}
                        onClick={() => navigate(`/records/daily/album/${photo.id}`)}
                      />
                    ))}
                    <div
                      className={styles.photoThumbPlaceholder}
                      onClick={() => openUpload(album.id!)}
                    >
                      ＋
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AlbumPage;

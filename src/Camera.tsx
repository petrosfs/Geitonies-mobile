import { useEffect, useRef, useState } from 'react';
import { Modal } from './components';
import { squarePhoto, useT } from './ui';

/**
 * Live camera inside the app: preview with the square that will be kept, shutter, switch front/back.
 * Calls onFail if the camera can't be opened (no permission, no camera), so the caller can fall back.
 */
export function CameraSheet({ onShot, onClose, onFail }: { onShot: (photo: string) => void; onClose: () => void; onFail: () => void }) {
  const { t } = useT();
  const video = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 720 } }, audio: false })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((tr) => tr.stop()); return; }
        stream = s;
        if (video.current) { video.current.srcObject = s; void video.current.play().then(() => setReady(true)).catch(() => setReady(true)); }
      })
      .catch(() => { if (!cancelled) onFail(); });
    return () => { cancelled = true; stream?.getTracks().forEach((tr) => tr.stop()); setReady(false); };
  }, [facing]); // eslint-disable-line react-hooks/exhaustive-deps
  const shoot = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    onShot(squarePhoto(v, v.videoWidth, v.videoHeight, facing === 'user'));
  };
  return (
    <Modal onClose={onClose}>
      <h2>📷 {t('cameraTitle')}</h2>
      <div className="camera">
        <video ref={video} playsInline muted className={facing === 'user' ? 'mirror' : ''} />
        <div className="camera-frame" aria-hidden />
        {!ready && <div className="camera-wait small">{t('cameraWait')}</div>}
      </div>
      <div className="row camera-actions">
        <button className="btn ghost" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}>🔄 {t('cameraSwitch')}</button>
        <button className="btn primary grow" disabled={!ready} onClick={shoot}>📸 {t('cameraShoot')}</button>
      </div>
      <button className="btn wide" onClick={onClose}>{t('cancel')}</button>
    </Modal>
  );
}

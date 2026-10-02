import type { ReactNode } from 'react';
import { pieceText } from './three/pieces';
import { pieceThumb } from './three/thumbs';

/* Small shared UI components. Hooks and helpers live in ./ui.ts */

/** the player's piece as a small picture (falls back to an emoji where 3D isn't available) */
export function PieceIcon({ id, color, size = 20 }: { id: string; color: string; size?: number }) {
  // render at twice the displayed size (sharp on phone screens); few sizes, so the cache stays small
  const px = size > 100 ? 320 : size > 56 ? 192 : 128;
  const src = pieceThumb(id, color, px);
  if (!src) return <span className="piece-txt" style={{ fontSize: size * 0.85 }}>{pieceText(id)}</span>;
  return <img className="piece-img" src={src} alt="" width={size} height={size} />;
}
export function Avatar({ color, emoji, photo, size = 32 }: { color: string; emoji: string; photo?: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, borderColor: color, fontSize: size * 0.55 }}>
      {photo ? <img src={photo} alt="" /> : <PieceIcon id={emoji} color={color} size={size * 0.92} />}
    </span>
  );
}
export function Modal({ children, onClose, tone }: { children: ReactNode; onClose?: () => void; tone?: string }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" style={tone ? { borderTopColor: tone } : undefined} onClick={(e) => e.stopPropagation()} role="dialog">
        {children}
      </div>
    </div>
  );
}

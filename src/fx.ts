/* Sound (synthesised, no files), vibration and shake detection. */

let ctx: AudioContext | null = null;

/** call from a user gesture (tap) so browsers allow sound later */
export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* no audio */ }
}

/** short "clack" of a die hitting the table; strength 0..1 */
export function clack(strength = 1) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 0.05);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800 + Math.random() * 1600;
  bp.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.value = 0.5 * Math.min(1, Math.max(0.15, strength));
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(t);
}

/** soft tick for a token hop */
export function tick() {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(500, t + 0.05);
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.08);
}

/** vibration (Android; iPhone browsers don't support it) */
export function buzz(ms = 15) {
  try { navigator.vibrate?.(ms); } catch { /* ignore */ }
}

type MotionPerm = { requestPermission?: () => Promise<'granted' | 'denied'> };

/** iPhone asks permission for motion sensors; must be called from a tap */
export async function requestMotion(): Promise<boolean> {
  const DME = (window as unknown as { DeviceMotionEvent?: MotionPerm }).DeviceMotionEvent;
  if (!DME) return false;
  if (typeof DME.requestPermission === 'function') {
    try { return (await DME.requestPermission()) === 'granted'; } catch { return false; }
  }
  return true;
}

/** calls onShake when the phone is shaken; returns a stop function */
export function listenShake(onShake: () => void): () => void {
  let last = 0;
  let prev: { x: number; y: number; z: number } | null = null;
  const h = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null || a.y === null || a.z === null) return;
    const cur = { x: a.x, y: a.y, z: a.z };
    if (prev) {
      const delta = Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y) + Math.abs(cur.z - prev.z);
      const now = Date.now();
      if (delta > 28 && now - last > 1500) { last = now; onShake(); }
    }
    prev = cur;
  };
  window.addEventListener('devicemotion', h);
  return () => window.removeEventListener('devicemotion', h);
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/** short police siren (two tones) */
export function siren() {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  for (let k = 0; k < 4; k++) {
    o.frequency.setValueAtTime(k % 2 ? 620 : 880, t + k * 0.28);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.08, t + 0.05);
  g.gain.setValueAtTime(0.08, t + 1.0);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + 1.2);
}

/** metal clank (cage landing) */
export function clank() {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  [520, 787, 1210].forEach((f, i) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0.06 / (i + 1), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(ctx!.destination);
    o.start(t);
    o.stop(t + 0.4);
  });
}

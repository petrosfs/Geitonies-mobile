import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildPiece } from './pieces';

let envTex: THREE.Texture | null = null;

/*
 * Small pictures of the 3D pieces (in a player's colour) for lists, buttons and avatars.
 * One hidden renderer, results cached as image URLs.
 */

let renderer: THREE.WebGLRenderer | null = null;
let failed = false;
const cache = new Map<string, string>();
const SIZE = 128;

function setup() {
  if (renderer || failed) return renderer;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    // don't stop to read the shader compiler's log after every new material (a long freeze on phones)
    renderer.debug.checkShaderErrors = false;
    renderer.setSize(SIZE, SIZE, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  } catch {
    failed = true;
    renderer = null;
  }
  return renderer;
}

/** get the picture maker ready (renderer, lighting), e.g. while the player looks at the home screen */
export function warmUp() { setup(); }

/*
 * Many new pictures at once (the piece picker shows 23) would freeze the screen. A few are drawn
 * straight away in each frame (about 12 ms' worth); the rest wait for the next frames and appear then.
 */
const BUDGET_MS = 12;
let spent = 0;
let resetQueued = false;
const pending = new Map<string, { id: string; color: string; px: number; done: Set<() => void> }>();
let pumping = false;

function chargeFrame(ms: number) {
  spent += ms;
  if (!resetQueued) { resetQueued = true; requestAnimationFrame(() => { spent = 0; resetQueued = false; }); }
}

function pump() {
  pumping = false;
  const start = performance.now();
  for (const [key, job] of pending) {
    if (performance.now() - start > BUDGET_MS) break;
    pending.delete(key);
    pieceThumb(job.id, job.color, job.px);
    job.done.forEach((f) => f());
  }
  if (pending.size) { pumping = true; requestAnimationFrame(pump); }
}

/**
 * The picture now if it is ready or there is time left in this frame; otherwise `undefined`,
 * and `onReady` is called when it has been drawn. `null` means no 3D on this device.
 */
export function thumbSoon(id: string, color: string, px: number, onReady: () => void): string | null | undefined {
  const key = id + '|' + color + '|' + px;
  const hit = cache.get(key);
  if (hit) return hit;
  if (spent < BUDGET_MS && !pending.size) {
    const t0 = performance.now();
    const url = pieceThumb(id, color, px);
    chargeFrame(performance.now() - t0);
    return url;
  }
  const job = pending.get(key) ?? { id, color, px, done: new Set<() => void>() };
  job.done.add(onReady);
  pending.set(key, job);
  if (!pumping) { pumping = true; requestAnimationFrame(pump); }
  return undefined;
}

/** image URL of piece `id` in `color`, or null if 3D isn't available */
export function pieceThumb(id: string, color: string, px = SIZE): string | null {
  const key = id + '|' + color + '|' + px;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = setup();
  if (!r) return null;
  try {
    r.setSize(px, px, false);
    const scene = new THREE.Scene();
    scene.environment = envTex;
    scene.environmentIntensity = 0.7;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a5a76, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(2, 4, 3);
    scene.add(sun);
    const piece = buildPiece(id, color);
    piece.rotation.y = -0.65;
    scene.add(piece);
    const bb = new THREE.Box3().setFromObject(piece);
    const center = bb.getCenter(new THREE.Vector3());
    const size = bb.getSize(new THREE.Vector3()).length();
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
    const dir = new THREE.Vector3(0.15, 0.55, 1).normalize();
    cam.position.copy(center).add(dir.multiplyScalar(size * 1.75));
    cam.lookAt(center);
    r.render(scene, cam);
    const url = r.domElement.toDataURL('image/png');
    // geometry goes; materials stay, so the next picture reuses the compiled shaders instead of compiling again
    scene.traverse((o) => { (o as THREE.Mesh).geometry?.dispose?.(); });
    cache.set(key, url);
    return url;
  } catch {
    return null;
  }
}

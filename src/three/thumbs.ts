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
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose?.();
    });
    cache.set(key, url);
    return url;
  } catch {
    return null;
  }
}

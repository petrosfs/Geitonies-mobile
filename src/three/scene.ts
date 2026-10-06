import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { cellPos } from '../game/layout';
import { board as boardOf, priceOf, sqName } from '../game/engine';
import type { Game, Lang } from '../game/types';
import { buzz, clack, clank, siren, tick } from '../fx';
import { buildPiece, GLIDERS, PIECE_HEIGHT } from './pieces';
import { faceValues, simulateDice } from './dice';

type Side = 'b' | 'l' | 't' | 'r';
export type BoardLight = 'normal' | 'dim' | 'night';
const LIGHT: Record<BoardLight, { board: string; exposure: number; hemi: number; sun: number; env: number; sky: string }> = {
  normal: { board: '#e8ecee', exposure: 1.05, hemi: 1.1, sun: 2.0, env: 0.55, sky: '#0f3b5f' },
  dim: { board: '#c3cacf', exposure: 0.9, hemi: 0.9, sun: 1.6, env: 0.4, sky: '#0c2f4c' },
  night: { board: '#8f989f', exposure: 0.75, hemi: 0.6, sun: 1.2, env: 0.25, sky: '#071a2b' },
};
interface Rect { x0: number; z0: number; x1: number; z1: number; side: Side }

const CORNER = 1.5;
const PHI = 0.48;
/** width of the decorated ring (neighbourhood buildings) around the board */
const RING = 1.4;
const ICON: Record<string, string> = {
  go: '←', jail: '⛓️', parking: '🅿️', gotojail: '🚓', chance: '❓', chest: '🎁', tax: '💶', station: '🚆', utility: '💡',
};
const CORNER_LABEL: Record<string, { el: string; en: string }> = {
  go: { el: 'ΑΦΕΤΗΡΙΑ', en: 'START' },
  jail: { el: 'ΦΥΛΑΚΗ', en: 'JAIL' },
  parking: { el: 'ΠΑΡΚΙΝΓΚ', en: 'PARKING' },
  gotojail: { el: 'ΦΥΛΑΚΗ!', en: 'TO JAIL' },
};

/** board-unit rectangle of square i (0..W, z grows toward the camera side) */
function rectOf(i: number, s: number): Rect {
  const { row, col, side } = cellPos(i, s);
  const n = s + 1;
  const edge = (k: number) => (k === 1 ? 0 : CORNER + (k - 2));
  const size = (k: number) => (k === 1 || k === n ? CORNER : 1);
  return { x0: edge(col), x1: edge(col) + size(col), z0: edge(row), z1: edge(row) + size(row), side };
}

/** rotation that makes text/buildings face the board centre */
const SIDE_ANGLE: Record<Side, number> = { b: 0, l: Math.PI / 2, t: Math.PI, r: -Math.PI / 2 };

export interface SceneEvents {
  onSquare: (sq: number) => void;
  onBusy: (busy: boolean) => void;
  onFollow: (follow: boolean) => void;
  onLost?: () => void;
}

interface TokenState {
  group: THREE.Group;
  sprite: THREE.Sprite;
  shown: number;
  path: number[];
  hopStart: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  photoKey: string;
  glide: boolean;
  jailed: boolean;
  cage?: THREE.Group;
  cageStart: number;
  cageState: 'drop' | 'on' | 'lift';
}

interface DiceAnim {
  frames: Float32Array[]; // per frame: [p1(3) q1(4) p2(3) q2(4)]
  hits: { f: number; s: number }[];
  start: number;
  played: number;
  values: [number, number];
}

export class Scene3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private boardCanvas = document.createElement('canvas');
  private boardTex: THREE.CanvasTexture;
  private boardPlane: THREE.Mesh;
  private buildings = new THREE.Group();
  private tokens = new Map<string, TokenState>();
  private dice: THREE.Mesh[] = [];
  private diceMats: THREE.MeshStandardMaterial[] = [];
  private ring: THREE.Mesh;
  private raf = 0;
  private W = 12;
  private s = 10;
  private N = 40;
  private g: Game | null = null;
  private lang: Lang = 'el';
  private texKey = '';
  private houseKey = '';
  private rolls = -1;
  private diceAnim: DiceAnim | null = null;
  private holdUntil = 0;
  private busy = false;
  private follow = true;
  private sound = true;
  private vibrate = true;
  private cinema = true;
  /** id of the token the camera is chasing, and until when */
  private chase: { id: string; until: number } | null = null;
  private down: { x: number; y: number } | null = null;
  private ro: ResizeObserver;
  private photos: Record<string, string> = {};

  private host: HTMLElement;
  private ev: SceneEvents;

  constructor(host: HTMLElement, ev: SceneEvents) {
    this.host = host;
    this.ev = ev;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);
    // soft studio reflections for the glossy pieces and chrome
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();
    this.renderer.domElement.style.touchAction = 'none';

    this.scene.background = new THREE.Color('#0f3b5f');
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.8, 160); // near/far tight -> more depth precision on phones
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = 1.3;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x2a4a66, 1.1);
    this.hemiLight = hemi;
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0006;      // no self-shadow stripes ("shadow acne")
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun, sun.target);
    this.sunLight = sun;

    this.boardCanvas.width = this.boardCanvas.height = 2048;
    this.boardTex = new THREE.CanvasTexture(this.boardCanvas);
    this.boardTex.colorSpace = THREE.SRGBColorSpace;
    this.boardTex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.boardPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ map: this.boardTex, color: '#e4e9ec', roughness: 0.92, envMapIntensity: 0.25 }),
    );
    this.boardPlane.rotation.x = -Math.PI / 2;
    this.boardPlane.receiveShadow = true;
    this.scene.add(this.boardPlane, this.buildings);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.4, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.scene.add(this.ring);

    // dice
    this.diceMats = [1, 2, 3, 4, 5, 6].map((v) => new THREE.MeshStandardMaterial({ map: dieTexture(v), roughness: 0.35 }));

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => { this.down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointermove', (e) => {
      if (this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 8) this.setFollow(false);
    });
    el.addEventListener('pointerup', (e) => this.onTap(e));
    el.addEventListener('wheel', () => this.setFollow(false), { passive: true });
    // the phone may drop the 3D context (e.g. after a long time in the background): rebuild
    el.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.setBusy(false); this.ev.onLost?.(); });

    try { if (localStorage.getItem('gtn-debug')) (window as unknown as { __scene: Scene3D }).__scene = this; } catch { /* ignore */ }
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.loop();
  }

  private sunLight: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private boardBase: THREE.Object3D[] = [];

  // ---------------- setup per board size ----------------

  private buildBoard(g: Game) {
    const N = boardOf(g).squares.length;
    if (N === this.N && this.boardBase.length) return;
    this.N = N;
    this.s = N / 4;
    this.W = this.s - 1 + 2 * CORNER;
    const W = this.W;
    this.boardBase.forEach((o) => { this.scene.remove(o); o.traverse((x) => (x as THREE.Mesh).geometry?.dispose()); });
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(W + 2 * RING, 0.5, W + 2 * RING),
      [
        new THREE.MeshStandardMaterial({ color: '#1b3a55', roughness: 0.6 }),
        new THREE.MeshStandardMaterial({ color: '#1b3a55', roughness: 0.6 }),
        new THREE.MeshStandardMaterial({ color: '#86b36f', roughness: 0.95 }),
        new THREE.MeshStandardMaterial({ color: '#1b3a55', roughness: 0.6 }),
        new THREE.MeshStandardMaterial({ color: '#1b3a55', roughness: 0.6 }),
        new THREE.MeshStandardMaterial({ color: '#1b3a55', roughness: 0.6 }),
      ],
    );
    base.position.y = -0.29; // top at -0.04: grass level
    base.receiveShadow = true;
    const table = new THREE.Mesh(
      new THREE.CircleGeometry(W * 3, 64),
      new THREE.MeshStandardMaterial({ color: '#0c3350', roughness: 1 }),
    );
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.5;
    table.receiveShadow = true;
    // pavement around the squares
    const walk = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.5, 0.02, W + 0.5),
      new THREE.MeshStandardMaterial({ color: '#d4dbe0', roughness: 0.9 }),
    );
    walk.position.y = -0.03; // top at -0.02: pavement, clearly below the board (0) and above the grass (-0.04)
    walk.receiveShadow = true;
    const decor = buildDecor(boardOf(g), this.s, W);
    decor.position.y = -0.04; // stands on the grass
    this.boardBase = [base, table, walk, decor];
    this.scene.add(base, table, walk, decor);
    this.boardPlane.scale.set(W, W, 1);
    this.boardPlane.position.set(0, 0, 0);

    const sun = this.sunLight;
    sun.position.set(W * 0.35, W * 1.3, W * 0.55);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -(W / 2 + RING) * 1.3;
    sc.right = sc.top = (W / 2 + RING) * 1.3;
    sc.near = 1; sc.far = W * 4;
    sc.updateProjectionMatrix();

    const d = this.dieSize();
    this.dice.forEach((m) => this.scene.remove(m));
    this.dice = [0, 1].map((k) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(d, d, d, 3, d * 0.16), this.diceMats.slice());
      m.castShadow = true;
      m.position.set((k - 0.5) * d * 1.8, d / 2, 0);
      this.scene.add(m);
      return m;
    });
    this.ring.scale.setScalar(this.tokenScale());
    this.controls.minDistance = W * 0.45;
    this.controls.maxDistance = W * 2.4;
    this.placeCamera(0, true);
    this.tokens.forEach((t) => this.scene.remove(t.group));
    this.tokens.clear();
    this.texKey = '';
    this.houseKey = '';
  }

  private dieSize() { return 0.058 * this.W; }
  private tokenScale() { return 0.075 * this.W; }

  // ---------------- public ----------------

  setFx(sound: boolean, vibrate: boolean, cinema: boolean) { this.sound = sound; this.vibrate = vibrate; this.cinema = cinema; }

  /** board brightness: normal, dim, or night */
  setLight(level: BoardLight) {
    const L = LIGHT[level] ?? LIGHT.normal; // unknown/old value -> normal
    (this.boardPlane.material as THREE.MeshStandardMaterial).color.set(L.board);
    this.renderer.toneMappingExposure = L.exposure;
    this.hemiLight.intensity = L.hemi;
    this.sunLight.intensity = L.sun;
    this.scene.environmentIntensity = L.env;
    (this.scene.background as THREE.Color).set(L.sky);
  }

  setFollow(f: boolean) {
    if (this.follow === f) return;
    this.follow = f;
    this.ev.onFollow(f);
  }

  update(g: Game, lang: Lang, photos: Record<string, string>) {
    const first = !this.g;
    this.buildBoard(g);
    this.g = g;
    this.lang = lang;
    this.photos = photos;

    const texKey = JSON.stringify([lang, g.boardId, g.names, Object.values(g.props).map((p) => [p.owner && g.players.find((x) => x.id === p.owner)?.color, p.mort])]);
    if (texKey !== this.texKey) { this.texKey = texKey; this.drawBoard(); }
    const houseKey = JSON.stringify(Object.entries(g.props).map(([k, p]) => (p.houses ? k + ':' + p.houses : '')));
    if (houseKey !== this.houseKey) { this.houseKey = houseKey; this.drawBuildings(); }

    this.drawPot(g);
    // dice
    const rolls = g.rolls ?? 0;
    if (this.rolls === -1 || first) {
      this.rolls = rolls;
      this.restDice(g.dice ?? [5, 2]);
    } else if (rolls !== this.rolls && g.dice) {
      this.rolls = rolls;
      this.throwDice(g.dice);
    }
    this.syncTokens(first);
    this.queueCoins(g);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose?.();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------------- camera ----------------

  private sideAzimuth(side: Side) {
    return { b: 0, l: -Math.PI / 2, t: Math.PI, r: Math.PI / 2 }[side];
  }

  private placeCamera(theta: number, immediate: boolean) {
    const aspect = this.camera.aspect || 1;
    const radius = this.fitRadius(aspect);
    const phi = PHI;
    const target = new THREE.Vector3(0, 0, 0);
    const pos = new THREE.Vector3(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.cos(theta),
    );
    if (immediate) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.update();
    }
    return pos;
  }

  private fitCache = { key: '', r: 0 };
  /** smallest camera distance that shows the whole board */
  private fitRadius(aspect: number) {
    const key = aspect.toFixed(3) + ':' + this.W;
    if (this.fitCache.key === key) return this.fitCache.r;
    const cam = new THREE.PerspectiveCamera(this.camera.fov, aspect, 0.1, 500);
    const h = this.W / 2 + RING * 0.8;
    const pts = [[-h, -h], [h, -h], [-h, h], [h, h]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    const fits = (r: number) => {
      cam.position.set(0, r * Math.cos(PHI), r * Math.sin(PHI));
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld();
      return pts.every((p) => { const v = p.clone().project(cam); return Math.abs(v.x) < 0.96 && Math.abs(v.y) < 0.9; });
    };
    let lo = this.W * 0.5, hi = this.W * 6;
    for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    this.fitCache = { key, r: hi };
    return hi;
  }

  recenter() {
    this.setFollow(true);
  }

  private followStep(now: number) {
    if (!this.follow || !this.g) return;
    const aspect = this.camera.aspect || 1;
    let target = new THREE.Vector3(0, 0, 0);
    let radius = this.fitRadius(aspect);
    let phi = PHI;
    let side: Side;
    const chasing = this.cinema && this.chase && now < this.chase.until ? this.tokens.get(this.chase.id) : undefined;
    if (chasing) {
      // close-up behind the moving token, looking toward the board centre
      target = chasing.group.position.clone().setY(0.3);
      radius = this.W * 0.42;
      phi = 0.78;
      side = rectOf(chasing.path[0] ?? chasing.shown, this.s).side;
    } else {
      const cur = this.g.players[this.g.cur];
      const t = this.tokens.get(cur.id);
      side = rectOf(t ? t.shown : cur.pos, this.s).side;
    }
    const speed = chasing ? 0.08 : 0.045;
    this.controls.target.lerp(target, speed);
    const off = this.camera.position.clone().sub(this.controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    let d = this.sideAzimuth(side) - sph.theta;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    sph.theta += d * speed;
    sph.phi += (phi - sph.phi) * speed;
    sph.radius += (radius - sph.radius) * speed;
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(sph));
    this.camera.lookAt(this.controls.target);
  }

  private resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------------- tapping squares ----------------

  private onTap(e: PointerEvent) {
    if (!this.down || !this.g) return;
    const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
    this.down = null;
    if (moved > 8) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.intersectObject(this.boardPlane)[0];
    if (!hit?.uv) return;
    const u = hit.uv.x * this.W;
    const v = (1 - hit.uv.y) * this.W;
    for (let i = 0; i < this.N; i++) {
      const c = rectOf(i, this.s);
      if (u >= c.x0 && u <= c.x1 && v >= c.z0 && v <= c.z1) {
        // after the click event, so the new dialog doesn't receive this same tap
        window.setTimeout(() => this.ev.onSquare(i), 60);
        return;
      }
    }
  }

  // ---------------- board texture ----------------

  private drawBoard() {
    const g = this.g!;
    const b = boardOf(g);
    const cv = this.boardCanvas;
    const ctx = cv.getContext('2d')!;
    const k = cv.width / this.W;
    const font = (px: number, w = 600) => `${w} ${px}px Commissioner, system-ui, sans-serif`;
    ctx.fillStyle = '#eef1ee';
    ctx.fillRect(0, 0, cv.width, cv.height);
    // centre
    const inner0 = CORNER * k, inner1 = (this.W - CORNER) * k;
    ctx.fillStyle = '#dfe7e4';
    ctx.fillRect(inner0, inner0, inner1 - inner0, inner1 - inner0);
    ctx.save();
    ctx.translate(cv.width / 2, cv.height / 2);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = 'rgba(15,59,95,0.13)';
    ctx.font = font(k * 1.3, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.lang === 'el' ? 'Γειτονιές' : 'Neighbourhoods', 0, 0);
    ctx.restore();

    for (let i = 0; i < this.N; i++) {
      const sq = b.squares[i];
      const c = rectOf(i, this.s);
      const x0 = c.x0 * k, z0 = c.z0 * k, w = (c.x1 - c.x0) * k, h = (c.z1 - c.z0) * k;
      ctx.save();
      ctx.translate(x0 + w / 2, z0 + h / 2);
      ctx.rotate(SIDE_ANGLE[c.side]);
      // local frame: width along reading direction, top = toward centre
      const lw = c.side === 'b' || c.side === 't' ? w : h;
      const lh = c.side === 'b' || c.side === 't' ? h : w;
      ctx.translate(-lw / 2, -lh / 2);
      const corner = i % this.s === 0;
      ctx.fillStyle = corner ? '#e5ebe8' : '#f5f7f3';
      ctx.fillRect(0, 0, lw, lh);
      ctx.strokeStyle = '#7f95a4';
      ctx.lineWidth = k * 0.024;
      ctx.strokeRect(0, 0, lw, lh);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0c151c';
      const pr = g.props[i];
      if (sq.group !== undefined) {
        ctx.fillStyle = b.groups[sq.group].color;
        ctx.fillRect(0, 0, lw, lh * 0.22);
      }
      if (pr?.owner) {
        const owner = g.players.find((p) => p.id === pr.owner);
        ctx.fillStyle = owner?.color ?? '#000';
        ctx.fillRect(0, lh - k * 0.13, lw, k * 0.13);
      }
      ctx.fillStyle = '#0c151c';
      if (corner) {
        // corners: icon and label run diagonally, like on a real board
        ctx.save();
        ctx.translate(lw / 2, lh / 2);
        ctx.rotate(Math.PI / 4);
        ctx.font = font(k * 0.5, 400);
        ctx.fillText(ICON[sq.kind] ?? '', 0, -k * 0.16);
        ctx.font = font(k * 0.2, 800);
        ctx.fillText(CORNER_LABEL[sq.kind]?.[this.lang] ?? '', 0, k * 0.3);
        ctx.restore();
      } else if (sq.kind === 'street') {
        ctx.font = font(k * 0.15, 600);
        wrap(ctx, sqName(g, i, this.lang), lw * 0.9, k * 0.17, 3).forEach((line, n, arr) =>
          ctx.fillText(line, lw / 2, lh * 0.5 + (n - (arr.length - 1) / 2) * k * 0.17));
        ctx.font = font(k * 0.13, 400);
        ctx.fillText(priceOf(g, i) + ' €', lw / 2, lh - k * 0.25);
      } else {
        ctx.font = font(k * 0.36, 400);
        ctx.fillText(ICON[sq.kind] ?? '', lw / 2, lh * 0.36);
        ctx.font = font(k * 0.12, 600);
        const label = sq.kind === 'station' || sq.kind === 'utility' ? sqName(g, i, this.lang) : sq.name[this.lang];
        wrap(ctx, label, lw * 0.92, k * 0.14, 2).forEach((line, n) => ctx.fillText(line, lw / 2, lh * 0.66 + n * k * 0.14));
        if (sq.price) { ctx.font = font(k * 0.12, 600); ctx.fillText(priceOf(g, i) + ' €', lw / 2, lh - k * 0.23); }
        if (sq.tax) { ctx.font = font(k * 0.12, 400); ctx.fillText(sq.tax + ' €', lw / 2, lh - k * 0.23); }
      }
      if (pr?.mort) {
        ctx.fillStyle = 'rgba(40,50,60,0.45)';
        ctx.fillRect(0, 0, lw, lh);
        ctx.fillStyle = '#fff';
        ctx.font = font(k * 0.14, 800);
        ctx.fillText(this.lang === 'el' ? 'ΥΠΟΘΗΚΗ' : 'MORTGAGED', lw / 2, lh * 0.5);
      }
      ctx.restore();
    }
    this.boardTex.needsUpdate = true;
  }

  // ---------------- buildings ----------------

  private drawBuildings() {
    const g = this.g!;
    this.buildings.children.slice().forEach((c) => {
      this.buildings.remove(c);
      c.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); });
    });
    const houseMat = new THREE.MeshStandardMaterial({ color: '#2f9a52', roughness: 0.5 });
    const hotelMat = new THREE.MeshStandardMaterial({ color: '#d9362f', roughness: 0.5 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#f4f7f9', roughness: 0.6 });
    for (const [key, pr] of Object.entries(g.props)) {
      if (!pr.houses) continue;
      const i = Number(key);
      const c = rectOf(i, this.s);
      const cx = (c.x0 + c.x1) / 2 - this.W / 2;
      const cz = (c.z0 + c.z1) / 2 - this.W / 2;
      // strip position (inner edge), in the cell's local frame
      const along = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), -SIDE_ANGLE[c.side]);
      const inward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), -SIDE_ANGLE[c.side]);
      const depth = c.side === 'b' || c.side === 't' ? c.z1 - c.z0 : c.x1 - c.x0;
      const base = new THREE.Vector3(cx, 0, cz).add(inward.clone().multiplyScalar(depth / 2 - 0.17));
      const make = (hotel: boolean) => {
        const grp = new THREE.Group();
        const bw = hotel ? 0.55 : 0.17, bh = hotel ? 0.2 : 0.14, bd = hotel ? 0.24 : 0.17;
        const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), hotel ? hotelMat : houseMat);
        body.position.y = bh / 2;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(bw, bd) * 0.75, 0.11, 4), hotel ? hotelMat : houseMat);
        roof.rotation.y = Math.PI / 4;
        roof.scale.set(hotel ? 1 : 1, 1, hotel ? bd / bw : 1);
        roof.position.y = bh + 0.055;
        const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.03), roofMat);
        chimney.position.set(bw * 0.25, bh + 0.08, 0);
        grp.add(body, roof, chimney);
        grp.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
        grp.rotation.y = -SIDE_ANGLE[c.side];
        return grp;
      };
      if (pr.houses === 5) {
        const h = make(true);
        h.position.copy(base);
        this.buildings.add(h);
      } else {
        for (let n = 0; n < pr.houses; n++) {
          const h = make(false);
          h.position.copy(base).add(along.clone().multiplyScalar((n - (pr.houses - 1) / 2) * 0.22));
          this.buildings.add(h);
        }
      }
    }
  }

  // ---------------- tokens ----------------

  private cellCenter(i: number): THREE.Vector3 {
    const c = rectOf(i, this.s);
    return new THREE.Vector3((c.x0 + c.x1) / 2 - this.W / 2, 0, (c.z0 + c.z1) / 2 - this.W / 2);
  }

  /** where token k of n sits on square i */
  private slot(i: number, id: string): THREE.Vector3 {
    const g = this.g!;
    const here = g.players.filter((p) => !p.out && (this.tokens.get(p.id)?.shown ?? p.pos) === i);
    const n = Math.max(1, here.length);
    const k = Math.max(0, here.findIndex((p) => p.id === id));
    const p = this.cellCenter(i);
    // push toward the outer part of the cell (buildings sit on the inner edge)
    const c = rectOf(i, this.s);
    const outward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), -SIDE_ANGLE[c.side]);
    if (i % this.s !== 0) p.add(outward.multiplyScalar(0.15));
    if (n > 1) {
      const rad = i % this.s === 0 ? 0.42 : 0.27;
      const a = (k / n) * Math.PI * 2;
      p.x += Math.cos(a) * rad;
      p.z += Math.sin(a) * rad;
    }
    return p;
  }

  private makeToken(color: string, emoji: string, photo?: string): TokenState {
    const grp = new THREE.Group();
    const piece = buildPiece(emoji, color);
    grp.add(piece);
    // a photo floats above the piece so friends recognise each other
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(color, emoji, photo), depthTest: false }));
    sprite.scale.set(0.5, 0.5, 1);
    sprite.position.y = (PIECE_HEIGHT[emoji] ?? 0.9) + 0.35;
    sprite.renderOrder = 10;
    sprite.visible = !!photo;
    grp.add(sprite);
    grp.scale.setScalar(this.tokenScale());
    this.scene.add(grp);
    return { group: grp, sprite, shown: 0, path: [], hopStart: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), photoKey: photo ?? '', glide: GLIDERS.has(emoji), jailed: false, cageStart: 0, cageState: 'on' };
  }

  /** direction of travel at square i, as a y-rotation for a piece facing +x */
  private heading(i: number): number {
    const a = this.cellCenter(i);
    const b = this.cellCenter((i + 1) % this.N);
    return Math.atan2(-(b.z - a.z), b.x - a.x);
  }

  private turnTo(t: TokenState, angle: number, k: number) {
    let d = angle - t.group.rotation.y;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    t.group.rotation.y += d * k;
  }

  private syncTokens(first: boolean) {
    const g = this.g!;
    for (const p of g.players) {
      let t = this.tokens.get(p.id);
      if (p.out) {
        if (t) { this.scene.remove(t.group); this.tokens.delete(p.id); }
        continue;
      }
      const photo = this.photos[p.id];
      if (t && t.photoKey !== (photo ?? '')) {
        (t.sprite.material as THREE.SpriteMaterial).map = labelTexture(p.color, p.emoji, photo);
        t.sprite.visible = !!photo;
        t.photoKey = photo ?? '';
      }
      if (!t) {
        t = this.makeToken(p.color, p.emoji, photo);
        t.jailed = p.jail;
        if (p.jail) this.addCage(t, true);
        t.shown = p.pos;
        this.tokens.set(p.id, t);
        t.group.position.copy(this.slot(p.pos, p.id));
        t.group.rotation.y = this.heading(p.pos);
        continue;
      }
      if (t.jailed !== p.jail) {
        t.jailed = p.jail;
        if (first && p.jail) this.addCage(t, true);
      }
      const target = t.path.length ? t.path[t.path.length - 1] : t.shown;
      if (target === p.pos) continue;
      if (first) { t.shown = p.pos; t.path = []; continue; }
      const f = (p.pos - target + this.N) % this.N;
      if (f > 0 && f <= 12 && !p.jail) {
        for (let k = 1; k <= f; k++) t.path.push((target + k) % this.N);
      } else {
        t.path.push(p.pos);
      }
    }
    // settle everyone else into their slots
    this.tokens.forEach((t, id) => { if (!t.path.length) t.to = this.slot(t.shown, id); });
  }

  // ---------------- jail cage ----------------

  private addCage(t: TokenState, instant: boolean) {
    if (t.cage) { t.cageState = 'on'; return; }
    const cage = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: '#39434b', roughness: 0.45, metalness: 0.6 });
    const R = 0.62, H = 1.35;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, H, 6), metal);
      bar.position.set(Math.cos(a) * R, H / 2, Math.sin(a) * R);
      bar.castShadow = true;
      cage.add(bar);
    }
    for (const y of [0.03, H]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.035, 8, 36), metal);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      cage.add(ring);
    }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.04, 36), metal);
    top.position.y = H + 0.02;
    cage.add(top);
    // siren lights on the roof
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshStandardMaterial({ color: '#ff2a2a', emissive: '#ff0000', emissiveIntensity: 0 }));
    const blue = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshStandardMaterial({ color: '#2a6bff', emissive: '#0044ff', emissiveIntensity: 0 }));
    red.position.set(0.18, H + 0.1, 0);
    blue.position.set(-0.18, H + 0.1, 0);
    red.name = 'red'; blue.name = 'blue';
    cage.add(red, blue);
    t.group.add(cage);
    t.cage = cage;
    t.cageState = instant ? 'on' : 'drop';
    t.cageStart = instant ? -1e9 : 0;
    cage.position.y = instant ? 0 : 4;
  }

  private stepCages(now: number): boolean {
    let busy = false;
    const jail = this.g ? boardOf(this.g).jail : -1;
    for (const t of this.tokens.values()) {
      // a jailed token that has arrived at the jail gets a cage dropped on it
      if (t.jailed && !t.cage && !t.path.length && t.shown === jail && now >= this.holdUntil) this.addCage(t, false);
      if (!t.jailed && t.cage && t.cageState !== 'lift') { t.cageState = 'lift'; t.cageStart = now; }
      const c = t.cage;
      if (!c) continue;
      if (t.cageState === 'drop') {
        if (!t.cageStart) {
          t.cageStart = now;
          if (this.sound) siren();
          if (this.vibrate) buzz(40);
        }
        const k = Math.min(1, (now - t.cageStart) / 650);
        c.position.y = 4 * (1 - bounceOut(k));
        if (k >= 1 && t.cageState === 'drop') {
          t.cageState = 'on';
          if (this.sound) clank();
          if (this.vibrate) buzz(60);
        }
        busy = true;
      } else if (t.cageState === 'lift') {
        const k = Math.min(1, (now - t.cageStart) / 500);
        c.position.y = 4 * k * k;
        if (k >= 1) {
          t.group.remove(c);
          c.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); });
          t.cage = undefined;
        }
      }
      // siren lights flash for 3 s after the drop
      const since = now - t.cageStart;
      const on = t.cageState !== 'lift' && since < 3500;
      const phase = Math.floor(now / 180) % 2;
      const red = c.getObjectByName('red') as THREE.Mesh | undefined;
      const blue = c.getObjectByName('blue') as THREE.Mesh | undefined;
      if (red && blue) {
        (red.material as THREE.MeshStandardMaterial).emissiveIntensity = on && phase === 0 ? 2.5 : 0.1;
        (blue.material as THREE.MeshStandardMaterial).emissiveIntensity = on && phase === 1 ? 2.5 : 0.1;
      }
    }
    return busy;
  }

  private stepTokens(now: number): boolean {
    let moving = false;
    const hop = this.cinema ? 260 : 190;
    for (const [id, t] of this.tokens) {
      if (!t.path.length || now < this.holdUntil) {
        // ease toward the resting slot, facing the way round the board
        t.group.position.lerp(this.slot(t.shown, id), 0.2);
        this.turnTo(t, this.heading(t.shown), 0.15);
        if (t.path.length) moving = true;
        continue;
      }
      moving = true;
      if (!t.hopStart) {
        t.hopStart = now;
        this.chase = { id, until: now + 100000 };
        t.from.copy(t.group.position);
        t.to.copy(this.slot(t.path[0], id));
      }
      const long = t.from.distanceTo(t.to) > 2.5;
      const dur = long ? 650 : hop;
      const k = Math.min(1, (now - t.hopStart) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      t.group.position.lerpVectors(t.from, t.to, e);
      if (t.from.distanceTo(t.to) > 0.05) this.turnTo(t, Math.atan2(-(t.to.z - t.from.z), t.to.x - t.from.x), 0.3);
      t.group.position.y = Math.sin(k * Math.PI) * (long ? 2.2 : 0.55);
      if (k >= 1) {
        t.shown = t.path.shift()!;
        t.hopStart = 0;
        if (this.sound && !t.glide) tick();
        if (!t.path.length && this.chase?.id === id) this.chase.until = now + 1400; // linger, then back to the overview
        if (!t.path.length) t.group.rotation.z = 0;
      }
      break; // one token moves at a time
    }
    return moving;
  }

  // ---------------- dice ----------------

  private restDice(values: [number, number]) { this.restDiceAt(values); }

  /** paint the 6 faces with the given values (+x,-x,+y,-y,+z,-z) */
  private paintFaces(m: THREE.Mesh, faces: number[]) {
    m.material = faces.map((v) => this.diceMats[v - 1]);
  }

  /** rest the dice flat showing `values` (also the fallback if anything goes wrong) */
  private restDiceAt(values: [number, number], where?: THREE.Vector3[]) {
    const d = this.dieSize();
    this.dice.forEach((m, k) => {
      this.paintFaces(m, faceValues(2, values[k])); // +y face on top
      const p = where?.[k] ?? new THREE.Vector3((k - 0.5) * d * 1.9, d / 2, this.potRadius() > 0 ? this.potRadius() + d * 1.2 : 0);
      m.position.set(p.x, d / 2, p.z);
      m.quaternion.setFromEuler(new THREE.Euler(0, k ? 0.4 : -0.3, 0));
    });
  }

  private throwDice(values: [number, number]) {
    try {
      const cam = this.camera.position.clone().setY(0);
      const sim = simulateDice(values, {
        d: this.dieSize(),
        half: (this.W - 2 * CORNER) / 2 - 0.15,
        from: { x: cam.x, z: cam.z },
        scale: this.W / 12,
        obstacle: this.potRadius(),
      });
      this.dice.forEach((m, k) => this.paintFaces(m, sim.faces[k]));
      this.diceAnim = { frames: sim.frames, hits: sim.hits, start: performance.now(), played: 0, values };
      this.holdUntil = performance.now() + (sim.frames.length / 60) * 1000 + 250;
      this.setBusy(true);
    } catch (e) {
      console.error('dice', e);
      this.diceAnim = null;
      this.restDiceAt(values);
    }
  }

  private stepDice(now: number): boolean {
    const a = this.diceAnim;
    if (!a) return false;
    const f = Math.min(a.frames.length - 1, Math.floor(((now - a.start) / 1000) * 60));
    const fr = a.frames[f];
    this.dice.forEach((m, k) => {
      m.position.set(fr[k * 7], fr[k * 7 + 1], fr[k * 7 + 2]);
      m.quaternion.set(fr[k * 7 + 3], fr[k * 7 + 4], fr[k * 7 + 5], fr[k * 7 + 6]);
    });
    while (a.played < a.hits.length && a.hits[a.played].f <= f) {
      if (this.sound) clack(a.hits[a.played].s);
      if (this.vibrate) buzz(Math.round(8 + a.hits[a.played].s * 20));
      a.played++;
    }
    if (f >= a.frames.length - 1) { this.diceAnim = null; return false; }
    return true;
  }

  private setBusy(b: boolean) {
    if (b === this.busy) return;
    this.busy = b;
    this.ev.onBusy(b);
  }

  // ---------------- loop ----------------

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    try {
      this.frame();
    } catch (e) {
      // never let an animation error freeze the game: jump to the final state
      console.error('3d', e);
      this.skipAnimations();
    }
  };

  /** finish every running animation immediately */
  skipAnimations() {
    try {
      if (this.diceAnim) { const v = this.diceAnim.values; this.diceAnim = null; this.restDiceAt(v); }
      this.holdUntil = 0;
      this.tokens.forEach((t, id) => {
        if (t.path.length) t.shown = t.path[t.path.length - 1];
        t.path = [];
        t.hopStart = 0;
        t.group.position.copy(this.slot(t.shown, id));
      });
      this.chase = null;
      this.tokens.forEach((t) => { if (t.cage) { t.cage.position.y = 0; t.cageState = 'on'; t.cageStart = -1e9; } });
    } catch { /* ignore */ }
    this.setBusy(false);
  }

  private busySince = 0;

  // ---------------- flying coins ----------------

  private potGroup = new THREE.Group();
  private potShown = -1;

  /** free-parking money waiting in the middle of the board */
  private drawPot(g: Game) {
    const pot = g.rules.freeParking ? g.pot : 0;
    if (pot === this.potShown) return;
    this.potShown = pot;
    this.potGroup.children.slice().forEach((c) => { this.potGroup.remove(c); (c as THREE.Mesh).geometry?.dispose?.(); });
    if (!this.potGroup.parent) this.scene.add(this.potGroup);
    if (pot <= 0) return;
    const sc = this.tokenScale();
    const geo = new THREE.CylinderGeometry(0.2 * sc, 0.2 * sc, 0.055 * sc, 24);
    const coins = Math.min(48, Math.max(3, Math.round(pot / 20)));
    const stacks = Math.min(6, Math.max(1, Math.ceil(coins / 8)));
    let left = coins;
    for (let k = 0; k < stacks; k++) {
      const a = (k / stacks) * Math.PI * 2;
      const r = stacks === 1 ? 0 : 0.34 * sc;
      const n = Math.ceil(left / (stacks - k));
      left -= n;
      for (let j = 0; j < n; j++) {
        const c = new THREE.Mesh(geo, this.coinMat);
        c.position.set(Math.cos(a) * r + Math.sin(j * 1.7) * 0.02 * sc, (0.0275 + j * 0.056) * sc, Math.sin(a) * r + Math.cos(j * 2.3) * 0.02 * sc);
        c.castShadow = true;
        this.potGroup.add(c);
      }
    }
    // label: "Parking: 350 €"
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 96;
    const x = cv.getContext('2d')!;
    x.fillStyle = 'rgba(15,59,95,0.92)';
    x.beginPath(); x.roundRect?.(4, 4, 248, 88, 24); x.fill();
    x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '600 26px Commissioner, system-ui, sans-serif';
    x.fillText('🅿️ ' + (this.lang === 'el' ? 'Πάρκινγκ' : 'Parking'), 128, 32);
    x.font = '800 34px Commissioner, system-ui, sans-serif';
    x.fillStyle = '#f4b33d';
    x.fillText(new Intl.NumberFormat(this.lang === 'el' ? 'el-GR' : 'en-IE', { maximumFractionDigits: 0 }).format(pot) + ' €', 128, 68);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    label.scale.set(1.5 * sc, 0.56 * sc, 1);
    label.position.y = (0.55 + Math.ceil(coins / stacks) * 0.056) * sc;
    label.renderOrder = 9;
    this.potGroup.add(label);
  }

  /** radius of the coin pile, so the dice bounce off it */
  private potRadius() { return this.potShown > 0 ? (this.potGroup.children.length > 2 ? 0.58 : 0.24) * this.tokenScale() : 0; }

  private logSeen = -1;
  private coinQueue: { from: () => THREE.Vector3; to: () => THREE.Vector3; n: number }[] = [];
  private coins: { mesh: THREE.Mesh; start: number; from: THREE.Vector3; to: THREE.Vector3; spin: number; last: boolean }[] = [];
  private coinGeo: THREE.CylinderGeometry | null = null;
  private coinMat = new THREE.MeshStandardMaterial({ color: '#f0bf45', roughness: 0.25, metalness: 1 });

  private anchor(who: string): () => THREE.Vector3 {
    if (who === 'bank' || who === 'pot') return () => new THREE.Vector3(0, 0.3, 0);
    return () => {
      const t = this.tokens.get(who);
      return t ? t.group.position.clone().setY(0.5 * this.tokenScale()) : new THREE.Vector3(0, 0.3, 0);
    };
  }

  /** turn new money entries of the game log into coin flights */
  private queueCoins(g: Game) {
    const seq = g.logSeq ?? 0;
    if (this.logSeen < 0) { this.logSeen = seq; return; }
    const fresh = Math.min(Math.max(0, seq - this.logSeen), g.log.length);
    this.logSeen = seq;
    for (const e of g.log.slice(g.log.length - fresh)) {
      const a = e.a ?? {};
      const n = Number(a.n) || 0;
      if (!n) continue;
      const p = String(a.p ?? '');
      if (e.k === 'rent' && Number(a.sq) >= 0) {
        const owner = g.players.find((x) => x.id === String(a.o));
        this.flashQueue.push({ sq: Number(a.sq), color: owner?.color ?? '#f4b33d' });
      }
      if (e.k === 'paid') this.coinQueue.push({ from: this.anchor(p), to: this.anchor(String(a.to)), n });
      else if (e.k === 'salary' || e.k === 'got' || e.k === 'pot') this.coinQueue.push({ from: this.anchor('bank'), to: this.anchor(p), n });
      else if (e.k === 'bought' || e.k === 'won') this.coinQueue.push({ from: this.anchor(p), to: this.anchor('bank'), n });
    }
  }

  private flashQueue: { sq: number; color: string }[] = [];
  private flashes: { mesh: THREE.Mesh; start: number }[] = [];

  /** the square someone paid rent on flashes three times in the owner's colour */
  private stepFlashes(now: number, tokensMoving: boolean) {
    if (this.flashQueue.length && !tokensMoving && !this.diceAnim && now >= this.holdUntil) {
      for (const f of this.flashQueue.splice(0)) {
        const c = rectOf(f.sq, this.s);
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(c.x1 - c.x0, c.z1 - c.z0),
          new THREE.MeshBasicMaterial({ color: f.color, transparent: true, opacity: 0, depthWrite: false }),
        );
        m.rotation.x = -Math.PI / 2;
        m.position.set((c.x0 + c.x1) / 2 - this.W / 2, 0.012, (c.z0 + c.z1) / 2 - this.W / 2);
        this.scene.add(m);
        this.flashes.push({ mesh: m, start: now });
      }
    }
    const dur = 1500;
    this.flashes = this.flashes.filter((f) => {
      const k = (now - f.start) / dur;
      const mat = f.mesh.material as THREE.MeshBasicMaterial;
      if (k >= 1) { this.scene.remove(f.mesh); f.mesh.geometry.dispose(); mat.dispose(); return false; }
      mat.opacity = 0.55 * Math.max(0, Math.sin(k * Math.PI * 3)) * (1 - k * 0.4);
      return true;
    });
  }

  private stepCoins(now: number, tokensMoving: boolean) {
    if (this.coinQueue.length && !tokensMoving && !this.diceAnim && now >= this.holdUntil) {
      const s = this.tokenScale();
      this.coinGeo ??= new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 0.03 * s, 20);
      let delay = 0;
      for (const f of this.coinQueue.splice(0)) {
        const count = Math.max(2, Math.min(8, Math.round(f.n / 60)));
        const from = f.from(), to = f.to();
        for (let i = 0; i < count; i++) {
          const mesh = new THREE.Mesh(this.coinGeo, this.coinMat);
          mesh.castShadow = true;
          mesh.visible = false;
          this.scene.add(mesh);
          this.coins.push({ mesh, start: now + delay + i * 70, from: from.clone(), to: to.clone(), spin: (Math.random() - 0.5) * 20, last: i === count - 1 });
        }
        delay += count * 70 + 150;
      }
    }
    const dur = 650;
    this.coins = this.coins.filter((c) => {
      const k = (now - c.start) / dur;
      if (k < 0) return true;
      if (k >= 1) {
        this.scene.remove(c.mesh);
        if (this.sound) tick();
        if (c.last && this.vibrate) buzz(10);
        return false;
      }
      c.mesh.visible = true;
      c.mesh.position.lerpVectors(c.from, c.to, k);
      c.mesh.position.y += Math.sin(k * Math.PI) * (1.2 + c.from.distanceTo(c.to) * 0.12);
      c.mesh.rotation.set(k * c.spin, 0, k * c.spin * 0.6);
      return true;
    });
  }

  private frame() {
    const now = performance.now();
    const rolling = this.stepDice(now);
    const moving = this.stepTokens(now);
    const caging = this.stepCages(now);
    this.stepCoins(now, moving || caging);
    this.stepFlashes(now, moving || caging);
    this.setBusy(rolling || moving || caging);
    // watchdog: no animation may block the game for more than 10 s
    if (this.busy) {
      if (!this.busySince) this.busySince = now;
      else if (now - this.busySince > 10000) { this.busySince = 0; this.skipAnimations(); }
    } else this.busySince = 0;
    if (this.g) {
      const cur = this.g.players[this.g.cur];
      const t = this.tokens.get(cur.id);
      if (t) {
        this.ring.visible = true;
        this.ring.position.set(t.group.position.x, 0.02, t.group.position.z);
        (this.ring.material as THREE.MeshBasicMaterial).color.set(cur.color);
        const pulse = 1 + Math.sin(now / 300) * 0.08;
        this.ring.scale.setScalar(this.tokenScale() * pulse);
      } else this.ring.visible = false;
    }
    this.followStep(now);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// ---------------- helpers ----------------

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, _lh: number, lines: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width <= max || !cur) cur = t;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  if (out.length > lines) {
    const kept = out.slice(0, lines);
    kept[lines - 1] = kept[lines - 1].replace(/.{0,2}$/, '…');
    return kept;
  }
  // shrink very long single words
  return out.map((l) => {
    let s = l;
    while (s.length > 2 && ctx.measureText(s).width > max) s = s.slice(0, -2) + '…';
    return s;
  });
}

function dieTexture(v: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = '#fbfbf8';
  x.fillRect(0, 0, 128, 128);
  const P: Record<number, [number, number][]> = {
    1: [[64, 64]], 2: [[34, 34], [94, 94]], 3: [[30, 30], [64, 64], [98, 98]],
    4: [[34, 34], [94, 34], [34, 94], [94, 94]], 5: [[32, 32], [96, 32], [64, 64], [32, 96], [96, 96]],
    6: [[34, 30], [94, 30], [34, 64], [94, 64], [34, 98], [94, 98]],
  };
  x.fillStyle = v === 1 ? '#c8412f' : '#14212b';
  for (const [px, py] of P[v]) { x.beginPath(); x.arc(px, py, v === 1 ? 15 : 11, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function labelTexture(color: string, emoji: string, photo?: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const drawBase = () => {
    x.clearRect(0, 0, 128, 128);
    x.beginPath(); x.arc(64, 64, 60, 0, Math.PI * 2);
    x.fillStyle = '#ffffff'; x.fill();
    x.beginPath(); x.arc(64, 64, 52, 0, Math.PI * 2);
    x.fillStyle = color; x.fill();
  };
  drawBase();
  x.font = '64px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(emoji, 64, 70);
  if (photo) {
    const img = new Image();
    img.onload = () => {
      drawBase();
      x.save(); x.beginPath(); x.arc(64, 64, 52, 0, Math.PI * 2); x.clip();
      x.drawImage(img, 12, 12, 104, 104); x.restore();
      tex.needsUpdate = true;
    };
    img.src = photo;
  }
  return tex;
}

// ---------------- neighbourhood decorations ----------------

const M = {
  wall: new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 0.8 }),
  wall2: new THREE.MeshStandardMaterial({ color: '#e6d8c3', roughness: 0.8 }),
  slab: new THREE.MeshStandardMaterial({ color: '#b9c2c9', roughness: 0.7 }),
  roof: new THREE.MeshStandardMaterial({ color: '#c4643c', roughness: 0.7 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#3f8f4a', roughness: 0.9 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.9 }),
  pool: new THREE.MeshStandardMaterial({ color: '#56c1e0', roughness: 0.15, metalness: 0.1 }),
  grey: new THREE.MeshStandardMaterial({ color: '#8b979f', roughness: 0.8 }),
  dark: new THREE.MeshStandardMaterial({ color: '#34414b', roughness: 0.6 }),
  train: new THREE.MeshStandardMaterial({ color: '#c8412f', roughness: 0.5 }),
  metal: new THREE.MeshStandardMaterial({ color: '#9aa7b0', roughness: 0.4, metalness: 0.6 }),
};
const CAR_COLORS = ['#e5484d', '#0090ff', '#f2cf37', '#30a46c', '#ffffff'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }));

function seeded(n: number) {
  let t = n * 2654435761 >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), t | 1); r ^= r + Math.imul(r ^ (r >>> 7), r | 61); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function tree(x: number, z: number, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * s, 0.03 * s, 0.18 * s, 6), M.trunk);
  trunk.position.y = 0.09 * s;
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13 * s, 0), M.leaf);
  top.position.y = 0.27 * s;
  trunk.castShadow = top.castShadow = true;
  g.add(trunk, top);
  g.position.set(x, 0, z);
  return g;
}
function house(x: number, z: number, rnd: () => number) {
  const g = new THREE.Group();
  const w = 0.26 + rnd() * 0.08, h = 0.18 + rnd() * 0.06;
  g.add(box(w, h, 0.26, rnd() < 0.5 ? M.wall : M.wall2));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, 0.14, 4), M.roof);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = h + 0.07;
  roof.castShadow = true;
  g.add(roof);
  g.position.set(x, 0, z);
  return g;
}
/** Greek "polykatoikia": white block with balcony slabs */
function block(x: number, z: number, rnd: () => number, accent: THREE.Material) {
  const g = new THREE.Group();
  const floors = 3 + Math.floor(rnd() * 3);
  const fh = 0.13, w = 0.36, d = 0.32;
  g.add(box(w, floors * fh, d, M.wall));
  // balcony slabs on every floor but the top one (the roof is its own, higher slab: no two faces at the same height)
  for (let f = 1; f < floors; f++) g.add(box(w + 0.05, 0.02, d + 0.06, M.slab, 0, f * fh - 0.01, 0.02));
  g.add(box(w + 0.02, 0.025, d + 0.02, M.slab, 0, floors * fh, 0));
  g.add(box(0.1, 0.06, 0.1, M.slab, w * 0.2, floors * fh + 0.025, 0)); // stairwell on the roof
  g.add(box(w * 0.35, 0.08, 0.01, accent, 0, 0.02, d / 2 + 0.035)); // shop sign in the group colour
  g.position.set(x, 0, z);
  return g;
}
function villa(x: number, z: number, rnd: () => number, accent: THREE.Material) {
  const g = new THREE.Group();
  g.add(box(0.46, 0.18, 0.3, M.wall, -0.08, 0, -0.08));
  g.add(box(0.5, 0.025, 0.34, M.slab, -0.08, 0.18, -0.08));
  g.add(box(0.2, 0.14, 0.18, M.wall2, 0.12, 0.2, -0.12));
  const pool = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.14), M.pool);
  pool.position.set(0.1, 0.01, 0.2);
  g.add(pool);
  g.add(box(0.05, 0.05, 0.05, accent, -0.3, 0, 0.18));
  g.add(tree(0.3, 0.2, 0.9 + rnd() * 0.3));
  g.position.set(x, 0, z);
  return g;
}
function car(x: number, z: number, rnd: () => number) {
  const g = new THREE.Group();
  const mat = CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)];
  g.add(box(0.26, 0.07, 0.13, mat, 0, 0.03, 0));
  g.add(box(0.14, 0.06, 0.11, mat, -0.02, 0.1, 0));
  g.position.set(x, 0, z);
  g.rotation.y = (rnd() - 0.5) * 0.3;
  return g;
}

/** little city around the board: what stands next to each square depends on the square */
function buildDecor(b: ReturnType<typeof boardOf>, s: number, W: number): THREE.Group {
  const root = new THREE.Group();
  const N = b.squares.length;
  const accents = b.groups.map((g) => new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.6 }));
  for (let i = 0; i < N; i++) {
    const sq = b.squares[i];
    const c = rectOf(i, s);
    const rnd = seeded(i + 1);
    const g = new THREE.Group();
    const corner = i % s === 0;
    // local frame: x along the side, +z outward (away from the board)
    if (corner) {
      const cx = (c.x0 + c.x1) / 2 - W / 2, cz = (c.z0 + c.z1) / 2 - W / 2;
      const dir = new THREE.Vector3(Math.sign(cx), 0, Math.sign(cz)).normalize();
      g.position.set(cx, 0, cz).add(dir.multiplyScalar(0.75 * Math.SQRT2 + RING * 0.55));
      g.rotation.y = Math.atan2(dir.x, dir.z);
      if (sq.kind === 'jail') {
        g.add(box(0.8, 0.35, 0.6, M.grey));
        for (let k = -3; k <= 3; k++) g.add(box(0.02, 0.2, 0.02, M.dark, k * 0.1, 0.08, 0.31));
      } else if (sq.kind === 'parking') {
        for (let k = 0; k < 4; k++) g.add(car(-0.45 + k * 0.3, (k % 2) * 0.1, rnd));
      } else if (sq.kind === 'gotojail') {
        g.add(box(0.6, 0.3, 0.45, M.wall));
        g.add(box(0.62, 0.06, 0.47, M.dark, 0, 0.3, 0));
        g.add(car(0.1, 0.4, rnd));
      } else {
        g.add(tree(-0.4, 0, 1.3), tree(0, 0.2, 1.1), tree(0.4, -0.1, 1.4));
      }
      root.add(g);
      continue;
    }
    const cx = (c.x0 + c.x1) / 2 - W / 2, cz = (c.z0 + c.z1) / 2 - W / 2;
    const outward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), -SIDE_ANGLE[c.side]);
    g.position.set(cx, 0, cz).add(outward.multiplyScalar(0.75 + 0.25 + RING * 0.4));
    g.rotation.y = -SIDE_ANGLE[c.side] + Math.PI;
    switch (sq.kind) {
      case 'street': {
        const f = sq.group! / (b.groups.length - 1);
        const accent = accents[sq.group!];
        if (f < 0.34) {
          g.add(house(-0.18, 0.05, rnd), house(0.2, -0.05, rnd));
          if (rnd() < 0.7) g.add(tree(0, 0.35));
        } else if (f < 0.72) {
          g.add(block(-0.1, 0.05, rnd, accent));
          if (rnd() < 0.5) g.add(tree(0.3, 0.3, 0.8));
        } else {
          g.add(villa(0, 0, rnd, accent));
        }
        break;
      }
      case 'station': {
        g.add(box(0.9, 0.05, 0.3, M.grey));
        g.add(box(0.8, 0.14, 0.14, M.train, 0, 0.05, 0.06));
        g.add(box(0.8, 0.02, 0.16, M.dark, 0, 0.19, 0.06));
        break;
      }
      case 'utility': {
        if (rnd() < 0.5) {
          const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 16), M.metal);
          tank.position.y = 0.4; tank.castShadow = true;
          g.add(tank);
          for (const [x, z] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) g.add(box(0.02, 0.3, 0.02, M.dark, x, 0, z));
        } else {
          g.add(box(0.03, 0.75, 0.03, M.metal));
          g.add(box(0.4, 0.02, 0.02, M.metal, 0, 0.62, 0));
          g.add(box(0.28, 0.02, 0.02, M.metal, 0, 0.5, 0));
        }
        break;
      }
      default:
        g.add(tree(-0.2, rnd() * 0.2, 0.9 + rnd() * 0.4), tree(0.2, rnd() * 0.2, 0.9 + rnd() * 0.4));
    }
    root.add(g);
  }
  return root;
}

function bounceOut(x: number): number {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}

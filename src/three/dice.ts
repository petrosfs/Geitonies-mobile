import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/*
 * Dice physics, simulated ahead of time (no clock involved), then played back.
 * After the simulation the dice are nudged flat and apart, so the result is
 * always readable, and the rolled values are painted on the faces that ended up on top.
 */

export interface DiceSim {
  /** per frame: [x,y,z,qx,qy,qz,qw] for die 0 then die 1 */
  frames: Float32Array[];
  /** impacts (for sound/vibration): frame and strength 0..1 */
  hits: { f: number; s: number }[];
  /** per die: value shown on each local face (+x,-x,+y,-y,+z,-z) */
  faces: number[][];
}

export interface DiceOpts {
  d: number;          // die size
  half: number;       // half-size of the throwing area (walls)
  from: { x: number; z: number }; // unit direction the dice are thrown from
  scale: number;      // speed scale
  rand?: () => number;
  /** radius of something round standing in the middle (the parking money); 0 = nothing */
  obstacle?: number;
}

/** hard cap: 3.5 s of rolling; whatever is left is smoothed away by the settle step */
export const MAX_FRAMES = 210;
const SETTLE_FRAMES = 14;
const AXES = [
  new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
];
const UP = new THREE.Vector3(0, 1, 0);

/** local face that points up most */
export function topFace(q: THREE.Quaternion): { face: number; dot: number } {
  let face = 0, dot = -2;
  AXES.forEach((a, i) => { const y = a.clone().applyQuaternion(q).y; if (y > dot) { dot = y; face = i; } });
  return { face, dot };
}

/** values for the 6 local faces so that `face` shows `value` and opposite faces add up to 7 */
export function faceValues(face: number, value: number): number[] {
  const others = [1, 2, 3, 4, 5, 6].filter((v) => v !== value && v !== 7 - value);
  const a = others[0];
  const rest = others.filter((v) => v !== a && v !== 7 - a);
  const pairs: [number, number][] = [[a, 7 - a], [rest[0], rest[1]]];
  const out = new Array<number>(6);
  out[face] = value;
  out[face ^ 1] = 7 - value;
  let n = 0;
  for (let p = 0; p < 3; p++) {
    if (p === Math.floor(face / 2)) continue;
    out[p * 2] = pairs[n][0];
    out[p * 2 + 1] = pairs[n][1];
    n++;
  }
  return out;
}

export function simulateDice(values: [number, number], o: DiceOpts): DiceSim {
  const rand = o.rand ?? Math.random;
  const r = (a: number, b: number) => a + rand() * (b - a);
  const { d, half } = o;
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82 * 3, 0) });
  world.allowSleep = true;
  const mat = new CANNON.Material('m');
  world.addContactMaterial(new CANNON.ContactMaterial(mat, mat, { friction: 0.35, restitution: 0.35 }));
  const plane = (x: number, y: number, z: number, rx: number, ry: number) => {
    const b = new CANNON.Body({ mass: 0, material: mat, shape: new CANNON.Plane() });
    b.quaternion.setFromEuler(rx, ry, 0);
    b.position.set(x, y, z);
    world.addBody(b);
  };
  plane(0, 0, 0, -Math.PI / 2, 0);         // table
  plane(0, 0, -half, 0, 0);                // walls
  plane(0, 0, half, 0, Math.PI);
  plane(-half, 0, 0, 0, Math.PI / 2);
  plane(half, 0, 0, 0, -Math.PI / 2);
  plane(0, d * 12, 0, Math.PI / 2, 0);      // ceiling, so nothing can fly away
  const obst = o.obstacle ?? 0;
  if (obst > 0) {
    const pile = new CANNON.Body({ mass: 0, material: mat, shape: new CANNON.Cylinder(obst, obst, d * 1.6, 16) });
    pile.position.set(0, d * 0.8, 0);
    world.addBody(pile);
  }

  const from = new THREE.Vector3(o.from.x, 0, o.from.z);
  if (from.lengthSq() < 1e-6) from.set(0, 0, 1);
  from.normalize();
  const bodies = [0, 1].map((k) => {
    const b = new CANNON.Body({ mass: 1, material: mat, shape: new CANNON.Box(new CANNON.Vec3(d / 2, d / 2, d / 2)) });
    b.sleepSpeedLimit = 0.15;
    b.sleepTimeLimit = 0.25;
    b.linearDamping = 0.12;
    b.angularDamping = 0.12;
    const side = new THREE.Vector3(-from.z, 0, from.x).multiplyScalar((k - 0.5) * d * 2.2);
    const start = from.clone().multiplyScalar(half * 0.7).add(side);
    b.position.set(start.x, d * r(3, 4.5), start.z);
    const vel = from.clone().multiplyScalar(-r(8, 11) * o.scale).add(new THREE.Vector3(r(-1.5, 1.5), 0, r(-1.5, 1.5)));
    b.velocity.set(vel.x, r(1, 3), vel.z);
    b.angularVelocity.set(r(-18, 18), r(-18, 18), r(-18, 18));
    b.quaternion.setFromEuler(r(0, 6.3), r(0, 6.3), r(0, 6.3));
    world.addBody(b);
    return b;
  });

  const hits: { f: number; s: number }[] = [];
  let frame = 0;
  bodies.forEach((b) => b.addEventListener('collide', (e: { contact: CANNON.ContactEquation }) => {
    const s = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (Number.isFinite(s) && s > 1.2 && (!hits.length || frame - hits[hits.length - 1].f > 3)) hits.push({ f: frame, s: Math.min(1, s / 10) });
  }));

  const frames: Float32Array[] = [];
  let calm = 0;
  const snap = () => {
    const f = new Float32Array(14);
    bodies.forEach((b, k) => f.set([b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w], k * 7));
    return f;
  };
  for (frame = 0; frame < MAX_FRAMES; frame++) {
    world.step(1 / 60); // fixed step, independent of the real clock
    const f = snap();
    if (!f.every(Number.isFinite)) break; // never trust a broken frame
    frames.push(f);
    if (frame > 30 && bodies.every((b) => b.sleepState === CANNON.Body.SLEEPING)) break;
    // almost still for a third of a second: good enough
    const slow = bodies.every((b) => b.velocity.length() < 0.25 && b.angularVelocity.length() < 0.6 && b.position.y < d * 0.75);
    calm = slow ? calm + 1 : 0;
    if (frame > 30 && calm > 20) break;
  }
  if (!frames.length) frames.push(snap().map((v, i) => (Number.isFinite(v) ? v : [0, d / 2, 0, 0, 0, 0, 1][i % 7])) as Float32Array);

  // settle: lie flat on the nearest face, stay inside the walls, don't overlap
  const last = frames[frames.length - 1];
  const pos = [0, 1].map((k) => new THREE.Vector3(last[k * 7], last[k * 7 + 1], last[k * 7 + 2]));
  const q0 = [0, 1].map((k) => new THREE.Quaternion(last[k * 7 + 3], last[k * 7 + 4], last[k * 7 + 5], last[k * 7 + 6]).normalize());
  const q1 = q0.map((q) => {
    const { face } = topFace(q);
    const worldAxis = AXES[face].clone().applyQuaternion(q);
    return new THREE.Quaternion().setFromUnitVectors(worldAxis, UP).multiply(q);
  });
  const lim = half - d * 0.75;
  const end = pos.map((p) => new THREE.Vector3(
    Math.max(-lim, Math.min(lim, p.x)), d / 2, Math.max(-lim, Math.min(lim, p.z)),
  ));
  // never rest on top of the money pile
  if (obst > 0) {
    end.forEach((p) => {
      const r = Math.hypot(p.x, p.z), min = obst + d * 0.75;
      if (r < min) { const a = r > 1e-6 ? Math.atan2(p.z, p.x) : Math.random() * 6.28; p.x = Math.cos(a) * min; p.z = Math.sin(a) * min; }
    });
  }
  const gap = new THREE.Vector3().subVectors(end[1], end[0]).setY(0);
  const minGap = d * 1.5;
  if (gap.length() < minGap) {
    if (gap.lengthSq() < 1e-6) gap.set(1, 0, 0);
    gap.setLength((minGap - gap.length()) / 2 + 1e-3);
    end[0].sub(gap);
    end[1].add(gap);
    end.forEach((p) => { p.x = Math.max(-lim, Math.min(lim, p.x)); p.z = Math.max(-lim, Math.min(lim, p.z)); });
  }
  for (let s = 1; s <= SETTLE_FRAMES; s++) {
    const t = s / SETTLE_FRAMES;
    const e = t * t * (3 - 2 * t);
    const f = new Float32Array(14);
    for (let k = 0; k < 2; k++) {
      const p = pos[k].clone().lerp(end[k], e);
      const q = q0[k].clone().slerp(q1[k], e);
      f.set([p.x, p.y, p.z, q.x, q.y, q.z, q.w], k * 7);
    }
    frames.push(f);
  }
  const faces = [0, 1].map((k) => faceValues(topFace(q1[k]).face, values[k]));
  return { frames, hits, faces };
}

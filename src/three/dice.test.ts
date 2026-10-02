import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { faceValues, MAX_FRAMES, simulateDice, topFace } from './dice';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

describe('dice', () => {
  it('faceValues puts the value on top and opposite faces add to 7', () => {
    for (let face = 0; face < 6; face++) {
      for (let v = 1; v <= 6; v++) {
        const f = faceValues(face, v);
        expect(f[face]).toBe(v);
        expect([...f].sort().join()).toBe('1,2,3,4,5,6');
        for (let p = 0; p < 3; p++) expect(f[p * 2] + f[p * 2 + 1]).toBe(7);
      }
    }
  });

  it('3000 throws: always land flat, inside the board, apart, showing the rolled values', () => {
    const boards = [{ W: 12, inner: 9 }, { W: 16, inner: 13 }];
    let maxFrames = 0, totalFrames = 0;
    for (let i = 0; i < 3000; i++) {
      const rand = seeded(i + 1);
      const b = boards[i % 2];
      const d = 0.058 * b.W;
      const half = b.inner / 2 - 0.15;
      const a = rand() * Math.PI * 2;
      const values: [number, number] = [1 + Math.floor(rand() * 6), 1 + Math.floor(rand() * 6)];
      const obstacle = i % 3 === 0 ? 0.3 * (b.W / 12) : 0;   // every third throw: parking money in the middle
      const sim = simulateDice(values, { d, half, from: { x: Math.sin(a), z: Math.cos(a) }, scale: b.W / 12, rand, obstacle });
      maxFrames = Math.max(maxFrames, sim.frames.length);
      totalFrames += sim.frames.length;
      expect(sim.frames.length).toBeGreaterThan(10);
      expect(sim.frames.length).toBeLessThanOrEqual(MAX_FRAMES + 20);
      for (const f of sim.frames) for (const v of f) expect(Number.isFinite(v)).toBe(true);
      const last = sim.frames[sim.frames.length - 1];
      const p = [0, 1].map((k) => new THREE.Vector3(last[k * 7], last[k * 7 + 1], last[k * 7 + 2]));
      for (let k = 0; k < 2; k++) {
        const q = new THREE.Quaternion(last[k * 7 + 3], last[k * 7 + 4], last[k * 7 + 5], last[k * 7 + 6]);
        const top = topFace(q);
        expect(top.dot).toBeGreaterThan(0.999);                 // lying flat
        expect(sim.faces[k][top.face]).toBe(values[k]);          // shows the rolled number
        expect(Math.abs(p[k].y - d / 2)).toBeLessThan(1e-3);     // on the table
        expect(Math.abs(p[k].x)).toBeLessThanOrEqual(half);      // inside the walls
        expect(Math.abs(p[k].z)).toBeLessThanOrEqual(half);
        // never below the table during the throw
        for (const f of sim.frames) expect(f[k * 7 + 1]).toBeGreaterThan(d * 0.2);
      }
      expect(p[0].distanceTo(p[1])).toBeGreaterThanOrEqual(d * 1.2); // not overlapping
      if (obstacle) for (const q of p) expect(Math.hypot(q.x, q.z)).toBeGreaterThan(obstacle + d * 0.5); // not on the money
    }
    console.log(`dice: max ${(maxFrames / 60).toFixed(1)} s, average ${(totalFrames / 3000 / 60).toFixed(2)} s`);
  }, 300000);
});

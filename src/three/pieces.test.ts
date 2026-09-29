import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';

/* Every piece can be built, is a sensible size and fits on a square. */

beforeAll(() => {
  // a tiny stand-in for <canvas> (pieces draw number plates and € signs on canvases)
  // any property is a function that returns another such object (gradients, measureText, ...)
  const any: object = new Proxy(function () { /* stub */ }, { get: (_t, k) => (k === 'width' ? 10 : any), apply: () => any });
  const ctx = any;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
  };
});

describe('pieces', async () => {
  const { buildPiece, PIECES, GLIDERS } = await import('./pieces');

  it('there are 23 different pieces (no octopus)', () => {
    expect(new Set(PIECES).size).toBe(23);
    expect(PIECES).not.toContain('🐙');
  });

  for (const id of [...PIECES, '⛵', '🛵', '🐙', 'unknown-piece']) {
    it(`${id} builds, has no broken geometry and fits in a square`, () => {
      const g = buildPiece(id, '#e5484d');
      let meshes = 0;
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        meshes++;
        const pos = m.geometry.getAttribute('position');
        for (let i = 0; i < pos.array.length; i++) expect(Number.isFinite(pos.array[i])).toBe(true);
      });
      expect(meshes).toBeGreaterThan(0);
      const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
      expect(size.y).toBeGreaterThan(0.25);
      expect(size.y).toBeLessThan(1.3);
      expect(Math.max(size.x, size.z)).toBeLessThan(1.1);
    });
  }

  it('vehicles roll smoothly', () => {
    for (const id of ['🚗', '🚢', '🏍️', 'barrow']) expect(GLIDERS.has(id)).toBe(true);
  });
});

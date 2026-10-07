import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/*
 * 3D pieces built from simple shapes, one per piece choice.
 * Unit size: stands on y = 0, about 0.9 tall, faces +x (direction of travel).
 * Main colour = player colour.
 */

type Mat = THREE.Material;

function mats(color: string) {
  const c = new THREE.Color(color);
  // lacquered paint: glossy clear coat over the colour (looks like a painted metal game piece)
  const paint = (col: THREE.Color, rough = 0.32) => new THREE.MeshPhysicalMaterial({
    color: col, roughness: rough, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12,
  });
  return {
    main: paint(c),
    dark: paint(c.clone().multiplyScalar(0.55), 0.4),
    ink: new THREE.MeshPhysicalMaterial({ color: '#1f2428', roughness: 0.45, metalness: 0.1, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
    white: new THREE.MeshPhysicalMaterial({ color: '#f5f5f0', roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    gold: new THREE.MeshStandardMaterial({ color: '#e8b04a', roughness: 0.22, metalness: 1 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#b9dcf0', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.6, clearcoat: 1 }),
    orange: new THREE.MeshStandardMaterial({ color: '#f47b20', roughness: 0.4, emissive: '#c24a00', emissiveIntensity: 0.4 }),
    terracotta: new THREE.MeshStandardMaterial({ color: '#b5623b', roughness: 0.75 }),
    red: new THREE.MeshStandardMaterial({ color: '#c8352b', roughness: 0.45 }),
    cheese: new THREE.MeshStandardMaterial({ color: '#f5c542', roughness: 0.55 }),
  };
}

function mesh(geo: THREE.BufferGeometry, mat: Mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
const box = (w: number, h: number, d: number, mat: Mat, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const sphere = (r: number, mat: Mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
  const m = mesh(new THREE.SphereGeometry(r, 32, 24), mat, x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
};
const cyl = (rt: number, rb: number, h: number, mat: Mat, x = 0, y = 0, z = 0, seg = 32) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);
const cone = (r: number, h: number, mat: Mat, x = 0, y = 0, z = 0, seg = 24) => mesh(new THREE.ConeGeometry(r, h, seg), mat, x, y, z);

const builders: Record<string, (m: ReturnType<typeof mats>) => THREE.Object3D[]> = {
  // 1950s-style racer (our own design): cigar body, open wheels, driver in helmet and goggles, number roundel
  '🚗': (m) => {
    const chrome = new THREE.MeshStandardMaterial({ color: '#f2f5f7', roughness: 0.12, metalness: 1 });
    // cigar-shaped body: a lathe along the x axis (tail at -x, nose at +x)
    const profile = [
      [0.0, -0.44], [0.03, -0.42], [0.07, -0.34], [0.1, -0.22], [0.115, -0.08], [0.118, 0.06],
      [0.108, 0.22], [0.092, 0.34], [0.078, 0.42], [0.07, 0.44], [0.0, 0.44],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const body = mesh(new THREE.LatheGeometry(profile, 32), m.main, 0, 0.16, 0);
    body.rotation.z = -Math.PI / 2;
    body.scale.set(1, 1, 0.92);
    const mouth = mesh(new THREE.CircleGeometry(0.058, 24), m.ink, 0.442, 0.16, 0);
    mouth.rotation.y = Math.PI / 2;
    const lip = mesh(new THREE.TorusGeometry(0.062, 0.009, 8, 24), chrome, 0.44, 0.16, 0);
    lip.rotation.y = Math.PI / 2;
    const stripe = mesh(new THREE.CylinderGeometry(0.119, 0.119, 0.035, 32, 1, true), m.white, 0.16, 0.16, 0);
    stripe.rotation.z = Math.PI / 2;
    stripe.scale.set(1, 1, 0.93);
    // cockpit, windscreen and driver
    const cockpit = sphere(0.075, m.ink, -0.06, 0.262, 0, 1.5, 0.25, 0.95);
    const screen = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16, 1, true, -Math.PI / 2.4, Math.PI / 1.2), m.glass, 0.035, 0.29, 0);
    (screen.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    screen.rotation.z = -0.35;
    const helmet = sphere(0.056, m.white, -0.08, 0.33, 0);
    const goggles = mesh(new THREE.TorusGeometry(0.052, 0.012, 8, 20), m.ink, -0.078, 0.335, 0);
    goggles.rotation.x = Math.PI / 2;
    goggles.scale.set(1, 1, 0.5);
    const lenses = [0.022, -0.022].map((z) => sphere(0.016, m.glass, -0.03, 0.335, z, 0.5, 1, 1));
    const shoulders = sphere(0.06, m.dark, -0.1, 0.27, 0, 1, 0.5, 1.4);
    // number roundels (drawn once per piece)
    const tex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d')!;
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(32, 32, 30, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#1d1d1d'; x.font = '800 38px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('5', 32, 35);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const roundel = (z: number) => {
      const r = new THREE.Mesh(new THREE.CircleGeometry(0.05, 24), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5 }));
      r.position.set(-0.2, 0.17, z);
      r.rotation.y = z > 0 ? 0 : Math.PI;
      return r;
    };
    // open wheels with spokes and a knock-off spinner, on thin suspension arms
    const spokeWheel = (x: number, z: number, r: number) => {
      const g = new THREE.Group();
      const tyre = mesh(new THREE.TorusGeometry(r - 0.022, 0.024, 10, 28), m.ink);
      const rim = mesh(new THREE.TorusGeometry(r - 0.045, 0.008, 6, 24), chrome);
      g.add(tyre, rim);
      for (let k = 0; k < 8; k++) {
        const sp = box(0.006, (r - 0.045) * 2, 0.006, chrome);
        sp.rotation.z = (k / 8) * Math.PI;
        g.add(sp);
      }
      const spinner = cone(0.022, 0.04, chrome, 0, 0, 0, 3);
      spinner.rotation.x = Math.sign(z) * Math.PI / 2;
      spinner.position.z = Math.sign(z) * 0.02;
      g.add(spinner);
      g.position.set(x, r, z);
      const arm = cyl(0.008, 0.008, Math.abs(z) - 0.07, m.ink, x, r, z / 2 + Math.sign(z) * 0.035, 6);
      arm.rotation.x = Math.PI / 2;
      return [g, arm];
    };
    return [
      body, mouth, lip, stripe,
      cockpit, screen, shoulders, helmet, goggles, ...lenses,
      roundel(0.109), roundel(-0.109),
      ...spokeWheel(0.28, 0.17, 0.105), ...spokeWheel(0.28, -0.17, 0.105),
      ...spokeWheel(-0.25, 0.175, 0.115), ...spokeWheel(-0.25, -0.175, 0.115),
    ];
  },
  // top hat
  '🎩': (m) => [
    cyl(0.34, 0.34, 0.04, m.main, 0, 0.02, 0, 32),
    cyl(0.2, 0.22, 0.5, m.main, 0, 0.29, 0, 28),
    cyl(0.225, 0.225, 0.08, m.ink, 0, 0.1, 0, 28),
  ],
  // dog: rounded body, paws, floppy ears, curled tail
  '🐶': (m) => {
    const ear = (z: number) => { const e = sphere(0.07, m.dark, 0.2, 0.58, z, 0.55, 1.25, 0.5); e.rotation.x = z > 0 ? 0.35 : -0.35; return e; };
    const tail = mesh(new THREE.TorusGeometry(0.09, 0.028, 10, 20, Math.PI * 1.1), m.main, -0.29, 0.45, 0);
    tail.rotation.set(0, 0, 0.6);
    const leg = (x: number, z: number) => [
      cyl(0.045, 0.038, 0.2, m.main, x, 0.13, z, 16),
      sphere(0.05, m.main, x + 0.015, 0.03, z, 1.25, 0.6, 1),
    ];
    return [
      sphere(0.2, m.main, -0.04, 0.34, 0, 1.45, 0.82, 0.85),                 // body
      sphere(0.13, m.main, 0.16, 0.44, 0, 1, 1.05, 1),                       // chest
      sphere(0.14, m.main, 0.27, 0.6, 0, 1.05, 0.95, 0.95),                  // head
      sphere(0.075, m.main, 0.39, 0.55, 0, 1.3, 0.8, 0.9),                   // muzzle
      sphere(0.028, m.ink, 0.49, 0.58, 0),                                    // nose
      sphere(0.022, m.ink, 0.37, 0.65, 0.065), sphere(0.022, m.ink, 0.37, 0.65, -0.065),
      ear(0.11), ear(-0.11), tail,
      ...leg(0.14, 0.09), ...leg(0.14, -0.09), ...leg(-0.2, 0.09), ...leg(-0.2, -0.09),
      mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 24), m.red, 0.19, 0.5, 0).rotateY(Math.PI / 2).rotateX(0.4), // collar
    ];
  },
  // lucky cat (maneki-neko): sitting, big round head, left paw raised and beckoning, collar with a bell, gold coin
  '🐱': (m) => {
    const red = new THREE.MeshStandardMaterial({ color: '#d7263d', roughness: 0.4 });
    const pink = new THREE.MeshStandardMaterial({ color: '#f4a3b4', roughness: 0.5 });
    const ear = (z: number) => {
      const e = cone(0.06, 0.1, m.main, 0.02, 0.8, z, 12);
      e.rotation.x = z > 0 ? -0.35 : 0.35;
      const inner = cone(0.035, 0.07, pink, 0.035, 0.79, z * 0.98, 12);
      inner.rotation.x = e.rotation.x;
      return [e, inner];
    };
    const whisker = (z: number, a: number) => {
      const w = cyl(0.003, 0.003, 0.09, m.ink, 0.17, 0.6 + a * 0.02, z, 4);
      w.rotation.set(Math.PI / 2, 0, a * 0.2);
      w.position.z = z + Math.sign(z) * 0.03;
      return w;
    };
    const eye = (z: number) => {
      const e = mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 16, Math.PI), m.ink, 0.165, 0.66, z);
      e.rotation.y = Math.PI / 2;
      return e;
    };
    // raised left paw (beckoning), right paw holding a gold coin
    const armUp = limb(new THREE.Vector3(0.04, 0.36, 0.14), new THREE.Vector3(0.09, 0.66, 0.2), 0.045, 0.04, m.main);
    const pawUp = sphere(0.055, m.main, 0.1, 0.7, 0.2, 0.8, 1, 1);
    const pawPad = sphere(0.025, pink, 0.14, 0.7, 0.2, 0.4, 1, 1);
    const coin = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 24), m.gold, 0.17, 0.3, -0.07);
    coin.rotation.z = Math.PI / 2;
    coin.scale.set(1, 1, 0.65);
    return [
      sphere(0.2, m.main, 0, 0.2, 0, 1, 1.1, 1),                       // body
      mesh(new RoundedBoxGeometry(0.34, 0.04, 0.34, 3, 0.015), m.dark, 0, 0.02, 0), // cushion
      sphere(0.17, m.main, 0.02, 0.6, 0, 1, 0.92, 1.05),                // big head
      sphere(0.07, m.white, 0.14, 0.56, 0, 0.5, 0.75, 1.3),             // muzzle
      sphere(0.018, pink, 0.18, 0.59, 0),                               // nose
      eye(0.06), eye(-0.06),
      ...ear(0.1), ...ear(-0.1),
      whisker(0.06, 1), whisker(0.06, -1), whisker(-0.06, 1), whisker(-0.06, -1),
      mesh(new THREE.TorusGeometry(0.115, 0.024, 8, 28), red, 0.02, 0.44, 0).rotateX(Math.PI / 2), // collar
      sphere(0.035, m.gold, 0.15, 0.39, 0),                            // bell
      box(0.01, 0.004, 0.03, m.ink, 0.183, 0.385, 0),
      armUp, pawUp, pawPad,
      sphere(0.05, m.main, 0.16, 0.3, -0.12),                          // paw on the coin
      coin,
      sphere(0.06, m.main, 0.14, 0.05, 0.1, 1.3, 0.7, 1), sphere(0.06, m.main, 0.14, 0.05, -0.1, 1.3, 0.7, 1), // feet
      mesh(new THREE.TorusGeometry(0.12, 0.028, 8, 20, Math.PI), m.main, -0.17, 0.1, 0).rotateX(Math.PI / 2), // tail
    ];
  },
  // rocket
  '🚀': (m) => {
    const fins = [0, 1, 2].map((k) => {
      const f = box(0.02, 0.22, 0.16, m.dark, 0, 0.14, 0);
      const a = (k / 3) * Math.PI * 2;
      f.position.set(Math.cos(a) * 0.15, 0.14, Math.sin(a) * 0.15);
      f.rotation.y = -a;
      return f;
    });
    const win = sphere(0.06, m.glass, 0.13, 0.55, 0, 0.4, 1, 1);
    return [
      cyl(0.14, 0.13, 0.55, m.white, 0, 0.4, 0),
      cone(0.14, 0.26, m.main, 0, 0.8, 0),
      cyl(0.141, 0.141, 0.08, m.main, 0, 0.3, 0),
      cone(0.08, 0.14, m.orange, 0, 0.08, 0),
      win, ...fins,
    ];
  },
  // guitar (upright)
  '🎸': (m) => {
    const body = new THREE.Group();
    body.add(
    sphere(0.19, m.main, 0, 0.25, 0, 1, 1, 0.5),
    sphere(0.145, m.main, 0, 0.46, 0, 1, 1, 0.5),
    (() => { const h = cyl(0.05, 0.05, 0.02, m.ink, 0, 0.34, 0.09, 16); h.rotation.x = Math.PI / 2; return h; })(),
    box(0.07, 0.42, 0.06, m.dark, 0, 0.74, 0),
    box(0.11, 0.13, 0.06, m.ink, 0, 1.0, 0),
    box(0.12, 0.03, 0.05, m.ink, 0, 0.17, 0.09));
    body.rotation.y = Math.PI / 2;
    return [cyl(0.18, 0.2, 0.04, m.ink, 0, 0.02, 0, 24), body];
  },
  // owl
  '🦉': (m) => [
    sphere(0.22, m.main, 0, 0.32, 0, 1, 1.35, 1),
    sphere(0.085, m.white, 0.14, 0.5, 0.08), sphere(0.085, m.white, 0.14, 0.5, -0.08),
    sphere(0.04, m.ink, 0.21, 0.5, 0.08), sphere(0.04, m.ink, 0.21, 0.5, -0.08),
    (() => { const b = cone(0.04, 0.1, m.gold, 0.22, 0.42, 0, 8); b.rotation.z = -Math.PI; return b; })(),
    cone(0.05, 0.14, m.dark, 0.02, 0.66, 0.12, 6), cone(0.05, 0.14, m.dark, 0.02, 0.66, -0.12, 6),
    sphere(0.14, m.dark, -0.04, 0.3, 0.17, 0.8, 1.3, 0.35), sphere(0.14, m.dark, -0.04, 0.3, -0.17, 0.8, 1.3, 0.35),
    box(0.1, 0.03, 0.06, m.gold, 0.1, 0.02, 0.07), box(0.1, 0.03, 0.06, m.gold, 0.1, 0.02, -0.07),
  ],
  // turtle with a patterned shell: hexagonal plates on top, small plates round the rim
  '🐢': (m) => {
    const shell = mesh(new THREE.SphereGeometry(0.28, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), m.main, 0, 0.08, 0);
    shell.scale.set(1.1, 0.8, 1);
    const plates: THREE.Object3D[] = [];
    const R = 0.28, sx = 1.1, sy = 0.8, y0 = 0.08;
    const plateAt = (theta: number, phi: number, size: number, mat: Mat) => {
      const p = new THREE.Vector3(R * sx * Math.sin(phi) * Math.cos(theta), y0 + R * sy * Math.cos(phi), R * Math.sin(phi) * Math.sin(theta));
      const n = new THREE.Vector3(p.x / (sx * sx), (p.y - y0) / (sy * sy), p.z).normalize();
      const plate = mesh(new THREE.CylinderGeometry(size, size * 1.05, 0.014, 6), mat);
      plate.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      plate.position.copy(p).add(n.clone().multiplyScalar(0.004));
      return plate;
    };
    plates.push(plateAt(0, 0, 0.07, m.dark));                           // centre plate
    for (let k = 0; k < 6; k++) plates.push(plateAt((k / 6) * Math.PI * 2, 0.62, 0.062, m.dark)); // ring
    for (let k = 0; k < 14; k++) plates.push(plateAt((k / 14) * Math.PI * 2 + 0.2, 1.22, 0.034, m.dark)); // rim
    return [
      shell, ...plates,
      cyl(0.3, 0.3, 0.035, m.dark, 0, 0.08, 0, 32),
      sphere(0.1, m.dark, 0.36, 0.14, 0, 1.2, 0.9, 0.9),
      sphere(0.02, m.ink, 0.43, 0.18, 0.05), sphere(0.02, m.ink, 0.43, 0.18, -0.05),
      sphere(0.07, m.dark, 0.2, 0.04, 0.22, 1.3, 0.6, 1), sphere(0.07, m.dark, 0.2, 0.04, -0.22, 1.3, 0.6, 1),
      sphere(0.07, m.dark, -0.2, 0.04, 0.22, 1.3, 0.6, 1), sphere(0.07, m.dark, -0.2, 0.04, -0.22, 1.3, 0.6, 1),
      (() => { const t = cone(0.04, 0.12, m.dark, -0.34, 0.08, 0, 12); t.rotation.z = Math.PI / 2; return t; })(),
    ];
  },
  // cactus in a pot, with ribs and black spines
  '🌵': (m) => {
    const spines: THREE.Object3D[] = [];
    const spineAt = (p: THREE.Vector3, dir: THREE.Vector3) => {
      const sp = cone(0.007, 0.04, m.ink, 0, 0, 0, 5);
      sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      sp.position.copy(p).add(dir.clone().normalize().multiplyScalar(0.018));
      spines.push(sp);
    };
    const column = (cx: number, y0: number, y1: number, r: number) => {
      for (let y = y0; y <= y1; y += 0.07) {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + (Math.round((y - y0) / 0.07) % 2) * (Math.PI / 8);
          spineAt(new THREE.Vector3(cx + Math.cos(a) * r, y, Math.sin(a) * r), new THREE.Vector3(Math.cos(a), 0.25, Math.sin(a)));
        }
      }
    };
    column(0, 0.26, 0.76, 0.09);
    column(0.16, 0.57, 0.66, 0.05);
    column(-0.16, 0.47, 0.56, 0.05);
    const ribs = Array.from({ length: 8 }, (_, k) => {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      return cyl(0.012, 0.012, 0.56, m.dark, Math.cos(a) * 0.086, 0.5, Math.sin(a) * 0.086, 6);
    });
    const arm = (x: number, y: number, dir: number) => {
      const g = new THREE.Group();
      const h = cyl(0.05, 0.05, 0.14, m.main, x * 0.6, y, 0, 16);
      h.rotation.z = Math.PI / 2;
      g.add(h, cyl(0.05, 0.05, 0.14, m.main, x, y + 0.06, 0, 16), sphere(0.05, m.main, x, y + 0.13, 0));
      g.position.x = 0;
      void dir;
      return g;
    };
    return [
      cyl(0.17, 0.13, 0.2, m.terracotta, 0, 0.1, 0),
      cyl(0.18, 0.18, 0.04, m.terracotta, 0, 0.2, 0),
      cyl(0.16, 0.16, 0.01, m.ink, 0, 0.221, 0),                        // soil
      cyl(0.09, 0.09, 0.6, m.main, 0, 0.5, 0, 24),
      sphere(0.09, m.main, 0, 0.8, 0),
      ...ribs,
      arm(0.16, 0.52, 1), arm(-0.16, 0.42, -1),
      ...spines,
      sphere(0.028, m.ink, 0, 0.9, 0, 1, 0.6, 1),                       // dark flower bud on top
    ];
  },
  // football on a stand
  '⚽': (m) => {
    const ball = new THREE.Group();
    const ico = new THREE.IcosahedronGeometry(1, 0);
    const pos = ico.getAttribute('position');
    ball.add(mesh(new THREE.IcosahedronGeometry(0.24, 2), m.white));
    const seen = new Set<string>();
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i).normalize();
      const k = v.toArray().map((x) => x.toFixed(2)).join();
      if (seen.has(k)) continue;
      seen.add(k);
      const patch = mesh(new THREE.CircleGeometry(0.075, 5), m.main);
      patch.position.copy(v.clone().multiplyScalar(0.242));
      patch.lookAt(v.clone().multiplyScalar(2));
      ball.add(patch);
    }
    ball.position.y = 0.36;
    return [cyl(0.14, 0.18, 0.1, m.dark, 0, 0.05, 0), ball];
  },
  // pizza slice on a plate (lying almost flat, tip forward)
  '🍕': (m) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(0.24, 0.62); sh.lineTo(-0.24, 0.62); sh.closePath();
    const slice = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: false }), m.cheese);
    const crust = cyl(0.055, 0.055, 0.52, m.main, 0, 0.62, 0.035, 12);
    crust.rotation.z = Math.PI / 2;
    const dots = [[0, 0.42, 0.05], [-0.08, 0.28, 0.045], [0.07, 0.2, 0.04]].map(([x, y, r]) => {
      const d = cyl(r, r, 0.02, m.red, x, y, 0.08, 14);
      d.rotation.x = Math.PI / 2;
      return d;
    });
    const inner = new THREE.Group();
    inner.add(slice, crust, ...dots);
    inner.position.y = -0.31; // centre the slice
    const tilt = new THREE.Group();
    tilt.add(inner);
    tilt.rotation.set(-Math.PI / 2 + 0.35, 0, Math.PI / 2); // lie down, tip toward +x, crust raised
    tilt.position.y = 0.2;
    return [cyl(0.36, 0.3, 0.05, m.white, 0, 0.025, 0, 28), tilt];
  },
  // crown
  '👑': (m) => {
    const ring = mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.2, 28, 1, true), m.main, 0, 0.14, 0);
    (m.main as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    const parts: THREE.Object3D[] = [ring, cyl(0.23, 0.23, 0.04, m.gold, 0, 0.05, 0, 28)];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      parts.push(cone(0.06, 0.2, m.main, Math.cos(a) * 0.2, 0.34, Math.sin(a) * 0.2, 8));
      parts.push(sphere(0.035, m.gold, Math.cos(a) * 0.2, 0.46, Math.sin(a) * 0.2));
      parts.push(sphere(0.03, m.white, Math.cos(a + 0.6) * 0.215, 0.15, Math.sin(a + 0.6) * 0.215));
    }
    return parts;
  },
  // unicorn
  '🦄': (m) => horseParts(m, true),
  // octopus
  '🐙': (m) => {
    const parts: THREE.Object3D[] = [
      sphere(0.22, m.main, 0, 0.42, 0, 1, 1.15, 1),
      sphere(0.05, m.white, 0.18, 0.44, 0.08), sphere(0.05, m.white, 0.18, 0.44, -0.08),
      sphere(0.025, m.ink, 0.22, 0.44, 0.08), sphere(0.025, m.ink, 0.22, 0.44, -0.08),
    ];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const curve = new THREE.CatmullRomCurve3([
        dir.clone().multiplyScalar(0.12).setY(0.26),
        dir.clone().multiplyScalar(0.24).setY(0.08),
        dir.clone().multiplyScalar(0.34).setY(0.04),
        dir.clone().multiplyScalar(0.36).add(new THREE.Vector3(0, 0.12, 0)).add(new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.06)),
      ]);
      parts.push(mesh(new THREE.TubeGeometry(curve, 16, 0.035, 8, false), m.main));
    }
    return parts;
  },
};


// ---------------- extra pieces ----------------

/** flat outline (x,z) extruded upward by h, bottom at y0 */
function slab(pts: [number, number][], h: number, mat: Mat, y0 = 0) {
  const sh = new THREE.Shape();
  pts.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
  sh.closePath();
  const bev = Math.min(0.012, h * 0.25);
  const m = mesh(new THREE.ExtrudeGeometry(sh, { depth: h - 2 * bev, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 3, curveSegments: 8 }), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = bev;
  m.position.y += y0;
  return m;
}
const scalePts = (pts: [number, number][], k: number): [number, number][] => pts.map(([x, z]) => [x * k, z * k]);

function textTex(text: string, bg: string | null, fg: string, size = 64): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  if (bg) { x.fillStyle = bg; x.beginPath(); x.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = fg;
  x.font = `800 ${Math.round(size * 0.6)}px system-ui, sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, size / 2, size / 2 + size * 0.04);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function decalCircle(tex: THREE.Texture, r: number, x: number, y: number, z: number, ry: number) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5 }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  return m;
}
const woodMat = () => new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.8 });
const chromeMat = () => new THREE.MeshStandardMaterial({ color: '#f2f5f7', roughness: 0.12, metalness: 1 });

type B = (m: ReturnType<typeof mats>) => THREE.Object3D[];

/** a ship's hull lofted through cross-sections: narrow keel, flared sides, raked bow, flat transom */
function shipHull(mat: Mat, deckMat: Mat) {
  const N = 28;
  const x0 = -0.46, x1 = 0.5;
  const sec: THREE.Vector3[][] = [];
  const deckL: THREE.Vector3[] = [], deckR: THREE.Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const x = x0 + ((x1 - x0) * i) / N;
    const t = Math.max(0, (x - 0.12) / (x1 - 0.12));            // 0 midships -> 1 bow tip
    const b = 0.12 * Math.sqrt(Math.max(0, 1 - t * t * t)) + (i === N ? 0 : 0.002);
    const deck = 0.165 + t * t * 0.04;                             // sheer: bow rises
    const keel = Math.min(deck - 0.02, 0.02 + Math.pow(t, 2.2) * 0.14); // forefoot rises toward the bow
    const ring = [
      new THREE.Vector3(x, deck, b), new THREE.Vector3(x, deck * 0.55 + keel * 0.45, b * 0.97),
      new THREE.Vector3(x, keel + 0.02, b * 0.62), new THREE.Vector3(x, keel, 0),
      new THREE.Vector3(x, keel + 0.02, -b * 0.62), new THREE.Vector3(x, deck * 0.55 + keel * 0.45, -b * 0.97),
      new THREE.Vector3(x, deck, -b),
    ];
    sec.push(ring);
    deckL.push(ring[0]);
    deckR.push(ring[6]);
  }
  const pos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < 6; k++) {
      const a = sec[i][k], b = sec[i][k + 1], c = sec[i + 1][k], d = sec[i + 1][k + 1];
      tri(a, c, b); tri(b, c, d);
    }
  }
  const stern = sec[0];                                            // transom
  for (let k = 1; k < 6; k++) tri(stern[0], stern[k], stern[k + 1]);
  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hullGeo.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeo, mat);
  (mat as THREE.Material).side = THREE.DoubleSide;
  hull.castShadow = true;
  const dpos: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = deckL[i], b = deckR[i], c = deckL[i + 1], d = deckR[i + 1];
    dpos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z);
  }
  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3));
  deckGeo.computeVertexNormals();
  const deck = new THREE.Mesh(deckGeo, deckMat);
  (deckMat as THREE.Material).side = THREE.DoubleSide;
  deck.position.y = 0.002;
  // railing along the deck edges
  const rail = (pts: THREE.Vector3[]) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(2, -2).map((p) => p.clone().setY(p.y + 0.03))), 40, 0.004, 5, false), m_white);
  return { hull, deck, rails: [rail(deckL), rail(deckR)], deckAt: (x: number) => 0.165 + Math.pow(Math.max(0, (x - 0.12) / 0.38), 2) * 0.04 };
}
let m_white: Mat;

/** side profile (x, y) extruded across the width, centred */
function profileSolid(pts: [number, number][], width: number, mat: Mat, bevel = 0.006) {
  const sh = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: width - 2 * bevel, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2 });
  geo.translate(0, 0, -(width - 2 * bevel) / 2);
  return mesh(geo, mat);
}

/** naval frigate */
const frigate: B = (m) => {
  m_white = m.white;
  const grey = new THREE.MeshPhysicalMaterial({ color: '#aeb8bf', roughness: 0.5, metalness: 0.2, clearcoat: 0.3 });
  const deckMat = new THREE.MeshStandardMaterial({ color: '#7d878e', roughness: 0.8 });
  const { hull, deck, rails, deckAt } = shipHull(m.main, deckMat);
  const d0 = deckAt(0);
  const hullNo = textTex('F', null, '#ffffff', 64);
  const hullNoL = decalCircle(hullNo, 0.035, 0.34, 0.13, 0.087, 0);
  const hullNoR = decalCircle(hullNo, 0.035, 0.34, 0.13, -0.087, Math.PI);
  hullNoL.rotation.y = -0.35; hullNoR.rotation.y = Math.PI + 0.35;
  // superstructure: sloped bridge block, hangar, funnel
  const bridge = profileSolid([[-0.06, 0], [0.13, 0], [0.1, 0.085], [-0.06, 0.085]], 0.17, grey);
  bridge.position.y = d0;
  const bridgeTop = profileSolid([[-0.03, 0], [0.085, 0], [0.065, 0.06], [-0.03, 0.06]], 0.12, grey);
  bridgeTop.position.y = d0 + 0.085;
  const windows = profileSolid([[0.088, 0], [0.068, 0.028], [0.066, 0.028], [0.086, 0]], 0.121, m.ink, 0);
  windows.position.y = d0 + 0.105;
  const hangar = profileSolid([[-0.27, 0], [-0.06, 0], [-0.06, 0.075], [-0.25, 0.075]], 0.16, grey);
  hangar.position.y = d0;
  const funnel = profileSolid([[-0.13, 0], [-0.07, 0], [-0.09, 0.09], [-0.14, 0.09]], 0.07, grey);
  funnel.position.y = d0 + 0.075;
  const funnelTop = profileSolid([[-0.14, 0], [-0.09, 0], [-0.092, 0.012], [-0.141, 0.012]], 0.072, m.ink, 0);
  funnelTop.position.y = d0 + 0.165;
  // mast with yards and radar
  const mast = cyl(0.006, 0.01, 0.2, m.ink, 0.02, d0 + 0.24, 0, 8);
  const yard1 = box(0.006, 0.006, 0.1, m.ink, 0.02, d0 + 0.26, 0);
  const yard2 = box(0.006, 0.006, 0.07, m.ink, 0.02, d0 + 0.3, 0);
  const radar = sphere(0.028, m.white, 0.02, d0 + 0.345, 0, 1, 0.7, 1);
  const radarBar = box(0.012, 0.012, 0.09, m.ink, 0.045, d0 + 0.215, 0);
  // weapons: gun turret and vertical launch cells on the foredeck, a CIWS dome on the hangar
  const gunDeck = deckAt(0.27);
  const turret = cyl(0.03, 0.045, 0.04, grey, 0.27, gunDeck + 0.02, 0, 6);
  const barrel = cyl(0.007, 0.009, 0.14, m.ink, 0.35, gunDeck + 0.035, 0, 10);
  barrel.rotation.z = -Math.PI / 2 + 0.1;
  const vls: THREE.Object3D[] = [];
  for (let a = 0; a < 2; a++) for (let b = 0; b < 3; b++) vls.push(box(0.018, 0.006, 0.018, m.ink, 0.16 + a * 0.024, deckAt(0.17) + 0.003, (b - 1) * 0.024));
  const ciws = sphere(0.022, m.white, -0.21, d0 + 0.095, 0, 1, 1.2, 1);
  // lifeboats on the sides of the hangar
  const boat = (z: number) => { const b = mesh(new THREE.CapsuleGeometry(0.014, 0.05, 4, 10), m.orange, -0.14, d0 + 0.06, z); b.rotation.z = Math.PI / 2; return b; };
  // helideck with an "H"
  const hTex = textTex('H', '#3b4349', '#ffffff', 64);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(0.075, 28), new THREE.MeshStandardMaterial({ map: hTex, roughness: 0.8 }));
  pad.rotation.x = -Math.PI / 2;
  pad.rotation.z = Math.PI / 2;
  pad.position.set(-0.36, deckAt(-0.36) + 0.004, 0);
  const flag = box(0.002, 0.03, 0.04, m.main, -0.44, d0 + 0.09, 0);
  const flagPole = cyl(0.003, 0.003, 0.1, m.ink, -0.44, d0 + 0.05, -0.02, 6);
  return [
    hull, deck, ...rails, hullNoL, hullNoR,
    bridge, bridgeTop, windows, hangar, funnel, funnelTop,
    mast, yard1, yard2, radar, radarBar,
    turret, barrel, ...vls, ciws, boat(0.085), boat(-0.085),
    pad, flag, flagPole,
  ];
};

/** motocross bike: knobby tyres, high mudguards, long seat, number plates */
const motocross: B = (m) => {
  const chrome = chromeMat();
  const num = textTex('7', '#ffffff', '#1d1d1d');
  const wheelAt = (x: number, r: number) => {
    const g = new THREE.Group();
    g.add(mesh(new THREE.TorusGeometry(r - 0.025, 0.028, 10, 30), m.ink));
    g.add(mesh(new THREE.TorusGeometry(r - 0.055, 0.007, 6, 24), chrome));
    for (let k = 0; k < 18; k++) { // knobs
      const a = (k / 18) * Math.PI * 2;
      const kb = box(0.03, 0.02, 0.07, m.ink, Math.cos(a) * r, Math.sin(a) * r, 0);
      kb.rotation.z = a;
      g.add(kb);
    }
    for (let k = 0; k < 6; k++) { const sp = box(0.005, (r - 0.055) * 2, 0.005, chrome); sp.rotation.z = (k / 6) * Math.PI; g.add(sp); }
    g.add(cyl(0.02, 0.02, 0.06, chrome, 0, 0, 0, 10).rotateX(Math.PI / 2));
    g.position.set(x, r, 0);
    return g;
  };
  const fork = (z: number) => { const f = cyl(0.012, 0.012, 0.42, chrome, 0.24, 0.33, z, 8); f.rotation.z = 0.35; return f; };
  const frontGuard = box(0.2, 0.015, 0.06, m.main, 0.31, 0.3, 0);
  frontGuard.rotation.z = -0.25;
  const rearGuard = box(0.24, 0.015, 0.07, m.main, -0.3, 0.37, 0);
  rearGuard.rotation.z = 0.35;
  const seat = box(0.3, 0.035, 0.08, m.ink, -0.1, 0.39, 0);
  seat.rotation.z = 0.08;
  const swing = box(0.26, 0.02, 0.03, m.ink, -0.14, 0.17, 0);
  swing.rotation.z = 0.12;
  const exhaust = cyl(0.018, 0.018, 0.22, chrome, -0.2, 0.3, 0.06, 10);
  exhaust.rotation.z = Math.PI / 2 + 0.3;
  const bar = cyl(0.01, 0.01, 0.22, m.ink, 0.19, 0.55, 0, 8);
  bar.rotation.x = Math.PI / 2;
  return [
    wheelAt(0.3, 0.14), wheelAt(-0.28, 0.13),
    fork(0.045), fork(-0.045), frontGuard, rearGuard,
    box(0.2, 0.1, 0.11, m.main, 0.04, 0.37, 0),                 // tank
    box(0.12, 0.12, 0.1, m.dark, -0.01, 0.22, 0),               // engine
    seat, swing, exhaust, bar,
    box(0.012, 0.09, 0.09, m.white, 0.215, 0.47, 0),            // front number plate
    decalCircle(num, 0.035, 0.222, 0.47, 0, Math.PI / 2),
    box(0.12, 0.08, 0.005, m.white, -0.2, 0.32, 0.045), box(0.12, 0.08, 0.005, m.white, -0.2, 0.32, -0.045),
    decalCircle(num, 0.03, -0.2, 0.32, 0.049, 0), decalCircle(num, 0.03, -0.2, 0.32, -0.049, Math.PI),
  ];
};

/** clothes iron */
const iron: B = (m) => {
  const chrome = chromeMat();
  const outline: [number, number][] = [[-0.3, -0.15], [0.05, -0.15], [0.3, -0.07], [0.4, 0], [0.3, 0.07], [0.05, 0.15], [-0.3, 0.15]];
  const handle = mesh(new THREE.TorusGeometry(0.16, 0.025, 10, 24, Math.PI), m.ink, -0.02, 0.2, 0);
  const dial = cyl(0.035, 0.035, 0.03, m.white, -0.2, 0.2, 0, 16);
  return [
    slab(outline, 0.05, chrome, 0),
    slab(scalePts(outline, 0.9), 0.14, m.main, 0.05),
    handle,
    cyl(0.018, 0.018, 0.1, m.ink, 0.13, 0.24, 0, 8), cyl(0.018, 0.018, 0.1, m.ink, -0.17, 0.24, 0, 8),
    dial,
  ];
};

/** leather lace-up boot: real boot silhouette (heel, instep, toe), sole with heel, criss-cross laces, padded collar, pull tab */
const boot: B = (m) => {
  const sh = new THREE.Shape();
  sh.moveTo(-0.2, 0.05);
  sh.lineTo(0.24, 0.05);
  sh.quadraticCurveTo(0.34, 0.05, 0.34, 0.11);                  // toe tip
  sh.quadraticCurveTo(0.33, 0.17, 0.22, 0.18);                  // toe top
  sh.quadraticCurveTo(0.1, 0.19, 0.05, 0.27);                   // instep
  sh.lineTo(0.02, 0.5);                                          // front of the shaft
  sh.quadraticCurveTo(-0.08, 0.53, -0.19, 0.5);                  // top edge
  sh.lineTo(-0.2, 0.26);                                         // back of the shaft
  sh.quadraticCurveTo(-0.24, 0.13, -0.2, 0.05);                  // heel curve
  const W = 0.2, bev = 0.035;
  const upperGeo = new THREE.ExtrudeGeometry(sh, { depth: W - 2 * bev, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 6, curveSegments: 16 });
  upperGeo.translate(0, 0, -(W - 2 * bev) / 2);
  const upper = mesh(upperGeo, m.main);
  // sole and heel follow the footprint
  const sole = mesh(new RoundedBoxGeometry(0.6, 0.035, W + 0.03, 4, 0.016), m.ink, 0.07, 0.035, 0);
  const heel = mesh(new RoundedBoxGeometry(0.13, 0.05, W + 0.02, 4, 0.016), m.ink, -0.165, 0.012, 0);
  // padded collar sitting on the top edge, dark opening inside it
  const collar = mesh(new THREE.TorusGeometry(0.092, 0.017, 10, 36), m.dark, -0.085, 0.522, 0);
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1.2, 1, 1);
  const hole = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 1 });
  const opening = mesh(new THREE.CircleGeometry(0.09, 28), hole, -0.085, 0.527, 0);
  opening.rotation.x = -Math.PI / 2;
  opening.scale.set(1.2, 0.9, 1);
  // toe cap: a darker overlay following the toe
  const capShape = new THREE.Shape();
  capShape.moveTo(0.2, 0.05); capShape.lineTo(0.24, 0.05);
  capShape.quadraticCurveTo(0.34, 0.05, 0.34, 0.11);
  capShape.quadraticCurveTo(0.33, 0.17, 0.22, 0.18);
  capShape.quadraticCurveTo(0.19, 0.12, 0.2, 0.05);
  const capGeo = new THREE.ExtrudeGeometry(capShape, { depth: W - 2 * bev + 0.004, bevelEnabled: true, bevelSize: bev + 0.002, bevelThickness: bev + 0.002, bevelSegments: 6, curveSegments: 12 });
  capGeo.translate(0, 0, -(W - 2 * bev + 0.004) / 2);
  const toeCap = mesh(capGeo, m.dark);
  const tab = profileSolid([[-0.235, 0.44], [-0.215, 0.44], [-0.215, 0.58], [-0.235, 0.58]], 0.05, m.dark, 0.006);
  // laces criss-crossing up the front, with eyelets
  const parts: THREE.Object3D[] = [upper, sole, heel, toeCap, collar, opening, tab];
  const frontAt = (t: number) => new THREE.Vector3(0.07 - t * 0.045 + bev * 0.6, 0.27 + t * 0.21, 0);
  const n = 5;
  for (let k = 0; k < n; k++) {
    const a = frontAt(k / n), b = frontAt((k + 1) / n);
    for (const z of [0.05, -0.05]) parts.push(sphere(0.011, m.gold, a.x + 0.004, a.y, z));
    const cross = (za: number, zb: number) => {
      const c = new THREE.CatmullRomCurve3([new THREE.Vector3(a.x + 0.01, a.y, za), new THREE.Vector3((a.x + b.x) / 2 + 0.018, (a.y + b.y) / 2, 0), new THREE.Vector3(b.x + 0.01, b.y, zb)]);
      return mesh(new THREE.TubeGeometry(c, 8, 0.006, 5, false), m.white);
    };
    parts.push(cross(0.05, -0.05), cross(-0.05, 0.05));
  }
  const bow = mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 16), m.white, frontAt(1).x + 0.02, frontAt(1).y + 0.01, 0);
  bow.rotation.y = Math.PI / 2;
  parts.push(bow);
  return parts;
};

/** rubber duck */
const duck: B = (m) => {
  const beak = sphere(0.06, new THREE.MeshStandardMaterial({ color: '#f47b20', roughness: 0.4 }), 0.33, 0.43, 0, 1.3, 0.45, 0.9);
  const tail = cone(0.06, 0.14, m.main, -0.26, 0.28, 0, 12);
  tail.rotation.z = 0.9;
  return [
    sphere(0.22, m.main, 0, 0.19, 0, 1.3, 0.85, 1),
    sphere(0.15, m.main, 0.17, 0.45, 0),
    beak,
    sphere(0.025, m.ink, 0.28, 0.5, 0.075), sphere(0.025, m.ink, 0.28, 0.5, -0.075),
    sphere(0.1, m.dark, -0.02, 0.23, 0.2, 1.4, 0.7, 0.4), sphere(0.1, m.dark, -0.02, 0.23, -0.2, 1.4, 0.7, 0.4),
    tail,
  ];
};

/** sewing thimble: metal, rolled rim, sides and top covered in real dimples (bump map) */
let dimpleTex: THREE.CanvasTexture | null = null;
function dimples() {
  if (dimpleTex) return dimpleTex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      const cx = col * 16 + (row % 2 ? 8 : 0) + 8, cy = row * 16 + 8;
      const g = x.createRadialGradient?.(cx, cy, 0, cx, cy, 6);
      if (g) { g.addColorStop(0, '#202020'); g.addColorStop(1, '#ffffff'); x.fillStyle = g; }
      x.beginPath(); x.arc(cx, cy, 6, 0, Math.PI * 2); x.fill?.();
    }
  }
  dimpleTex = new THREE.CanvasTexture(c);
  dimpleTex.wrapS = dimpleTex.wrapT = THREE.RepeatWrapping;
  dimpleTex.repeat.set(3, 1.6);
  return dimpleTex;
}
const thimble: B = (m) => {
  const metal = new THREE.MeshPhysicalMaterial({
    color: (m.main as THREE.MeshPhysicalMaterial).color, roughness: 0.3, metalness: 0.75, clearcoat: 0.6,
    bumpMap: dimples(), bumpScale: 3,
  });
  // body from the band up to the dome (dimpled), as one smooth lathe
  const prof: [number, number][] = [[0.172, 0.08], [0.168, 0.2], [0.162, 0.3], [0.155, 0.36]];
  for (let k = 1; k <= 10; k++) { const a = (k / 10) * (Math.PI / 2); prof.push([0.155 * Math.cos(a), 0.36 + 0.1 * Math.sin(a)]); }
  const body = mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 64), metal);
  // smooth band and rolled rim at the bottom
  const band = cyl(0.176, 0.182, 0.08, m.main, 0, 0.04, 0, 64);
  const rim = mesh(new THREE.TorusGeometry(0.182, 0.016, 12, 64), m.main, 0, 0.012, 0).rotateX(Math.PI / 2);
  const lip = mesh(new THREE.TorusGeometry(0.172, 0.008, 8, 64), m.gold, 0, 0.082, 0).rotateX(Math.PI / 2);
  const deco = mesh(new THREE.TorusGeometry(0.179, 0.005, 6, 64), m.gold, 0, 0.045, 0).rotateX(Math.PI / 2);
  return [body, band, rim, lip, deco];
};

/** builder's wheelbarrow: tray on a front wheel, two handles and two legs at the back */
const wheelbarrow: B = (m) => {
  const wood = woodMat();
  const tray = new THREE.Group();
  const side = (z: number) => { const b = box(0.4, 0.13, 0.018, m.main, 0, 0.065, z); b.rotation.x = z > 0 ? -0.35 : 0.35; return b; };
  const front = box(0.018, 0.14, 0.3, m.main, 0.2, 0.07, 0);
  front.rotation.z = -0.55;
  const back = box(0.018, 0.13, 0.28, m.main, -0.2, 0.065, 0);
  back.rotation.z = 0.25;
  tray.add(box(0.36, 0.018, 0.2, m.main, 0, 0.009, 0), side(0.115), side(-0.115), front, back);
  tray.position.set(0.02, 0.2, 0);
  const wheelG = new THREE.Group();
  wheelG.add(mesh(new THREE.TorusGeometry(0.075, 0.028, 10, 24), m.ink));
  wheelG.add(cyl(0.028, 0.028, 0.07, m.white, 0, 0, 0, 12).rotateX(Math.PI / 2));
  wheelG.position.set(0.3, 0.1, 0);
  const handle = (z: number) => { const h = cyl(0.013, 0.013, 0.72, wood, -0.03, 0.2, z, 8); h.rotation.z = Math.PI / 2 + 0.22; return h; };
  const strut = (z: number) => { const st = box(0.16, 0.015, 0.015, m.ink, 0.24, 0.15, z); st.rotation.z = -0.55; return st; };
  const leg = (z: number) => box(0.02, 0.18, 0.02, m.ink, -0.14, 0.09, z);
  return [tray, handle(0.1), handle(-0.1), strut(0.035), strut(-0.035), leg(0.1), leg(-0.1), wheelG];
};

/** equestrian statue: rearing horse with a rider (crested helmet, cape, raised sword), on a plinth */
function limb(a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number, mat: Mat) {
  const len = a.distanceTo(b);
  const c = mesh(new THREE.CylinderGeometry(r2, r1, len, 14), mat);
  c.position.copy(a).add(b).multiplyScalar(0.5);
  c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return c;
}
const horse: B = (m) => {
  const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
  const P = 0.09; // top of the plinth
  const neck = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.14, P + 0.44), V(0.22, P + 0.58), V(0.29, P + 0.69)]), 16, 0.07, 16, false), m.main);
  const mane = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.1, P + 0.5), V(0.18, P + 0.65), V(0.25, P + 0.76)]), 16, 0.032, 8, false), m.dark);
  mane.scale.z = 1.4;
  const head = sphere(0.072, m.main, 0.35, P + 0.7, 0, 1.9, 0.9, 0.85);
  head.rotation.z = -0.6;
  const tail = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-0.3, P + 0.44), V(-0.38, P + 0.36), V(-0.39, P + 0.18)]), 12, 0.034, 8, false), m.dark);
  const leg = (hip: THREE.Vector3, knee: THREE.Vector3, hoof: THREE.Vector3) => [
    limb(hip, knee, 0.042, 0.032, m.main), sphere(0.033, m.main, knee.x, knee.y, knee.z),
    limb(knee, hoof, 0.03, 0.03, m.main), sphere(0.034, m.dark, hoof.x, hoof.y + 0.01, hoof.z),
  ];
  const horseParts = [
    sphere(0.19, m.main, -0.04, P + 0.42, 0, 1.55, 0.75, 0.72),
    neck, mane, head, tail,
    sphere(0.048, m.dark, 0.45, P + 0.65, 0, 1.1, 0.8, 0.85),
    cone(0.026, 0.07, m.main, 0.31, P + 0.8, 0.045, 10), cone(0.026, 0.07, m.main, 0.31, P + 0.8, -0.045, 10),
    ...leg(V(-0.22, P + 0.34, 0.075), V(-0.24, P + 0.17, 0.075), V(-0.22, P + 0.0, 0.075)),     // hind legs
    ...leg(V(-0.22, P + 0.34, -0.075), V(-0.2, P + 0.17, -0.075), V(-0.2, P + 0.0, -0.075)),
    ...leg(V(0.17, P + 0.34, -0.075), V(0.18, P + 0.17, -0.075), V(0.18, P + 0.0, -0.075)),     // front leg on the ground
    ...leg(V(0.17, P + 0.34, 0.075), V(0.28, P + 0.25, 0.075), V(0.23, P + 0.13, 0.075)),      // front leg raised
  ];
  // rider sitting upright in the saddle
  const S = V(-0.03, P + 0.55);
  const rider: THREE.Object3D[] = [
    sphere(0.1, m.ink, S.x, S.y - 0.005, 0, 1.2, 0.2, 1.05),                                        // saddle cloth
    mesh(new THREE.CapsuleGeometry(0.052, 0.13, 6, 14), m.main, S.x, S.y + 0.12, 0),                 // body
    sphere(0.046, m.main, S.x + 0.01, S.y + 0.27, 0),                                                // head
    mesh(new THREE.SphereGeometry(0.051, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.dark, S.x + 0.01, S.y + 0.275, 0), // helmet
    box(0.11, 0.04, 0.012, m.dark, S.x, S.y + 0.335, 0),                                              // crest
    ...[0.1, -0.1].flatMap((z) => {                                                                     // legs down the horse's sides
      const hip = V(S.x, S.y + 0.03, z * 0.5), knee = V(S.x + 0.08, S.y - 0.06, z * 1.25), foot = V(S.x + 0.06, S.y - 0.19, z * 1.25);
      return [limb(hip, knee, 0.026, 0.023, m.main), limb(knee, foot, 0.022, 0.02, m.main), sphere(0.024, m.ink, foot.x + 0.01, foot.y, foot.z)];
    }),
    limb(V(S.x, S.y + 0.19, 0.058), V(S.x + 0.04, S.y + 0.33, 0.09), 0.021, 0.018, m.main),          // raised arm
    limb(V(S.x + 0.04, S.y + 0.33, 0.09), V(S.x + 0.1, S.y + 0.5, 0.09), 0.007, 0.004, m.gold),       // sword
    limb(V(S.x, S.y + 0.19, -0.058), V(S.x + 0.11, S.y + 0.12, -0.04), 0.021, 0.018, m.main),        // arm holding the reins
  ];
  const cape = mesh(new THREE.CylinderGeometry(0.062, 0.11, 0.22, 16, 1, true, Math.PI * 0.55, Math.PI * 0.9), m.dark, S.x - 0.02, S.y + 0.11, 0);
  (cape.material as THREE.Material).side = THREE.DoubleSide;
  return [
    mesh(new RoundedBoxGeometry(0.66, 0.07, 0.3, 4, 0.02), m.ink, 0, 0.035, 0),      // plinth
    mesh(new RoundedBoxGeometry(0.6, 0.03, 0.26, 3, 0.01), m.dark, 0, 0.083, 0),
    ...horseParts, ...rider, cape,
  ];
};

/** sack of money/** sack of money: sits flat on the floor, cloth folds, tied neck with a frilled top, € on the front */
const moneySack: B = (m) => {
  const euro = textTex('€', null, '#ffffff', 64);
  const prof: [number, number][] = [
    [0, 0], [0.19, 0], [0.25, 0.02], [0.28, 0.08], [0.28, 0.17], [0.25, 0.27], [0.19, 0.36], [0.11, 0.44], [0.075, 0.48],
    [0.09, 0.52], [0.14, 0.58], [0.16, 0.62], [0.12, 0.63], [0.05, 0.6], [0, 0.59],
  ];
  const geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48, 0, Math.PI * 2);
  // cloth: gentle folds on the body, a wavy frill on top
  const pos = geo.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    const k = v.y > 0.49 ? 1 + 0.16 * Math.sin(9 * a) : v.y > 0.05 ? 1 + 0.035 * Math.sin(5 * a + v.y * 9) : 1;
    pos.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  geo.computeVertexNormals();
  const sack = mesh(geo, m.main);
  (m.main as THREE.Material).side = THREE.DoubleSide;
  const rope = mesh(new THREE.TorusGeometry(0.085, 0.017, 8, 28), m.gold, 0, 0.475, 0).rotateX(Math.PI / 2);
  const knotEnd = limb(new THREE.Vector3(0.085, 0.47, 0), new THREE.Vector3(0.14, 0.38, 0.03), 0.012, 0.01, m.gold);
  return [
    sack, rope, knotEnd,
    decalCircle(euro, 0.11, 0.286, 0.16, 0, Math.PI / 2),
    decalCircle(euro, 0.09, -0.286, 0.16, 0, -Math.PI / 2),
  ];
};

/** cannon on a wooden carriage */
const cannon: B = (m) => {
  const wood = woodMat();
  const profile = [[0, -0.3], [0.09, -0.3], [0.1, -0.26], [0.085, -0.22], [0.08, 0.2], [0.095, 0.22], [0.095, 0.27], [0.06, 0.27], [0.06, 0.2], [0, 0.2]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const barrel = mesh(new THREE.LatheGeometry(profile, 24), m.main);
  const knob = sphere(0.045, m.main, 0, -0.33, 0);
  const bore = mesh(new THREE.CircleGeometry(0.055, 20), m.ink, 0, 0.271, 0);
  bore.rotation.x = -Math.PI / 2;
  const gun = new THREE.Group();
  gun.add(barrel, knob, bore);
  gun.rotation.z = -Math.PI / 2 + 0.25; // point forward and a bit up
  gun.position.set(0.02, 0.28, 0);
  const wheelAt = (z: number) => {
    const g = new THREE.Group();
    g.add(mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 24), wood));
    for (let k = 0; k < 6; k++) { const sp = box(0.012, 0.22, 0.012, wood); sp.rotation.z = (k / 6) * Math.PI; g.add(sp); }
    g.add(cyl(0.03, 0.03, 0.05, m.ink, 0, 0, 0, 12).rotateX(Math.PI / 2));
    g.position.set(0.02, 0.14, z);
    return g;
  };
  const trail = box(0.36, 0.05, 0.08, wood, -0.2, 0.08, 0);
  trail.rotation.z = 0.35;
  return [
    box(0.3, 0.1, 0.03, wood, 0, 0.2, 0.09), box(0.3, 0.1, 0.03, wood, 0, 0.2, -0.09), // carriage cheeks
    trail, gun, wheelAt(0.15), wheelAt(-0.15),
    cyl(0.012, 0.012, 0.34, m.ink, 0.02, 0.14, 0, 6).rotateX(Math.PI / 2),
  ];
};

const EXTRA: Record<string, B> = {
  '🚢': frigate, '⛵': frigate,         // ⛵ kept for older saved games
  '🏍️': motocross, '🛵': motocross,
  iron, boot, duck, thimble, barrow: wheelbarrow, horse, sack: moneySack, cannon,
};

/** horse body shared by the horse and the unicorn: slim legs with knees and hooves, arched neck, mane, tail */
function horseParts(m: ReturnType<typeof mats>, unicorn: boolean): THREE.Object3D[] {
  const hair = unicorn ? m.white : m.ink;
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.14, 0.44, 0), new THREE.Vector3(0.22, 0.58, 0), new THREE.Vector3(0.3, 0.7, 0),
  ]);
  const neck = mesh(new THREE.TubeGeometry(neckCurve, 16, 0.075, 16, false), m.main);
  const maneCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.1, 0.5, 0), new THREE.Vector3(0.18, 0.66, 0), new THREE.Vector3(0.27, 0.78, 0),
  ]);
  const mane = mesh(new THREE.TubeGeometry(maneCurve, 16, 0.035, 8, false), hair);
  mane.scale.set(1, 1, 1.4);
  const head = sphere(0.075, m.main, 0.36, 0.72, 0, 1.9, 0.9, 0.85);
  head.rotation.z = -0.55;
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.3, 0.44, 0), new THREE.Vector3(-0.38, 0.38, 0), new THREE.Vector3(-0.4, 0.22, 0),
  ]);
  const tail = mesh(new THREE.TubeGeometry(tailCurve, 12, 0.035, 8, false), hair);
  const leg = (x: number, z: number) => [
    cyl(0.04, 0.03, 0.17, m.main, x, 0.27, z, 16),     // upper leg
    sphere(0.034, m.main, x, 0.18, z),                  // knee
    cyl(0.028, 0.03, 0.15, m.main, x, 0.1, z, 16),      // lower leg
    cyl(0.036, 0.04, 0.035, m.ink, x, 0.018, z, 16),    // hoof
  ];
  const parts: THREE.Object3D[] = [
    sphere(0.19, m.main, -0.04, 0.42, 0, 1.55, 0.75, 0.72),
    neck, mane, head, tail,
    sphere(0.05, m.dark, 0.46, 0.66, 0, 1.1, 0.8, 0.85),                         // muzzle
    cone(0.028, 0.075, m.main, 0.32, 0.83, 0.045, 12), cone(0.028, 0.075, m.main, 0.32, 0.83, -0.045, 12),
    sphere(0.018, m.ink, 0.4, 0.75, 0.055), sphere(0.018, m.ink, 0.4, 0.75, -0.055),
    ...leg(0.17, 0.075), ...leg(0.17, -0.075), ...leg(-0.23, 0.075), ...leg(-0.23, -0.075),
  ];
  if (unicorn) {
    const horn = cone(0.028, 0.2, m.gold, 0.39, 0.88, 0, 16);
    horn.rotation.z = -0.35;
    parts.push(horn);
  } else {
    parts.push(sphere(0.1, m.ink, -0.05, 0.55, 0, 1.25, 0.2, 1.05));            // saddle
    parts.push(box(0.01, 0.1, 0.01, m.ink, -0.05, 0.47, 0.13), box(0.01, 0.1, 0.01, m.ink, -0.05, 0.47, -0.13));
    parts.push(box(0.04, 0.012, 0.03, m.gold, -0.05, 0.42, 0.13), box(0.04, 0.012, 0.03, m.gold, -0.05, 0.42, -0.13)); // stirrups
  }
  return parts;
}

/** simple pawn when the piece is unknown */
function pawn(m: ReturnType<typeof mats>) {
  const profile = [[0, 0], [0.3, 0], [0.3, 0.06], [0.22, 0.1], [0.12, 0.22], [0.09, 0.5], [0.16, 0.56], [0.1, 0.6], [0, 0.6]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  return [mesh(new THREE.LatheGeometry(profile, 24), m.main), sphere(0.15, m.main, 0, 0.72, 0)];
}

/** pieces that roll smoothly instead of hopping */
export const GLIDERS = new Set(['🚗', '🚢', '⛵', '🏍️', '🛵', 'barrow']);

export const PIECE_HEIGHT: Record<string, number> = { '🎸': 1.05, '🚀': 0.95, '🌵': 0.95, '🚢': 0.65, '⛵': 0.65, horse: 1.1 };

export function buildPiece(emoji: string, color: string): THREE.Group {
  const m = mats(color);
  const g = new THREE.Group();
  const parts = (builders[emoji] ?? EXTRA[emoji] ?? pawn)(m);
  parts.forEach((p) => {
    p.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
    g.add(p);
  });
  return g;
}


export { PIECES, PIECE_TEXT, pieceText } from './piece-list';

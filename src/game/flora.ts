import * as THREE from 'three';
import { getNightMap, getSurfaceHeight } from '../sim/maps.js';
import type { LanternState } from '../sim/types.js';

export type FlowerSpecies = 'rose' | 'lily' | 'tulip';

interface ReactiveFlower {
  lanternId: string;
  species: FlowerSpecies;
  stemPivot: THREE.Group;
  petals: THREE.Mesh[];
  baseAngles: number[];
  petalMat: THREE.MeshLambertMaterial;
  currentBloom: number;
  phase: number;
}

export class IslandFlora {
  readonly group = new THREE.Group();
  private flowers: ReactiveFlower[] = [];

  clear(): void {
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    this.flowers = [];
  }

  buildForNight(night: number): void {
    this.clear();
    const map = getNightMap(night);

    // 1. Instanced grass tufts across solid ground
    const grassCount = night === 2 ? 150 : 180;
    const grassGeo = new THREE.ConeGeometry(0.14, 0.55, 4);
    grassGeo.translate(0, 0.27, 0);
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x3b7a62 });
    const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
    const dummy = new THREE.Object3D();

    let placed = 0;
    for (let i = 0; i < grassCount * 3 && placed < grassCount; i++) {
      const a = ((i * 137.508) % 360) * (Math.PI / 180);
      const frac = ((i * 31) % 97) / 97;
      let gx = 0;
      let gz = 0;
      if (night === 2) {
        const onB = i % 2 === 1;
        const r = 4 + Math.sqrt(frac) * 22;
        gx = (onB ? 70 : 0) + Math.cos(a) * r;
        gz = Math.sin(a) * r;
      } else {
        const maxR = night === 1 ? 37 : 42;
        const r = 4 + Math.sqrt(frac) * (maxR - 4);
        gx = Math.cos(a) * r;
        gz = Math.sin(a) * r;
      }
      const gy = getSurfaceHeight(night, gx, gz);
      if (gy === null) continue;
      if (night === 3 && Math.hypot(gx, gz) < 3.5) continue;

      dummy.position.set(gx, gy, gz);
      dummy.rotation.set(0, a, ((i % 5) - 2) * 0.06);
      const sc = 0.75 + (i % 4) * 0.2;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      grassInst.setMatrixAt(placed++, dummy.matrix);
    }
    grassInst.count = placed;
    grassInst.instanceMatrix.needsUpdate = true;
    this.group.add(grassInst);

    // 2. Stylized bushes & perimeter trees (clear of lanterns, bridge, ramps)
    const bushGeo = new THREE.DodecahedronGeometry(0.85, 0);
    const bushMat = new THREE.MeshLambertMaterial({ color: 0x265c4b });
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.8, 7);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
    const canopyGeo = new THREE.ConeGeometry(1.6, 2.8, 7);
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x2d6b56 });

    const propCount = night === 1 ? 14 : night === 2 ? 12 : 14;
    for (let i = 0; i < propCount; i++) {
      const ang = (i / propCount) * Math.PI * 2 + 0.18;
      let px = 0;
      let pz = 0;
      if (night === 2) {
        const onB = i % 2 === 1;
        px = (onB ? 70 : 0) + Math.cos(ang) * 23;
        pz = Math.sin(ang) * 23;
        if (Math.abs(pz) < 4 && px > 20 && px < 50) continue;
      } else {
        const r = night === 1 ? 34.5 : 39.5;
        px = Math.cos(ang) * r;
        pz = Math.sin(ang) * r;
      }
      const py = getSurfaceHeight(night, px, pz);
      if (py === null) continue;
      if (map.lanterns.some((l) => Math.hypot(l.pos[0] - px, l.pos[2] - pz) < 4.5)) continue;

      if (i % 2 === 0) {
        const bush = new THREE.Mesh(bushGeo, bushMat);
        bush.position.set(px, py + 0.55, pz);
        bush.scale.set(1.2, 0.85, 1.1);
        this.group.add(bush);
      } else {
        const tree = new THREE.Group();
        tree.position.set(px, py, pz);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.4;
        const c1 = new THREE.Mesh(canopyGeo, canopyMat);
        c1.position.y = 3.2;
        const c2 = new THREE.Mesh(canopyGeo, canopyMat);
        c2.position.y = 4.4;
        c2.scale.setScalar(0.72);
        tree.add(trunk, c1, c2);
        this.group.add(tree);
      }
    }

    // 3. Reactive Flower Gardens around EVERY Big Lantern: Rose (Hoa Hồng), Lily (Hoa Ly), Tulip (Hoa Tulip)
    const speciesOrder: FlowerSpecies[] = ['rose', 'lily', 'tulip'];
    for (const l of map.lanterns) {
      const flowerCount = 6;
      for (let k = 0; k < flowerCount; k++) {
        const species = speciesOrder[k % 3];
        const ang = (k / flowerCount) * Math.PI * 2 + 0.25;
        const rad = 1.45 + (k % 2) * 0.45;
        const fx = l.pos[0] + Math.cos(ang) * rad;
        const fz = l.pos[2] + Math.sin(ang) * rad;
        const fy = l.pos[1];
        this.createFlower(l.id, species, fx, fy, fz, k * 1.1);
      }
    }
  }

  private createFlower(
    lanternId: string,
    species: FlowerSpecies,
    x: number,
    y: number,
    z: number,
    phase: number
  ): void {
    const root = new THREE.Group();
    root.position.set(x, y, z);

    const stemPivot = new THREE.Group();
    root.add(stemPivot);

    const stemHeight = species === 'lily' ? 0.85 : species === 'tulip' ? 0.72 : 0.68;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, stemHeight, 5),
      new THREE.MeshLambertMaterial({ color: 0x2f7d4d })
    );
    stem.position.y = stemHeight * 0.5;
    stemPivot.add(stem);

    const headGroup = new THREE.Group();
    headGroup.position.y = stemHeight;
    stemPivot.add(headGroup);

    const colorHex = species === 'rose' ? 0xe84a6f : species === 'lily' ? 0xfff4d6 : 0xff9f45;
    const emissiveHex = species === 'rose' ? 0x8f1d3b : species === 'lily' ? 0xffe58a : 0xff7b29;
    const petalMat = new THREE.MeshLambertMaterial({
      color: colorHex,
      emissive: emissiveHex,
      emissiveIntensity: 0.05
    });

    // Center stamen
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xf2c14e })
    );
    headGroup.add(core);

    const petalCount = species === 'rose' ? 7 : species === 'lily' ? 6 : 5;
    const petalGeo =
      species === 'rose'
        ? new THREE.SphereGeometry(0.14, 6, 5)
        : species === 'lily'
          ? new THREE.ConeGeometry(0.11, 0.34, 4)
          : new THREE.BoxGeometry(0.14, 0.28, 0.05);
    petalGeo.translate(0, 0.14, 0);

    const petals: THREE.Mesh[] = [];
    const baseAngles: number[] = [];
    for (let i = 0; i < petalCount; i++) {
      const a = (i / petalCount) * Math.PI * 2;
      const p = new THREE.Mesh(petalGeo, petalMat);
      p.rotation.order = 'YXZ';
      p.rotation.y = a;
      p.rotation.x = 0.12; // starts closed
      if (species === 'rose') p.scale.set(1.0, 0.9, 0.5);
      headGroup.add(p);
      petals.push(p);
      baseAngles.push(a);
    }

    this.group.add(root);
    this.flowers.push({
      lanternId,
      species,
      stemPivot,
      petals,
      baseAngles,
      petalMat,
      currentBloom: 0,
      phase
    });
  }

  update(lanterns: LanternState[], elapsedSec: number): void {
    const byId = new Map<string, LanternState>();
    for (const l of lanterns) byId.set(l.id, l);

    for (const f of this.flowers) {
      const l = byId.get(f.lanternId);
      let targetBloom = 0;
      if (l) {
        if (l.lit) {
          const fuelRatio = Math.max(0, Math.min(1, l.fuelUnits / 6000));
          targetBloom = 0.3 + 0.7 * fuelRatio;
        } else {
          const req = l.everLit ? 5 : 10;
          targetBloom = Math.min(0.28, (l.deposited / req) * 0.28);
        }
      }

      // Smooth blooming transition
      f.currentBloom += (targetBloom - f.currentBloom) * 0.06;

      // Stem droops when unlit (bloom=0), stands tall & sways softly when blooming
      const droopAngle = (1 - f.currentBloom) * 0.55;
      const sway = Math.sin(elapsedSec * 2.1 + f.phase) * 0.06;
      f.stemPivot.rotation.x = droopAngle + sway;
      f.stemPivot.rotation.z = Math.cos(elapsedSec * 1.7 + f.phase) * 0.05;

      // Petals open outward proportionally to lantern brightness/fuel
      const maxOpen = f.species === 'lily' ? 1.25 : f.species === 'rose' ? 1.05 : 0.72;
      const openTilt = 0.1 + f.currentBloom * maxOpen;
      for (const p of f.petals) {
        p.rotation.x = openTilt;
      }

      f.petalMat.emissiveIntensity = 0.04 + f.currentBloom * 0.55;
    }
  }
}

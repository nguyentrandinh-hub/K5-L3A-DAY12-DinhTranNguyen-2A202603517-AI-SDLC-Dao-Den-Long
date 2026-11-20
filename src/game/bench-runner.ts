import * as THREE from 'three';
import { DeterministicRNG } from '../sim/prng.js';
import { getNightMap, getSurfaceHeight } from '../sim/maps.js';
import { DT } from '../sim/tuning.js';

export function isBenchMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('bench') === '1';
}

export function runBenchmarkScene(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  buildNight1Base: () => void,
  createLanternsL1ToL3Lit: () => void,
  hideNonBenchUi: () => void
): void {
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed') ?? 42) || 42;
  const durationS = Number(params.get('duration') ?? 30) || 30;
  const startNavMs = performance.now();

  hideNonBenchUi();
  buildNight1Base();
  createLanternsL1ToL3Lit();

  const rng = new DeterministicRNG(seed);
  const map = getNightMap(1);

  // Spawn exact 200 wandering Ink Shades scattered across Night 1 (r <= 38m)
  const SHADE_COUNT = 200;
  const shadeData: Array<{ x: number; z: number; angle: number }> = [];
  for (let i = 0; i < SHADE_COUNT; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * 37 + 1;
    shadeData.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      angle: rng.range(0, Math.PI * 2)
    });
  }

  const shadeGeo = new THREE.SphereGeometry(0.68, 8, 8);
  shadeGeo.scale(1, 1.35, 1);
  const shadeMat = new THREE.MeshLambertMaterial({
    color: 0x120a1a,
    emissive: 0x7a3cff,
    emissiveIntensity: 0.85
  });
  const shadeInst = new THREE.InstancedMesh(shadeGeo, shadeMat, SHADE_COUNT);
  scene.add(shadeInst);

  // Spawn exact 100 motes scattered across Night 1
  const MOTE_COUNT = 100;
  const moteGeo = new THREE.SphereGeometry(0.24, 6, 6);
  const moteMat = new THREE.MeshBasicMaterial({
    color: 0xffe58a
  });
  const moteInst = new THREE.InstancedMesh(moteGeo, moteMat, MOTE_COUNT);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < MOTE_COUNT; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * 37 + 1;
    dummy.position.set(Math.cos(a) * r, 0.75, Math.sin(a) * r);
    dummy.updateMatrix();
    moteInst.setMatrixAt(i, dummy.matrix);
  }
  moteInst.instanceMatrix.needsUpdate = true;
  scene.add(moteInst);

  // Keep shades outside L1-L3 safe_radius (6m)
  const litLanterns = map.lanterns.slice(0, 3);
  const wanderSpeed = 4.0 * 0.4;

  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpuName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'WebGL2';
  const rendererDesc = `Three.js 0.170.0 (${gpuName})`;

  let firstFrameDone = false;
  let loadMs = 0;
  let benchStartTime = 0;
  let lastFrameTime = 0;
  const dts: number[] = [];
  let peakMemMb: number | null = null;
  let posted = false;

  const WARMUP_MS = 3000;
  const MEASURE_MS = durationS * 1000;

  function stepBench(now: number): void {
    if (!firstFrameDone) {
      firstFrameDone = true;
      loadMs = Math.max(1, performance.timeOrigin ? now : now - startNavMs);
      benchStartTime = now;
      lastFrameTime = now;
    }

    const dtMs = now - lastFrameTime;
    lastFrameTime = now;
    const elapsedMs = now - benchStartTime;

    // Update 200 wandering shades
    for (let i = 0; i < SHADE_COUNT; i++) {
      const s = shadeData[i];
      s.angle += 0.015;
      const nx = s.x + Math.cos(s.angle) * wanderSpeed * DT;
      const nz = s.z + Math.sin(s.angle) * wanderSpeed * DT;
      if (getSurfaceHeight(1, nx, nz) !== null) {
        s.x = nx;
        s.z = nz;
      } else {
        s.angle += Math.PI * 0.75;
      }
      for (const l of litLanterns) {
        const dx = s.x - l.pos[0];
        const dz = s.z - l.pos[2];
        const d = Math.hypot(dx, dz);
        if (d < 6.0) {
          const ux = d > 1e-6 ? dx / d : 1;
          const uz = d > 1e-6 ? dz / d : 0;
          s.x = l.pos[0] + ux * 6.01;
          s.z = l.pos[2] + uz * 6.01;
        }
      }
      dummy.position.set(s.x, 1.0, s.z);
      dummy.updateMatrix();
      shadeInst.setMatrixAt(i, dummy.matrix);
    }
    shadeInst.instanceMatrix.needsUpdate = true;

    // Orbit camera: center (0,0,0), r=30m, Y=15m, start angle 0° (30,15,0), CCW from above, 15s/rev
    const tSec = elapsedMs / 1000;
    const theta = (tSec / 15) * Math.PI * 2;
    camera.position.set(Math.cos(theta) * 30, 15, Math.sin(theta) * 30);
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);

    if (elapsedMs >= WARMUP_MS && elapsedMs < WARMUP_MS + MEASURE_MS) {
      if (dtMs > 0) dts.push(dtMs);
      const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      if (perfMem && typeof perfMem.usedJSHeapSize === 'number') {
        const mb = perfMem.usedJSHeapSize / (1024 * 1024);
        if (peakMemMb === null || mb > peakMemMb) peakMemMb = Math.round(mb * 10) / 10;
      }
    }

    if (elapsedMs >= WARMUP_MS + MEASURE_MS) {
      if (!posted) {
        posted = true;
        const N = Math.max(1, dts.length);
        const sumDt = dts.reduce((a, b) => a + b, 0) || 1;
        const avgFps = Math.round(((1000 * N) / sumDt) * 10) / 10;
        const sortedDesc = [...dts].sort((a, b) => b - a);
        const k = Math.max(1, Math.ceil(0.01 * N));
        const topKAvg = sortedDesc.slice(0, k).reduce((a, b) => a + b, 0) / k;
        const p1LowFps = Math.round((1000 / Math.max(0.001, topKAvg)) * 10) / 10;
        const sortedAsc = [...dts].sort((a, b) => a - b);
        const p95Idx = Math.min(N - 1, Math.floor(0.95 * (N - 1)));
        const frameMsP95 = Math.round(sortedAsc[p95Idx] * 10) / 10;

        void fetch('/api/bench-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            avg_fps: avgFps,
            p1_low_fps: p1LowFps,
            frame_ms_p95: frameMsP95,
            frames: N,
            load_ms: Math.round(loadMs),
            peak_mem_mb: peakMemMb,
            renderer: rendererDesc
          })
        });
      }
      return;
    }

    requestAnimationFrame(stepBench);
  }

  requestAnimationFrame(stepBench);
}

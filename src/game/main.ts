import * as THREE from 'three';
import { createDefaultInput, SimulationEngine, xzDistance } from '../sim/engine.js';
import { DEFAULT_TUNING, DT, ISLAND_RADIUS } from '../sim/tuning.js';
import type { EventRecord, InputState } from '../sim/types.js';
import { SoundFX } from './audio.js';

const app = document.getElementById('app')!;
const hudFlames = document.getElementById('hud-flames')!;
const hudCarried = document.getElementById('hud-carried')!;
const hudLanterns = document.getElementById('hud-lanterns')!;
const hudTime = document.getElementById('hud-time')!;
const hudScore = document.getElementById('hud-score')!;
const promptBanner = document.getElementById('prompt-banner')!;
const overlay = document.getElementById('overlay')!;
const overlayTitle = document.getElementById('overlay-title')!;
const overlayDesc = document.getElementById('overlay-desc')!;
const overlayStats = document.getElementById('overlay-stats')!;
const overlayBtn = document.getElementById('overlay-btn')!;

const sound = new SoundFX();

// Three.js Scene setup
const scene = new THREE.Scene();
const darkBg = new THREE.Color(0x0c0920);
const warmBg = new THREE.Color(0x231b38);
scene.background = darkBg.clone();
scene.fog = new THREE.FogExp2(0x0f0b24, 0.022);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 220);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.prepend(renderer.domElement);

// Lighting (warms up dynamically as lanterns are lit)
const hemiLight = new THREE.HemisphereLight(0x6b6bb5, 0x1b1530, 0.55);
scene.add(hemiLight);

const moonLight = new THREE.DirectionalLight(0xaab8ff, 0.65);
moonLight.position.set(25, 45, 20);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024, 1024);
moonLight.shadow.camera.near = 5;
moonLight.shadow.camera.far = 120;
const dCam = 48;
moonLight.shadow.camera.left = -dCam;
moonLight.shadow.camera.right = dCam;
moonLight.shadow.camera.top = dCam;
moonLight.shadow.camera.bottom = -dCam;
scene.add(moonLight);

// Island: Đảo Bến (circular island floating above a sea of clouds)
const islandGeo = new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 3.5, 4, 48);
const islandMat = new THREE.MeshStandardMaterial({ color: 0x26293d, roughness: 0.92 });
const islandMesh = new THREE.Mesh(islandGeo, islandMat);
islandMesh.position.y = -2;
islandMesh.receiveShadow = true;
scene.add(islandMesh);

// Decorative wooden pier & rim posts
const pierMat = new THREE.MeshStandardMaterial({ color: 0x5c3e2b, roughness: 0.85 });
const pier = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 10), pierMat);
pier.position.set(0, -0.1, ISLAND_RADIUS + 3);
pier.receiveShadow = true;
scene.add(pier);

// Sea of clouds below the island
const cloudGroup = new THREE.Group();
const cloudMat = new THREE.MeshStandardMaterial({
  color: 0x2b2548,
  roughness: 1,
  transparent: true,
  opacity: 0.7
});
for (let i = 0; i < 36; i++) {
  const ang = (i / 36) * Math.PI * 2;
  const dist = ISLAND_RADIUS + 10 + (i % 3) * 8;
  const cloud = new THREE.Mesh(new THREE.SphereGeometry(6 + (i % 4) * 2.2, 10, 8), cloudMat);
  cloud.scale.set(1.6, 0.45, 1.3);
  cloud.position.set(Math.cos(ang) * dist, -5.5 - (i % 3) * 1.5, Math.sin(ang) * dist);
  cloudGroup.add(cloud);
}
scene.add(cloudGroup);

// Build Mây (player with conical hat nón lá + hanging mini lantern)
const playerGroup = new THREE.Group();
const cloakMat = new THREE.MeshStandardMaterial({ color: 0x3b6ea5, roughness: 0.7 });
const bodyMesh = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.35, 12), cloakMat);
bodyMesh.position.y = 0.68;
bodyMesh.castShadow = true;
playerGroup.add(bodyMesh);

const headMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.32, 14, 12),
  new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.6 })
);
headMesh.position.y = 1.48;
headMesh.castShadow = true;
playerGroup.add(headMesh);

// Nón lá (Vietnamese conical hat)
const hatMesh = new THREE.Mesh(
  new THREE.ConeGeometry(0.75, 0.45, 18),
  new THREE.MeshStandardMaterial({ color: 0xe2c275, roughness: 0.8 })
);
hatMesh.position.y = 1.82;
hatMesh.castShadow = true;
playerGroup.add(hatMesh);

// Hanging mini lantern on brim of nón lá
const miniLanternPivot = new THREE.Group();
miniLanternPivot.position.set(0, 1.64, 0.68);
const miniLanternMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.16, 10, 10),
  new THREE.MeshStandardMaterial({
    color: 0xffb347,
    emissive: 0xff9922,
    emissiveIntensity: 1.8
  })
);
miniLanternMesh.position.y = -0.18;
miniLanternPivot.add(miniLanternMesh);
const playerLight = new THREE.PointLight(0xffb347, 4, 14);
playerLight.position.y = -0.18;
miniLanternPivot.add(playerLight);
playerGroup.add(miniLanternPivot);
scene.add(playerGroup);

// Pulse shockwave visual ring
const pulseRing = new THREE.Mesh(
  new THREE.RingGeometry(0.4, 0.9, 40),
  new THREE.MeshBasicMaterial({
    color: 0xffcf6e,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0
  })
);
pulseRing.rotation.x = -Math.PI / 2;
pulseRing.position.y = 0.15;
scene.add(pulseRing);
let pulseAnimT = 0;

// Dynamic entity pools
interface LanternVisual {
  group: THREE.Group;
  bulbMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  safeRing: THREE.Mesh;
}
const lanternVisuals = new Map<string, LanternVisual>();
const moteVisuals = new Map<string, THREE.Mesh>();
const shadeVisuals = new Map<string, THREE.Group>();

// Rising celebration embers when a lantern lights up (purely visual)
interface Ember {
  mesh: THREE.Mesh;
  vy: number;
  life: number;
}
const embers: Ember[] = [];
const emberGeo = new THREE.SphereGeometry(0.14, 6, 6);
const emberMat = new THREE.MeshBasicMaterial({ color: 0xffc864 });

function spawnLanternEmbers(x: number, z: number): void {
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(emberGeo, emberMat);
    m.position.set(x + (Math.random() - 0.5) * 1.8, 2.5 + Math.random(), z + (Math.random() - 0.5) * 1.8);
    scene.add(m);
    embers.push({ mesh: m, vy: 2 + Math.random() * 2.5, life: 2.2 });
  }
}

function createLanternVisual(id: string, x: number, z: number): LanternVisual {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.32, 3.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x3b2c26, roughness: 0.9 })
  );
  post.position.y = 1.8;
  post.castShadow = true;
  group.add(post);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 0.7, 6),
    new THREE.MeshStandardMaterial({ color: 0x4c2b24, roughness: 0.8 })
  );
  roof.position.y = 4.25;
  group.add(roof);

  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0x524c63,
    emissive: 0xff9e2c,
    emissiveIntensity: 0
  });
  const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 1.0, 8), bulbMat);
  bulb.position.y = 3.55;
  group.add(bulb);

  const light = new THREE.PointLight(0xffad42, 0, 26);
  light.position.y = 3.55;
  group.add(light);

  // Subtle safe_radius golden ring (visible when lit)
  const safeRing = new THREE.Mesh(
    new THREE.RingGeometry(DEFAULT_TUNING.safe_radius - 0.12, DEFAULT_TUNING.safe_radius, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffc46b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25
    })
  );
  safeRing.rotation.x = -Math.PI / 2;
  safeRing.position.y = 0.06;
  safeRing.visible = false;
  group.add(safeRing);

  scene.add(group);
  const vis: LanternVisual = { group, bulbMat, light, safeRing };
  lanternVisuals.set(id, vis);
  return vis;
}

function createShadeVisual(id: string): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.75, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0x1a0b2e,
      emissive: 0x4b126b,
      emissiveIntensity: 0.8,
      roughness: 0.5
    })
  );
  body.scale.set(1, 1.35, 1);
  body.position.y = 1.0;
  body.castShadow = true;
  group.add(body);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe68aff });
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), eyeMat);
  leftEye.position.set(-0.22, 1.2, 0.62);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.22;
  group.add(leftEye, rightEye);

  scene.add(group);
  shadeVisuals.set(id, group);
  return group;
}

const moteGeo = new THREE.SphereGeometry(0.28, 10, 10);
const moteMat = new THREE.MeshStandardMaterial({
  color: 0xffe484,
  emissive: 0xffae34,
  emissiveIntensity: 2.2
});

// Game state
let engine = new SimulationEngine(Date.now() & 0xffff, 1, DEFAULT_TUNING);
let isStarted = false;
let camYawDeg = 0;
let accumulator = 0;
let lastTime = performance.now();

const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR' && isStarted) {
    restartGame();
  }
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function clearDynamicVisuals(): void {
  for (const v of lanternVisuals.values()) scene.remove(v.group);
  lanternVisuals.clear();
  for (const m of moteVisuals.values()) scene.remove(m);
  moteVisuals.clear();
  for (const s of shadeVisuals.values()) scene.remove(s);
  shadeVisuals.clear();
}

function restartGame(): void {
  sound.unlock();
  clearDynamicVisuals();
  engine = new SimulationEngine((Date.now() & 0xffffff) || 42, 1, DEFAULT_TUNING);
  camYawDeg = 0;
  accumulator = 0;
  isStarted = true;
  overlay.classList.add('hidden');
  syncVisuals(0);
}

overlayBtn.addEventListener('click', () => {
  restartGame();
});

function handleEvents(events: EventRecord[]): void {
  for (const ev of events) {
    switch (ev.name) {
      case 'mote_picked':
        sound.playPickup();
        break;
      case 'deposit':
        sound.playDeposit();
        break;
      case 'lantern_lit': {
        sound.playLanternLit();
        const l = engine.lanterns.find((x) => x.id === ev.data.lantern_id);
        if (l) spawnLanternEmbers(l.x, l.z);
        break;
      }
      case 'pulse':
        sound.playPulse();
        pulseAnimT = 1.0;
        pulseRing.position.set(engine.player.x, 0.15, engine.player.z);
        break;
      case 'player_hit':
        sound.playHit();
        break;
      case 'game_over': {
        isStarted = false;
        overlay.classList.remove('hidden');
        overlayStats.style.display = 'block';
        const won = ev.data.result === 'won';
        if (won) sound.playWin();
        overlayTitle.textContent = won ? 'Đảo Đèn Lồng Đã Sáng!' : 'Màn Sương Đã Thắng...';
        overlayDesc.textContent = won
          ? 'Mây đã thắp sáng cả 5 Đèn Lồng Lớn, xua tan sương đen trên Đảo Bến!'
          : ev.data.reason === 'dawn'
            ? 'Bình minh đã tới trước khi mọi ngọn đèn được thắp sáng.'
            : 'Mây đã mất hết ngọn lửa trước Bóng Mực. Hãy thử lại nhé!';
        overlayStats.textContent = `Điểm cuối: ${engine.score} · Đèn đã thắp: ${engine.lanterns.filter((l) => l.lit).length}/5 · Thời gian còn: ${Math.ceil(engine.timeLeftS)}s`;
        overlayBtn.textContent = 'Chơi lại Đêm 1';
        break;
      }
    }
  }
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function syncVisuals(elapsedSec: number): void {
  // Player
  playerGroup.position.set(engine.player.x, engine.player.y, engine.player.z);
  miniLanternPivot.rotation.z = Math.sin(elapsedSec * 5) * 0.18;
  playerLight.intensity = 3.2 + engine.player.carried * 0.6;

  // Lanterns
  let litCount = 0;
  let nearUnlit = false;
  for (const l of engine.lanterns) {
    if (l.lit) litCount++;
    else if (
      engine.player.carried > 0 &&
      xzDistance(engine.player.x, engine.player.z, l.x, l.z) <= DEFAULT_TUNING.interact_radius
    ) {
      nearUnlit = true;
    }

    let vis = lanternVisuals.get(l.id);
    if (!vis) {
      vis = createLanternVisual(l.id, l.x, l.z);
    }
    vis.group.position.set(l.x, l.y, l.z);
    const ratio = Math.min(1, l.deposited / DEFAULT_TUNING.lantern_cost);
    vis.bulbMat.emissiveIntensity = l.lit ? 2.4 : ratio * 0.9;
    vis.light.intensity = l.lit ? 14 : ratio * 3;
    vis.safeRing.visible = l.lit;
  }

  // Island brightens progressively with lit lanterns
  const progress = litCount / DEFAULT_TUNING.lantern_count_night1;
  scene.background = darkBg.clone().lerp(warmBg, progress);
  if (scene.fog instanceof THREE.FogExp2) {
    scene.fog.density = 0.022 - progress * 0.011;
  }
  hemiLight.intensity = 0.55 + progress * 0.65;

  // Motes
  const activeMoteIds = new Set(engine.motes.map((m) => m.id));
  for (const [id, mesh] of moteVisuals.entries()) {
    if (!activeMoteIds.has(id)) {
      scene.remove(mesh);
      moteVisuals.delete(id);
    }
  }
  for (const m of engine.motes) {
    let mesh = moteVisuals.get(m.id);
    if (!mesh) {
      mesh = new THREE.Mesh(moteGeo, moteMat);
      scene.add(mesh);
      moteVisuals.set(m.id, mesh);
    }
    const bob = 0.75 + Math.sin(elapsedSec * 3.5 + m.x) * 0.22;
    mesh.position.set(m.x, bob, m.z);
  }

  // Shades
  const activeShadeIds = new Set(engine.shades.map((s) => s.id));
  for (const [id, grp] of shadeVisuals.entries()) {
    if (!activeShadeIds.has(id)) {
      scene.remove(grp);
      shadeVisuals.delete(id);
    }
  }
  for (const s of engine.shades) {
    let grp = shadeVisuals.get(s.id);
    if (!grp) {
      grp = createShadeVisual(s.id);
    }
    grp.position.set(s.x, 0, s.z);
    grp.lookAt(engine.player.x, 0, engine.player.z);
    const scale = s.state === 'stunned' ? 0.75 + Math.sin(elapsedSec * 24) * 0.1 : 1.0;
    grp.scale.setScalar(scale);
  }

  // Pulse ring animation
  if (pulseAnimT > 0) {
    pulseAnimT = Math.max(0, pulseAnimT - 0.03);
    const s = 1 + (1 - pulseAnimT) * DEFAULT_TUNING.pulse_radius;
    pulseRing.scale.set(s, s, 1);
    (pulseRing.material as THREE.MeshBasicMaterial).opacity = pulseAnimT * 0.8;
  }

  // Embers
  for (let i = embers.length - 1; i >= 0; i--) {
    const e = embers[i];
    e.mesh.position.y += e.vy * DT;
    e.life -= DT;
    if (e.life <= 0) {
      scene.remove(e.mesh);
      embers.splice(i, 1);
    }
  }

  // Camera 3rd person follow
  const yawRad = (camYawDeg * Math.PI) / 180;
  const camDist = 11.5;
  const camHeight = 6.2;
  const targetCamX = engine.player.x - Math.sin(yawRad) * camDist;
  const targetCamZ = engine.player.z - Math.cos(yawRad) * camDist;
  camera.position.lerp(new THREE.Vector3(targetCamX, engine.player.y + camHeight, targetCamZ), 0.14);
  camera.lookAt(engine.player.x, engine.player.y + 1.3, engine.player.z);

  // HUD
  hudFlames.textContent = engine.player.flames > 0 ? '🔥'.repeat(engine.player.flames) : '—';
  hudCarried.textContent = `${engine.player.carried} / ${DEFAULT_TUNING.carry_capacity}`;
  hudLanterns.textContent = `${litCount} / ${DEFAULT_TUNING.lantern_count_night1}`;
  hudTime.textContent = formatTime(engine.timeLeftS);
  hudScore.textContent = String(engine.score);
  promptBanner.style.display = nearUnlit && isStarted ? 'block' : 'none';
}

function readLiveInput(): InputState {
  const input = createDefaultInput();
  let mx = 0;
  let mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
  if (keys.has('KeyA')) mx -= 1;
  if (keys.has('KeyD')) mx += 1;
  if (keys.has('KeyQ') || keys.has('ArrowLeft')) camYawDeg += 1.8;
  if (keys.has('KeyE')) {
    // E serves as interact (also F)
  }
  if (keys.has('ArrowRight')) camYawDeg -= 1.8;

  // Face character toward movement direction
  if (mx !== 0 || mz !== 0) {
    const theta = (camYawDeg * Math.PI) / 180;
    const wx = mx * Math.cos(theta) + mz * Math.sin(theta);
    const wz = -mx * Math.sin(theta) + mz * Math.cos(theta);
    playerGroup.rotation.y = Math.atan2(wx, wz);
  }

  input.move = [mx, mz];
  input.cam_yaw_deg = camYawDeg;
  input.jump = keys.has('Space');
  input.interact = keys.has('KeyE') || keys.has('KeyF');
  input.pulse = keys.has('ShiftLeft') || keys.has('ShiftRight');
  return input;
}

function animate(now: number): void {
  requestAnimationFrame(animate);
  const delta = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (isStarted && engine.state === 'playing') {
    accumulator += delta;
    while (accumulator >= DT && engine.state === 'playing') {
      const evs = engine.step(readLiveInput());
      handleEvents(evs);
      accumulator -= DT;
    }
  }

  syncVisuals(now / 1000);
  renderer.render(scene, camera);
}

syncVisuals(0);
requestAnimationFrame(animate);

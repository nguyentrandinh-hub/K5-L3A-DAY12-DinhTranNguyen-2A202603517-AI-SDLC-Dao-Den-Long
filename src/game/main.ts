import * as THREE from 'three';
import { createDefaultInput, SimulationEngine, xzDistance } from '../sim/engine.js';
import { getNightMap } from '../sim/maps.js';
import { DEFAULT_TUNING, DT, TICK_RATE } from '../sim/tuning.js';
import type { EventRecord, InputState } from '../sim/types.js';
import { SoundFX } from './audio.js';

// Standard Ticket-02 color palette
const COLORS = {
  sky: 0x0e1430,
  fog: 0x1b2350,
  grass: 0x2f5d50,
  sand: 0xc9b48a,
  wood: 0x6b4a2f,
  cloudSea: 0x12384a,
  lanternLit: 0xffb347,
  lanternCore: 0xffe9b0,
  lanternUnlit: 0x5b5f6e,
  moteCore: 0xfff6c2,
  moteGlow: 0xffe58a,
  shadeBody: 0x120a1a,
  shadeRim: 0x7a3cff,
  shadeStun: 0x3a3450,
  mayCloak: 0xe8e2d0,
  mayScarf: 0xc8102e,
  gold: 0xf2c14e,
  drifter: 0x8fa3b8
};

// DOM elements
const app = document.getElementById('app')!;
const hudEl = document.getElementById('hud')!;
const hudNightName = document.getElementById('hud-night-name')!;
const hudFlames = document.getElementById('hud-flames')!;
const hudTime = document.getElementById('hud-time')!;
const hudLanterns = document.getElementById('hud-lanterns')!;
const hudScore = document.getElementById('hud-score')!;
const moteSlotsEl = document.getElementById('mote-slots')!;
const abDash = document.getElementById('ab-dash')!;
const abDashStatus = document.getElementById('ab-dash-status')!;
const abPulse = document.getElementById('ab-pulse')!;
const abPulseStatus = document.getElementById('ab-pulse-status')!;
const charmPill = document.getElementById('charm-pill')!;
const windPill = document.getElementById('wind-pill')!;
const promptBanner = document.getElementById('prompt-banner')!;
const offscreenArrow = document.getElementById('offscreen-arrow')!;
const hitVignette = document.getElementById('hit-vignette')!;
const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
const minimapCtx = minimapCanvas.getContext('2d')!;

// High scores persisted in localStorage (strictly UI-only)
const HIGHSCORE_KEY = 'dao_den_long_highscores_v1';
function loadHighScores(): Record<string, number> {
  try {
    const raw = localStorage.getItem(HIGHSCORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}
function saveHighScore(night: number, score: number): number {
  const map = loadHighScores();
  const key = `night${night}`;
  const best = Math.max(map[key] ?? 0, score);
  map[key] = best;
  try {
    localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
  return best;
}

const overlay = document.getElementById('overlay')!;
const overlayTitle = document.getElementById('overlay-title')!;
const overlayDesc = document.getElementById('overlay-desc')!;
const overlayStats = document.getElementById('overlay-stats')!;
const overlayButtons = document.getElementById('overlay-buttons')!;
const settingsBox = document.getElementById('settings-box')!;
const setVolumeInput = document.getElementById('set-volume') as HTMLInputElement;
const setSensInput = document.getElementById('set-sens') as HTMLInputElement;
const valVolume = document.getElementById('val-volume')!;
const valSens = document.getElementById('val-sens')!;

// Build 10 firefly slots
const moteSlotNodes: HTMLDivElement[] = [];
for (let i = 0; i < 10; i++) {
  const s = document.createElement('div');
  s.className = 'mote-slot';
  moteSlotsEl.appendChild(s);
  moteSlotNodes.push(s);
}

// Persistent settings
const SETTINGS_KEY = 'dao_den_long_settings_v1';
interface GameSettings {
  volume: number;
  sensitivity: number;
}
function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      return {
        volume: typeof parsed.volume === 'number' ? parsed.volume : 70,
        sensitivity: typeof parsed.sensitivity === 'number' ? parsed.sensitivity : 100
      };
    }
  } catch {
    // ignore storage errors
  }
  return { volume: 70, sensitivity: 100 };
}
function saveSettings(s: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

const settings = loadSettings();
const sound = new SoundFX();
sound.setVolume(settings.volume / 100);
setVolumeInput.value = String(settings.volume);
setSensInput.value = String(settings.sensitivity);
valVolume.textContent = `${settings.volume}%`;
valSens.textContent = `${(settings.sensitivity / 100).toFixed(1)}x`;

setVolumeInput.addEventListener('input', () => {
  settings.volume = Number(setVolumeInput.value);
  valVolume.textContent = `${settings.volume}%`;
  sound.setVolume(settings.volume / 100);
  saveSettings(settings);
});
setSensInput.addEventListener('input', () => {
  settings.sensitivity = Number(setSensInput.value);
  valSens.textContent = `${(settings.sensitivity / 100).toFixed(1)}x`;
  saveSettings(settings);
});

// Three.js Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.sky);
scene.fog = new THREE.FogExp2(COLORS.fog, 0.014);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 260);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.prepend(renderer.domElement);

// Ambient light: intensity = 0.15 + 0.55 * (lit / total)
const ambientLight = new THREE.AmbientLight(0xd8e0ff, 0.15);
scene.add(ambientLight);

const moonLight = new THREE.DirectionalLight(0xc2d0ff, 0.75);
moonLight.position.set(30, 55, 25);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024, 1024);
const dCam = 75;
moonLight.shadow.camera.left = -dCam;
moonLight.shadow.camera.right = dCam;
moonLight.shadow.camera.top = dCam;
moonLight.shadow.camera.bottom = -dCam;
scene.add(moonLight);

// Cloud sea base plane
const cloudSea = new THREE.Mesh(
  new THREE.CircleGeometry(220, 48),
  new THREE.MeshStandardMaterial({ color: COLORS.cloudSea, roughness: 0.95 })
);
cloudSea.rotation.x = -Math.PI / 2;
cloudSea.position.y = -11;
scene.add(cloudSea);

// Starry night sky & golden moon (cosmetic atmosphere)
{
  const starPositions: number[] = [];
  for (let i = 0; i < 240; i++) {
    const theta = ((i * 137.508) % 360) * (Math.PI / 180);
    const phi = 0.25 + ((i * 29) % 100) / 140;
    const r = 135;
    starPositions.push(r * Math.cos(theta) * Math.cos(phi), r * Math.sin(phi) + 18, r * Math.sin(theta) * Math.cos(phi));
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: COLORS.moteCore, size: 0.9, transparent: true, opacity: 0.85 })
  );
  scene.add(stars);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(5.5, 16, 16),
    new THREE.MeshBasicMaterial({ color: COLORS.lanternCore })
  );
  moon.position.set(-55, 62, 70);
  scene.add(moon);
}

// Companion guide firefly (100% cosmetic, orbits Mây & nudges toward nearest unlit lantern)
const guideFirefly = new THREE.Mesh(
  new THREE.SphereGeometry(0.14, 8, 8),
  new THREE.MeshBasicMaterial({ color: COLORS.gold })
);
scene.add(guideFirefly);

// Cosmetic particle pools: dash trails, celebration embers, and Night 3 wind leaves
interface SimpleParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}
const particles: SimpleParticle[] = [];
const sparkGeo = new THREE.SphereGeometry(0.14, 6, 6);
const sparkMat = new THREE.MeshBasicMaterial({ color: COLORS.lanternLit, transparent: true, opacity: 0.85 });
const leafGeo = new THREE.BoxGeometry(0.28, 0.04, 0.14);
const leafMat = new THREE.MeshBasicMaterial({ color: COLORS.gold });

function spawnSpark(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number): void {
  const m = new THREE.Mesh(sparkGeo, sparkMat);
  m.position.set(x, y, z);
  scene.add(m);
  particles.push({ mesh: m, vx, vy, vz, life, maxLife: life });
}

function spawnWindLeaf(dirDeg: number): void {
  const rad = (dirDeg * Math.PI) / 180;
  const m = new THREE.Mesh(leafGeo, leafMat);
  m.position.set(
    engine.player.x + (Math.random() - 0.5) * 26 - Math.cos(rad) * 14,
    engine.player.y + 0.8 + Math.random() * 6,
    engine.player.z + (Math.random() - 0.5) * 26 - Math.sin(rad) * 14
  );
  scene.add(m);
  particles.push({
    mesh: m,
    vx: Math.cos(rad) * 10,
    vy: -0.6 + (Math.random() - 0.5),
    vz: Math.sin(rad) * 10,
    life: 1.6,
    maxLife: 1.6
  });
}

let hitShakeT = 0;

// Map geometry container (rebuilt per Night)
const mapGroup = new THREE.Group();
scene.add(mapGroup);

function buildMapVisuals(night: number): void {
  while (mapGroup.children.length > 0) {
    mapGroup.remove(mapGroup.children[0]);
  }
  const grassMat = new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 0.9 });
  const sandMat = new THREE.MeshStandardMaterial({ color: COLORS.sand, roughness: 0.9 });
  const woodMat = new THREE.MeshStandardMaterial({ color: COLORS.wood, roughness: 0.85 });
  const padMat = new THREE.MeshStandardMaterial({
    color: COLORS.gold,
    emissive: COLORS.lanternLit,
    emissiveIntensity: 0.8
  });

  if (night === 1) {
    const island = new THREE.Mesh(new THREE.CylinderGeometry(40, 37, 4, 48), grassMat);
    island.position.y = -2;
    island.receiveShadow = true;
    mapGroup.add(island);

    const rim = new THREE.Mesh(new THREE.RingGeometry(36.5, 40, 48), sandMat);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.02;
    mapGroup.add(rim);

    const pier = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 8), woodMat);
    pier.position.set(0, -0.1, 41);
    mapGroup.add(pier);

    // Cosmetic sampan boat moored at Đảo Bến + Ông Đăng elder NPC near pier
    const boat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 5.2), woodMat);
    boat.position.set(5.2, -0.5, 42.5);
    boat.rotation.y = 0.25;
    mapGroup.add(boat);

    const ongDang = new THREE.Group();
    ongDang.position.set(-4.5, 0, 35);
    const elderBody = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 10), new THREE.MeshStandardMaterial({ color: COLORS.wood }));
    elderBody.position.y = 0.75;
    const elderHead = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), new THREE.MeshStandardMaterial({ color: COLORS.mayCloak }));
    elderHead.position.y = 1.65;
    const staffOrb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), padMat);
    staffOrb.position.set(0.65, 1.6, 0.2);
    ongDang.add(elderBody, elderHead, staffOrb);
    mapGroup.add(ongDang);
  } else if (night === 2) {
    const islA = new THREE.Mesh(new THREE.CylinderGeometry(28, 25, 4, 40), grassMat);
    islA.position.set(0, -2, 0);
    islA.receiveShadow = true;
    mapGroup.add(islA);

    const islB = new THREE.Mesh(new THREE.CylinderGeometry(28, 25, 4, 40), grassMat);
    islB.position.set(70, -2, 0);
    islB.receiveShadow = true;
    mapGroup.add(islB);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 4), woodMat);
    bridge.position.set(35, -0.25, 0);
    bridge.receiveShadow = true;
    mapGroup.add(bridge);

    // Cosmetic areca palms (cây cau) & hanging bridge lanterns on Đảo Cau
    const palmLeafMat = new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 0.85 });
    for (const [px, pz] of [
      [-12, 16],
      [14, 14],
      [-16, -15],
      [56, 16],
      [84, 15],
      [82, -16]
    ]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 6.5, 8), woodMat);
      trunk.position.set(px, 3.25, pz);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.5, 7), palmLeafMat);
      crown.position.set(px, 6.7, pz);
      mapGroup.add(trunk, crown);
    }
    for (const bx of [29, 35, 41]) {
      for (const bz of [-2.1, 2.1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), woodMat);
        post.position.set(bx, 1.1, bz);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), padMat);
        orb.position.set(bx, 2.25, bz);
        mapGroup.add(post, orb);
      }
    }
  } else {
    // Night 3: 3 tiers + 2 ramps + bell tower
    const t0 = new THREE.Mesh(new THREE.CylinderGeometry(45, 42, 4, 52), grassMat);
    t0.position.y = -2;
    t0.receiveShadow = true;
    mapGroup.add(t0);

    // Tier 1 half-annulus (r=12..24, z>0, Y=3)
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 24, 0, Math.PI, false);
    shape.absarc(0, 0, 12, Math.PI, 0, true);
    const t1Geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
    t1Geo.rotateX(Math.PI / 2);
    const t1 = new THREE.Mesh(t1Geo, sandMat);
    t1.position.y = 3;
    t1.receiveShadow = true;
    mapGroup.add(t1);

    // Tier 2 center disk (r=8, Y=6)
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 32), sandMat);
    t2.position.y = 3;
    t2.receiveShadow = true;
    mapGroup.add(t2);

    // 2 Ramps at 30° and 150° from r=30 (Y=0) to r=24 (Y=3)
    for (const deg of [30, 150]) {
      const rad = (deg * Math.PI) / 180;
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.4, 3), woodMat);
      const midR = 27;
      ramp.position.set(Math.cos(rad) * midR, 1.5, Math.sin(rad) * midR);
      ramp.rotation.order = 'YXZ';
      ramp.rotation.y = -rad;
      ramp.rotation.z = Math.atan2(-3, 6);
      mapGroup.add(ramp);
    }

    // Bell tower at center (r=2, h=8 on Tier 2 Y=6) + glowing golden bronze bell
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 16), woodMat);
    tower.position.set(0, 10, 0);
    tower.castShadow = true;
    mapGroup.add(tower);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.1, 1.5, 12), padMat);
    bell.position.set(0, 14.3, 0);
    mapGroup.add(bell);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.2, 8), new THREE.MeshStandardMaterial({ color: COLORS.mayScarf }));
    roof.position.set(0, 15.8, 0);
    mapGroup.add(roof);
  }

  // Jump pads
  for (const pad of getNightMap(night).jumpPads) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(pad.radius, pad.radius * 1.1, 0.25, 20), padMat);
    disc.position.set(pad.x, pad.y + 0.12, pad.z);
    mapGroup.add(disc);
  }
}

// Build Mây (standard colors: cloak #E8E2D0, scarf #C8102E, nón lá + hanging mini lantern)
const playerGroup = new THREE.Group();
const bodyMesh = new THREE.Mesh(
  new THREE.ConeGeometry(0.5, 1.3, 12),
  new THREE.MeshStandardMaterial({ color: COLORS.mayCloak, roughness: 0.7 })
);
bodyMesh.position.y = 0.65;
bodyMesh.castShadow = true;
playerGroup.add(bodyMesh);

const scarfMesh = new THREE.Mesh(
  new THREE.TorusGeometry(0.32, 0.09, 8, 16),
  new THREE.MeshStandardMaterial({ color: COLORS.mayScarf, roughness: 0.6 })
);
scarfMesh.rotation.x = Math.PI / 2;
scarfMesh.position.y = 1.24;
playerGroup.add(scarfMesh);

const headMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 12, 12),
  new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.6 })
);
headMesh.position.y = 1.46;
playerGroup.add(headMesh);

const hatMesh = new THREE.Mesh(
  new THREE.ConeGeometry(0.74, 0.42, 18),
  new THREE.MeshStandardMaterial({ color: COLORS.sand, roughness: 0.8 })
);
hatMesh.position.y = 1.8;
playerGroup.add(hatMesh);

const miniLanternPivot = new THREE.Group();
miniLanternPivot.position.set(0, 1.62, 0.66);
const miniLanternMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.15, 10, 10),
  new THREE.MeshStandardMaterial({
    color: COLORS.lanternLit,
    emissive: COLORS.lanternLit,
    emissiveIntensity: 1.8
  })
);
miniLanternMesh.position.y = -0.18;
miniLanternPivot.add(miniLanternMesh);
const playerLight = new THREE.PointLight(COLORS.lanternLit, 3.5, 14);
playerLight.position.y = -0.18;
miniLanternPivot.add(playerLight);
playerGroup.add(miniLanternPivot);
scene.add(playerGroup);

// Pulse ring
const pulseRing = new THREE.Mesh(
  new THREE.RingGeometry(0.4, 0.85, 36),
  new THREE.MeshBasicMaterial({ color: COLORS.gold, side: THREE.DoubleSide, transparent: true, opacity: 0 })
);
pulseRing.rotation.x = -Math.PI / 2;
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
const shadeVisuals = new Map<string, { group: THREE.Group; bodyMat: THREE.MeshStandardMaterial }>();
const drifterVisuals = new Map<string, THREE.Mesh>();
const charmVisuals = new Map<string, THREE.Group>();

const moteGeo = new THREE.SphereGeometry(0.24, 10, 10);
const moteMat = new THREE.MeshStandardMaterial({
  color: COLORS.moteCore,
  emissive: COLORS.moteGlow,
  emissiveIntensity: 2.0
});
const drifterGeo = new THREE.BoxGeometry(1.4, 0.2, 0.5);
const drifterMat = new THREE.MeshStandardMaterial({
  color: COLORS.drifter,
  emissive: COLORS.drifter,
  emissiveIntensity: 0.6,
  transparent: true,
  opacity: 0.85
});

function createLanternVisual(id: string, x: number, y: number, z: number): LanternVisual {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, 3.5, 10),
    new THREE.MeshStandardMaterial({ color: COLORS.wood, roughness: 0.9 })
  );
  post.position.y = 1.75;
  group.add(post);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 0.65, 6),
    new THREE.MeshStandardMaterial({ color: COLORS.wood, roughness: 0.8 })
  );
  roof.position.y = 4.15;
  group.add(roof);

  const bulbMat = new THREE.MeshStandardMaterial({
    color: COLORS.lanternUnlit,
    emissive: COLORS.lanternLit,
    emissiveIntensity: 0
  });
  const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.44, 0.95, 8), bulbMat);
  bulb.position.y = 3.45;
  group.add(bulb);

  const light = new THREE.PointLight(COLORS.lanternLit, 0, 24);
  light.position.y = 3.45;
  group.add(light);

  const safeRing = new THREE.Mesh(
    new THREE.RingGeometry(DEFAULT_TUNING.safe_radius - 0.12, DEFAULT_TUNING.safe_radius, 48),
    new THREE.MeshBasicMaterial({ color: COLORS.gold, side: THREE.DoubleSide, transparent: true, opacity: 0.24 })
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

function createShadeVisual(id: string) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: COLORS.shadeBody,
    emissive: COLORS.shadeRim,
    emissiveIntensity: 0.85,
    roughness: 0.5
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12), bodyMat);
  body.scale.set(1, 1.35, 1);
  group.add(body);
  scene.add(group);
  const v = { group, bodyMat };
  shadeVisuals.set(id, v);
  return v;
}

function createCharmVisual(id: string, x: number, y: number, z: number): THREE.Group {
  const grp = new THREE.Group();
  grp.position.set(x, y + 1.0, z);
  const card = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.9, 0.08),
    new THREE.MeshStandardMaterial({ color: COLORS.mayScarf, emissive: COLORS.mayScarf, emissiveIntensity: 0.6 })
  );
  const border = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.98, 0.05),
    new THREE.MeshStandardMaterial({ color: COLORS.gold, emissive: COLORS.gold, emissiveIntensity: 0.8 })
  );
  grp.add(border, card);
  scene.add(grp);
  charmVisuals.set(id, grp);
  return grp;
}

// Flow state
type ScreenMode = 'menu' | 'intro' | 'playing' | 'paused' | 'settings' | 'result' | 'dawn';
let screenMode: ScreenMode = 'menu';
let returnMode: ScreenMode = 'menu';
let currentNight: 1 | 2 | 3 = 1;
let totalCampaignScore = 0;
let engine = new SimulationEngine(42, 1, DEFAULT_TUNING);
let camYawDeg = 0;
let accumulator = 0;
let lastTime = performance.now();
let lastCountdownSec = -1;
let lastWindWarn = false;

const keys = new Set<string>();
let pauseQueued = false;
let isDraggingMouse = false;

renderer.domElement.addEventListener('mousedown', (e) => {
  if (screenMode !== 'playing') return;
  isDraggingMouse = true;
  if (e.button === 0 && document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock?.();
  }
});
window.addEventListener('mouseup', () => {
  isDraggingMouse = false;
});
window.addEventListener('mousemove', (e) => {
  if (screenMode !== 'playing') return;
  if (document.pointerLockElement === renderer.domElement || isDraggingMouse) {
    camYawDeg -= e.movementX * 0.18 * (settings.sensitivity / 100);
  }
});

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyM') {
    sound.toggleMute();
  }
  if ((e.code === 'Escape' || e.code === 'KeyP') && (screenMode === 'playing' || screenMode === 'paused')) {
    pauseQueued = true;
    if (screenMode === 'playing') {
      document.exitPointerLock?.();
      showPauseOverlay();
    } else if (screenMode === 'paused') {
      resumeFromPause();
    }
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function clearEntityVisuals(): void {
  for (const v of lanternVisuals.values()) scene.remove(v.group);
  lanternVisuals.clear();
  for (const m of moteVisuals.values()) scene.remove(m);
  moteVisuals.clear();
  for (const s of shadeVisuals.values()) scene.remove(s.group);
  shadeVisuals.clear();
  for (const d of drifterVisuals.values()) scene.remove(d);
  drifterVisuals.clear();
  for (const c of charmVisuals.values()) scene.remove(c);
  charmVisuals.clear();
}

function setOverlay(
  title: string,
  desc: string,
  buttons: Array<{ label: string; secondary?: boolean; onClick: () => void }>,
  statsText?: string,
  showSettings = false
): void {
  overlay.classList.remove('hidden');
  overlayTitle.textContent = title;
  overlayDesc.textContent = desc;
  if (statsText) {
    overlayStats.style.display = 'block';
    overlayStats.textContent = statsText;
  } else {
    overlayStats.style.display = 'none';
  }
  settingsBox.style.display = showSettings ? 'block' : 'none';
  overlayButtons.innerHTML = '';
  for (const b of buttons) {
    const btn = document.createElement('button');
    btn.className = b.secondary ? 'btn secondary' : 'btn';
    btn.textContent = b.label;
    btn.addEventListener('click', b.onClick);
    overlayButtons.appendChild(btn);
  }
}

function showMainMenu(): void {
  screenMode = 'menu';
  hudEl.classList.add('hidden');
  totalCampaignScore = 0;
  currentNight = 1;
  setOverlay(
    'Đảo Đèn Lồng',
    'Cùng Mây thắp sáng 3 hòn đảo — Đảo Bến, Đảo Cau và Đảo Chuông — để xua tan sương đen trước khi bình minh tới.',
    [
      { label: 'Bắt đầu hành trình (3 Đêm)', onClick: () => showNightIntro(1) },
      { label: 'Đêm 2 — Đảo Cau', secondary: true, onClick: () => showNightIntro(2) },
      { label: 'Đêm 3 — Đảo Chuông', secondary: true, onClick: () => showNightIntro(3) },
      { label: 'Cài đặt', secondary: true, onClick: () => showSettings('menu') }
    ]
  );
}

function showSettings(from: ScreenMode): void {
  returnMode = from;
  screenMode = 'settings';
  setOverlay(
    'Cài đặt',
    'Điều chỉnh âm lượng và độ nhạy xoay camera (tự động lưu giữa các lần mở game).',
    [
      {
        label: 'Quay lại',
        onClick: () => {
          if (returnMode === 'paused') showPauseOverlay();
          else showMainMenu();
        }
      }
    ],
    undefined,
    true
  );
}

function showNightIntro(night: 1 | 2 | 3): void {
  sound.unlock();
  currentNight = night;
  screenMode = 'intro';
  hudEl.classList.add('hidden');
  const map = getNightMap(night);
  buildMapVisuals(night);
  clearEntityVisuals();
  engine = new SimulationEngine((Date.now() & 0xffffff) || 42, night, DEFAULT_TUNING);
  camYawDeg = 0;
  syncVisuals(0);

  setOverlay(map.name, map.introQuote, [
    { label: `Vào ${map.name}`, onClick: () => startNight(night) },
    { label: 'Về Menu', secondary: true, onClick: showMainMenu }
  ]);
}

function startNight(night: 1 | 2 | 3): void {
  sound.unlock();
  currentNight = night;
  buildMapVisuals(night);
  clearEntityVisuals();
  engine = new SimulationEngine((Date.now() & 0xffffff) || 42, night, DEFAULT_TUNING);
  camYawDeg = 0;
  accumulator = 0;
  lastCountdownSec = -1;
  lastWindWarn = false;
  screenMode = 'playing';
  overlay.classList.add('hidden');
  hudEl.classList.remove('hidden');
  hudNightName.textContent = engine.map.name;
  syncVisuals(0);
}

function showPauseOverlay(): void {
  screenMode = 'paused';
  setOverlay('Tạm dừng', `Đang tạm dừng tại ${engine.map.name}. Toàn bộ thời gian và logic đã dừng.`, [
    { label: 'Tiếp tục', onClick: resumeFromPause },
    { label: 'Chơi lại Đêm', secondary: true, onClick: () => startNight(currentNight) },
    { label: 'Cài đặt', secondary: true, onClick: () => showSettings('paused') },
    { label: 'Về Menu', secondary: true, onClick: showMainMenu }
  ]);
}

function resumeFromPause(): void {
  if (engine.state === 'paused') {
    engine.step({ ...createDefaultInput(), pause: true });
    engine.step(createDefaultInput());
  }
  screenMode = 'playing';
  overlay.classList.add('hidden');
}

function handleEvents(events: EventRecord[]): void {
  for (const ev of events) {
    switch (ev.name) {
      case 'mote_picked':
      case 'charm_picked':
        sound.playPickup();
        break;
      case 'deposit':
        sound.playDeposit();
        break;
      case 'lantern_lit': {
        sound.playLanternLit();
        const litL = engine.lanterns.find((x) => x.id === ev.data.lantern_id);
        if (litL) {
          for (let i = 0; i < 16; i++) {
            spawnSpark(
              litL.x + (Math.random() - 0.5) * 1.4,
              litL.y + 3.2,
              litL.z + (Math.random() - 0.5) * 1.4,
              (Math.random() - 0.5) * 1.6,
              2.2 + Math.random() * 2.4,
              (Math.random() - 0.5) * 1.6,
              1.6
            );
          }
        }
        break;
      }
      case 'pulse':
        sound.playPulse();
        pulseAnimT = 1.0;
        pulseRing.position.set(engine.player.x, engine.player.y + 0.2, engine.player.z);
        break;
      case 'dash':
        sound.playDash();
        break;
      case 'player_hit':
        sound.playHit();
        hitShakeT = 0.35;
        hitVignette.style.opacity = '1';
        setTimeout(() => {
          hitVignette.style.opacity = '0';
        }, 180);
        break;
      case 'shade_spawned':
        sound.playShadeSpawn();
        break;
      case 'game_over': {
        const won = ev.data.result === 'won';
        const best = saveHighScore(currentNight, engine.score);
        if (won) {
          sound.playWin();
          totalCampaignScore += engine.score;
          if (currentNight < 3) {
            const nextN = (currentNight + 1) as 2 | 3;
            screenMode = 'result';
            setOverlay(
              `Hoàn thành ${engine.map.name}!`,
              'Ánh đèn đã xua tan bóng tối trên hòn đảo này. Sẵn sàng sang hòn đảo tiếp theo!',
              [
                { label: `Tiếp tục sang Đêm ${nextN}`, onClick: () => showNightIntro(nextN) },
                { label: 'Về Menu', secondary: true, onClick: showMainMenu }
              ],
              `Điểm Đêm ${currentNight}: ${engine.score} (Kỷ lục: ${best}) · Tổng điểm: ${totalCampaignScore}`
            );
          } else {
            screenMode = 'dawn';
            setOverlay(
              'Bình Minh Trên Đảo Đèn Lồng!',
              'Mây đã thắp sáng cả 3 hòn đảo — Đảo Bến, Đảo Cau và Đảo Chuông. Màn sương đen đã tan biến hoàn toàn!',
              [{ label: 'Chơi lại từ đầu', onClick: showMainMenu }],
              `Điểm Đêm 3: ${engine.score} (Kỷ lục: ${best}) · Tổng điểm cả 3 Đêm: ${totalCampaignScore}`
            );
          }
        } else {
          sound.playLose();
          screenMode = 'result';
          setOverlay(
            'Màn Sương Đã Thắng...',
            ev.data.reason === 'dawn'
              ? 'Bình minh đã tới trước khi mọi Đèn Lồng Lớn được thắp sáng.'
              : 'Mây đã mất hết Ngọn Lửa. Hãy thử lại Đêm này nhé!',
            [
              { label: `Chơi lại Đêm ${currentNight}`, onClick: () => startNight(currentNight) },
              { label: 'Về Menu', secondary: true, onClick: showMainMenu }
            ],
            `Điểm Đêm ${currentNight}: ${engine.score} (Kỷ lục: ${best})`
          );
        }
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
  playerGroup.visible = engine.player.fallRespawnTicks === 0;
  miniLanternPivot.rotation.z = Math.sin(elapsedSec * 5) * 0.18;
  playerLight.intensity = 3.0 + engine.player.carried * 0.35;

  // Lanterns & nearest unlit lantern for prompt + offscreen arrow
  let litCount = 0;
  let nearestUnlit: { x: number; y: number; z: number; deposited: number; dist: number } | null = null;
  for (const l of engine.lanterns) {
    if (l.lit) litCount++;
    else {
      const d = xzDistance(engine.player.x, engine.player.z, l.x, l.z);
      if (!nearestUnlit || d < nearestUnlit.dist) {
        nearestUnlit = { x: l.x, y: l.y, z: l.z, deposited: l.deposited, dist: d };
      }
    }

    let vis = lanternVisuals.get(l.id);
    if (!vis) vis = createLanternVisual(l.id, l.x, l.y, l.z);
    vis.group.position.set(l.x, l.y, l.z);
    const ratio = Math.min(1, l.deposited / DEFAULT_TUNING.lantern_cost);
    vis.bulbMat.color.setHex(l.lit ? COLORS.lanternCore : COLORS.lanternUnlit);
    vis.bulbMat.emissiveIntensity = l.lit ? 2.4 : ratio * 0.8;
    vis.light.intensity = l.lit ? 14 : ratio * 3;
    vis.safeRing.visible = l.lit;
  }

  // Standard ambient light formula: 0.15 + 0.55 * (lit / total)
  const progress = litCount / Math.max(1, engine.lanterns.length);
  ambientLight.intensity = 0.15 + 0.55 * progress;
  sound.setProgress(progress);

  // Dash trail sparks & Night 3 wind leaves & Guide firefly (purely cosmetic)
  if (screenMode === 'playing' && engine.player.dashTicksLeft > 0) {
    spawnSpark(engine.player.x, engine.player.y + 0.9, engine.player.z, 0, 0.4, 0, 0.35);
  }
  if (screenMode === 'playing' && (engine.wind.warning || engine.wind.active) && Math.random() < 0.35) {
    spawnWindLeaf(engine.wind.dirDeg);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.mesh.position.x += p.vx * DT;
    p.mesh.position.y += p.vy * DT;
    p.mesh.position.z += p.vz * DT;
    p.life -= DT;
    const ratioP = Math.max(0, p.life / p.maxLife);
    p.mesh.scale.setScalar(ratioP);
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
  if (nearestUnlit) {
    const dx = nearestUnlit.x - engine.player.x;
    const dz = nearestUnlit.z - engine.player.z;
    const d = Math.hypot(dx, dz) || 1;
    guideFirefly.visible = true;
    guideFirefly.position.set(
      engine.player.x + (dx / d) * 1.9 + Math.cos(elapsedSec * 4) * 0.3,
      engine.player.y + 2.0 + Math.sin(elapsedSec * 5) * 0.25,
      engine.player.z + (dz / d) * 1.9 + Math.sin(elapsedSec * 4) * 0.3
    );
  } else {
    guideFirefly.visible = false;
  }

  // Minimap radar (top-down relative to island)
  minimapCtx.clearRect(0, 0, 126, 126);
  const cx = 63;
  const cy = 63;
  const scale = 1.05;
  minimapCtx.strokeStyle = 'rgba(242, 193, 78, 0.22)';
  minimapCtx.beginPath();
  minimapCtx.arc(cx, cy, 56, 0, Math.PI * 2);
  minimapCtx.stroke();
  for (const l of engine.lanterns) {
    const rx = cx + (l.x - engine.player.x) * scale;
    const ry = cy - (l.z - engine.player.z) * scale;
    if (Math.hypot(rx - cx, ry - cy) <= 58) {
      minimapCtx.fillStyle = l.lit ? '#FFB347' : '#5B5F6E';
      minimapCtx.beginPath();
      minimapCtx.arc(rx, ry, l.lit ? 4.5 : 3.5, 0, Math.PI * 2);
      minimapCtx.fill();
    }
  }
  for (const c of engine.charms) {
    if (!c.available) continue;
    const rx = cx + (c.x - engine.player.x) * scale;
    const ry = cy - (c.z - engine.player.z) * scale;
    if (Math.hypot(rx - cx, ry - cy) <= 58) {
      minimapCtx.fillStyle = '#C8102E';
      minimapCtx.fillRect(rx - 3, ry - 3, 6, 6);
    }
  }
  minimapCtx.fillStyle = '#FFF6C2';
  minimapCtx.beginPath();
  minimapCtx.arc(cx, cy, 4, 0, Math.PI * 2);
  minimapCtx.fill();

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
    mesh.position.set(m.x, m.y + 0.7 + Math.sin(elapsedSec * 3.5 + m.x) * 0.2, m.z);
  }

  // Shades
  const activeShadeIds = new Set(engine.shades.map((s) => s.id));
  for (const [id, v] of shadeVisuals.entries()) {
    if (!activeShadeIds.has(id)) {
      scene.remove(v.group);
      shadeVisuals.delete(id);
    }
  }
  for (const s of engine.shades) {
    let v = shadeVisuals.get(s.id);
    if (!v) v = createShadeVisual(s.id);
    v.group.position.set(s.x, s.y, s.z);
    v.bodyMat.color.setHex(s.state === 'stunned' ? COLORS.shadeStun : COLORS.shadeBody);
    v.bodyMat.emissiveIntensity = s.state === 'stunned' ? 0.25 : 0.85;
  }

  // Drifters
  const activeDrifterIds = new Set(engine.drifters.filter((d) => d.state !== 'removed').map((d) => d.id));
  for (const [id, mesh] of drifterVisuals.entries()) {
    if (!activeDrifterIds.has(id)) {
      scene.remove(mesh);
      drifterVisuals.delete(id);
    }
  }
  for (const d of engine.drifters) {
    if (d.state === 'removed') continue;
    let mesh = drifterVisuals.get(d.id);
    if (!mesh) {
      mesh = new THREE.Mesh(drifterGeo, drifterMat);
      scene.add(mesh);
      drifterVisuals.set(d.id, mesh);
    }
    mesh.position.set(d.x, d.y + Math.sin(elapsedSec * 6 + d.x) * 0.25, d.z);
    mesh.rotation.y = elapsedSec * 3;
  }

  // Charms
  for (const c of engine.charms) {
    let grp = charmVisuals.get(c.id);
    if (!grp) grp = createCharmVisual(c.id, c.x, c.y, c.z);
    grp.visible = c.available;
    grp.rotation.y = elapsedSec * 2.2;
  }

  // Pulse ring animation
  if (pulseAnimT > 0) {
    pulseAnimT = Math.max(0, pulseAnimT - 0.035);
    const s = 1 + (1 - pulseAnimT) * DEFAULT_TUNING.pulse_radius;
    pulseRing.scale.set(s, s, 1);
    (pulseRing.material as THREE.MeshBasicMaterial).opacity = pulseAnimT * 0.8;
  }

  // Camera follow + subtle hit shake
  const yawRad = (camYawDeg * Math.PI) / 180;
  const camDist = 11.5;
  const camHeight = 6.2;
  let shakeX = 0;
  let shakeY = 0;
  if (hitShakeT > 0) {
    hitShakeT = Math.max(0, hitShakeT - DT);
    shakeX = (Math.random() - 0.5) * 0.45 * hitShakeT;
    shakeY = (Math.random() - 0.5) * 0.35 * hitShakeT;
  }
  camera.position.lerp(
    new THREE.Vector3(
      engine.player.x - Math.sin(yawRad) * camDist + shakeX,
      engine.player.y + camHeight + shakeY,
      engine.player.z - Math.cos(yawRad) * camDist
    ),
    0.15
  );
  camera.lookAt(engine.player.x, engine.player.y + 1.3, engine.player.z);

  // HUD updates
  hudFlames.textContent = engine.player.flames > 0 ? '🔥'.repeat(engine.player.flames) : '—';
  hudLanterns.textContent = `${litCount} / ${engine.lanterns.length}`;
  hudScore.textContent = String(engine.score);
  hudTime.textContent = formatTime(engine.timeLeftS);
  hudTime.classList.toggle('danger', engine.timeLeftS <= 30);

  // 10s countdown tick sound
  if (screenMode === 'playing' && engine.timeLeftS <= 10 && engine.timeLeftS > 0) {
    const sec = Math.ceil(engine.timeLeftS);
    if (sec !== lastCountdownSec) {
      lastCountdownSec = sec;
      sound.playCountdown();
    }
  }

  // 10-slot firefly bar
  for (let i = 0; i < 10; i++) {
    moteSlotNodes[i].classList.toggle('filled', i < engine.player.carried);
  }

  // Cooldown cards
  const dashCd = engine.player.dashCooldownTicks / TICK_RATE;
  abDash.className = dashCd <= 0 ? 'ability-card ready' : 'ability-card cooldown';
  abDashStatus.textContent =
    engine.player.charmTicks > 0 ? 'Không hồi chiêu!' : dashCd <= 0 ? 'Sẵn sàng' : `${dashCd.toFixed(1)}s`;

  const pulseCd = engine.player.pulseCooldownTicks / TICK_RATE;
  const pulseOk = pulseCd <= 0 && engine.player.carried >= DEFAULT_TUNING.pulse_cost;
  abPulse.className = pulseOk ? 'ability-card ready' : 'ability-card cooldown';
  abPulseStatus.textContent =
    pulseCd > 0 ? `${pulseCd.toFixed(1)}s` : engine.player.carried < 3 ? 'Cần 3 đom đóm' : 'Sẵn sàng';

  // Charm & Wind indicators
  if (engine.player.charmTicks > 0) {
    charmPill.style.display = 'block';
    charmPill.textContent = `Bùa Gió: ${(engine.player.charmTicks / TICK_RATE).toFixed(1)}s`;
  } else {
    charmPill.style.display = 'none';
  }

  if (engine.wind.warning && !lastWindWarn && screenMode === 'playing') {
    sound.playWindWarning();
  }
  lastWindWarn = engine.wind.warning;
  if (engine.wind.active) {
    windPill.style.display = 'block';
    windPill.textContent = `Gió mạnh đang thổi (${Math.round(engine.wind.dirDeg)}°)`;
  } else if (engine.wind.warning) {
    windPill.style.display = 'block';
    windPill.textContent = 'Cảnh báo: Gió lớn sắp tới!';
  } else {
    windPill.style.display = 'none';
  }

  // Interact prompt
  if (screenMode === 'playing' && nearestUnlit && nearestUnlit.dist <= DEFAULT_TUNING.interact_radius) {
    promptBanner.style.display = 'block';
    promptBanner.textContent = `E — Nạp ánh sáng (${nearestUnlit.deposited}/10)`;
  } else {
    promptBanner.style.display = 'none';
  }

  // Offscreen arrow pointing to nearest unlit lantern
  if (screenMode === 'playing' && nearestUnlit) {
    const proj = new THREE.Vector3(nearestUnlit.x, nearestUnlit.y + 3.5, nearestUnlit.z).project(camera);
    const inFront = proj.z < 1;
    const onScreen = inFront && Math.abs(proj.x) <= 0.92 && Math.abs(proj.y) <= 0.92;
    if (!onScreen) {
      const dx = inFront ? proj.x : -proj.x;
      const dy = inFront ? proj.y : -proj.y;
      const ang = Math.atan2(-dy, dx);
      const padX = window.innerWidth * 0.44;
      const padY = window.innerHeight * 0.42;
      const sx = window.innerWidth / 2 + Math.cos(ang) * padX;
      const sy = window.innerHeight / 2 + Math.sin(ang) * padY;
      offscreenArrow.style.display = 'flex';
      offscreenArrow.style.left = `${sx - 17}px`;
      offscreenArrow.style.top = `${sy - 17}px`;
      offscreenArrow.style.transform = `rotate(${ang}rad)`;
    } else {
      offscreenArrow.style.display = 'none';
    }
  } else {
    offscreenArrow.style.display = 'none';
  }
}

function readLiveInput(): InputState {
  const input = createDefaultInput();
  let mx = 0;
  let mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
  if (keys.has('KeyA')) mx += 1;
  if (keys.has('KeyD')) mx -= 1;

  const camSpeed = 1.8 * (settings.sensitivity / 100);
  if (keys.has('ArrowLeft')) camYawDeg += camSpeed;
  if (keys.has('ArrowRight')) camYawDeg -= camSpeed;

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
  input.pulse = keys.has('KeyQ');
  input.dash = keys.has('ShiftLeft') || keys.has('ShiftRight');
  input.pause = pauseQueued;
  pauseQueued = false;
  return input;
}

function animate(now: number): void {
  requestAnimationFrame(animate);
  const delta = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (screenMode === 'playing' && engine.state === 'playing') {
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

buildMapVisuals(1);
showMainMenu();
requestAnimationFrame(animate);

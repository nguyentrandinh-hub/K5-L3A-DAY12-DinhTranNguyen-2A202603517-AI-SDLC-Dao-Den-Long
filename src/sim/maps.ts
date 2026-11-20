import type { Vec3 } from './types.js';

export interface JumpPadDef {
  x: number;
  y: number;
  z: number;
  radius: number;
  vy: number;
  vh: number;
  dirX: number;
  dirZ: number;
}

export interface NightMapDef {
  night: 1 | 2 | 3;
  name: string;
  introQuote: string;
  durationS: number;
  shadeSpeed: number;
  shadeIntervalTicks: number;
  maxShades: number;
  hasDrifters: boolean;
  hasWind: boolean;
  spawnPos: Vec3;
  lanterns: Array<{ id: string; pos: Vec3 }>;
  moteSpawns: Vec3[];
  shadeSpawns: Vec3[];
  jumpPads: JumpPadDef[];
  charms: Array<{ id: string; pos: Vec3 }>;
}

function r3(n: number): number {
  const v = Math.round(n * 1000) / 1000;
  return v === 0 ? 0 : v;
}

function ringPoints(
  cx: number,
  y: number,
  cz: number,
  radius: number,
  count: number,
  startDeg = 0,
  stepDeg?: number
): Vec3[] {
  const pts: Vec3[] = [];
  const step = stepDeg ?? 360 / count;
  for (let i = 0; i < count; i++) {
    const rad = ((startDeg + i * step) * Math.PI) / 180;
    pts.push([r3(cx + Math.cos(rad) * radius), y, r3(cz + Math.sin(rad) * radius)]);
  }
  return pts;
}

function normalize2D(dx: number, dz: number): [number, number] {
  const d = Math.hypot(dx, dz);
  return d > 1e-6 ? [dx / d, dz / d] : [1, 0];
}

// Night 1 — Đảo Bến
const NIGHT_1_MAP: NightMapDef = {
  night: 1,
  name: 'Đêm 1 — Đảo Bến',
  introQuote:
    '“Sương đen đã phủ kín bến thuyền rồi, Mây à. Hãy gom những đốm đom đóm đầu tiên và thắp lại 5 Đèn Lồng Lớn trước bình minh.” — Ông Đăng',
  durationS: 240,
  shadeSpeed: 4.0,
  shadeIntervalTicks: 480, // 8s
  maxShades: 6,
  hasDrifters: false,
  hasWind: false,
  spawnPos: [0, 0, 0],
  lanterns: [
    { id: 'L1', pos: [0, 0, 25] },
    { id: 'L2', pos: [23.8, 0, 7.7] },
    { id: 'L3', pos: [14.7, 0, -20.2] },
    { id: 'L4', pos: [-14.7, 0, -20.2] },
    { id: 'L5', pos: [-23.8, 0, 7.7] }
  ],
  moteSpawns: [
    ...ringPoints(0, 0, 0, 12, 8, 0, 45),
    ...ringPoints(0, 0, 0, 33, 16, 0, 22.5)
  ],
  shadeSpawns: ringPoints(0, 0, 0, 37, 12, 15, 30),
  jumpPads: [],
  charms: []
};

// Night 2 — Đảo Cau
const [pad2ADx, pad2ADz] = normalize2D(70 - 20, 0 - 18);
const [pad2BDx, pad2BDz] = normalize2D(0 - 50, 0 - -18);

const NIGHT_2_MAP: NightMapDef = {
  night: 2,
  name: 'Đêm 2 — Đảo Cau',
  introQuote:
    '“Đảo Cau có hai bờ nối bằng cầu tre mỏng manh. Coi chừng Gió Lạc lượn quanh — chúng mê ánh sáng lắm, nhưng Bùa Gió sẽ giúp con chạy nhanh hơn.” — Ông Đăng',
  durationS: 270,
  shadeSpeed: 4.0,
  shadeIntervalTicks: 420, // 7s
  maxShades: 8,
  hasDrifters: true,
  hasWind: false,
  spawnPos: [0, 0, 0],
  lanterns: [
    { id: 'L1', pos: [0, 0, 20] },
    { id: 'L2', pos: [17, 0, -10] },
    { id: 'L3', pos: [-17, 0, -10] },
    { id: 'L4', pos: [70, 0, 20] },
    { id: 'L5', pos: [87, 0, -10] },
    { id: 'L6', pos: [53, 0, -10] }
  ],
  moteSpawns: [
    ...ringPoints(0, 0, 0, 10, 4, 0, 90),
    ...ringPoints(0, 0, 0, 22, 8, 0, 45),
    ...ringPoints(70, 0, 0, 10, 4, 0, 90),
    ...ringPoints(70, 0, 0, 22, 8, 0, 45)
  ],
  shadeSpawns: [
    ...ringPoints(0, 0, 0, 26, 8, 22.5, 45),
    ...ringPoints(70, 0, 0, 26, 8, 22.5, 45)
  ],
  jumpPads: [
    { x: 20, y: 0, z: 18, radius: 1.0, vy: 14.0, vh: 24.0, dirX: pad2ADx, dirZ: pad2ADz },
    { x: 50, y: 0, z: -18, radius: 1.0, vy: 14.0, vh: 24.0, dirX: pad2BDx, dirZ: pad2BDz }
  ],
  charms: [{ id: 'C1', pos: [35, 0, 0] }]
};

// Night 3 — Đảo Chuông
const NIGHT_3_MAP: NightMapDef = {
  night: 3,
  name: 'Đêm 3 — Đảo Chuông',
  introQuote:
    '“Đêm cuối cùng trên Đảo Chuông ba tầng. Gió lớn sẽ nổi lên từng đợt — hãy giữ vững bước chân, leo lên tầng tháp chuông và đánh thức bình minh!” — Ông Đăng',
  durationS: 300,
  shadeSpeed: 4.5,
  shadeIntervalTicks: 360, // 6s
  maxShades: 10,
  hasDrifters: true,
  hasWind: true,
  spawnPos: [0, 0, -12],
  lanterns: [
    { id: 'L1', pos: [0, 6, 6] },
    { id: 'L2', pos: [18, 3, 10] },
    { id: 'L3', pos: [-18, 3, 10] },
    { id: 'L4', pos: [35, 0, -10] },
    { id: 'L5', pos: [-35, 0, -10] },
    { id: 'L6', pos: [20, 0, -35] },
    { id: 'L7', pos: [-20, 0, -35] }
  ],
  moteSpawns: [
    ...ringPoints(0, 0, 0, 34, 18, 0, 20),
    ...ringPoints(0, 3, 0, 18, 8, 20, 20),
    ...ringPoints(0, 6, 0, 5, 4, 45, 90)
  ],
  shadeSpawns: ringPoints(0, 0, 0, 43, 16, 0, 22.5),
  jumpPads: [{ x: 0, y: 3, z: 13, radius: 1.0, vy: 12.0, vh: 8.0, dirX: 0, dirZ: -1 }],
  charms: [
    { id: 'C1', pos: [30, 0, 25] },
    { id: 'C2', pos: [-30, 0, 25] }
  ]
};

export function getNightMap(night: number): NightMapDef {
  if (night === 2) return NIGHT_2_MAP;
  if (night === 3) return NIGHT_3_MAP;
  return NIGHT_1_MAP;
}

const RAMP_ANGLES_RAD = [(30 * Math.PI) / 180, (150 * Math.PI) / 180];

/**
 * Returns the ground/floor surface height Y at (x, z) for the given night,
 * or null if (x, z) is outside solid ground (sea of clouds).
 */
export function getSurfaceHeight(night: number, x: number, z: number): number | null {
  if (night === 1) {
    return Math.hypot(x, z) <= 40.0 ? 0 : null;
  }

  if (night === 2) {
    if (Math.hypot(x, z) <= 28.0) return 0;
    if (Math.hypot(x - 70, z) <= 28.0) return 0;
    if (x >= 26.0 && x <= 44.0 && z >= -2.0 && z <= 2.0) return 0;
    return null;
  }

  // Night 3 — Đảo Chuông (3 tiers + 2 ramps)
  const r = Math.hypot(x, z);
  if (r > 45.0) return null;

  // Tier 2: center disk radius 8m at Y=6
  if (r <= 8.0) return 6.0;

  // Tier 1: annulus radius 12..24m, z > 0 at Y=3
  if (r >= 12.0 && r <= 24.0 && z > 0) return 3.0;

  // Ramps at 30° and 150°, width 3m (half-width 1.5m), r from 30m (Y=0) to 24m (Y=3)
  for (const rad of RAMP_ANGLES_RAD) {
    const ux = Math.cos(rad);
    const uz = Math.sin(rad);
    const along = x * ux + z * uz;
    const perp = Math.abs(-x * uz + z * ux);
    if (perp <= 1.5 && along >= 24.0 && along <= 30.0) {
      return ((30.0 - along) / 6.0) * 3.0;
    }
  }

  // Tier 0: full island at Y=0
  return 0.0;
}

/**
 * Checks if (x, y, z) collides with the Night 3 bell tower (cylinder r=2m, height 8m at center on Tier 2).
 */
export function isInsideBellTower(night: number, x: number, y: number, z: number): boolean {
  if (night !== 3) return false;
  return Math.hypot(x, z) < 2.0 && y >= 5.5 && y <= 14.5;
}

export function resolveBellTowerCollision(night: number, x: number, y: number, z: number): [number, number] {
  if (!isInsideBellTower(night, x, y, z)) return [x, z];
  const d = Math.hypot(x, z);
  const nx = d > 1e-6 ? x / d : 0;
  const nz = d > 1e-6 ? z / d : 1;
  return [nx * 2.02, nz * 2.02];
}

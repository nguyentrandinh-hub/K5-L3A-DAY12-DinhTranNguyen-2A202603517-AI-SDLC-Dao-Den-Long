export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export interface ScoreTuning {
  per_mote: number;
  per_lantern: number;
  per_stun: number;
  per_second_left: number;
  per_flame_left: number;
}

export interface TuningConfig {
  player_speed: number;
  dash_speed: number;
  dash_duration_s: number;
  dash_cooldown_s: number;
  carry_capacity: number;
  capacity_max: number;
  lantern_cost: number;
  relight_cost: number;
  lantern_count_night1: number;
  fuel_max: number;
  fuel_decay_per_s: number;
  fuel_per_mote: number;
  drain_per_s: number;
  low_fuel_threshold: number;
  win_ratio: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  night2_duration_s: number;
  night3_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  safe_radius: number;
  shade_speed: number;
  shade_hit_radius: number;
  fall_enabled: boolean;
  score: ScoreTuning;
}

export interface InputState {
  move: Vec2;
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}

export interface InputFrame {
  tick: number;
  move?: Vec2;
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
}

export interface InputsFile {
  frames: InputFrame[];
}

export type GameState = 'playing' | 'paused' | 'won' | 'lost';
export type ShadeBehaviorState = 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned' | 'drain';
export type DrifterBehaviorState = 'idle' | 'chase' | 'flee' | 'removed';
export type MoteKind = 'random' | 'dropped';

export interface ScenarioPlayer {
  pos?: Vec3;
  carried?: number;
  flames?: number;
  invuln_ticks?: number;
  dash_cd_ticks?: number;
  pulse_cd_ticks?: number;
  charm_ticks?: number;
  successful_lights?: number;
}

export interface ScenarioLantern {
  id: string;
  pos?: Vec3;
  deposited?: number;
  lit?: boolean;
  fuel?: number;
  ever_lit?: boolean;
}

export interface ScenarioShade {
  id?: string;
  pos: Vec3;
  state?: ShadeBehaviorState;
  state_ticks_left?: number;
  target_lantern_id?: string;
}

export interface ScenarioDrifter {
  id?: string;
  pos: Vec3;
  state?: DrifterBehaviorState;
  stolen?: number;
}

export interface ScenarioCharm {
  id?: string;
  pos: Vec3;
  available?: boolean;
  respawn_ticks?: number;
}

export type ScenarioMote = Vec3 | { id?: string; pos: Vec3; kind?: MoteKind; ttl_s?: number };

export interface ScenarioFile {
  player?: ScenarioPlayer;
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: ScenarioMote[];
  shades?: ScenarioShade[];
  drifters?: ScenarioDrifter[];
  charms?: ScenarioCharm[];
  lanterns?: ScenarioLantern[];
  time_left_s?: number;
}

export interface PlayerState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  facingX: number;
  facingZ: number;
  flames: number;
  carried: number;
  successfulLights: number;
  invulnTicks: number;
  dashTicksLeft: number;
  dashCooldownTicks: number;
  dashDirX: number;
  dashDirZ: number;
  pulseCooldownTicks: number;
  charmTicks: number;
  launchLocked: boolean;
  fallRespawnTicks: number;
}

export interface LanternState {
  id: string;
  x: number;
  y: number;
  z: number;
  lit: boolean;
  deposited: number;
  /** Integer 1/60 fuel units (0..6000 where 6000 = 100.0 fuel). */
  fuelUnits: number;
  everLit: boolean;
  relitCount: number;
}

export interface ShadeState {
  id: string;
  x: number;
  y: number;
  z: number;
  state: ShadeBehaviorState;
  stateTicksLeft: number;
  targetLanternId: string | null;
  drainTickCounter: number;
  pulsePushTicks: number;
  pulsePushDirX: number;
  pulsePushDirZ: number;
  recoilDirX: number;
  recoilDirZ: number;
  safePushTicks: number;
  safePushLanternId: string | null;
  wanderAngle: number;
  spawnTick: number;
}

export interface MoteState {
  id: string;
  x: number;
  y: number;
  z: number;
  kind: MoteKind;
  ttlTicks: number | null;
  spawnPointIdx: number | null;
  spawnTick: number;
}

export interface DrifterState {
  id: string;
  x: number;
  y: number;
  z: number;
  state: DrifterBehaviorState;
  stateTicksLeft: number;
  stolen: number;
  hasStolen: boolean;
  idleAngle: number;
  spawnTick: number;
}

export interface CharmState {
  id: string;
  x: number;
  y: number;
  z: number;
  available: boolean;
  respawnTicks: number;
}

export interface WindState {
  active: boolean;
  warning: boolean;
  dirDeg: number;
}

export interface SnapshotRecord {
  type: 'snapshot';
  tick: number;
  sim_tick: number;
  night: number;
  state: GameState;
  time_left_s: number;
  score: number;
  wind: {
    active: boolean;
    dir_deg: number;
  };
  player: {
    pos: Vec3;
    vel: Vec3;
    grounded: boolean;
    flames: number;
    carried: number;
    capacity: number;
    invuln: boolean;
    dash_cd_s: number;
    pulse_cd_s: number;
    charm_s: number;
  };
  lanterns: Array<{
    id: string;
    pos: Vec3;
    lit: boolean;
    deposited: number;
    fuel: number;
    ever_lit: boolean;
    relit_count: number;
  }>;
  shades: Array<{
    id: string;
    pos: Vec3;
    state: ShadeBehaviorState;
  }>;
  motes_active: number;
  motes: Array<{
    id: string;
    pos: Vec3;
    kind: MoteKind;
    ttl_s: number | null;
  }>;
  drifters: Array<{
    id: string;
    pos: Vec3;
    state: DrifterBehaviorState;
    stolen: number;
  }>;
  charms: Array<{
    id: string;
    available: boolean;
    respawn_s: number;
  }>;
}

export interface EventRecord {
  type: 'event';
  tick: number;
  name:
    | 'night_start'
    | 'mote_picked'
    | 'deposit'
    | 'refuel'
    | 'lantern_lit'
    | 'lantern_out'
    | 'fuel_drain'
    | 'pulse'
    | 'dash'
    | 'charm_picked'
    | 'drifter_steal'
    | 'drifter_drop'
    | 'player_hit'
    | 'shade_spawned'
    | 'paused'
    | 'resumed'
    | 'game_over';
  data: Record<string, unknown>;
}

export interface EndRecord {
  type: 'end';
  ticks: number;
  state: GameState;
  score: number;
}

export type JsonlRecord = SnapshotRecord | EventRecord | EndRecord;

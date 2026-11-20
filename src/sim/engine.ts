import { getNightMap, getSurfaceHeight, resolveBellTowerCollision } from './maps.js';
import type { NightMapDef } from './maps.js';
import { DeterministicRNG } from './prng.js';
import {
  CHARM_DURATION_TICKS,
  CHARM_RESPAWN_TICKS,
  CHARM_SPEED,
  DAWN_LIT_LANTERN_BONUS,
  DEFAULT_TUNING,
  DRAIN_STUN_SCORE,
  DRIFTER_CHASE_SPEED,
  DRIFTER_DETECT_RADIUS,
  DRIFTER_DROP_FLEE_TICKS,
  DRIFTER_FLEE_SPEED,
  DRIFTER_FLEE_TICKS,
  DRIFTER_IDLE_SPEED,
  DRIFTER_MAX_COUNT,
  DRIFTER_MIN_CARRIED,
  DRIFTER_SPAWN_INTERVAL_TICKS,
  DRIFTER_STEAL_MAX,
  DRIFTER_STEAL_RADIUS,
  DROPPED_MOTE_TTL_TICKS,
  DT,
  FALL_RESPAWN_TICKS,
  FALL_THRESHOLD_Y,
  FUEL_DECAY_UNITS_PER_TICK,
  FUEL_DRAIN_UNITS_PER_TICK,
  FUEL_LOW_UNITS,
  FUEL_MAX_UNITS,
  FUEL_PER_MOTE_UNITS,
  FUEL_UNITS_PER_FUEL,
  GRAVITY,
  INVULN_TICKS,
  JUMP_VELOCITY,
  PULSE_CENTER_Y_OFFSET,
  PULSE_PUSH_TICKS,
  PULSE_STUN_TICKS,
  RELIGHT_SCORE,
  SAFE_PUSH_MAX_TICKS,
  SHADE_DETECT_RADIUS,
  SHADE_DRAIN_AGGRO_RADIUS,
  SHADE_DRAIN_EVENT_INTERVAL,
  SHADE_DRAIN_RADIUS,
  SHADE_FIRST_SPAWN_TICK,
  SHADE_LOSE_RADIUS,
  SHADE_MIN_SPAWN_PLAYER_DIST,
  SHADE_RECOIL_DIST,
  SHADE_RECOIL_TICKS,
  TICK_RATE,
  WIND_CYCLE_TICKS,
  WIND_DURATION_TICKS,
  WIND_PUSH_SPEED,
  WIND_WARNING_TICKS
} from './tuning.js';
import type {
  CharmState,
  DrifterState,
  EndRecord,
  EventRecord,
  GameState,
  InputState,
  LanternState,
  MoteState,
  PlayerState,
  ScenarioFile,
  ShadeState,
  SnapshotRecord,
  TuningConfig,
  WindState
} from './types.js';

export function round3(value: number): number {
  const r = Math.round(value * 1000) / 1000;
  return r === 0 ? 0 : r;
}

export function round1(value: number): number {
  const r = Math.round(value * 10) / 10;
  return r === 0 ? 0 : r;
}

export function xzDistance(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

export function dist3D(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): number {
  return Math.hypot(ax - bx, ay - by, az - bz);
}

export function createDefaultInput(): InputState {
  return {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false,
    dash: false,
    pause: false
  };
}

const INITIAL_RANDOM_MOTES = 20;
const MAX_RANDOM_MOTES = 30;
const MOTE_SPAWN_INTERVAL_TICKS = 240;

export class SimulationEngine {
  readonly tuning: TuningConfig;
  readonly seed: number;
  readonly night: number;
  readonly map: NightMapDef;

  private rng: DeterministicRNG;
  private randomMotes: boolean;
  private randomShades: boolean;
  private randomDrifters: boolean;
  private windEnabled: boolean;
  private initialTimeLeftS: number;
  private nextMoteId = 1;
  private nextShadeId = 1;
  private nextDrifterId = 1;
  private prevInput: InputState = createDefaultInput();
  private nightStartEmitted = false;

  tick = 0;
  simTick = 0;
  state: GameState = 'playing';
  timeLeftS: number;
  score = 0;

  player: PlayerState;
  lanterns: LanternState[] = [];
  shades: ShadeState[] = [];
  motes: MoteState[] = [];
  drifters: DrifterState[] = [];
  charms: CharmState[] = [];
  wind: WindState = { active: false, warning: false, dirDeg: 0 };

  constructor(seed: number, night = 1, tuning: TuningConfig = DEFAULT_TUNING, scenario?: ScenarioFile) {
    this.seed = seed;
    this.night = night === 2 ? 2 : night === 3 ? 3 : 1;
    this.tuning = tuning;
    this.map = getNightMap(this.night);
    this.rng = new DeterministicRNG(seed);

    this.randomMotes = scenario?.random_motes ?? true;
    this.randomShades = scenario?.random_shades ?? true;
    this.randomDrifters = scenario?.random_drifters ?? this.map.hasDrifters;
    this.windEnabled = scenario?.wind_enabled ?? this.map.hasWind;

    const defaultDuration =
      this.night === 1
        ? tuning.night1_duration_s
        : this.night === 2
          ? tuning.night2_duration_s
          : tuning.night3_duration_s;
    this.initialTimeLeftS = scenario?.time_left_s ?? defaultDuration;
    this.timeLeftS = this.initialTimeLeftS;

    // Player setup
    const pPos = scenario?.player?.pos ?? this.map.spawnPos;
    const groundAtStart = getSurfaceHeight(this.night, pPos[0], pPos[2]);
    const isGrounded = groundAtStart !== null && Math.abs(pPos[1] - groundAtStart) <= 0.1;

    this.player = {
      x: pPos[0],
      y: pPos[1],
      z: pPos[2],
      vx: 0,
      vy: 0,
      vz: 0,
      grounded: isGrounded,
      facingX: 0,
      facingZ: 1,
      flames: scenario?.player?.flames ?? tuning.flames,
      carried: scenario?.player?.carried ?? 0,
      successfulLights: scenario?.player?.successful_lights ?? 0,
      invulnTicks: scenario?.player?.invuln_ticks ?? 0,
      dashTicksLeft: 0,
      dashCooldownTicks: scenario?.player?.dash_cd_ticks ?? 0,
      dashDirX: 0,
      dashDirZ: 1,
      pulseCooldownTicks: scenario?.player?.pulse_cd_ticks ?? 0,
      charmTicks: scenario?.player?.charm_ticks ?? 0,
      launchLocked: false,
      fallRespawnTicks: 0
    };

    // Lanterns from standard map
    for (const def of this.map.lanterns) {
      this.lanterns.push({
        id: def.id,
        x: def.pos[0],
        y: def.pos[1],
        z: def.pos[2],
        lit: false,
        deposited: 0,
        fuelUnits: 0,
        everLit: false,
        relitCount: 0
      });
    }

    // Apply scenario lantern overrides (no events, no score, does NOT count toward successfulLights)
    if (scenario?.lanterns) {
      for (const override of scenario.lanterns) {
        const target = this.lanterns.find((l) => l.id === override.id);
        if (!target) continue;
        if (override.pos) {
          target.x = override.pos[0];
          target.y = override.pos[1];
          target.z = override.pos[2];
        }
        if (typeof override.ever_lit === 'boolean') {
          target.everLit = override.ever_lit;
        }
        if (typeof override.deposited === 'number') {
          target.deposited = override.deposited;
        }
        if (typeof override.lit === 'boolean') {
          target.lit = override.lit;
          if (override.lit) {
            target.everLit = true;
            const fuelVal = typeof override.fuel === 'number' ? override.fuel : tuning.fuel_max;
            target.fuelUnits = Math.max(0, Math.min(FUEL_MAX_UNITS, Math.round(fuelVal * FUEL_UNITS_PER_FUEL)));
            if (typeof override.deposited !== 'number') {
              target.deposited = tuning.lantern_cost;
            }
          } else {
            target.fuelUnits = 0;
          }
        } else {
          const reqCost = target.everLit ? tuning.relight_cost : tuning.lantern_cost;
          if (target.deposited >= reqCost) {
            target.lit = true;
            target.everLit = true;
            const fuelVal = typeof override.fuel === 'number' ? override.fuel : tuning.fuel_max;
            target.fuelUnits = Math.max(0, Math.min(FUEL_MAX_UNITS, Math.round(fuelVal * FUEL_UNITS_PER_FUEL)));
          } else if (typeof override.fuel === 'number' && override.fuel > 0) {
            target.lit = true;
            target.everLit = true;
            target.fuelUnits = Math.max(0, Math.min(FUEL_MAX_UNITS, Math.round(override.fuel * FUEL_UNITS_PER_FUEL)));
          }
        }
      }
    }

    // Motes
    if (scenario?.motes !== undefined) {
      for (const m of scenario.motes) {
        if (Array.isArray(m)) {
          this.motes.push({
            id: `M${this.nextMoteId++}`,
            x: m[0],
            y: m[1],
            z: m[2],
            kind: 'random',
            ttlTicks: null,
            spawnPointIdx: null,
            spawnTick: -1
          });
        } else {
          const kind = m.kind ?? 'random';
          const ttlTicks =
            typeof m.ttl_s === 'number'
              ? Math.round(m.ttl_s * TICK_RATE)
              : kind === 'dropped'
                ? DROPPED_MOTE_TTL_TICKS
                : null;
          this.motes.push({
            id: m.id ?? `M${this.nextMoteId++}`,
            x: m.pos[0],
            y: m.pos[1],
            z: m.pos[2],
            kind,
            ttlTicks,
            spawnPointIdx: null,
            spawnTick: -1
          });
        }
      }
    } else if (this.randomMotes) {
      this.spawnInitialRandomMotes();
    }

    // Shades
    if (scenario?.shades !== undefined) {
      for (const s of scenario.shades) {
        const id = s.id ?? `S${this.nextShadeId++}`;
        const st = s.state ?? 'chase';
        const ticksLeft =
          s.state_ticks_left ??
          (st === 'stunned'
            ? PULSE_STUN_TICKS
            : st === 'recoil'
              ? SHADE_RECOIL_TICKS
              : st === 'spawning'
                ? 30
                : 0);
        this.shades.push({
          id,
          x: s.pos[0],
          y: s.pos[1] ?? 1.0,
          z: s.pos[2],
          state: st,
          stateTicksLeft: ticksLeft,
          targetLanternId: s.target_lantern_id ?? null,
          drainTickCounter: 0,
          pulsePushTicks: 0,
          pulsePushDirX: 1,
          pulsePushDirZ: 0,
          recoilDirX: 1,
          recoilDirZ: 0,
          safePushTicks: 0,
          safePushLanternId: null,
          wanderAngle: this.rng.range(0, Math.PI * 2),
          spawnTick: -1
        });
      }
    }

    // Drifters
    if (scenario?.drifters !== undefined) {
      for (const d of scenario.drifters) {
        const id = d.id ?? `D${this.nextDrifterId++}`;
        const st = d.state ?? 'idle';
        this.drifters.push({
          id,
          x: d.pos[0],
          y: d.pos[1] ?? 1.5,
          z: d.pos[2],
          state: st,
          stateTicksLeft: st === 'flee' ? DRIFTER_FLEE_TICKS : 0,
          stolen: d.stolen ?? 0,
          hasStolen: (d.stolen ?? 0) > 0,
          idleAngle: this.rng.range(0, Math.PI * 2),
          spawnTick: -1
        });
      }
    }

    // Charms
    if (scenario?.charms !== undefined) {
      for (const c of scenario.charms) {
        this.charms.push({
          id: c.id ?? `C${this.charms.length + 1}`,
          x: c.pos[0],
          y: c.pos[1],
          z: c.pos[2],
          available: c.available ?? true,
          respawnTicks: c.respawn_ticks ?? 0
        });
      }
    } else {
      for (const c of this.map.charms) {
        this.charms.push({
          id: c.id,
          x: c.pos[0],
          y: c.pos[1],
          z: c.pos[2],
          available: true,
          respawnTicks: 0
        });
      }
    }

    this.wind.dirDeg = round3(this.rng.range(0, 360));
  }

  getCarryCapacity(): number {
    return Math.min(
      this.tuning.capacity_max,
      this.tuning.carry_capacity + 2 * this.player.successfulLights
    );
  }

  private lanternHasSafeZone(l: LanternState): boolean {
    return l.lit && l.fuelUnits >= FUEL_LOW_UNITS;
  }

  private spawnInitialRandomMotes(): void {
    const indices = this.map.moteSpawns.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const count = Math.min(INITIAL_RANDOM_MOTES, indices.length);
    for (let i = 0; i < count; i++) {
      const idx = indices[i];
      const pt = this.map.moteSpawns[idx];
      this.motes.push({
        id: `M${this.nextMoteId++}`,
        x: pt[0],
        y: pt[1],
        z: pt[2],
        kind: 'random',
        ttlTicks: null,
        spawnPointIdx: idx,
        spawnTick: -1
      });
    }
  }

  private spawnOneRandomMote(): void {
    if (this.motes.length >= MAX_RANDOM_MOTES) return;
    const occupied = new Set<number>();
    for (const m of this.motes) {
      if (m.spawnPointIdx !== null) occupied.add(m.spawnPointIdx);
    }
    const free: number[] = [];
    for (let i = 0; i < this.map.moteSpawns.length; i++) {
      if (!occupied.has(i)) free.push(i);
    }
    if (free.length === 0) return;
    const chosen = free[Math.floor(this.rng.next() * free.length)];
    const pt = this.map.moteSpawns[chosen];
    this.motes.push({
      id: `M${this.nextMoteId++}`,
      x: pt[0],
      y: pt[1],
      z: pt[2],
      kind: 'random',
      ttlTicks: null,
      spawnPointIdx: chosen,
      spawnTick: this.simTick
    });
  }

  private spawnOneShade(events: EventRecord[]): void {
    if (this.shades.length >= this.map.maxShades) return;
    const valid = this.map.shadeSpawns.filter((pt) => {
      if (xzDistance(pt[0], pt[2], this.player.x, this.player.z) < SHADE_MIN_SPAWN_PLAYER_DIST) {
        return false;
      }
      for (const l of this.lanterns) {
        if (this.lanternHasSafeZone(l) && xzDistance(pt[0], pt[2], l.x, l.z) < this.tuning.safe_radius) {
          return false;
        }
      }
      return true;
    });
    if (valid.length === 0) return;
    const pt = valid[Math.floor(this.rng.next() * valid.length)];
    const shade: ShadeState = {
      id: `S${this.nextShadeId++}`,
      x: pt[0],
      y: pt[1] + 1.0,
      z: pt[2],
      state: 'wander',
      stateTicksLeft: 0,
      targetLanternId: null,
      drainTickCounter: 0,
      pulsePushTicks: 0,
      pulsePushDirX: 1,
      pulsePushDirZ: 0,
      recoilDirX: 1,
      recoilDirZ: 0,
      safePushTicks: 0,
      safePushLanternId: null,
      wanderAngle: this.rng.range(0, Math.PI * 2),
      spawnTick: this.simTick
    };
    this.shades.push(shade);
    events.push({
      type: 'event',
      tick: this.tick,
      name: 'shade_spawned',
      data: { id: shade.id }
    });
  }

  private spawnOneDrifter(): void {
    const activeCount = this.drifters.filter((d) => d.state !== 'removed').length;
    if (activeCount >= DRIFTER_MAX_COUNT) return;
    const pt = this.map.shadeSpawns[Math.floor(this.rng.next() * this.map.shadeSpawns.length)];
    this.drifters.push({
      id: `D${this.nextDrifterId++}`,
      x: pt[0],
      y: pt[1] + 1.5,
      z: pt[2],
      state: 'idle',
      stateTicksLeft: 0,
      stolen: 0,
      hasStolen: false,
      idleAngle: this.rng.range(0, Math.PI * 2),
      spawnTick: this.simTick
    });
  }

  private pushShadesOutOfSafeZone(lantern: LanternState): void {
    for (const s of this.shades) {
      if (xzDistance(s.x, s.z, lantern.x, lantern.z) < this.tuning.safe_radius) {
        s.safePushTicks = SAFE_PUSH_MAX_TICKS;
        s.safePushLanternId = lantern.id;
        if (s.state === 'drain' && s.targetLanternId === lantern.id) {
          s.state = 'wander';
          s.targetLanternId = null;
          s.drainTickCounter = 0;
        }
      }
    }
  }

  private tryMoveHorizontal(
    oldX: number,
    oldY: number,
    oldZ: number,
    dx: number,
    dz: number
  ): { x: number; z: number; blocked: boolean } {
    const tryX = oldX + dx;
    const tryZ = oldZ + dz;
    const surf = getSurfaceHeight(this.night, tryX, tryZ);
    let nx = tryX;
    let nz = tryZ;
    let blocked = false;

    if (surf !== null && surf > oldY + 0.6) {
      const surfX = getSurfaceHeight(this.night, oldX + dx, oldZ);
      const surfZ = getSurfaceHeight(this.night, oldX, oldZ + dz);
      if (surfX === null || surfX <= oldY + 0.6) {
        nx = oldX + dx;
        nz = oldZ;
        blocked = true;
      } else if (surfZ === null || surfZ <= oldY + 0.6) {
        nx = oldX;
        nz = oldZ + dz;
        blocked = true;
      } else {
        nx = oldX;
        nz = oldZ;
        blocked = true;
      }
    }

    const [bx, bz] = resolveBellTowerCollision(this.night, nx, oldY, nz);
    if (bx !== nx || bz !== nz) blocked = true;
    return { x: bx, z: bz, blocked };
  }

  step(input: InputState): EventRecord[] {
    if (this.state === 'won' || this.state === 'lost') {
      return [];
    }

    const events: EventRecord[] = [];
    this.tick += 1;

    // 1. Read input & handle pause rising edge FIRST
    const pausePressed = input.pause && !this.prevInput.pause;
    const jumpPressed = input.jump && !this.prevInput.jump;
    const interactPressed = input.interact && !this.prevInput.interact;
    const pulsePressed = input.pulse && !this.prevInput.pulse;
    const dashPressed = input.dash && !this.prevInput.dash;

    this.prevInput.move[0] = input.move[0];
    this.prevInput.move[1] = input.move[1];
    this.prevInput.cam_yaw_deg = input.cam_yaw_deg;
    this.prevInput.jump = input.jump;
    this.prevInput.interact = input.interact;
    this.prevInput.pulse = input.pulse;
    this.prevInput.dash = input.dash;
    this.prevInput.pause = input.pause;

    if (pausePressed) {
      if (this.state === 'playing') {
        this.state = 'paused';
        events.push({ type: 'event', tick: this.tick, name: 'paused', data: {} });
        return events;
      } else if (this.state === 'paused') {
        this.state = 'playing';
        events.push({ type: 'event', tick: this.tick, name: 'resumed', data: {} });
      }
    }

    if (this.state === 'paused') {
      return events;
    }

    // Active gameplay tick
    this.simTick += 1;
    if (!this.nightStartEmitted) {
      this.nightStartEmitted = true;
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'night_start',
        data: { night: this.night }
      });
    }

    // 2. Decrement timers + lantern fuel decay & drain (in integer 1/60 units)
    this.timeLeftS = Math.max(0, this.initialTimeLeftS - this.simTick / TICK_RATE);
    if (this.player.dashCooldownTicks > 0) this.player.dashCooldownTicks -= 1;
    if (this.player.pulseCooldownTicks > 0) this.player.pulseCooldownTicks -= 1;
    if (this.player.invulnTicks > 0) this.player.invulnTicks -= 1;
    if (this.player.charmTicks > 0) this.player.charmTicks -= 1;

    // Lantern fuel decay + shade drain (avoid array copy when no shade is draining)
    let hasDrainingShade = false;
    for (let i = 0; i < this.shades.length; i++) {
      if (this.shades[i].state === 'drain') {
        hasDrainingShade = true;
        break;
      }
    }
    const sortedShadesById = hasDrainingShade ? [...this.shades].sort((a, b) => a.id.localeCompare(b.id)) : null;
    for (const l of this.lanterns) {
      if (!l.lit) continue;
      l.fuelUnits -= FUEL_DECAY_UNITS_PER_TICK;

      if (sortedShadesById) {
        for (const s of sortedShadesById) {
          if (s.state === 'drain' && s.targetLanternId === l.id) {
            l.fuelUnits -= FUEL_DRAIN_UNITS_PER_TICK;
            s.drainTickCounter += 1;
            if (s.drainTickCounter % SHADE_DRAIN_EVENT_INTERVAL === 0) {
              events.push({
                type: 'event',
                tick: this.tick,
                name: 'fuel_drain',
                data: {
                  lantern_id: l.id,
                  shade_id: s.id,
                  fuel: round1(Math.max(0, l.fuelUnits) / FUEL_UNITS_PER_FUEL)
                }
              });
            }
          }
        }
      }

      // Immediately extinguish if fuel <= 0
      if (l.fuelUnits <= 0) {
        l.fuelUnits = 0;
        l.lit = false;
        l.deposited = 0;
        l.everLit = true;
        events.push({
          type: 'event',
          tick: this.tick,
          name: 'lantern_out',
          data: { lantern_id: l.id }
        });
      }
    }

    // Wind cycle (Night 3)
    if (this.windEnabled) {
      const cyclePos = this.simTick % WIND_CYCLE_TICKS;
      if (cyclePos === WIND_CYCLE_TICKS - WIND_WARNING_TICKS) {
        this.wind.dirDeg = round3(this.rng.range(0, 360));
      }
      this.wind.warning = cyclePos >= WIND_CYCLE_TICKS - WIND_WARNING_TICKS;
      this.wind.active = this.simTick >= WIND_CYCLE_TICKS && cyclePos < WIND_DURATION_TICKS;
    } else {
      this.wind.active = false;
      this.wind.warning = false;
    }

    // Dropped mote TTL (in-place compaction to avoid per-tick array allocation)
    let writeMoteIdx = 0;
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      if (m.ttlTicks === null) {
        this.motes[writeMoteIdx++] = m;
      } else {
        m.ttlTicks -= 1;
        if (m.ttlTicks > 0) {
          this.motes[writeMoteIdx++] = m;
        }
      }
    }
    this.motes.length = writeMoteIdx;

    // Charm respawn timers
    for (const c of this.charms) {
      if (!c.available && c.respawnTicks > 0) {
        c.respawnTicks -= 1;
        if (c.respawnTicks <= 0) {
          c.respawnTicks = 0;
          c.available = true;
        }
      }
    }

    // Shade & Drifter state timers
    for (const s of this.shades) {
      if (s.stateTicksLeft > 0) {
        s.stateTicksLeft -= 1;
        if (s.stateTicksLeft <= 0 && (s.state === 'spawning' || s.state === 'stunned' || s.state === 'recoil')) {
          s.state = 'wander';
        }
      }
    }
    for (const d of this.drifters) {
      if (d.state === 'flee' && d.stateTicksLeft > 0) {
        d.stateTicksLeft -= 1;
        if (d.stateTicksLeft <= 0) {
          d.state = 'removed';
        }
      }
    }

    // 3. Move Mây (jump, dash, jump pads, wind) & check fall off island
    if (this.player.fallRespawnTicks > 0) {
      this.player.fallRespawnTicks -= 1;
      if (this.player.fallRespawnTicks === 0) {
        this.player.x = this.map.spawnPos[0];
        this.player.y = this.map.spawnPos[1];
        this.player.z = this.map.spawnPos[2];
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.vz = 0;
        this.player.grounded = true;
        this.player.launchLocked = false;
        this.player.dashTicksLeft = 0;
        this.player.invulnTicks = INVULN_TICKS;
      }
    } else {
      let mx = input.move[0];
      let mz = input.move[1];
      const len = Math.hypot(mx, mz);
      if (len > 1) {
        mx /= len;
        mz /= len;
      }
      const theta = (input.cam_yaw_deg * Math.PI) / 180;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const wx = mx * cosT + mz * sinT;
      const wz = -mx * sinT + mz * cosT;

      if (len > 1e-4) {
        const wLen = Math.hypot(wx, wz);
        this.player.facingX = wx / wLen;
        this.player.facingZ = wz / wLen;
      }

      const dashDurationTicks = Math.round(this.tuning.dash_duration_s * TICK_RATE);
      const dashCdTicks = Math.round(this.tuning.dash_cooldown_s * TICK_RATE);
      if (
        dashPressed &&
        this.player.dashTicksLeft <= 0 &&
        (this.player.charmTicks > 0 || this.player.dashCooldownTicks <= 0)
      ) {
        this.player.dashTicksLeft = dashDurationTicks;
        this.player.dashCooldownTicks = this.player.charmTicks > 0 ? 0 : dashCdTicks;
        this.player.dashDirX = this.player.facingX;
        this.player.dashDirZ = this.player.facingZ;
        this.player.launchLocked = false;
        events.push({ type: 'event', tick: this.tick, name: 'dash', data: {} });
      }

      if (jumpPressed && this.player.grounded && this.player.dashTicksLeft <= 0) {
        this.player.vy = JUMP_VELOCITY;
        this.player.grounded = false;
      }

      if (this.player.dashTicksLeft > 0) {
        this.player.vx = this.player.dashDirX * this.tuning.dash_speed;
        this.player.vz = this.player.dashDirZ * this.tuning.dash_speed;
        this.player.vy = 0;
        this.player.dashTicksLeft -= 1;
      } else if (!this.player.launchLocked) {
        const moveSpeed = this.player.charmTicks > 0 ? CHARM_SPEED : this.tuning.player_speed;
        this.player.vx = wx * moveSpeed;
        this.player.vz = wz * moveSpeed;
      }

      let windVx = 0;
      let windVz = 0;
      if (this.wind.active) {
        const wRad = (this.wind.dirDeg * Math.PI) / 180;
        windVx = Math.cos(wRad) * WIND_PUSH_SPEED;
        windVz = Math.sin(wRad) * WIND_PUSH_SPEED;
      }

      const moved = this.tryMoveHorizontal(
        this.player.x,
        this.player.y,
        this.player.z,
        (this.player.vx + windVx) * DT,
        (this.player.vz + windVz) * DT
      );
      this.player.x = moved.x;
      this.player.z = moved.z;

      const surfaceY = getSurfaceHeight(this.night, this.player.x, this.player.z);
      if (this.player.dashTicksLeft > 0) {
        this.player.grounded = surfaceY !== null && Math.abs(this.player.y - surfaceY) <= 0.05;
      } else if (this.player.grounded) {
        if (surfaceY === null || surfaceY < this.player.y - 0.6) {
          this.player.grounded = false;
          this.player.vy += GRAVITY * DT;
          this.player.y += this.player.vy * DT;
        } else {
          this.player.y = surfaceY;
          this.player.vy = 0;
        }
      } else {
        const prevY = this.player.y;
        this.player.vy += GRAVITY * DT;
        this.player.y += this.player.vy * DT;
        if (surfaceY !== null && this.player.vy <= 0 && prevY >= surfaceY - 0.25 && this.player.y <= surfaceY) {
          this.player.y = surfaceY;
          this.player.vy = 0;
          this.player.grounded = true;
          this.player.launchLocked = false;
        }
      }

      for (const pad of this.map.jumpPads) {
        if (
          xzDistance(this.player.x, this.player.z, pad.x, pad.z) <= pad.radius &&
          Math.abs(this.player.y - pad.y) <= 0.6
        ) {
          this.player.vy = pad.vy;
          this.player.vx = pad.dirX * pad.vh;
          this.player.vz = pad.dirZ * pad.vh;
          this.player.grounded = false;
          this.player.launchLocked = true;
          this.player.dashTicksLeft = 0;
          break;
        }
      }

      if (this.tuning.fall_enabled && this.player.y < FALL_THRESHOLD_Y) {
        this.player.flames = Math.max(0, this.player.flames - 1);
        const lost = this.player.carried;
        this.player.carried = 0;
        this.player.dashTicksLeft = 0;
        this.player.launchLocked = false;
        events.push({
          type: 'event',
          tick: this.tick,
          name: 'player_hit',
          data: { by: 'fall', flames: this.player.flames, dropped: 0, lost }
        });
        if (this.player.flames > 0) {
          this.player.fallRespawnTicks = FALL_RESPAWN_TICKS;
        }
      }
    }

    const canInteractWorld = this.player.fallRespawnTicks === 0 && this.player.flames > 0;

    // 4. Pick up motes (using dynamic capacity) & charms
    if (canInteractWorld) {
      const cap = this.getCarryCapacity();
      if (this.player.carried < cap && this.motes.length > 0) {
        const remaining: MoteState[] = [];
        for (const mote of this.motes) {
          const canPick =
            this.player.carried < cap &&
            mote.spawnTick < this.simTick &&
            xzDistance(this.player.x, this.player.z, mote.x, mote.z) <= this.tuning.pickup_radius &&
            Math.abs(this.player.y - mote.y) <= 1.5;
          if (canPick) {
            this.player.carried += 1;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'mote_picked',
              data: { carried: this.player.carried }
            });
          } else {
            remaining.push(mote);
          }
        }
        this.motes = remaining;
      }

      for (const charm of this.charms) {
        if (
          charm.available &&
          xzDistance(this.player.x, this.player.z, charm.x, charm.z) <= this.tuning.pickup_radius &&
          Math.abs(this.player.y - charm.y) <= 1.5
        ) {
          charm.available = false;
          charm.respawnTicks = CHARM_RESPAWN_TICKS;
          this.player.charmTicks = CHARM_DURATION_TICKS;
          this.player.dashCooldownTicks = 0;
          events.push({
            type: 'event',
            tick: this.tick,
            name: 'charm_picked',
            data: { charm_id: charm.id, charm_ticks: CHARM_DURATION_TICKS }
          });
        }
      }
    }

    // 5. Interact with lanterns (Light, Relight, or Refuel)
    if (canInteractWorld && interactPressed && this.player.carried > 0) {
      let bestLantern: LanternState | null = null;
      let bestDist = Infinity;
      for (const lantern of this.lanterns) {
        const canAccept = !lantern.lit || lantern.fuelUnits < FUEL_MAX_UNITS;
        if (!canAccept) continue;
        const d = xzDistance(this.player.x, this.player.z, lantern.x, lantern.z);
        if (d <= this.tuning.interact_radius) {
          if (d < bestDist - 1e-6 || (Math.abs(d - bestDist) <= 1e-6 && (!bestLantern || lantern.id < bestLantern.id))) {
            bestDist = d;
            bestLantern = lantern;
          }
        }
      }

      if (bestLantern) {
        if (!bestLantern.lit) {
          const reqCost = bestLantern.everLit ? this.tuning.relight_cost : this.tuning.lantern_cost;
          const needed = Math.max(0, reqCost - bestLantern.deposited);
          const amount = Math.min(this.player.carried, needed);
          if (amount > 0) {
            this.player.carried -= amount;
            bestLantern.deposited += amount;
            this.score += amount * this.tuning.score.per_mote;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'deposit',
              data: {
                lantern_id: bestLantern.id,
                amount,
                deposited: bestLantern.deposited
              }
            });

            if (bestLantern.deposited >= reqCost) {
              const isRelight = bestLantern.everLit;
              bestLantern.lit = true;
              bestLantern.fuelUnits = FUEL_MAX_UNITS;
              bestLantern.everLit = true;
              if (isRelight) {
                bestLantern.relitCount += 1;
                this.score += RELIGHT_SCORE;
              } else {
                this.score += this.tuning.score.per_lantern;
              }
              this.player.successfulLights += 1;
              events.push({
                type: 'event',
                tick: this.tick,
                name: 'lantern_lit',
                data: { lantern_id: bestLantern.id, relight: isRelight }
              });
              this.pushShadesOutOfSafeZone(bestLantern);
            }
          }
        } else {
          // Refuel lit lantern
          const missingUnits = FUEL_MAX_UNITS - bestLantern.fuelUnits;
          const neededMotes = Math.ceil(missingUnits / FUEL_PER_MOTE_UNITS);
          const used = Math.min(this.player.carried, neededMotes);
          if (used > 0) {
            const wasLow = bestLantern.fuelUnits < FUEL_LOW_UNITS;
            this.player.carried -= used;
            bestLantern.fuelUnits = Math.min(FUEL_MAX_UNITS, bestLantern.fuelUnits + used * FUEL_PER_MOTE_UNITS);
            this.score += used * this.tuning.score.per_mote;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'refuel',
              data: {
                lantern_id: bestLantern.id,
                amount: used,
                fuel: round1(bestLantern.fuelUnits / FUEL_UNITS_PER_FUEL)
              }
            });
            if (wasLow && bestLantern.fuelUnits >= FUEL_LOW_UNITS) {
              this.pushShadesOutOfSafeZone(bestLantern);
            }
          }
        }
      }
    }

    // 6. Update safe zones
    for (const s of this.shades) {
      if (s.safePushTicks > 0 && s.safePushLanternId) {
        const l = this.lanterns.find((x) => x.id === s.safePushLanternId);
        if (l && this.lanternHasSafeZone(l)) {
          const dx = s.x - l.x;
          const dz = s.z - l.z;
          const d = Math.hypot(dx, dz);
          if (d >= this.tuning.safe_radius) {
            s.safePushTicks = 0;
            s.safePushLanternId = null;
          } else {
            const nx = d > 1e-6 ? dx / d : 1;
            const nz = d > 1e-6 ? dz / d : 0;
            const remaining = this.tuning.safe_radius + 0.05 - d;
            const stepOut = remaining / s.safePushTicks;
            s.x += nx * stepOut;
            s.z += nz * stepOut;
            s.safePushTicks -= 1;
            if (s.safePushTicks <= 0) s.safePushLanternId = null;
          }
        } else {
          s.safePushTicks = 0;
          s.safePushLanternId = null;
        }
      }
    }

    // 7. Pulse (Tỏa Sáng) — +15 total if shade was draining, +5 otherwise
    if (
      canInteractWorld &&
      pulsePressed &&
      this.player.pulseCooldownTicks <= 0 &&
      this.player.carried >= this.tuning.pulse_cost
    ) {
      this.player.carried -= this.tuning.pulse_cost;
      this.player.pulseCooldownTicks = Math.round(this.tuning.pulse_cooldown_s * TICK_RATE);
      const px = this.player.x;
      const py = this.player.y + PULSE_CENTER_Y_OFFSET;
      const pz = this.player.z;
      const stunnedIds: string[] = [];

      for (const s of this.shades) {
        if (s.spawnTick === this.simTick) continue;
        if (dist3D(px, py, pz, s.x, s.y, s.z) <= this.tuning.pulse_radius) {
          const wasDraining = s.state === 'drain';
          s.state = 'stunned';
          s.stateTicksLeft = PULSE_STUN_TICKS;
          s.targetLanternId = null;
          s.drainTickCounter = 0;
          s.pulsePushTicks = PULSE_PUSH_TICKS;
          const dx = s.x - px;
          const dz = s.z - pz;
          const hd = Math.hypot(dx, dz);
          s.pulsePushDirX = hd > 1e-6 ? dx / hd : 1;
          s.pulsePushDirZ = hd > 1e-6 ? dz / hd : 0;
          this.score += wasDraining ? DRAIN_STUN_SCORE : this.tuning.score.per_stun;
          stunnedIds.push(s.id);
        }
      }

      for (const dr of this.drifters) {
        if (dr.state === 'removed' || dr.spawnTick === this.simTick) continue;
        if (dist3D(px, py, pz, dr.x, dr.y, dr.z) <= this.tuning.pulse_radius) {
          if (dr.state === 'chase') {
            dr.state = 'flee';
            dr.stateTicksLeft = DRIFTER_FLEE_TICKS;
          } else if (dr.state === 'flee' && dr.stolen > 0) {
            const dropAmount = dr.stolen;
            dr.stolen = 0;
            dr.stateTicksLeft = DRIFTER_DROP_FLEE_TICKS;
            const groundY = getSurfaceHeight(this.night, dr.x, dr.z) ?? 0;
            for (let i = 0; i < dropAmount; i++) {
              const ang = (i / Math.max(1, dropAmount)) * Math.PI * 2;
              this.motes.push({
                id: `M${this.nextMoteId++}`,
                x: round3(dr.x + Math.cos(ang) * 0.5),
                y: groundY,
                z: round3(dr.z + Math.sin(ang) * 0.5),
                kind: 'dropped',
                ttlTicks: DROPPED_MOTE_TTL_TICKS,
                spawnPointIdx: null,
                spawnTick: this.simTick
              });
            }
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'drifter_drop',
              data: { drifter_id: dr.id, amount: dropAmount }
            });
          }
        }
      }

      events.push({
        type: 'event',
        tick: this.tick,
        name: 'pulse',
        data: { stunned_ids: stunnedIds }
      });
    }

    // 8. Move Shades & Drifters
    const shadeSpeed = this.map.shadeSpeed;
    for (const s of this.shades) {
      if (s.spawnTick === this.simTick) continue;

      if (s.state === 'stunned') {
        if (s.pulsePushTicks > 0) {
          const stepDist = this.tuning.pulse_push_m / PULSE_PUSH_TICKS;
          const moved = this.tryMoveHorizontal(
            s.x,
            s.y - 1.0,
            s.z,
            s.pulsePushDirX * stepDist,
            s.pulsePushDirZ * stepDist
          );
          s.x = moved.x;
          s.z = moved.z;
          s.pulsePushTicks = moved.blocked ? 0 : s.pulsePushTicks - 1;
        }
      } else if (s.state === 'recoil') {
        const stepDist = SHADE_RECOIL_DIST / SHADE_RECOIL_TICKS;
        s.x += s.recoilDirX * stepDist;
        s.z += s.recoilDirZ * stepDist;
      } else if (s.state === 'drain') {
        const dPlayer = xzDistance(s.x, s.z, this.player.x, this.player.z);
        const target = s.targetLanternId ? this.lanterns.find((l) => l.id === s.targetLanternId) : undefined;
        if (dPlayer <= SHADE_DRAIN_AGGRO_RADIUS && this.player.fallRespawnTicks === 0) {
          s.state = 'chase';
          s.targetLanternId = null;
          s.drainTickCounter = 0;
        } else if (
          !target ||
          !target.lit ||
          target.fuelUnits >= FUEL_LOW_UNITS ||
          xzDistance(s.x, s.z, target.x, target.z) > SHADE_DRAIN_RADIUS
        ) {
          s.state = 'wander';
          s.targetLanternId = null;
          s.drainTickCounter = 0;
        }
      } else if (s.state === 'wander' || s.state === 'chase') {
        const dPlayer = xzDistance(s.x, s.z, this.player.x, this.player.z);
        if (s.state === 'wander' && dPlayer <= SHADE_DETECT_RADIUS && this.player.fallRespawnTicks === 0) {
          s.state = 'chase';
          s.targetLanternId = null;
        } else if (s.state === 'chase' && (dPlayer > SHADE_LOSE_RADIUS || this.player.fallRespawnTicks > 0)) {
          s.state = 'wander';
        }

        if (s.state === 'chase') {
          const dx = this.player.x - s.x;
          const dz = this.player.z - s.z;
          const d = Math.hypot(dx, dz);
          if (d > 1e-6) {
            const step = Math.min(d, shadeSpeed * DT);
            s.x += (dx / d) * step;
            s.z += (dz / d) * step;
          }
        } else {
          // Wander: seek nearest weak lit lantern (fuel < 30), else nearest unlit lantern
          let weakLantern: LanternState | null = null;
          let weakDist = Infinity;
          for (const l of this.lanterns) {
            if (l.lit && l.fuelUnits < FUEL_LOW_UNITS) {
              const d = xzDistance(s.x, s.z, l.x, l.z);
              if (d < weakDist - 1e-6 || (Math.abs(d - weakDist) <= 1e-6 && (!weakLantern || l.id < weakLantern.id))) {
                weakDist = d;
                weakLantern = l;
              }
            }
          }

          if (weakLantern) {
            if (weakDist <= SHADE_DRAIN_RADIUS) {
              s.state = 'drain';
              s.targetLanternId = weakLantern.id;
              s.drainTickCounter = 0;
            } else {
              const dx = weakLantern.x - s.x;
              const dz = weakLantern.z - s.z;
              const step = Math.min(weakDist, shadeSpeed * DT);
              s.x += (dx / weakDist) * step;
              s.z += (dz / weakDist) * step;
              if (xzDistance(s.x, s.z, weakLantern.x, weakLantern.z) <= SHADE_DRAIN_RADIUS) {
                s.state = 'drain';
                s.targetLanternId = weakLantern.id;
                s.drainTickCounter = 0;
              }
            }
          } else {
            // Move toward nearest unlit lantern or gentle wander
            let unlitTarget: LanternState | null = null;
            let unlitDist = Infinity;
            for (const l of this.lanterns) {
              if (!l.lit) {
                const d = xzDistance(s.x, s.z, l.x, l.z);
                if (d < unlitDist - 1e-6 || (Math.abs(d - unlitDist) <= 1e-6 && (!unlitTarget || l.id < unlitTarget.id))) {
                  unlitDist = d;
                  unlitTarget = l;
                }
              }
            }
            if (unlitTarget && unlitDist > 2.0) {
              const step = Math.min(unlitDist, shadeSpeed * 0.5 * DT);
              s.x += ((unlitTarget.x - s.x) / unlitDist) * step;
              s.z += ((unlitTarget.z - s.z) / unlitDist) * step;
            } else {
              s.wanderAngle += 0.015;
              const step = shadeSpeed * 0.4 * DT;
              const nx = s.x + Math.cos(s.wanderAngle) * step;
              const nz = s.z + Math.sin(s.wanderAngle) * step;
              if (getSurfaceHeight(this.night, nx, nz) !== null) {
                s.x = nx;
                s.z = nz;
              } else {
                s.wanderAngle += Math.PI * 0.75;
              }
            }
          }
        }
      }

      // Clamp shade outside safe_radius of healthy lit lanterns (fuel >= 30)
      if (s.safePushTicks <= 0) {
        for (const l of this.lanterns) {
          if (!this.lanternHasSafeZone(l)) continue;
          const dx = s.x - l.x;
          const dz = s.z - l.z;
          const d = Math.hypot(dx, dz);
          if (d < this.tuning.safe_radius) {
            const nx = d > 1e-6 ? dx / d : 1;
            const nz = d > 1e-6 ? dz / d : 0;
            s.x = l.x + nx * (this.tuning.safe_radius + 0.01);
            s.z = l.z + nz * (this.tuning.safe_radius + 0.01);
          }
        }
      }

      const shSurf = getSurfaceHeight(this.night, s.x, s.z);
      if (shSurf !== null) s.y = shSurf + 1.0;
    }

    // Move Drifters
    for (const dr of this.drifters) {
      if (dr.state === 'removed' || dr.spawnTick === this.simTick) continue;
      const dPlayer = xzDistance(dr.x, dr.z, this.player.x, this.player.z);

      if (dr.state === 'idle') {
        if (!dr.hasStolen && this.player.carried >= DRIFTER_MIN_CARRIED && dPlayer <= DRIFTER_DETECT_RADIUS && canInteractWorld) {
          dr.state = 'chase';
        } else {
          dr.idleAngle += 0.02;
          dr.x += Math.cos(dr.idleAngle) * DRIFTER_IDLE_SPEED * DT;
          dr.z += Math.sin(dr.idleAngle) * DRIFTER_IDLE_SPEED * DT;
        }
      } else if (dr.state === 'chase') {
        if (this.player.carried < DRIFTER_MIN_CARRIED || dPlayer > DRIFTER_DETECT_RADIUS || !canInteractWorld) {
          dr.state = 'idle';
        } else {
          const dx = this.player.x - dr.x;
          const dz = this.player.z - dr.z;
          const d = Math.hypot(dx, dz);
          if (d > 1e-6) {
            const step = Math.min(d, DRIFTER_CHASE_SPEED * DT);
            dr.x += (dx / d) * step;
            dr.z += (dz / d) * step;
          }
        }
      } else if (dr.state === 'flee') {
        const dx = dr.x - this.player.x;
        const dz = dr.z - this.player.z;
        const d = Math.hypot(dx, dz);
        const nx = d > 1e-6 ? dx / d : 1;
        const nz = d > 1e-6 ? dz / d : 0;
        dr.x += nx * DRIFTER_FLEE_SPEED * DT;
        dr.z += nz * DRIFTER_FLEE_SPEED * DT;
      }
    }

    // 9. Collisions: Drifters steal first, then Shades hit (sorted by ascending ID)
    if (canInteractWorld) {
      if (this.drifters.length > 0 && this.player.carried > 0) {
        const drList = this.drifters.length > 1 ? [...this.drifters].sort((a, b) => a.id.localeCompare(b.id)) : this.drifters;
        for (const dr of drList) {
          if (
            dr.state === 'chase' &&
            !dr.hasStolen &&
            dr.spawnTick < this.simTick &&
            this.player.carried > 0 &&
            xzDistance(dr.x, dr.z, this.player.x, this.player.z) <= DRIFTER_STEAL_RADIUS
          ) {
            const amount = Math.min(DRIFTER_STEAL_MAX, this.player.carried);
            this.player.carried -= amount;
            dr.stolen = amount;
            dr.hasStolen = true;
            dr.state = 'flee';
            dr.stateTicksLeft = DRIFTER_FLEE_TICKS;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'drifter_steal',
              data: { drifter_id: dr.id, amount, carried: this.player.carried }
            });
          }
        }
      }

      if (this.player.invulnTicks <= 0 && this.shades.length > 0) {
        let hitter: ShadeState | null = null;
        for (let i = 0; i < this.shades.length; i++) {
          const s = this.shades[i];
          if (
            s.spawnTick < this.simTick &&
            s.safePushTicks <= 0 &&
            (s.state === 'chase' || s.state === 'wander' || s.state === 'drain') &&
            xzDistance(this.player.x, this.player.z, s.x, s.z) <= this.tuning.shade_hit_radius &&
            Math.abs(this.player.y - (s.y - 1.0)) <= 1.5
          ) {
            if (!hitter || s.id.localeCompare(hitter.id) < 0) {
              hitter = s;
            }
          }
        }
        if (hitter) {
          this.player.flames = Math.max(0, this.player.flames - 1);
          const dropped = Math.floor(this.player.carried * this.tuning.hit_drop_ratio);
          this.player.carried -= dropped;
          this.player.invulnTicks = INVULN_TICKS;

          for (let i = 0; i < dropped; i++) {
            const ang = (i / Math.max(1, dropped)) * Math.PI * 2 + this.rng.range(0, 0.5);
            const r = this.rng.range(1.5, 2.5);
            const mx = round3(this.player.x + Math.cos(ang) * r);
            const mz = round3(this.player.z + Math.sin(ang) * r);
            const my = getSurfaceHeight(this.night, mx, mz) ?? this.player.y;
            this.motes.push({
              id: `M${this.nextMoteId++}`,
              x: mx,
              y: my,
              z: mz,
              kind: 'dropped',
              ttlTicks: DROPPED_MOTE_TTL_TICKS,
              spawnPointIdx: null,
              spawnTick: this.simTick
            });
          }

          hitter.state = 'recoil';
          hitter.stateTicksLeft = SHADE_RECOIL_TICKS;
          hitter.targetLanternId = null;
          hitter.drainTickCounter = 0;
          const rdx = hitter.x - this.player.x;
          const rdz = hitter.z - this.player.z;
          const rd = Math.hypot(rdx, rdz);
          hitter.recoilDirX = rd > 1e-6 ? rdx / rd : 1;
          hitter.recoilDirZ = rd > 1e-6 ? rdz / rd : 0;

          events.push({
            type: 'event',
            tick: this.tick,
            name: 'player_hit',
            data: { by: 'shade', flames: this.player.flames, dropped }
          });
        }
      }
    }

    // 10. Scheduled spawning
    if (this.randomMotes && this.simTick > 0 && this.simTick % MOTE_SPAWN_INTERVAL_TICKS === 0) {
      this.spawnOneRandomMote();
    }
    if (this.randomShades) {
      if (this.simTick === SHADE_FIRST_SPAWN_TICK) {
        this.spawnOneShade(events);
        this.spawnOneShade(events);
      } else if (
        this.simTick > SHADE_FIRST_SPAWN_TICK &&
        (this.simTick - SHADE_FIRST_SPAWN_TICK) % this.map.shadeIntervalTicks === 0
      ) {
        this.spawnOneShade(events);
      }
    }
    if (this.randomDrifters && this.simTick > 0 && this.simTick % DRIFTER_SPAWN_INTERVAL_TICKS === 0) {
      this.spawnOneDrifter();
    }

    // 11. Win / Loss check (v1.2: no early win; no_flames always checked first; dawn_survived if lit >= ceil(0.6*N))
    if (this.player.flames <= 0) {
      this.state = 'lost';
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'game_over',
        data: { result: 'lost', reason: 'no_flames' }
      });
    } else if (this.timeLeftS <= 0) {
      const litLanterns = this.lanterns.filter((l) => l.lit);
      const requiredLit = Math.ceil(this.tuning.win_ratio * this.lanterns.length);
      if (litLanterns.length >= requiredLit) {
        for (const l of litLanterns) {
          this.score += DAWN_LIT_LANTERN_BONUS + Math.floor(l.fuelUnits / FUEL_UNITS_PER_FUEL);
        }
        this.score += this.player.flames * this.tuning.score.per_flame_left;
        this.state = 'won';
        events.push({
          type: 'event',
          tick: this.tick,
          name: 'game_over',
          data: { result: 'won', reason: 'dawn_survived' }
        });
      } else {
        this.state = 'lost';
        events.push({
          type: 'event',
          tick: this.tick,
          name: 'game_over',
          data: { result: 'lost', reason: 'dawn' }
        });
      }
    }

    return events;
  }

  getSnapshot(): SnapshotRecord {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      night: this.night,
      state: this.state,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      wind: {
        active: this.wind.active,
        dir_deg: round3(this.wind.dirDeg)
      },
      player: {
        pos: [round3(this.player.x), round3(this.player.y), round3(this.player.z)],
        vel: [round3(this.player.vx), round3(this.player.vy), round3(this.player.vz)],
        grounded: this.player.grounded,
        flames: this.player.flames,
        carried: this.player.carried,
        capacity: this.getCarryCapacity(),
        invuln: this.player.invulnTicks > 0,
        dash_cd_s: round3(this.player.dashCooldownTicks / TICK_RATE),
        pulse_cd_s: round3(this.player.pulseCooldownTicks / TICK_RATE),
        charm_s: round3(this.player.charmTicks / TICK_RATE)
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: [round3(l.x), round3(l.y), round3(l.z)],
        lit: l.lit,
        deposited: l.deposited,
        fuel: l.lit ? round1(l.fuelUnits / FUEL_UNITS_PER_FUEL) : 0,
        ever_lit: l.everLit,
        relit_count: l.relitCount
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: [round3(s.x), round3(s.y), round3(s.z)],
        state: s.state
      })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({
        id: m.id,
        pos: [round3(m.x), round3(m.y), round3(m.z)],
        kind: m.kind,
        ttl_s: m.ttlTicks === null ? null : round3(m.ttlTicks / TICK_RATE)
      })),
      drifters: this.drifters
        .filter((d) => d.state !== 'removed')
        .map((d) => ({
          id: d.id,
          pos: [round3(d.x), round3(d.y), round3(d.z)],
          state: d.state,
          stolen: d.stolen
        })),
      charms: this.charms.map((c) => ({
        id: c.id,
        available: c.available,
        respawn_s: round3(c.respawnTicks / TICK_RATE)
      }))
    };
  }

  getEndRecord(): EndRecord {
    return {
      type: 'end',
      ticks: this.tick,
      state: this.state,
      score: this.score
    };
  }
}

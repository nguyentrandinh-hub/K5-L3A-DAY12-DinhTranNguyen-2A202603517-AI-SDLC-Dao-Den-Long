import { DeterministicRNG } from './prng.js';
import { DEFAULT_TUNING, DT, GRAVITY, ISLAND_RADIUS, JUMP_VELOCITY, TICK_RATE } from './tuning.js';
import type {
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
  TuningConfig
} from './types.js';

export function round3(value: number): number {
  const r = Math.round(value * 1000) / 1000;
  return r === 0 ? 0 : r;
}

export function xzDistance(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

export function createDefaultInput(): InputState {
  return {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false
  };
}

const INITIAL_RANDOM_MOTES = 18;
const MIN_RANDOM_MOTES = 12;
const MOTE_RESPAWN_INTERVAL_TICKS = 300; // 5s
const INITIAL_RANDOM_SHADES = 2;
const MAX_RANDOM_SHADES = 5;
const SHADE_SPAWN_INTERVAL_TICKS = 2700; // 45s
const LANTERN_RING_RADIUS = 22.0;

export class SimulationEngine {
  readonly tuning: TuningConfig;
  readonly seed: number;
  readonly night: number;

  private rng: DeterministicRNG;
  private randomMotes: boolean;
  private randomShades: boolean;
  private initialTimeLeftS: number;
  private playableRadius: number;
  private nextMoteId = 1;
  private nextShadeId = 1;
  private prevInput: InputState = createDefaultInput();

  tick = 0;
  simTick = 0;
  state: GameState = 'playing';
  timeLeftS: number;
  score = 0;

  player: PlayerState;
  lanterns: LanternState[] = [];
  shades: ShadeState[] = [];
  motes: MoteState[] = [];

  constructor(seed: number, night = 1, tuning: TuningConfig = DEFAULT_TUNING, scenario?: ScenarioFile) {
    this.seed = seed;
    this.night = night;
    this.tuning = tuning;
    this.rng = new DeterministicRNG(seed);

    this.randomMotes = scenario?.random_motes ?? true;
    this.randomShades = scenario?.random_shades ?? true;
    this.initialTimeLeftS = scenario?.time_left_s ?? tuning.night1_duration_s;
    this.timeLeftS = this.initialTimeLeftS;

    // Default player at origin (0, 0, 0)
    const pPos = scenario?.player?.pos ?? [0, 0, 0];
    this.player = {
      x: pPos[0],
      y: pPos[1],
      z: pPos[2],
      vy: 0,
      flames: scenario?.player?.flames ?? tuning.flames,
      carried: scenario?.player?.carried ?? 0,
      invulnTimer: 0,
      pulseCooldown: 0
    };

    // Default 5 Big Lanterns in a ring around Đảo Bến
    for (let i = 0; i < tuning.lantern_count_night1; i++) {
      const angle = (i * 2 * Math.PI) / tuning.lantern_count_night1;
      this.lanterns.push({
        id: `L${i + 1}`,
        x: round3(Math.sin(angle) * LANTERN_RING_RADIUS),
        y: 0,
        z: round3(Math.cos(angle) * LANTERN_RING_RADIUS),
        lit: false,
        deposited: 0
      });
    }

    // Apply scenario lantern overrides (no events, no score)
    if (scenario?.lanterns) {
      for (const override of scenario.lanterns) {
        const target = this.lanterns.find((l) => l.id === override.id);
        if (!target) continue;
        if (override.pos) {
          target.x = override.pos[0];
          target.y = override.pos[1];
          target.z = override.pos[2];
        }
        if (typeof override.deposited === 'number') {
          target.deposited = override.deposited;
        }
        if (typeof override.lit === 'boolean') {
          target.lit = override.lit;
          if (override.lit && typeof override.deposited !== 'number') {
            target.deposited = tuning.lantern_cost;
          }
        } else if (target.deposited >= tuning.lantern_cost) {
          target.lit = true;
        }
      }
    }

    // Apply scenario motes or spawn random motes
    if (scenario?.motes !== undefined) {
      for (const m of scenario.motes) {
        if (Array.isArray(m)) {
          this.motes.push({ id: `M${this.nextMoteId++}`, x: m[0], y: 0, z: m[2] });
        } else {
          const id = m.id ?? `M${this.nextMoteId++}`;
          this.motes.push({ id, x: m.pos[0], y: 0, z: m.pos[2] });
        }
      }
    } else if (this.randomMotes) {
      for (let i = 0; i < INITIAL_RANDOM_MOTES; i++) {
        this.spawnRandomMote();
      }
    }

    // Apply scenario shades or spawn random shades
    if (scenario?.shades !== undefined) {
      for (const s of scenario.shades) {
        const id = s.id ?? `S${this.nextShadeId++}`;
        this.shades.push({
          id,
          x: s.pos[0],
          y: s.pos[1] ?? 1.0,
          z: s.pos[2],
          state: s.state ?? 'chase',
          stunTimer: 0
        });
      }
    } else if (this.randomShades) {
      for (let i = 0; i < INITIAL_RANDOM_SHADES; i++) {
        this.spawnRandomShade(false);
      }
    }

    // Ensure playable radius covers any custom scenario coordinates when fall_enabled is false
    let maxDist = ISLAND_RADIUS;
    const consider = (x: number, z: number) => {
      const d = Math.hypot(x, z);
      if (d + 15 > maxDist) maxDist = d + 15;
    };
    consider(this.player.x, this.player.z);
    for (const l of this.lanterns) consider(l.x, l.z);
    for (const m of this.motes) consider(m.x, m.z);
    for (const s of this.shades) consider(s.x, s.z);
    this.playableRadius = maxDist;
  }

  private spawnRandomMote(): MoteState {
    // Deterministic point inside island radius [5, 36]
    const angle = this.rng.range(0, Math.PI * 2);
    const radius = Math.sqrt(this.rng.next()) * 31 + 5;
    const mote: MoteState = {
      id: `M${this.nextMoteId++}`,
      x: round3(Math.cos(angle) * radius),
      y: 0,
      z: round3(Math.sin(angle) * radius)
    };
    this.motes.push(mote);
    return mote;
  }

  private spawnRandomShade(emitEvent: boolean, events?: EventRecord[]): ShadeState {
    let x = 35;
    let z = 0;
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const radius = this.rng.range(30, 39);
      const cx = round3(Math.cos(angle) * radius);
      const cz = round3(Math.sin(angle) * radius);
      const inSafe = this.lanterns.some(
        (l) => l.lit && xzDistance(cx, cz, l.x, l.z) < this.tuning.safe_radius
      );
      const tooCloseToPlayer = xzDistance(cx, cz, this.player.x, this.player.z) < 12;
      x = cx;
      z = cz;
      if (!inSafe && !tooCloseToPlayer) break;
    }
    const shade: ShadeState = {
      id: `S${this.nextShadeId++}`,
      x,
      y: 1.0,
      z,
      state: 'chase',
      stunTimer: 0
    };
    this.shades.push(shade);
    if (emitEvent && events) {
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'shade_spawned',
        data: { id: shade.id }
      });
    }
    return shade;
  }

  step(input: InputState): EventRecord[] {
    if (this.state !== 'playing') {
      return [];
    }

    const events: EventRecord[] = [];
    this.tick += 1;
    this.simTick += 1;
    this.timeLeftS = Math.max(0, this.initialTimeLeftS - this.simTick / TICK_RATE);

    // Update cooldown timers
    if (this.player.invulnTimer > 0) {
      this.player.invulnTimer = Math.max(0, this.player.invulnTimer - DT);
    }
    if (this.player.pulseCooldown > 0) {
      this.player.pulseCooldown = Math.max(0, this.player.pulseCooldown - DT);
    }

    // Rising-edge detection for discrete actions
    const jumpPressed = input.jump && !this.prevInput.jump;
    const interactPressed = input.interact && !this.prevInput.interact;
    const pulsePressed = input.pulse && !this.prevInput.pulse;
    this.prevInput = {
      move: [input.move[0], input.move[1]],
      cam_yaw_deg: input.cam_yaw_deg,
      jump: input.jump,
      interact: input.interact,
      pulse: input.pulse
    };

    // 1. Player horizontal movement (camera-relative XZ)
    let mx = input.move[0];
    let mz = input.move[1];
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    if (len > 0) {
      const theta = (input.cam_yaw_deg * Math.PI) / 180;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const wx = mx * cosT + mz * sinT;
      const wz = -mx * sinT + mz * cosT;
      this.player.x += wx * this.tuning.player_speed * DT;
      this.player.z += wz * this.tuning.player_speed * DT;

      if (!this.tuning.fall_enabled) {
        const distFromCenter = Math.hypot(this.player.x, this.player.z);
        if (distFromCenter > this.playableRadius) {
          const scale = this.playableRadius / distFromCenter;
          this.player.x *= scale;
          this.player.z *= scale;
        }
      }
    }

    // 2. Player vertical jump physics
    if (jumpPressed && this.player.y <= 0.0001) {
      this.player.vy = JUMP_VELOCITY;
    }
    if (this.player.y > 0 || this.player.vy > 0) {
      this.player.vy += GRAVITY * DT;
      this.player.y += this.player.vy * DT;
      if (this.player.y <= 0) {
        this.player.y = 0;
        this.player.vy = 0;
      }
    }

    // 3. Pick up nearby motes (XZ <= pickup_radius)
    if (this.player.carried < this.tuning.carry_capacity && this.motes.length > 0) {
      const remaining: MoteState[] = [];
      for (const mote of this.motes) {
        if (
          this.player.carried < this.tuning.carry_capacity &&
          xzDistance(this.player.x, this.player.z, mote.x, mote.z) <= this.tuning.pickup_radius
        ) {
          this.player.carried += 1;
          this.score += this.tuning.score.per_mote;
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

    // 4. Interact -> deposit light into nearest unlit lantern within interact_radius
    if (interactPressed && this.player.carried > 0) {
      let bestLantern: LanternState | null = null;
      let bestDist = Infinity;
      for (const lantern of this.lanterns) {
        if (lantern.lit) continue;
        const d = xzDistance(this.player.x, this.player.z, lantern.x, lantern.z);
        if (d <= this.tuning.interact_radius && d < bestDist) {
          bestDist = d;
          bestLantern = lantern;
        }
      }

      if (bestLantern) {
        const needed = Math.max(0, this.tuning.lantern_cost - bestLantern.deposited);
        const amount = Math.min(this.player.carried, needed);
        if (amount > 0) {
          this.player.carried -= amount;
          bestLantern.deposited += amount;
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

          if (bestLantern.deposited >= this.tuning.lantern_cost) {
            bestLantern.lit = true;
            this.score += this.tuning.score.per_lantern;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'lantern_lit',
              data: { lantern_id: bestLantern.id }
            });

            if (this.lanterns.every((l) => l.lit)) {
              const timeBonus = Math.floor(this.timeLeftS) * this.tuning.score.per_second_left;
              const flameBonus = this.player.flames * this.tuning.score.per_flame_left;
              this.score += timeBonus + flameBonus;
              this.state = 'won';
              events.push({
                type: 'event',
                tick: this.tick,
                name: 'game_over',
                data: { result: 'won', reason: 'all_lit' }
              });
              return events;
            }
          }
        }
      }
    }

    // 5. Pulse -> stun and push shades within pulse_radius
    if (
      pulsePressed &&
      this.player.pulseCooldown <= 0 &&
      this.player.carried >= this.tuning.pulse_cost
    ) {
      this.player.carried -= this.tuning.pulse_cost;
      this.player.pulseCooldown = this.tuning.pulse_cooldown_s;
      const stunnedIds: string[] = [];

      for (const shade of this.shades) {
        const d = xzDistance(this.player.x, this.player.z, shade.x, shade.z);
        if (d <= this.tuning.pulse_radius) {
          shade.state = 'stunned';
          shade.stunTimer = this.tuning.pulse_stun_s;
          const dx = shade.x - this.player.x;
          const dz = shade.z - this.player.z;
          const nx = d > 1e-6 ? dx / d : 1;
          const nz = d > 1e-6 ? dz / d : 0;
          shade.x += nx * this.tuning.pulse_push_m;
          shade.z += nz * this.tuning.pulse_push_m;
          this.score += this.tuning.score.per_stun;
          stunnedIds.push(shade.id);
        }
      }

      events.push({
        type: 'event',
        tick: this.tick,
        name: 'pulse',
        data: { stunned_ids: stunnedIds }
      });
    }

    // 6. Shades AI movement & safe_radius repulsion around lit lanterns
    for (const shade of this.shades) {
      if (shade.state === 'stunned') {
        shade.stunTimer -= DT;
        if (shade.stunTimer <= 0) {
          shade.stunTimer = 0;
          shade.state = 'chase';
        }
      } else {
        const dx = this.player.x - shade.x;
        const dz = this.player.z - shade.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 1e-6) {
          const stepDist = Math.min(dist, this.tuning.shade_speed * DT);
          shade.x += (dx / dist) * stepDist;
          shade.z += (dz / dist) * stepDist;
        }
      }

      // Enforce safe_radius around lit lanterns so shades cannot enter
      for (const lantern of this.lanterns) {
        if (!lantern.lit) continue;
        const dx = shade.x - lantern.x;
        const dz = shade.z - lantern.z;
        const d = Math.hypot(dx, dz);
        if (d < this.tuning.safe_radius) {
          const nx = d > 1e-6 ? dx / d : 1;
          const nz = d > 1e-6 ? dz / d : 0;
          shade.x = lantern.x + nx * (this.tuning.safe_radius + 0.01);
          shade.z = lantern.z + nz * (this.tuning.safe_radius + 0.01);
        }
      }
    }

    // 7. Shade collision with player
    if (this.player.invulnTimer <= 0) {
      const hittingShade = this.shades.find(
        (s) =>
          s.state !== 'stunned' &&
          xzDistance(this.player.x, this.player.z, s.x, s.z) <= this.tuning.shade_hit_radius
      );
      if (hittingShade) {
        this.player.flames = Math.max(0, this.player.flames - 1);
        const dropped = Math.floor(this.player.carried * this.tuning.hit_drop_ratio);
        this.player.carried -= dropped;
        this.player.invulnTimer = this.tuning.invuln_s;

        events.push({
          type: 'event',
          tick: this.tick,
          name: 'player_hit',
          data: {
            by: 'shade',
            flames: this.player.flames,
            dropped
          }
        });

        if (this.player.flames <= 0) {
          this.state = 'lost';
          events.push({
            type: 'event',
            tick: this.tick,
            name: 'game_over',
            data: { result: 'lost', reason: 'no_flames' }
          });
          return events;
        }
      }
    }

    // 8. Periodic deterministic spawning (if enabled)
    if (
      this.randomMotes &&
      this.tick % MOTE_RESPAWN_INTERVAL_TICKS === 0 &&
      this.motes.length < MIN_RANDOM_MOTES
    ) {
      this.spawnRandomMote();
    }
    if (
      this.randomShades &&
      this.tick % SHADE_SPAWN_INTERVAL_TICKS === 0 &&
      this.shades.length < MAX_RANDOM_SHADES
    ) {
      this.spawnRandomShade(true, events);
    }

    // 9. Dawn timeout check
    if (this.state === 'playing' && this.timeLeftS <= 0) {
      this.state = 'lost';
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'game_over',
        data: { result: 'lost', reason: 'dawn' }
      });
    }

    return events;
  }

  getSnapshot(): SnapshotRecord {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      state: this.state,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      player: {
        pos: [round3(this.player.x), round3(this.player.y), round3(this.player.z)],
        flames: this.player.flames,
        carried: this.player.carried
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: [round3(l.x), round3(l.y), round3(l.z)],
        lit: l.lit,
        deposited: l.deposited
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: [round3(s.x), round3(s.y), round3(s.z)],
        state: s.state
      })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({
        id: m.id,
        pos: [round3(m.x), round3(m.y), round3(m.z)]
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

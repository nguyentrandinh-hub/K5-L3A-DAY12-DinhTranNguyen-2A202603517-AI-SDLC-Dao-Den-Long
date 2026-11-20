import type { TuningConfig } from './types.js';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const JUMP_VELOCITY = 7.0;
export const GRAVITY = -20.0;

export const CHARM_SPEED = 7.2;
export const CHARM_DURATION_TICKS = 600;
export const CHARM_RESPAWN_TICKS = 2700;

export const DROPPED_MOTE_TTL_TICKS = 480;
export const FALL_THRESHOLD_Y = -10.0;
export const FALL_RESPAWN_TICKS = 60;
export const INVULN_TICKS = 90;

export const PULSE_CENTER_Y_OFFSET = 0.8;
export const PULSE_STUN_TICKS = 120;
export const PULSE_PUSH_TICKS = 15;

export const SHADE_DETECT_RADIUS = 12.0;
export const SHADE_LOSE_RADIUS = 18.0;
export const SHADE_RECOIL_TICKS = 60;
export const SHADE_RECOIL_DIST = 2.0;
export const SAFE_PUSH_MAX_TICKS = 30;
export const SHADE_FIRST_SPAWN_TICK = 300;
export const SHADE_MIN_SPAWN_PLAYER_DIST = 15.0;

export const DRIFTER_IDLE_SPEED = 2.0;
export const DRIFTER_CHASE_SPEED = 7.0;
export const DRIFTER_FLEE_SPEED = 7.0;
export const DRIFTER_DETECT_RADIUS = 15.0;
export const DRIFTER_MIN_CARRIED = 5;
export const DRIFTER_STEAL_RADIUS = 1.2;
export const DRIFTER_STEAL_MAX = 3;
export const DRIFTER_FLEE_TICKS = 240;
export const DRIFTER_DROP_FLEE_TICKS = 120;
export const DRIFTER_SPAWN_INTERVAL_TICKS = 1200;
export const DRIFTER_MAX_COUNT = 2;

export const WIND_CYCLE_TICKS = 1800; // 30s
export const WIND_DURATION_TICKS = 300; // 5s
export const WIND_WARNING_TICKS = 120; // 2s
export const WIND_PUSH_SPEED = 2.0;

export const DEFAULT_TUNING: TuningConfig = {
  player_speed: 6.0,
  dash_speed: 14.0,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1.0,
  interact_radius: 2.0,
  pulse_cost: 3,
  pulse_radius: 5.0,
  night1_duration_s: 300,
  night2_duration_s: 330,
  night3_duration_s: 360,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2.0,
  pulse_push_m: 4.0,
  pulse_cooldown_s: 3.0,
  safe_radius: 6.0,
  shade_speed: 4.0,
  shade_hit_radius: 1.0,
  fall_enabled: true,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 2,
    per_flame_left: 50
  }
};

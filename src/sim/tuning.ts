import type { TuningConfig } from './types.js';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const ISLAND_RADIUS = 45.0;
export const JUMP_VELOCITY = 7.0;
export const GRAVITY = -20.0;

export const DEFAULT_TUNING: TuningConfig = {
  player_speed: 8.0,
  carry_capacity: 5,
  lantern_cost: 3,
  lantern_count_night1: 5,
  pickup_radius: 2.0,
  interact_radius: 3.5,
  pulse_cost: 2,
  pulse_radius: 8.0,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 2.0,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3.0,
  pulse_push_m: 6.0,
  pulse_cooldown_s: 1.5,
  safe_radius: 6.0,
  shade_speed: 4.5,
  shade_hit_radius: 1.5,
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 25,
    per_second_left: 2,
    per_flame_left: 50
  }
};

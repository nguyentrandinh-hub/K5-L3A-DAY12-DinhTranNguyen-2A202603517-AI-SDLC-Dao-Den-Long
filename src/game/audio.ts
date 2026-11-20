/**
 * Procedural Web Audio synthesizer for Đảo Đèn Lồng (Contract v1.1).
 * 100% original synthesized Vietnamese pentatonic night melody & SFX.
 * Strictly isolated in src/game/ — zero impact on headless simulation.
 */
export class SoundFX {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmTimer: number | null = null;
  private volume = 0.7;
  private muted = false;
  private progress = 0;
  private melodyStep = 0;

  // Vietnamese pentatonic scale (C4, D4, F4, G4, A4, C5, D5)
  private readonly scale = [261.63, 293.66, 349.23, 392.0, 440.0, 523.25, 587.33];
  private readonly pattern = [0, 2, 3, 4, 3, 2, 5, 4, 3, 2, 1, 0, 2, 4, 3, 1];

  setVolume(vol01: number): void {
    this.volume = Math.max(0, Math.min(1, vol01));
    this.applyGain();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.applyGain();
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setProgress(p01: number): void {
    this.progress = Math.max(0, Math.min(1, p01));
  }

  private applyGain(): void {
    if (this.masterGain && this.ctx) {
      const target = this.muted ? 0 : this.volume;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
    }
  }

  unlock(): void {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : this.volume;
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.startPentatonicBgm();
  }

  private startPentatonicBgm(): void {
    if (this.bgmTimer !== null || typeof window === 'undefined') return;
    this.bgmTimer = window.setInterval(() => {
      if (!this.ctx || !this.masterGain || this.muted || this.volume <= 0.001) return;
      if (this.ctx.state !== 'running') return;
      const idx = this.pattern[this.melodyStep % this.pattern.length];
      this.melodyStep++;
      // Slightly brighter octave shift as lanterns light up
      const mult = this.progress > 0.6 && this.melodyStep % 4 === 0 ? 1.5 : 1.0;
      const freq = this.scale[idx] * mult;
      this.playTone(freq, freq * 0.997, 0.9, 'sine', 0.032 + this.progress * 0.015);
    }, 850);
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    gainPeak: number
  ): void {
    if (!this.ctx || !this.masterGain || this.muted || this.volume <= 0.001) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playPickup(): void {
    this.playTone(680, 1220, 0.14, 'sine', 0.12);
  }
  playDeposit(): void {
    this.playTone(460, 680, 0.2, 'triangle', 0.14);
  }
  playLanternLit(): void {
    this.playTone(523.25, 783.99, 0.42, 'sine', 0.18);
    setTimeout(() => this.playTone(659.25, 1046.5, 0.5, 'triangle', 0.15), 110);
  }
  playPulse(): void {
    this.playTone(300, 900, 0.3, 'sine', 0.2);
  }
  playHit(): void {
    this.playTone(170, 70, 0.25, 'sawtooth', 0.15);
  }
  playJump(): void {
    this.playTone(280, 520, 0.14, 'sine', 0.1);
  }
  playDash(): void {
    this.playTone(520, 220, 0.16, 'triangle', 0.14);
  }
  playShadeSpawn(): void {
    this.playTone(150, 90, 0.35, 'sawtooth', 0.1);
  }
  playCountdown(): void {
    this.playTone(880, 880, 0.08, 'sine', 0.1);
  }
  playWindWarning(): void {
    this.playTone(260, 380, 0.4, 'sine', 0.09);
  }
  playWin(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((n, idx) => {
      setTimeout(() => this.playTone(n, n * 1.02, 0.38, 'triangle', 0.16), idx * 120);
    });
  }
  playLose(): void {
    [392, 349.23, 293.66, 220].forEach((n, idx) => {
      setTimeout(() => this.playTone(n, n * 0.96, 0.32, 'sine', 0.14), idx * 130);
    });
  }
}

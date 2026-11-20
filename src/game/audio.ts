/**
 * Procedural Web Audio synthesizer for Đảo Đèn Lồng (Contract v1.1).
 * 100% original synthesized music & SFX; volume persisted via Settings.
 */
export class SoundFX {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmOsc: OscillatorNode | null = null;
  private volume = 0.7;

  setVolume(vol01: number): void {
    this.volume = Math.max(0, Math.min(1, vol01));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    }
  }

  unlock(): void {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.startAmbient();
  }

  private startAmbient(): void {
    if (!this.ctx || !this.masterGain || this.bgmOsc) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 110;
    gain.gain.value = 0.025;
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    this.bgmOsc = osc;
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    gainPeak: number
  ): void {
    if (!this.ctx || !this.masterGain || this.volume <= 0.001) return;
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

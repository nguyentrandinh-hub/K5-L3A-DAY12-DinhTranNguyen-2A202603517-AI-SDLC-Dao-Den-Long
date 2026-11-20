/**
 * Procedural Web Audio synthesizer for Đảo Đèn Lồng.
 * 100% original synthesized sounds; disabled in headless mode.
 */
export class SoundFX {
  private ctx: AudioContext | null = null;

  unlock(): void {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    gainPeak: number
  ): void {
    if (!this.ctx) return;
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
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playPickup(): void {
    this.playTone(660, 1180, 0.16, 'sine', 0.12);
  }

  playDeposit(): void {
    this.playTone(440, 660, 0.22, 'triangle', 0.14);
  }

  playLanternLit(): void {
    this.playTone(523.25, 783.99, 0.45, 'sine', 0.18);
    setTimeout(() => this.playTone(659.25, 1046.5, 0.55, 'triangle', 0.14), 110);
  }

  playPulse(): void {
    this.playTone(320, 880, 0.32, 'sine', 0.2);
  }

  playHit(): void {
    this.playTone(180, 75, 0.26, 'sawtooth', 0.14);
  }

  playWin(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, n * 1.02, 0.4, 'triangle', 0.16), idx * 120);
    });
  }
}

export class AudioSystem {
  ctx: AudioContext | null = null;
  bgmInterval: number | null = null;
  initialized = false;
  isGameOver = false;
  isPaused = false;
  musicEnabled = true;
  sfxEnabled = true;

  init() {
    if (this.initialized) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();
    this.initialized = true;
    this.startBGM();
  }

  setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (!enabled) this.stopBGM();
    else if (!this.isGameOver && !this.isPaused && this.initialized) this.startBGM();
  }

  setSFXEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
  }

  setGameOver(isOver: boolean) {
    this.isGameOver = isOver;
    if (isOver) {
      this.stopBGM();
    } else if (this.initialized && !this.isPaused && this.musicEnabled) {
      this.startBGM(); 
    }
  }

  setPaused(paused: boolean) {
    this.isPaused = paused;
    if (paused) {
      this.stopBGM();
    } else if (this.initialized && !this.isGameOver && this.musicEnabled) {
      this.startBGM();
    }
  }

  stopBGM() {
    if (this.bgmInterval) window.clearInterval(this.bgmInterval);
    this.bgmInterval = null;
  }

  playShoot() {
    if (!this.ctx || this.isGameOver || this.isPaused || !this.sfxEnabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.015, this.ctx.currentTime); // Lower volume to not be annoying
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playExplosion() {
    if (!this.ctx || !this.sfxEnabled) return;
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  playDamage() {
    if (!this.ctx || !this.sfxEnabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  startBGM() {
    if (!this.ctx || !this.musicEnabled) return;
    let noteIndex = 0;
    // Energetic pentatonic sequence
    const notes = [220, 261.63, 293.66, 329.63, 392, 329.63, 261.63, 196]; // A C D E G E C G
    const playNote = () => {
      if (!this.ctx || this.isGameOver || this.isPaused || !this.musicEnabled) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = notes[noteIndex % notes.length] / 2; // Baseline depth
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
      
      // Add hi-hat rhythm
      if (noteIndex % 2 === 0 || noteIndex % 4 === 3) {
        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const hpf = this.ctx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.value = 7000;
        const gainHat = this.ctx.createGain();
        gainHat.gain.setValueAtTime(0.015, this.ctx.currentTime);
        gainHat.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        noise.connect(hpf); hpf.connect(gainHat); gainHat.connect(this.ctx.destination);
        noise.start();
      }
      
      noteIndex++;
    };
    
    if (this.bgmInterval) window.clearInterval(this.bgmInterval);
    playNote(); // play strictly on start
    this.bgmInterval = window.setInterval(playNote, 160); // fast tempo, roughly ~180BPM eighth notes
  }
}

export const audioSystem = new AudioSystem();

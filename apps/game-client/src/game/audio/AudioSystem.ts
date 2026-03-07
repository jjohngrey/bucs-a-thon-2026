export interface AudioClipConfig {
  url: string;
  volume?: number;
  poolSize?: number;
}

interface AudioClipRuntime {
  elements: HTMLAudioElement[];
  cursor: number;
  volume: number;
  available: boolean;
}

const DEFAULT_VOLUME = 0.8;
const DEFAULT_POOL_SIZE = 3;

export class AudioSystem {
  private readonly clips = new Map<string, AudioClipRuntime>();
  private enabled = false;

  registerClip(key: string, config: AudioClipConfig): void {
    const poolSize = Math.max(1, config.poolSize ?? DEFAULT_POOL_SIZE);
    const elements: HTMLAudioElement[] = [];

    for (let i = 0; i < poolSize; i += 1) {
      const audio = new Audio(config.url);
      audio.preload = "auto";
      elements.push(audio);
    }

    this.clips.set(key, {
      elements,
      cursor: 0,
      volume: config.volume ?? DEFAULT_VOLUME,
      available: true
    });
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  play(key: string): void {
    if (!this.enabled) {
      return;
    }

    const clip = this.clips.get(key);
    if (!clip || !clip.available || clip.elements.length === 0) {
      return;
    }

    const audio = clip.elements[clip.cursor];
    clip.cursor = (clip.cursor + 1) % clip.elements.length;

    audio.currentTime = 0;
    audio.volume = clip.volume;

    void audio.play().catch(() => {
      // Mark unavailable after failed playback (missing file/unsupported format).
      clip.available = false;
    });
  }
}

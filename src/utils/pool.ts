import { Particle, FloatingText } from '../types/game';

/**
 * Object Pool for Particles to eliminate Garbage Collection allocations and 60 FPS stutters on Android WebViews.
 */
class ParticlePool {
  private pool: Particle[] = [];
  private maxSize: number = 300;

  public acquire(
    x: number,
    y: number,
    vx: number,
    vy: number,
    size: number,
    color: string,
    maxLife: number
  ): Particle {
    const p = this.pool.pop();
    if (p) {
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.size = size;
      p.color = color;
      p.alpha = 1;
      p.life = 0;
      p.maxLife = maxLife;
      return p;
    }

    return { x, y, vx, vy, size, color, alpha: 1, life: 0, maxLife };
  }

  public release(p: Particle): void {
    if (this.pool.length < this.maxSize) {
      this.pool.push(p);
    }
  }

  public clear(): void {
    this.pool = [];
  }
}

/**
 * Object Pool for Floating Score Texts
 */
class FloatingTextPool {
  private pool: FloatingText[] = [];
  private maxSize: number = 50;

  public acquire(
    id: string,
    text: string,
    x: number,
    y: number,
    color: string,
    scale: number
  ): FloatingText {
    const ft = this.pool.pop();
    if (ft) {
      ft.id = id;
      ft.text = text;
      ft.x = x;
      ft.y = y;
      ft.color = color;
      ft.alpha = 1;
      ft.scale = scale;
      ft.life = 0;
      return ft;
    }

    return { id, text, x, y, color, alpha: 1, scale, life: 0 };
  }

  public release(ft: FloatingText): void {
    if (this.pool.length < this.maxSize) {
      this.pool.push(ft);
    }
  }

  public clear(): void {
    this.pool = [];
  }
}

export const particlePool = new ParticlePool();
export const floatingTextPool = new FloatingTextPool();

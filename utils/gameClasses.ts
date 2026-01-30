
import { Point, Card } from '../types';
import { TILE_SIZE } from '../constants';

export class MalwarePacket {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  path: Point[];
  pathIndex: number = 0;
  isDead: boolean = false;
  radius: number = 10;
  type: string;

  constructor(path: Point[], stats: { hp: number, speed: number }, type: string = 'STANDARD') {
    this.path = path;
    this.x = path[0].x * TILE_SIZE + TILE_SIZE / 2;
    this.y = path[0].y * TILE_SIZE + TILE_SIZE / 2;
    this.maxHp = stats.hp;
    this.hp = stats.hp;
    this.speed = stats.speed;
    this.type = type;
  }

  update(deltaTime: number) {
    if (this.pathIndex >= this.path.length - 1) return true; // Reached end

    const target = this.path[this.pathIndex + 1];
    const tx = target.x * TILE_SIZE + TILE_SIZE / 2;
    const ty = target.y * TILE_SIZE + TILE_SIZE / 2;

    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.speed) {
      this.x = tx;
      this.y = ty;
      this.pathIndex++;
    } else {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#FF3B3B';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // HP Bar
    const barWidth = 20;
    ctx.fillStyle = '#330000';
    ctx.fillRect(this.x - 10, this.y - 15, barWidth, 4);
    ctx.fillStyle = '#FF3B3B';
    ctx.fillRect(this.x - 10, this.y - 15, (this.hp / this.maxHp) * barWidth, 4);
  }
}

export class SecurityNode {
  x: number;
  y: number;
  gridX: number;
  gridY: number;
  card: Card;
  cooldown: number = 0;
  range: number;
  damage: number;
  fireRate: number;
  type: string;

  constructor(gx: number, gy: number, card: Card) {
    this.gridX = gx;
    this.gridY = gy;
    this.x = gx * TILE_SIZE + TILE_SIZE / 2;
    this.y = gy * TILE_SIZE + TILE_SIZE / 2;
    this.card = card;
    this.range = (card.stats?.range || 2) * TILE_SIZE;
    this.damage = card.stats?.damage || 10;
    this.fireRate = card.stats?.fireRate || 1;
    this.type = card.stats?.nodeType || 'LASER';
  }

  findTarget(enemies: MalwarePacket[]): MalwarePacket | null {
    let closest: MalwarePacket | null = null;
    let minDist = Infinity;

    for (const enemy of enemies) {
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.range && dist < minDist) {
        minDist = dist;
        closest = enemy;
      }
    }
    return closest;
  }

  update(deltaTime: number, enemies: MalwarePacket[], fireCallback: (node: SecurityNode, target: MalwarePacket) => void) {
    if (this.cooldown > 0) {
      this.cooldown -= deltaTime;
    } else {
      const target = this.findTarget(enemies);
      if (target) {
        fireCallback(this, target);
        this.cooldown = 1 / this.fireRate;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = '#3DDCFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x - 15, this.y - 15, 30, 30);
    
    // Icon based on type
    ctx.fillStyle = '#3DDCFF';
    ctx.font = '10px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText(this.type[0], this.x, this.y + 4);

    // Range Circle (optional highlight)
  }
}

export class FirewallBuffer {
  x: number;
  y: number;
  target: MalwarePacket;
  speed: number = 5;
  damage: number;
  isDead: boolean = false;

  constructor(x: number, y: number, target: MalwarePacket, damage: number) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
  }

  update() {
    if (this.target.hp <= 0) {
      this.isDead = true;
      return;
    }

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.speed) {
      this.target.hp -= this.damage;
      this.isDead = true;
    } else {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#3DDCFF';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

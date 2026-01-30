
import { Point, Card } from '../types';
import { TILE_SIZE } from '../constants';

export class MalwarePacket {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  baseSpeed: number;
  path: Point[];
  pathIndex: number = 0;
  isDead: boolean = false;
  radius: number = 10;
  type: string;
  slowFactor: number = 1;

  constructor(path: Point[], stats: { hp: number, speed: number }, type: string = 'STANDARD') {
    this.path = path;
    this.x = path[0].x * TILE_SIZE + TILE_SIZE / 2;
    this.y = path[0].y * TILE_SIZE + TILE_SIZE / 2;
    this.maxHp = stats.hp;
    this.hp = stats.hp;
    this.baseSpeed = stats.speed;
    this.speed = stats.speed;
    this.type = type;
  }

  update(deltaTime: number) {
    if (this.pathIndex >= this.path.length - 1) return true;

    const currentSpeed = this.baseSpeed * this.slowFactor;
    // Reset slow factor for next frame
    this.slowFactor = 1;

    const target = this.path[this.pathIndex + 1];
    const tx = target.x * TILE_SIZE + TILE_SIZE / 2;
    const ty = target.y * TILE_SIZE + TILE_SIZE / 2;

    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < currentSpeed) {
      this.x = tx;
      this.y = ty;
      this.pathIndex++;
    } else {
      this.x += (dx / dist) * currentSpeed;
      this.y += (dy / dist) * currentSpeed;
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.slowFactor < 1 ? '#3DDCFF' : '#FF3B3B';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    const barWidth = 24;
    ctx.fillStyle = '#1A0000';
    ctx.fillRect(this.x - 12, this.y - 18, barWidth, 4);
    ctx.fillStyle = '#FF3B3B';
    ctx.fillRect(this.x - 12, this.y - 18, (this.hp / this.maxHp) * barWidth, 4);
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
  slowPower: number;
  
  // Live Metrics
  killCount: number = 0;
  upTime: number = 0;

  constructor(gx: number, gy: number, card: Card) {
    this.gridX = gx;
    this.gridY = gy;
    this.x = gx * TILE_SIZE + TILE_SIZE / 2;
    this.y = gy * TILE_SIZE + TILE_SIZE / 2;
    this.card = card;
    this.range = (card.stats?.range || 2) * TILE_SIZE;
    this.damage = card.stats?.damage || 0;
    this.fireRate = card.stats?.fireRate || 1;
    this.type = card.stats?.nodeType || 'LASER';
    this.slowPower = card.stats?.slowPower || 0;
  }

  update(deltaTime: number, enemies: MalwarePacket[], fireCallback: (node: SecurityNode, target: MalwarePacket) => void) {
    this.upTime += deltaTime;

    // Apply area effects like slowing
    if (this.slowPower > 0) {
      enemies.forEach(e => {
        const dist = Math.sqrt((e.x - this.x)**2 + (e.y - this.y)**2);
        if (dist < this.range) {
          e.slowFactor = Math.min(e.slowFactor, 1 - this.slowPower);
        }
      });
    }

    if (this.damage <= 0) return;

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

  setPosition(gx: number, gy: number) {
    this.gridX = gx;
    this.gridY = gy;
    this.x = gx * TILE_SIZE + TILE_SIZE / 2;
    this.y = gy * TILE_SIZE + TILE_SIZE / 2;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = '#3DDCFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x - 18, this.y - 18, 36, 36);
    
    ctx.fillStyle = '#3DDCFF';
    ctx.font = 'bold 12px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText(this.type.substring(0, 3), this.x, this.y + 4);
  }
}

export class FirewallBuffer {
  x: number;
  y: number;
  target: MalwarePacket;
  sourceNode?: SecurityNode;
  speed: number = 8;
  damage: number;
  isDead: boolean = false;

  constructor(x: number, y: number, target: MalwarePacket, damage: number, sourceNode?: SecurityNode) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.sourceNode = sourceNode;
  }

  update() {
    if (this.target.hp <= 0) { this.isDead = true; return; }
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.speed) {
      this.target.hp -= this.damage;
      if (this.target.hp <= 0 && this.sourceNode) {
        this.sourceNode.killCount++;
      }
      this.isDead = true;
    } else {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#9CFF57';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

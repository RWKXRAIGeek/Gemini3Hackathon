
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
  angle: number = 0;
  private trail: { x: number, y: number, life: number }[] = [];

  constructor(path: Point[], stats: { hp: number, speed: number }, type: string = 'STANDARD') {
    this.path = path;
    this.x = path[0].x * TILE_SIZE + TILE_SIZE / 2;
    this.y = path[0].y * TILE_SIZE + TILE_SIZE / 2;
    this.type = type;

    // Tactical Profile Scaling
    switch (this.type) {
      case 'SWARM_PACKET':
        this.radius = 8;
        this.maxHp = stats.hp * 0.6;
        this.baseSpeed = stats.speed * 1.4;
        break;
      case 'ARMORED_ELITE':
        this.radius = 15;
        this.maxHp = stats.hp * 2.5;
        this.baseSpeed = stats.speed * 0.7;
        break;
      case 'STEALTH_WORM':
        this.radius = 12;
        this.maxHp = stats.hp * 1.2;
        this.baseSpeed = stats.speed * 1.1;
        break;
      default:
        this.radius = 10;
        this.maxHp = stats.hp;
        this.baseSpeed = stats.speed;
        break;
    }
    
    this.hp = this.maxHp;
    this.speed = this.baseSpeed;
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
    
    if (dist > 0.1) {
      this.angle = Math.atan2(dy, dx);
    }

    // Update Trail (Data Leaks)
    if (Math.random() > 0.7) {
        this.trail.push({ 
            x: this.x + (Math.random() - 0.5) * 10, 
            y: this.y + (Math.random() - 0.5) * 10, 
            life: 1.0 
        });
    }
    this.trail.forEach(t => t.life -= deltaTime * 3);
    this.trail = this.trail.filter(t => t.life > 0);

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
    ctx.save();
    
    const isSlowed = this.slowFactor < 1;
    const primaryColor = isSlowed ? '#3DDCFF' : (this.type === 'STEALTH_WORM' ? '#E0FFFF' : '#FF3B3B');
    const secondaryColor = this.type === 'ARMORED_ELITE' ? '#FFA500' : primaryColor;
    
    // Draw Data Leak Trail
    ctx.fillStyle = primaryColor;
    this.trail.forEach(t => {
        ctx.globalAlpha = t.life * 0.5;
        ctx.fillRect(t.x - 1, t.y - 1, 2, 2);
    });
    ctx.globalAlpha = 1.0;

    ctx.fillStyle = primaryColor;
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;

    const time = Date.now();

    switch (this.type) {
      case 'SWARM_PACKET': {
        // SWARM_PACKET (The Mite): Arachnid shape with jittering legs
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Body
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius, this.radius * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs (Jittering)
        const jitter = Math.sin(time / 20) * 2;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const legAngle = (Math.PI / 4) + (i * Math.PI / 4);
          const lx = Math.cos(legAngle) * this.radius;
          const ly = Math.sin(legAngle) * this.radius;
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx * 1.8, ly + jitter);
        }
        ctx.stroke();

        // Spiked Tail
        ctx.beginPath();
        ctx.moveTo(-this.radius, 0);
        ctx.lineTo(-this.radius * 2, 0);
        ctx.stroke();
        break;
      }

      case 'ARMORED_ELITE': {
        // ARMORED_ELITE (The Beetle): Segmented carapace with mandibles
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Core Pulse
        const pulse = 0.5 + (Math.sin(time / 150) + 1) * 0.25;
        ctx.shadowBlur = 10 * pulse;
        ctx.shadowColor = secondaryColor;

        // Carapace segments
        ctx.fillStyle = '#660000';
        ctx.beginPath();
        ctx.roundRect(-this.radius, -this.radius * 0.8, this.radius * 0.6, this.radius * 1.6, 2);
        ctx.roundRect(-this.radius * 0.3, -this.radius, this.radius * 0.8, this.radius * 2, 2);
        ctx.roundRect(this.radius * 0.6, -this.radius * 0.8, this.radius * 0.4, this.radius * 1.6, 2);
        ctx.fill();
        ctx.stroke();

        // Mandibles
        ctx.beginPath();
        ctx.moveTo(this.radius, -this.radius * 0.4);
        ctx.lineTo(this.radius * 1.8, -this.radius * 0.8);
        ctx.moveTo(this.radius, this.radius * 0.4);
        ctx.lineTo(this.radius * 1.8, this.radius * 0.8);
        ctx.strokeStyle = secondaryColor;
        ctx.stroke();

        // Center Core
        ctx.fillStyle = secondaryColor;
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'STEALTH_WORM': {
        // STEALTH_WORM (The Centipede): Segmented body with flickering antennae
        const alpha = 0.2 + (Math.sin(time / 200) + 1) * 0.3;
        ctx.globalAlpha = alpha;
        
        // Head
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Segments
        for (let i = 1; i <= 3; i++) {
          const offset = i * this.radius * 1.2;
          const sx = this.x - Math.cos(this.angle) * offset;
          const sy = this.y - Math.sin(this.angle) * offset;
          ctx.beginPath();
          ctx.arc(sx, sy, this.radius * (0.8 - i * 0.15), 0, Math.PI * 2);
          ctx.fill();
        }

        // Antennae (Flickering)
        if (Math.random() > 0.3) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.beginPath();
            ctx.moveTo(this.radius * 0.5, -this.radius * 0.4);
            ctx.lineTo(this.radius * 1.5, -this.radius * 0.8);
            ctx.moveTo(this.radius * 0.5, this.radius * 0.4);
            ctx.lineTo(this.radius * 1.5, this.radius * 0.8);
            ctx.stroke();
            ctx.restore();
        }
        break;
      }

      default: {
        // STANDARD (The Virus): Glitch-orb
        ctx.translate(this.x, this.y);
        
        // Base Circle
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Glitch Scanlines (Noise)
        if (Math.random() > 0.5) {
            const gy = (Math.random() - 0.5) * this.radius * 2;
            const gw = this.radius * (1 + Math.random());
            ctx.clearRect(-gw/2, gy, gw, 1);
            ctx.fillRect(-gw/2 + 2, gy, gw, 1);
        }
        
        // Geometric edges
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(this.radius * 1.2, this.radius * 0.2);
        ctx.moveTo(-this.radius, -this.radius * 0.3);
        ctx.lineTo(-this.radius * 1.3, -this.radius * 0.1);
        ctx.stroke();
        break;
      }
    }

    ctx.restore();

    // HP Bar
    const barWidth = this.radius * 2.4;
    ctx.fillStyle = '#1A0000';
    ctx.fillRect(this.x - barWidth/2, this.y - this.radius - 12, barWidth, 4);
    ctx.fillStyle = primaryColor;
    ctx.fillRect(this.x - barWidth/2, this.y - this.radius - 12, (Math.max(0, this.hp) / this.maxHp) * barWidth, 4);
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
  
  // Reroute Interpolation State
  isRerouting: boolean = false;
  rerouteTimer: number = 0;
  startX: number = 0;
  startY: number = 0;
  targetX: number = 0;
  targetY: number = 0;
  readonly REROUTE_DURATION: number = 0.3; // 300ms as per specification

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

    // Handle Interpolated Rerouting
    if (this.isRerouting) {
      this.rerouteTimer += deltaTime;
      const t = Math.min(1, this.rerouteTimer / this.REROUTE_DURATION);
      // Expo Ease Out for a "snappy" high-tech feel
      const ease = (x: number) => x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
      const factor = ease(t);
      
      this.x = this.startX + (this.targetX - this.startX) * factor;
      this.y = this.startY + (this.targetY - this.startY) * factor;
      
      if (t >= 1) {
        this.isRerouting = false;
        this.x = this.targetX;
        this.y = this.targetY;
      }
    }

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
    // Legacy support for instant placement
    this.gridX = gx;
    this.gridY = gy;
    this.x = gx * TILE_SIZE + TILE_SIZE / 2;
    this.y = gy * TILE_SIZE + TILE_SIZE / 2;
    this.isRerouting = false;
  }

  startReroute(gx: number, gy: number) {
    this.gridX = gx;
    this.gridY = gy;
    this.startX = this.x;
    this.startY = this.y;
    this.targetX = gx * TILE_SIZE + TILE_SIZE / 2;
    this.targetY = gy * TILE_SIZE + TILE_SIZE / 2;
    this.rerouteTimer = 0;
    this.isRerouting = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    
    // Add a slight "glitch" jitter during rerouting
    if (this.isRerouting) {
      ctx.translate((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
      ctx.globalAlpha = 0.7 + Math.random() * 0.3;
    }

    ctx.strokeStyle = '#3DDCFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x - 18, this.y - 18, 36, 36);
    
    ctx.fillStyle = '#3DDCFF';
    ctx.font = 'bold 12px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText(this.type.substring(0, 3), this.x, this.y + 4);
    
    ctx.restore();
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

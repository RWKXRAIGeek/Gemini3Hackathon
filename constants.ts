
import { Card, CardType } from './types';

export const GRID_SIZE = 10;
export const TILE_SIZE = 60;
export const MAX_ENERGY = 30;
export const INITIAL_HP = 100;

export const MASTER_CARD_POOL: Record<string, Card> = {
  'node_laser_basic': {
    id: 'node_laser_basic',
    name: 'LASER_NODE_v1',
    description: 'High frequency focal beam. Single target.',
    cost: 5,
    type: CardType.SECURITY_NODE,
    rarity: 'COMMON',
    stats: { damage: 10, range: 3, fireRate: 1, nodeType: 'LASER' }
  },
  'node_plasma_aoe': {
    id: 'node_plasma_aoe',
    name: 'PLASMA_STORM_X',
    description: 'Deploys plasma clouds. AOE Damage.',
    cost: 12,
    type: CardType.SECURITY_NODE,
    rarity: 'RARE',
    stats: { damage: 8, range: 2, fireRate: 0.5, nodeType: 'PLASMA' }
  },
  'node_emp_pulse': {
    id: 'node_emp_pulse',
    name: 'EMP_PULSE_GEN',
    description: 'Slows down packets in range.',
    cost: 8,
    type: CardType.SECURITY_NODE,
    rarity: 'UNCOMMON',
    stats: { damage: 2, range: 2.5, fireRate: 0.8, nodeType: 'EMP' }
  },
  'patch_overclock': {
    id: 'patch_overclock',
    name: 'SYSTEM_OVERCLOCK',
    description: 'Increase fire rate of all nodes by 20% for 10s.',
    cost: 15,
    type: CardType.SYSTEM_OVERCLOCK,
    rarity: 'RARE'
  },
  'patch_repair': {
    id: 'patch_repair',
    name: 'REPAIR_SUBROUTINE',
    description: 'Restore 15% Kernel Core integrity.',
    cost: 10,
    type: CardType.TACTICAL_PATCH,
    rarity: 'COMMON'
  },
  'node_heavy_rail': {
    id: 'node_heavy_rail',
    name: 'RAILGUN_SENTINEL',
    description: 'Long range, armor piercing rounds.',
    cost: 20,
    type: CardType.SECURITY_NODE,
    rarity: 'LEGENDARY',
    stats: { damage: 45, range: 6, fireRate: 0.2, nodeType: 'RAILGUN' }
  }
};

export const INITIAL_DECK: Card[] = [
  MASTER_CARD_POOL['node_laser_basic'],
  MASTER_CARD_POOL['node_laser_basic'],
  MASTER_CARD_POOL['node_emp_pulse'],
  MASTER_CARD_POOL['patch_repair'],
  MASTER_CARD_POOL['node_laser_basic'],
];

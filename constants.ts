
import { Card, CardType } from './types';

export const GRID_SIZE = 10;
export const TILE_SIZE = 60;
export const MAX_ENERGY = 50;
export const INITIAL_HP = 100;

export const MASTER_CARD_POOL: Record<string, Card> = {
  'basic_firewall': {
    id: 'basic_firewall',
    name: 'Basic Firewall',
    description: 'Baseline sector isolation. Blocks and retaliates slightly.',
    cost: 4,
    type: CardType.SECURITY_NODE,
    rarity: 'COMMON',
    fusionTargetId: 'quantum_gate',
    stats: { damage: 2, range: 1.2, fireRate: 0.5, nodeType: 'FIREWALL' }
  },
  'quantum_gate': {
    id: 'quantum_gate',
    name: 'Quantum Gate',
    description: 'Fused Evolution: Retaliatory energy pulse against armored elite packets.',
    cost: 8,
    type: CardType.SECURITY_NODE,
    rarity: 'RARE',
    stats: { damage: 15, range: 1.5, fireRate: 1.2, nodeType: 'QUANTUM' }
  },
  'scout_sensor': {
    id: 'scout_sensor',
    name: 'Scout Sensor',
    description: 'Early detection of high-speed Swarm Packets.',
    cost: 3,
    type: CardType.SECURITY_NODE,
    rarity: 'COMMON',
    fusionTargetId: 'deep_packet_inspector',
    stats: { damage: 4, range: 4, fireRate: 1.5, nodeType: 'SCOUT' }
  },
  'deep_packet_inspector': {
    id: 'deep_packet_inspector',
    name: 'Deep Packet Inspector',
    description: 'Fused Evolution: Reveals hidden sub-routines. High detection range.',
    cost: 7,
    type: CardType.SECURITY_NODE,
    rarity: 'RARE',
    stats: { damage: 8, range: 6, fireRate: 2.0, nodeType: 'DPI' }
  },
  'static_burst': {
    id: 'static_burst',
    name: 'Static Burst',
    description: 'Threat stabilization via electronic interference.',
    cost: 3,
    type: CardType.SECURITY_NODE,
    rarity: 'COMMON',
    fusionTargetId: 'neural_tempest',
    stats: { damage: 2, range: 2.5, fireRate: 0.5, nodeType: 'STATIC' }
  },
  'neural_tempest': {
    id: 'neural_tempest',
    name: 'Neural Tempest',
    description: 'Fused Evolution: Massive AoE shock to stabilize sectors.',
    cost: 7,
    type: CardType.SECURITY_NODE,
    rarity: 'RARE',
    stats: { damage: 12, range: 3.5, fireRate: 1.0, nodeType: 'TEMPEST' }
  },
  'corrosive_script': {
    id: 'corrosive_script',
    name: 'Corrosive Script',
    description: 'Degrades Boss Packets via persistent erosion.',
    cost: 5,
    type: CardType.SECURITY_NODE,
    rarity: 'UNCOMMON',
    stats: { damage: 20, range: 3, fireRate: 0.8, nodeType: 'CORROSIVE' }
  },
  'logic_bomb': {
    id: 'logic_bomb',
    name: 'Logic Bomb',
    description: 'Clears dense clusters at mainframe junctions.',
    cost: 6,
    type: CardType.TACTICAL_PATCH,
    rarity: 'RARE',
    stats: { damage: 60, range: 2, nodeType: 'EXPLOSIVE' }
  },
  'vpn_tunnel': {
    id: 'vpn_tunnel',
    name: 'VPN Tunnel',
    description: 'Slows malware velocity via rerouting.',
    cost: 4,
    type: CardType.SECURITY_NODE,
    rarity: 'UNCOMMON',
    stats: { damage: 1, range: 3, fireRate: 0.5, nodeType: 'VPN', slowPower: 0.4 }
  },
  'protocol_sentry': {
    id: 'protocol_sentry',
    name: 'Protocol Sentry',
    description: 'Balanced general-purpose threat mitigation.',
    cost: 6,
    type: CardType.SECURITY_NODE,
    rarity: 'COMMON',
    stats: { damage: 10, range: 4, fireRate: 1.8, nodeType: 'SENTRY' }
  },
  'synapse_fryer': {
    id: 'synapse_fryer',
    name: 'Synapse Fryer',
    description: 'High-energy plasma designed to pierce multi-layered armor.',
    cost: 8,
    type: CardType.SECURITY_NODE,
    rarity: 'RARE',
    stats: { damage: 35, range: 5, fireRate: 1.2, nodeType: 'PLASMA' }
  },
  'brain_jack': {
    id: 'brain_jack',
    name: 'Brain-Jack',
    description: 'Forces targeted malware to attack other infections.',
    cost: 9,
    type: CardType.SECURITY_NODE,
    rarity: 'LEGENDARY',
    stats: { damage: 15, range: 4, fireRate: 0.5, nodeType: 'JACK' }
  }
};

export const INITIAL_DECK: Card[] = [
  MASTER_CARD_POOL['basic_firewall'],
  MASTER_CARD_POOL['basic_firewall'],
  MASTER_CARD_POOL['scout_sensor'],
  MASTER_CARD_POOL['scout_sensor'],
  MASTER_CARD_POOL['static_burst'],
  MASTER_CARD_POOL['static_burst'],
  MASTER_CARD_POOL['protocol_sentry'],
];

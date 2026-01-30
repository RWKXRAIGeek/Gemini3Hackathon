
export enum CardType {
  SECURITY_NODE = 'SECURITY_NODE',
  TACTICAL_PATCH = 'TACTICAL_PATCH',
  SYSTEM_OVERCLOCK = 'SYSTEM_OVERCLOCK'
}

export interface Card {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: CardType;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';
  stats?: {
    damage?: number;
    range?: number;
    fireRate?: number;
    nodeType?: string;
  };
}

export interface GameState {
  kernelHP: number;
  energyPoints: number;
  waveNumber: number;
  hand: Card[];
  deck: Card[];
  discard: Card[];
  isProcessing: boolean;
  statusLog: string[];
  lastGeminiResponse?: AegisResponse;
}

export interface AegisResponse {
  system_status: {
    intensity_band: 'OVERWHELMED' | 'MASTERY' | 'SWEET-SPOT';
    calculated_threat_level: number;
    malware_encryption_strength: string;
  };
  wave_parameters: {
    wave_difficulty: number;
    malware_type: string;
    stat_multipliers: {
      hp: number;
      speed: number;
    };
  };
  exploit_kit_update: {
    suggested_cards_ids: string[];
    reasoning: string;
  };
  kernel_log_message: string;
}

export interface Point {
  x: number;
  y: number;
}

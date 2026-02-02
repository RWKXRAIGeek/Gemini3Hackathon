
export enum CardType {
  SECURITY_NODE = 'SECURITY_NODE',
  TACTICAL_PATCH = 'TACTICAL_PATCH',
  SYSTEM_OVERCLOCK = 'SYSTEM_OVERCLOCK',
  FIREWALL = 'FIREWALL'
}

export interface Card {
  id: string;
  name: string;
  description: string;
  reasoningTip: string; // Tactical advice snippet
  cost: number;
  type: CardType;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';
  fusionTargetId?: string;
  stats?: {
    damage?: number;
    range?: number;
    fireRate?: number;
    nodeType?: string;
    slowPower?: number;
  };
}

export interface VisualDiagnosticResponse {
  weakest_sector: string;
  analysis: string;
  suggested_card_id: string;
  severity_level: 'High' | 'Medium' | 'Low';
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
  tactical_analysis: {
    skill_gap_identified: string;
    causal_justification: string;
  };
  kernel_log_message: string;
}

export interface SessionSummary {
  waveReached: number;
  defeatedCount: number;
  timestamp: number;
}

export interface GameState {
  kernelHP: number;
  energyPoints: number;
  waveNumber: number;
  hand: Card[];
  deck: Card[];
  discard: Card[];
  isProcessing: boolean;
  isScanning: boolean;
  isGameStarted: boolean;
  isTacticalOverlayOpen: boolean;
  statusLog: string[];
  lastGeminiResponse?: AegisResponse;
  lastDiagnostic?: VisualDiagnosticResponse;
  history: SessionSummary[];
  redemptionCard?: Card;
}

export interface Point {
  x: number;
  y: number;
}

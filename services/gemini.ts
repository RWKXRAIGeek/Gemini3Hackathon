
import { GoogleGenAI, Type } from "@google/genai";
import { AegisResponse, GameState } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getAegisReasoning = async (
  gameState: GameState,
  nodesCount: number,
  enemiesDefeated: number
): Promise<AegisResponse | null> => {
  try {
    const prompt = `
      CURRENT MAINFRAME TELEMETRY:
      - Kernel Core Integrity: ${gameState.kernelHP}%
      - Current Wave: ${gameState.waveNumber}
      - Energy Points: ${gameState.energyPoints}
      - Security Nodes Online: ${nodesCount}
      - Malware Packets Purged: ${enemiesDefeated}
      - Hand Density: ${gameState.hand.length} cards
      - Exploit Kit Inventory: ${gameState.deck.length + gameState.discard.length} cards

      Analyze the strategy gap. If the player is struggling (HP < 50%), offer Redemption Cards. 
      If the player is dominating (HP > 90% at Wave 5+), increase Malware Encryption Strength.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: `You are the Aegis OS Kernel, a tactical defensive AI. 
        Analyze the game state JSON and return a strategic response. 
        Tone: Cold, analytical, cyberpunk, terminal-style.
        Only output valid JSON.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            system_status: {
              type: Type.OBJECT,
              properties: {
                intensity_band: { type: Type.STRING },
                calculated_threat_level: { type: Type.NUMBER },
                malware_encryption_strength: { type: Type.STRING }
              },
              required: ["intensity_band", "calculated_threat_level", "malware_encryption_strength"]
            },
            wave_parameters: {
              type: Type.OBJECT,
              properties: {
                wave_difficulty: { type: Type.NUMBER },
                malware_type: { type: Type.STRING },
                stat_multipliers: {
                  type: Type.OBJECT,
                  properties: {
                    hp: { type: Type.NUMBER },
                    speed: { type: Type.NUMBER }
                  },
                  required: ["hp", "speed"]
                }
              },
              required: ["wave_difficulty", "malware_type", "stat_multipliers"]
            },
            exploit_kit_update: {
              type: Type.OBJECT,
              properties: {
                suggested_cards_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
                reasoning: { type: Type.STRING }
              },
              required: ["suggested_cards_ids", "reasoning"]
            },
            kernel_log_message: { type: Type.STRING }
          },
          required: ["system_status", "wave_parameters", "exploit_kit_update", "kernel_log_message"]
        }
      },
    });

    const result = JSON.parse(response.text || '{}');
    return result as AegisResponse;
  } catch (error) {
    console.error("Aegis Kernel Error:", error);
    // Fallback logic
    return {
      system_status: {
        intensity_band: 'SWEET-SPOT',
        calculated_threat_level: 0.5,
        malware_encryption_strength: 'Medium'
      },
      wave_parameters: {
        wave_difficulty: 1.0,
        malware_type: 'STANDARD_PACKET',
        stat_multipliers: { hp: 1.0, speed: 1.0 }
      },
      exploit_kit_update: {
        suggested_cards_ids: ['node_laser_basic', 'node_emp_pulse', 'patch_repair'],
        reasoning: 'API_CONNECTION_INTERRUPTED... DEPLOYING DEFAULT KIT.'
      },
      kernel_log_message: 'CONNECTION STABILITY COMPROMISED. LOCAL PROTOCOLS ENGAGED.'
    };
  }
};

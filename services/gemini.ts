
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
      - Exploit Kit Inventory: ${gameState.deck.length + gameState.discard.length} cards

      STRATEGIC DIRECTIVE:
      - If player has duplicate cards, encourage FUSION into (Quantum Gate, Deep Packet Inspector, Neural Tempest).
      - If swarm density is high, suggest Neural Shock or Intrusion Detection.
      - If boss/armored packets are detected, suggest Synapse Fryer or Corrosive Script.
      - Analyze the performance and provide a tactical cyberpunk response.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: `You are the Aegis OS Kernel. 
        Analyze the game state and return a strategic JSON response. 
        Role: Tactical Reasoner. Focus on "Power Compression" via Fusion logic.
        Valid Card IDs: basic_firewall, quantum_gate, scout_sensor, deep_packet_inspector, static_burst, neural_tempest, corrosive_script, logic_bomb, vpn_tunnel, protocol_sentry, synapse_fryer, brain_jack.`,
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
    return null;
  }
};

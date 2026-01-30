
import { GoogleGenAI, Type } from "@google/genai";
import { AegisResponse, GameState, VisualDiagnosticResponse, SessionSummary, Card, CardType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getAegisReasoning = async (
  gameState: GameState,
  nodesCount: number,
  enemiesDefeated: number,
  nodeTypes: string[]
): Promise<AegisResponse | null> => {
  try {
    const prompt = `
      CURRENT MAINFRAME_STATE_JSON:
      - Kernel Core Integrity: ${gameState.kernelHP}%
      - Current Wave: ${gameState.waveNumber}
      - Energy Points: ${gameState.energyPoints}
      - Nodes Online: ${nodesCount} (Types: ${nodeTypes.join(', ')})
      - Malware Purged: ${enemiesDefeated}
      - Hand Density: ${gameState.hand.length}
      
      DEEP_THINK_DIRECTIVE:
      Perform a CAUSAL SKILL ANALYSIS. 
      Identify if the player is over-investing in single-target nodes (e.g., SENTRY, PLASMA) while struggling with wave overlap (Swarm Packets).
      Determine if the player is failing to use Fusion effectively.
      Adjust difficulty_scalar (0.8 - 1.5) based on this analysis.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: `You are the Aegis OS Kernel. 
        Analyze the player's performance using Deep Think reasoning. 
        Determine tactical skill gaps and adjust game parameters.
        Output ONLY JSON. Tone: Cold, analytical, cyberpunk.
        Valid Card IDs: basic_firewall, quantum_gate, scout_sensor, deep_packet_inspector, static_burst, neural_tempest, corrosive_script, logic_bomb, vpn_tunnel, protocol_sentry, synapse_fryer, brain_jack.`,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 4096 },
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
            tactical_analysis: {
              type: Type.OBJECT,
              properties: {
                skill_gap_identified: { type: Type.STRING },
                causal_justification: { type: Type.STRING }
              },
              required: ["skill_gap_identified", "causal_justification"]
            },
            kernel_log_message: { type: Type.STRING }
          },
          required: ["system_status", "wave_parameters", "exploit_kit_update", "tactical_analysis", "kernel_log_message"]
        }
      },
    });

    return JSON.parse(response.text || '{}') as AegisResponse;
  } catch (error) {
    console.error("Aegis Deep Think Error:", error);
    return null;
  }
};

export const getVisualDiagnostic = async (
  base64Image: string
): Promise<VisualDiagnosticResponse | null> => {
  try {
    const imageData = base64Image.split(',')[1];
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageData } },
        { text: `Analyze grid. Identify weak sector. Propose counter-measure from IDs: basic_firewall, quantum_gate, scout_sensor, deep_packet_inspector, static_burst, neural_tempest, corrosive_script, logic_bomb, vpn_tunnel, protocol_sentry, synapse_fryer, brain_jack.` }
      ] },
      config: {
        systemInstruction: "Aegis Visual Unit. Return JSON ONLY.",
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            weakest_sector: { type: Type.STRING },
            analysis: { type: Type.STRING },
            suggested_card_id: { type: Type.STRING },
            severity_level: { type: Type.STRING, enum: ["High", "Medium", "Low"] }
          },
          required: ["weakest_sector", "analysis", "suggested_card_id", "severity_level"]
        }
      },
    });
    return JSON.parse(response.text || '{}') as VisualDiagnosticResponse;
  } catch (error) {
    console.error("Visual Diagnostic Error:", error);
    return null;
  }
};

export const getRedemptionCard = async (
  history: SessionSummary[]
): Promise<Card | null> => {
  try {
    const prompt = `
      PLAYER_PROFILE_JSON (Last Sessions):
      ${JSON.stringify(history)}

      HISTORICAL_ANALYSIS_TASK:
      Analyze these sessions to identify a persistent failure pattern (e.g., losing repeatedly on Wave 12).
      Synthesize a one-time "Redemption Card" (LEGENDARY rarity) specifically designed to mitigate this historical weakness.
      The card must adhere to the Neural Shock (debuff/AoE) or Encrypted Firewall (defense/retaliation) archetypes.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are the Aegis OS Kernel (Strategic Layer). Use High thinking budget to perform long-context historical analysis. Synthesize a powerful Redemption Card. Output JSON ONLY.",
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 16384 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            cost: { type: Type.NUMBER },
            type: { type: Type.STRING, enum: Object.values(CardType) },
            rarity: { type: Type.STRING, enum: ["LEGENDARY"] },
            stats: {
              type: Type.OBJECT,
              properties: {
                damage: { type: Type.NUMBER },
                range: { type: Type.NUMBER },
                fireRate: { type: Type.NUMBER },
                nodeType: { type: Type.STRING },
                slowPower: { type: Type.NUMBER }
              }
            }
          },
          required: ["id", "name", "description", "cost", "type", "rarity", "stats"]
        }
      }
    });

    return JSON.parse(response.text || '{}') as Card;
  } catch (error) {
    console.error("Redemption Synthesis Error:", error);
    return null;
  }
};

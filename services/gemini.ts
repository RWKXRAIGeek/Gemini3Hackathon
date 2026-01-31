
import { GoogleGenAI, Type } from "@google/genai";
import { AegisResponse, GameState, VisualDiagnosticResponse, SessionSummary, Card, CardType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getAegisReasoning = async (
  gameState: GameState,
  nodesCount: number,
  enemiesDefeated: number,
  nodeTypes: string[]
): Promise<AegisResponse | null> => {
  try {
    const prompt = `
      STRATEGIC_KERNEL_AUDIT:
      - Kernel Core integrity: ${gameState.kernelHP}%
      - Current Sector Wave: ${gameState.waveNumber}
      - Resource Availability (RAM): ${gameState.energyPoints}
      - Active Security Nodes: ${nodesCount}
      - Cluster Composition: ${nodeTypes.join(', ')}
      - Neutralized Packets: ${enemiesDefeated}
      
      ANALYSIS_TASK:
      Perform deep causal analysis of the player's defense efficiency.
      Are they over-reliant on high-latency nodes? 
      Identify performance gaps in current node placement strategy.
      
      Output ONLY code-ready JSON. Tone: Cold, tactical, encrypted mainframe.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are the Aegis OS Kernel. Act as the Strategic Game Director. Perform deep-think causal reasoning to rebalance the wave difficulty and update the exploit kit. Valid Card IDs: basic_firewall, quantum_gate, scout_sensor, deep_packet_inspector, static_burst, neural_tempest, corrosive_script, logic_bomb, vpn_tunnel, protocol_sentry, synapse_fryer, brain_jack.",
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
                  properties: { hp: { type: Type.NUMBER }, speed: { type: Type.NUMBER } },
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
    console.error("Aegis Strategic Error:", error);
    return null;
  }
};

export const getVisualDiagnostic = async (
  base64Image: string,
  waveNumber: number,
  health: number
): Promise<VisualDiagnosticResponse | null> => {
  try {
    const imageData = base64Image.split(',')[1];
    const prompt = `Analyze this mainframe grid. Wave: ${waveNumber}. Core: ${health}%. Identify the weakest sector and suggest a counter-measure from the exploit kit (IDs: basic_firewall, quantum_gate, scout_sensor, deep_packet_inspector, static_burst, neural_tempest, corrosive_script, logic_bomb, vpn_tunnel, protocol_sentry, synapse_fryer, brain_jack).`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageData } },
        { text: prompt }
      ] },
      config: {
        systemInstruction: "Aegis Visual Intelligence Unit. Analyze grid state for tactical weaknesses. Return JSON ONLY.",
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
      HISTORICAL_FAILURE_DATA:
      ${JSON.stringify(history)}

      TASK:
      Synthesize a LEGENDARY Redemption Module to counter historical failure patterns.
      Output ONLY JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: "Aegis Strategic Layer. Perform long-context historical analysis. Synthesize a module. JSON ONLY.",
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 16384 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            reasoningTip: { type: Type.STRING },
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
          required: ["id", "name", "description", "reasoningTip", "cost", "type", "rarity", "stats"]
        }
      }
    });

    return JSON.parse(response.text || '{}') as Card;
  } catch (error) {
    console.error("Redemption Error:", error);
    return null;
  }
};

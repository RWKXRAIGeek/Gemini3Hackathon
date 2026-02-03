
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AegisResponse, GameState, VisualDiagnosticResponse, SessionSummary, Card, CardType } from "../types";

// Initialized with process.env.API_KEY directly as per instructions
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Utility to perform exponential backoff retries for API calls.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let delay = 2000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const errorMsg = error?.message || "";
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED");
      
      // Handle the specific error mentioned in the guidelines for model selection
      const isNotFound = errorMsg.includes("Requested entity was not found.");
      if (isNotFound) {
        console.error("Critical API Error: Project/Model not found. Plan upgrade or key reset may be required.");
        throw error;
      }

      if (isRateLimit && i < maxRetries - 1) {
        console.warn(`[AEGIS] Rate limit reached. Executing backoff sequence: ${delay}ms... (Retry ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; 
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max communication attempts exhausted.");
}

/**
 * Custom base64 decoder for environments without standard atob or for raw bytes
 */
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM data from the Gemini TTS API into an AudioBuffer
 */
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Vocalizes text using the gemini-2.5-flash-preview-tts model with retry logic
 */
export const speak = async (text: string): Promise<void> => {
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say with a cold, tactical, military-AI tone: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    }));

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBytes = decodeBase64(base64Audio);
      const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    }
  } catch (error) {
    console.error("Aegis Vocalization Error:", error);
  }
};

export const getAegisReasoning = async (
  gameState: GameState,
  nodesCount: number,
  enemiesDefeated: number,
  nodeTypes: string[]
): Promise<AegisResponse | null> => {
  const fallback: AegisResponse = {
    system_status: { intensity_band: 'SWEET-SPOT', calculated_threat_level: 0.5, malware_encryption_strength: 'Low' },
    wave_parameters: { wave_difficulty: 1.0, malware_type: 'STANDARD', stat_multipliers: { hp: 1.0, speed: 1.0 } },
    exploit_kit_update: { suggested_cards_ids: ['basic_firewall', 'protocol_sentry'], reasoning: 'Communication bottleneck. Deploying default mitigation kit.' },
    tactical_analysis: { skill_gap_identified: 'N/A', causal_justification: 'Connectivity interrupted.' },
    kernel_log_message: '[SYS] SIGNAL_LOSS: LOCAL_RECOVERY_ENGAGED.'
  };

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
      Identify if the player is over-investing in single-target nodes while struggling with wave overlap.
      Adjust difficulty_scalar (0.8 - 1.5) based on this analysis.
    `;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: `You are the Aegis OS Kernel. 
        Analyze the player's performance using Deep Think reasoning. 
        Output ONLY JSON. Tone: Cold, analytical, cyberpunk.`,
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
    }));

    const rawJson = JSON.parse(response.text || '{}');
    
    return {
      system_status: {
        intensity_band: rawJson.system_status?.intensity_band || 'SWEET-SPOT',
        calculated_threat_level: rawJson.system_status?.calculated_threat_level ?? 0.5,
        malware_encryption_strength: rawJson.system_status?.malware_encryption_strength || 'Medium'
      },
      wave_parameters: {
        wave_difficulty: Math.max(0.8, Math.min(1.5, rawJson.wave_parameters?.wave_difficulty ?? 1.0)),
        malware_type: rawJson.wave_parameters?.malware_type || 'STANDARD',
        stat_multipliers: {
          hp: rawJson.wave_parameters?.stat_multipliers?.hp ?? 1.0,
          speed: rawJson.wave_parameters?.stat_multipliers?.speed ?? 1.0
        }
      },
      exploit_kit_update: {
        suggested_cards_ids: (Array.isArray(rawJson.exploit_kit_update?.suggested_cards_ids) && rawJson.exploit_kit_update.suggested_cards_ids.length > 0)
          ? rawJson.exploit_kit_update.suggested_cards_ids 
          : ['basic_firewall', 'protocol_sentry', 'scout_sensor'],
        reasoning: rawJson.exploit_kit_update?.reasoning || 'Deploying standard mitigation protocols.'
      },
      tactical_analysis: {
        skill_gap_identified: rawJson.tactical_analysis?.skill_gap_identified || 'Nominal performance.',
        causal_justification: rawJson.tactical_analysis?.causal_justification || 'Parameters within expected bounds.'
      },
      kernel_log_message: rawJson.kernel_log_message || '[SYS] LOCAL_OS_KERNEL_ENGAGED.'
    };
  } catch (error) {
    console.error("Aegis Deep Think Error:", error);
    return fallback;
  }
};

export const getVisualDiagnostic = async (
  base64Image: string
): Promise<VisualDiagnosticResponse | null> => {
  try {
    const imageData = base64Image.split(',')[1];
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageData } },
        { text: `Analyze grid. Identify weak sector. Propose counter-measure.` }
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
    }));
    
    const rawJson = JSON.parse(response.text || '{}');
    
    return {
      weakest_sector: rawJson.weakest_sector || 'Sector Alpha-0',
      analysis: rawJson.analysis || 'Scan identified minor vulnerabilities.',
      suggested_card_id: rawJson.suggested_card_id || 'protocol_sentry',
      severity_level: rawJson.severity_level || 'Low'
    };
  } catch (error) {
    console.error("Visual Diagnostic Error:", error);
    return {
      weakest_sector: 'Scan Failed',
      analysis: 'Visual processor offline. Manual audit recommended.',
      suggested_card_id: 'protocol_sentry',
      severity_level: 'Low'
    };
  }
};

export const getRedemptionCard = async (
  history: SessionSummary[]
): Promise<Card | null> => {
  try {
    const prompt = `
      PLAYER_PROFILE_JSON (Last Sessions):
      ${JSON.stringify(history)}

      Synthesize a one-time "Redemption Card" (LEGENDARY rarity) specifically designed to mitigate a persistent historical weakness.
    `;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are the Aegis OS Kernel. Synthesize a powerful Redemption Card. Output JSON ONLY.",
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 4096 },
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
    }));

    const rawJson = JSON.parse(response.text || '{}');
    if (!rawJson.name || !rawJson.id) return null;
    return rawJson as Card;
  } catch (error) {
    console.error("Redemption Synthesis Error:", error);
    return null;
  }
};

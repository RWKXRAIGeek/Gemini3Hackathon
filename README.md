## Copyright and License

Copyright (c) 2026 Ronald Kuseski.

All rights reserved. This code is provided solely for evaluation in the Gemini 3 Hackathon.
You may not use, copy, modify, merge, publish, distribute, sublicense, or sell any part of
this codebase without the author's explicit written permission.

Project Overview: Circuit Breach
Circuit Breach is a high-fidelity, cyberpunk-themed roguelike tower defense application that replaces static game logic with the Aegis OS Kernel—a reasoning-driven game director powered by Gemini 3. The project moves beyond traditional hardcoded difficulty, utilizing Deep Think reasoning to analyze player "telemetry" (HP, energy, node placement) and perform real-time grid stabilization.

--------------------------------------------------------------------------------
1. Core Innovation: The Aegis OS Kernel
The Aegis OS Kernel functions as an autonomous, reasoning-driven Game Director. Unlike standard AI, the Kernel identifies specific "Skill Gaps" in player behavior—such as a bias toward high-latency single-target nodes when facing swarm threats.
• Intensity Band Classification: The Kernel evaluates performance across three states:
    ◦ OVERWHELMED: High malware density or rapid HP loss. Triggering Redemption Protocols to synthesize legendary cards and reduce difficulty.
    ◦ MASTERY: Zero leaks and resource surplus. Increasing Malware Encryption Strength to restore strategic tension.
    ◦ SWEET-SPOT: Ideal challenge level; the Kernel maintains parameters while injecting tactical variety.
• Adaptive Difficulty Calibration: The AI calculates a dynamic wave_difficulty scalar (0.8 to 1.5) that serves as a global multiplier for malware HP and velocity.

--------------------------------------------------------------------------------
2. Technical Execution: Deterministic Integration
To ensure professional technical execution, the system utilizes a strict JSON Schema Specification. This protocol acts as the bridge between the Gemini 3 Reasoning Engine and the game’s runtime (React/Canvas), ensuring the AI’s decisions are translated into deterministic state updates.
• The Schema Structure: The AI must return code-ready JSON containing:
    ◦ system_status: High-level diagnostic summary (Intensity Band, Threat Level).
    ◦ wave_parameters: Numeric injection parameters for the subsequent breach (Difficulty scalar, Malware Type, Stat Multipliers).
    ◦ exploit_kit_update: Strategic deck reconfiguration (Suggested Card IDs and AI reasoning).
    ◦ tactical_analysis: Deep Think results identifying the causal link between player behavior and difficulty shifts.
• Safety & Stability: Enforcing this schema prevents engine crashes by ensuring the frontend can safely assume the presence of all required data fields.

--------------------------------------------------------------------------------
3. Multimodal & Visual Intelligence
Circuit Breach leverages the full suite of Gemini 3 capabilities to create an immersive "Mainframe" experience:
• Visual Intelligence Unit: The application uses Gemini’s vision capabilities to "scan" the 10x10 grid state via canvas data, identifying weak sectors and recommending specific security patches.
• Tactical Vocalization: System updates are narrated using a tactical "Kore" voice profile, providing an immersive terminal atmosphere.
• CRT Aesthetics: The UI utilizes Tailwind CSS with custom GLSL-inspired animations, chromatic aberration, and scanline overlays to simulate a high-security hacker terminal.

--------------------------------------------------------------------------------
4. Strategic Channel & Redemption Protocol
The project features a Strategic Channel for deep-horizon reasoning.
• Causal Analysis: When a persistent failure pattern is detected (e.g., failing at Wave 10), the Kernel performs a causal analysis of the "Operator's" history.
• Card Fusion & Synthesis: Players can fuse identical protocols into upgraded nodes. If the AI detects a player is "Overwhelmed," it synthesizes a Redemption Card—a bespoke, high-bandwidth counter-measure designed to patch the identified strategy flaw.

--------------------------------------------------------------------------------
Technical Summary for Judges
• Model Utilization: Gemini 3 Pro (Strategic/Deep Think) & Gemini 3 Flash (Tactical/Vision).
• Innovation: Reasoning-driven Dynamic Difficulty Adjustment (DDA) vs. hardcoded heuristics.
• Technical Complexity: Strict JSON Schema-driven state injection and multimodal (Vision/Text) feedback loop.
• UI/UX: High-fidelity CRT terminal aesthetic with an integrated "Kernel Log" that exposes the AI’s internal reasoning chain for player transparency


import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, GameState, Point, CardType, SessionSummary } from './types';
import { GRID_SIZE, TILE_SIZE, INITIAL_DECK, MAX_ENERGY, MASTER_CARD_POOL, INITIAL_HP } from './constants';
import { getAegisReasoning, getVisualDiagnostic, getRedemptionCard, speak } from './services/gemini';
import { SecurityNode, MalwarePacket, FirewallBuffer } from './utils/gameClasses';

const mockSystemVulnerabilities = [
  { addr: "0x4F2A", status: "MEMORY_LEAK", risk: "HIGH" },
  { addr: "0x8B11", status: "RECURSIVE_BREACH", risk: "CRITICAL" },
  { addr: "0xC003", status: "LATENCY_SPIKE", risk: "LOW" },
  { addr: "0xE994", status: "BUFFER_OVERFLOW", risk: "CRITICAL" },
  { addr: "0x1A22", status: "UNAUTHORIZED_SESS", risk: "HIGH" },
];

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null); // Recommendation 1: Background Baking

  const gameRef = useRef({
    nodes: [] as SecurityNode[],
    enemies: [] as MalwarePacket[],
    projectiles: [] as FirewallBuffer[],
    defeatedCount: 0,
    enemiesToSpawn: 0,
    spawnTimer: 0,
    difficultyMultiplier: 1.0,
    lastFrameTime: performance.now(),
    path: [
      { x: 0, y: 5 },
      { x: 2, y: 5 },
      { x: 2, y: 2 },
      { x: 5, y: 2 },
      { x: 5, y: 7 },
      { x: 8, y: 7 },
      { x: 8, y: 5 },
      { x: 9, y: 5 }
    ] as Point[]
  });

  const [gameState, setGameState] = useState<GameState>({
    kernelHP: INITIAL_HP,
    energyPoints: 20,
    waveNumber: 0,
    hand: [],
    deck: [...INITIAL_DECK],
    discard: [],
    isProcessing: false,
    isScanning: false,
    isGameStarted: false,
    isTacticalOverlayOpen: false,
    statusLog: ['[SYS_INIT] AEGIS OS BOOTING...', '[SYS_INIT] KERNEL CORE ACTIVE.'],
    history: JSON.parse(localStorage.getItem('aegis_history') || '[]'),
  });

  const [activeWave, setActiveWave] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [showRedemption, setShowRedemption] = useState(false);
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null);
  const [reroutingNodeIndex, setReroutingNodeIndex] = useState<number | null>(null);
  const [floatingTexts, setFloatingTexts] = useState<{id: number, x: number, y: number, text: string}[]>([]);
  const [ramFlash, setRamFlash] = useState(false);
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [rerouteBeam, setRerouteBeam] = useState<{from: Point, to: Point, opacity: number} | null>(null);

  // Recommendation 1: Bake background static assets to off-screen canvas
  const bakeBackground = useCallback(() => {
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 600;
    bgCanvas.height = 600;
    const bgCtx = bgCanvas.getContext('2d');
    if (!bgCtx) return;

    // Background Fill
    bgCtx.fillStyle = '#050814';
    bgCtx.fillRect(0, 0, 600, 600);

    // Grid Drawing
    bgCtx.strokeStyle = '#101525';
    bgCtx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      bgCtx.beginPath(); bgCtx.moveTo(i * TILE_SIZE, 0); bgCtx.lineTo(i * TILE_SIZE, 600); bgCtx.stroke();
      bgCtx.beginPath(); bgCtx.moveTo(0, i * TILE_SIZE); bgCtx.lineTo(600, i * TILE_SIZE); bgCtx.stroke();
    }

    // Path Drawing
    bgCtx.strokeStyle = '#1A2A40';
    bgCtx.lineWidth = 4;
    bgCtx.beginPath();
    gameRef.current.path.forEach((p, i) => {
      if (i === 0) bgCtx.moveTo(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE + TILE_SIZE / 2);
      else bgCtx.lineTo(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE + TILE_SIZE / 2);
    });
    bgCtx.stroke();

    bgCanvasRef.current = bgCanvas;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (reroutingNodeIndex !== null) {
          addLog('[SYS] REROUTE SEQUENCE ABORTED.');
          setReroutingNodeIndex(null);
        }
        if (selectedNodeIndex !== null) setSelectedNodeIndex(null);
        if (selectedIndices.length > 0) setSelectedIndices([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reroutingNodeIndex, selectedNodeIndex, selectedIndices]);

  const drawHand = useCallback((overridingHand?: Card[]) => {
    setGameState(prev => {
      const deck = [...prev.deck];
      const discard = [...prev.discard];
      const hand = overridingHand ? [...overridingHand] : [...prev.hand];
      
      while (hand.length < 5 && (deck.length > 0 || discard.length > 0)) {
        if (deck.length === 0) {
          deck.push(...discard.splice(0, discard.length));
          deck.sort(() => Math.random() - 0.5);
        }
        const card = deck.pop();
        if (card) hand.push(card);
      }
      return { ...prev, hand, deck, discard };
    });
  }, []);

  const resetGame = useCallback(() => {
    gameRef.current.nodes = [];
    gameRef.current.enemies = [];
    gameRef.current.projectiles = [];
    gameRef.current.defeatedCount = 0;
    gameRef.current.enemiesToSpawn = 0;
    gameRef.current.spawnTimer = 0;
    gameRef.current.difficultyMultiplier = 1.0;
    gameRef.current.lastFrameTime = performance.now();

    bakeBackground(); // Re-bake background

    setGameState(prev => ({
      ...prev,
      kernelHP: INITIAL_HP,
      energyPoints: 20,
      waveNumber: 0,
      hand: [],
      deck: [...INITIAL_DECK].sort(() => Math.random() - 0.5),
      discard: [],
      isProcessing: false,
      isScanning: false,
      isGameStarted: true,
      isTacticalOverlayOpen: false,
      lastGeminiResponse: undefined,
      lastDiagnostic: undefined,
      redemptionCard: undefined,
      statusLog: ['[SYS_REBOOT] FLUSHING SYSTEM CACHE...', '[SYS_REBOOT] KERNEL RE-INITIALIZED.'],
    }));

    setActiveWave(false);
    setSelectedIndices([]);
    setShowRedemption(false);
    setSelectedNodeIndex(null);
    setReroutingNodeIndex(null);
    setFloatingTexts([]);
    drawHand([]);
  }, [drawHand, bakeBackground]);

  useEffect(() => {
    if (gameState.isGameStarted && gameState.hand.length === 0 && !gameState.isProcessing) {
      checkForRedemption();
      drawHand();
    }
  }, [gameState.isGameStarted, drawHand, gameState.isProcessing]);

  const startGame = () => {
    bakeBackground(); // Bake background on initial start
    setGameState(prev => ({ ...prev, isGameStarted: true }));
    speak("Aegis OS Kernel initialized. Core active. Systems ready for breach audit.");
  };

  const toggleTacticalOverlay = () => {
    setGameState(prev => ({ ...prev, isTacticalOverlayOpen: !prev.isTacticalOverlayOpen }));
    if (!gameState.isTacticalOverlayOpen) {
      addLog('[SYS] INITIATING TACTICAL DIAGNOSTIC OVERLAY...');
    }
  };

  const checkForRedemption = async () => {
    const recentHistory = gameState.history.slice(-3);
    if (recentHistory.length >= 2 && recentHistory.every(h => h.waveReached < 10)) {
      addLog('[AEGIS] DETECTED CRITICAL FAILURE PATTERN. INITIATING REDEMPTION PROTOCOL...');
      setGameState(prev => ({ ...prev, isProcessing: true }));
      const redemption = await getRedemptionCard(gameState.history);
      if (redemption) {
        setGameState(prev => ({
          ...prev,
          redemptionCard: redemption,
          isProcessing: false,
          discard: [...prev.discard, redemption]
        }));
        setShowRedemption(true);
        addLog(`[AEGIS] REDEMPTION MODULE SYNTHESIZED: ${redemption.name}`);
        speak(`Critical performance gap detected. Patching historical vulnerability with ${redemption.name} protocol.`);
      } else {
        setGameState(prev => ({ ...prev, isProcessing: false }));
      }
    }
  };

  const saveSession = useCallback(() => {
    const summary: SessionSummary = {
      waveReached: gameState.waveNumber,
      defeatedCount: gameRef.current.defeatedCount,
      timestamp: Date.now()
    };
    const newHistory = [...gameState.history, summary].slice(-15);
    localStorage.setItem('aegis_history', JSON.stringify(newHistory));
    setGameState(prev => ({ ...prev, history: newHistory }));
  }, [gameState.waveNumber, gameState.history]);

  const addLog = (msg: string) => {
    setGameState(prev => ({
      ...prev,
      statusLog: [msg, ...prev.statusLog].slice(0, 15)
    }));
  };

  const startWave = async () => {
    if (activeWave) return;
    addLog(`[WAVE_${gameState.waveNumber + 1}] COMMENCING SECURITY AUDIT...`);
    gameRef.current.enemiesToSpawn = 6 + gameState.waveNumber * 3;
    gameRef.current.spawnTimer = 0;
    setActiveWave(true);
  };

  const runVisualDiagnostic = async () => {
    if (!canvasRef.current || gameState.isScanning) return;
    setGameState(prev => ({ ...prev, isScanning: true }));
    addLog('[VISUAL_SCAN] CAPTURING GRID TELEMETRY...');
    const imageData = canvasRef.current.toDataURL('image/jpeg', 0.8);
    const diagnostic = await getVisualDiagnostic(imageData);
    if (diagnostic) {
      addLog(`[SCAN_RESULT] SECTOR ${diagnostic.weakest_sector} IDENTIFIED AS WEAK.`);
      setGameState(prev => ({ ...prev, isScanning: false, lastDiagnostic: diagnostic }));
    } else {
      setGameState(prev => ({ ...prev, isScanning: false }));
    }
  };

  const endWave = useCallback(async () => {
    setActiveWave(false);
    setSelectedNodeIndex(null);
    setReroutingNodeIndex(null);
    setGameState(prev => ({ ...prev, isProcessing: true }));
    addLog('[SYS] BREACH EVENT CONCLUDED. ANALYZING DATA...');

    const nodeTypes = gameRef.current.nodes.map(n => n.type);
    
    setGameState(prev => ({
        ...prev,
        discard: [...prev.discard, ...prev.hand],
        hand: []
    }));

    const aegis = await getAegisReasoning(
      gameState, 
      gameRef.current.nodes.length, 
      gameRef.current.defeatedCount,
      nodeTypes
    );

    if (aegis) {
      addLog(`[AEGIS] ${aegis.kernel_log_message}`);
      const newHand = aegis.exploit_kit_update.suggested_cards_ids.map(id => MASTER_CARD_POOL[id] || MASTER_CARD_POOL['protocol_sentry']);
      
      setGameState(prev => ({
        ...prev,
        waveNumber: prev.waveNumber + 1,
        energyPoints: Math.min(MAX_ENERGY, prev.energyPoints + 15),
        isProcessing: false,
        lastGeminiResponse: aegis
      }));
      
      gameRef.current.difficultyMultiplier = aegis.wave_parameters.wave_difficulty;
      drawHand(newHand);
      runVisualDiagnostic();

      // Recommendation 4: Vocalize the tactical message for the next phase
      speak(aegis.kernel_log_message);
    } else {
      setGameState(prev => ({ ...prev, isProcessing: false }));
      drawHand([]);
    }
  }, [gameState, drawHand]);

  const toggleSelect = (idx: number) => {
    setSelectedNodeIndex(null);
    setReroutingNodeIndex(null);
    setSelectedIndices(prev => {
      if (prev.includes(idx)) return prev.filter(i => i !== idx);
      if (prev.length >= 1) return [idx];
      return [idx];
    });
  };

  const purgeCard = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (gameState.energyPoints < 2) {
        addLog('[ERROR] INSUFFICIENT ENERGY FOR DATA PURGE.');
        return;
    }
    setGameState(prev => {
        const card = prev.hand[idx];
        const newHand = prev.hand.filter((_, i) => i !== idx);
        return {
            ...prev,
            energyPoints: prev.energyPoints - 2,
            hand: newHand,
            discard: [...prev.discard, card]
        };
    });
    setSelectedIndices(prev => prev.filter(i => i !== idx).map(i => i > idx ? i - 1 : i));
    addLog('[SYS] MANUAL DATA PURGE EXECUTED (-2 EP)');
  };

  const spawnFloatingText = useCallback((x: number, y: number, text: string) => {
    const id = Date.now();
    setFloatingTexts(prev => [...prev, { id, x, y, text }]);
    setTimeout(() => {
        setFloatingTexts(prev => prev.filter(ft => ft.id !== id));
    }, 1200);
  }, []);

  const triggerRamFlash = useCallback(() => {
    setRamFlash(true);
    setTimeout(() => setRamFlash(false), 600);
  }, []);

  const decompileNode = (idx: number) => {
    const node = gameRef.current.nodes[idx];
    const card = node.card;

    addLog(`[SYS] DECOMPILING ${card.name.toUpperCase()}...`);
    
    setGameState(prev => {
      const isBufferFull = prev.hand.length >= 5;
      let ramRefund = 0;

      if (!isBufferFull) {
        ramRefund = Math.floor(card.cost * 0.5);
        addLog(`[SYS] ${card.name.toUpperCase()} RECALLED. REFUNDING ${ramRefund} RAM (50%).`);
        spawnFloatingText(node.x, node.y, `+${ramRefund} RAM`);
        triggerRamFlash();

        return {
          ...prev,
          hand: [...prev.hand, card],
          energyPoints: Math.min(MAX_ENERGY, prev.energyPoints + ramRefund)
        };
      } else {
        ramRefund = Math.floor(card.cost * 0.8);
        addLog(`[SYS] BUFFER OVERFLOW: CONVERTING ${card.name.toUpperCase()} TO RAM (+${ramRefund} EP, 80%).`);
        spawnFloatingText(node.x, node.y, `+${ramRefund} RAM`);
        triggerRamFlash();

        return {
          ...prev,
          energyPoints: Math.min(MAX_ENERGY, prev.energyPoints + ramRefund)
        };
      }
    });

    gameRef.current.nodes.splice(idx, 1);
    setSelectedNodeIndex(null);
    setReroutingNodeIndex(null);
  };

  const initReroute = (idx: number) => {
    setReroutingNodeIndex(idx);
    setSelectedNodeIndex(null);
    addLog('[SYS] INITIATING DATA REROUTE... SELECT DESTINATION PORT.');
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);
    
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;

    if (reroutingNodeIndex !== null) {
      const node = gameRef.current.nodes[reroutingNodeIndex];
      const cost = Math.max(1, Math.floor(node.card.cost * 0.1));
      
      const occupied = gameRef.current.nodes.find(n => n.gridX === x && n.gridY === y);
      if (occupied) {
        addLog('[ERROR] PORT OCCUPIED. REROUTE CANCELLED.');
        setReroutingNodeIndex(null);
        return;
      }

      if (gameState.energyPoints < cost) {
        addLog('[ERROR] INSUFFICIENT RAM FOR REROUTE.');
        setReroutingNodeIndex(null);
        return;
      }

      const oldPos = { x: node.x, y: node.y };
      // Recommendation 3: Use the new startReroute method for interpolated motion
      node.startReroute(x, y);
      
      // Update reroute beam to use the final target coordinate
      const targetCoord = { 
        x: node.gridX * TILE_SIZE + TILE_SIZE / 2, 
        y: node.gridY * TILE_SIZE + TILE_SIZE / 2 
      };
      setRerouteBeam({ from: oldPos, to: targetCoord, opacity: 1 });
      setTimeout(() => setRerouteBeam(null), 500);

      setGameState(prev => ({
        ...prev,
        energyPoints: prev.energyPoints - cost
      }));
      addLog(`[SYS] REROUTE COMPLETE: 0x${x}${y} ACTIVE (-${cost} GB)`);
      setReroutingNodeIndex(null);
      return;
    }

    const nodeIdx = gameRef.current.nodes.findIndex(n => n.gridX === x && n.gridY === y);
    if (nodeIdx !== -1) {
      setSelectedNodeIndex(nodeIdx);
      setSelectedIndices([]);
      addLog(`[SYS] ACCESSING SECTOR NODE [${x},${y}]`);
      return;
    }

    if (selectedIndices.length === 1) {
      const idx = selectedIndices[0];
      const card = gameState.hand[idx];
      if (card.type === CardType.SECURITY_NODE && gameState.energyPoints >= card.cost) {
        const occupied = gameRef.current.nodes.find(n => n.gridX === x && n.gridY === y);
        if (occupied) return;
        const newNode = new SecurityNode(x, y, card);
        gameRef.current.nodes.push(newNode);
        setGameState(prev => ({
          ...prev,
          energyPoints: prev.energyPoints - card.cost,
          hand: prev.hand.filter((_, i) => i !== idx),
          discard: [...prev.discard, card]
        }));
        setSelectedIndices([]);
        addLog(`[SYS] NODE ${card.name} DEPLOYED TO [${x},${y}]`);
      } else if (gameState.energyPoints < card.cost) {
        addLog('[ERROR] INSUFFICIENT ENERGY FOR DEPLOYMENT.');
      }
      return;
    }

    setSelectedNodeIndex(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos(null);
  };

  useEffect(() => {
    if (!canvasRef.current || !gameState.isGameStarted) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    let requestRef: number;
    const loop = (time: number) => {
      const dt = (time - gameRef.current.lastFrameTime) / 1000;
      gameRef.current.lastFrameTime = time;
      
      // Recommendation 1: Draw pre-rendered background
      if (bgCanvasRef.current) {
        ctx.drawImage(bgCanvasRef.current, 0, 0);
      } else {
        // Fallback drawing if bg not ready
        ctx.fillStyle = '#050814';
        ctx.fillRect(0, 0, 600, 600);
      }
      
      const core = gameRef.current.path[gameRef.current.path.length-1];
      ctx.fillStyle = '#3DDCFF';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#3DDCFF';
      ctx.fillRect(core.x * TILE_SIZE + 5, core.y * TILE_SIZE + 5, 50, 50);
      ctx.shadowBlur = 0;

      if (activeWave) {
        if (gameRef.current.enemiesToSpawn > 0) {
          gameRef.current.spawnTimer += dt;
          if (gameRef.current.spawnTimer >= 0.8) {
            const enemy = new MalwarePacket(gameRef.current.path, { hp: 40 * gameRef.current.difficultyMultiplier, speed: 2.0 }, 'STANDARD');
            gameRef.current.enemies.push(enemy);
            gameRef.current.enemiesToSpawn--;
            gameRef.current.spawnTimer = 0;
          }
        }
        
        gameRef.current.enemies.forEach((e, idx) => {
          if (e.update(dt)) {
            setGameState(prev => {
              const newHP = Math.max(0, prev.kernelHP - 12);
              if (newHP <= 0 && prev.kernelHP > 0) {
                setTimeout(() => saveSession(), 100);
                // Recommendation 4: Vocalize critical system failure
                speak("Critical Exception. Kernel core integrity zeroed. System failure imminent.");
              }
              return { ...prev, kernelHP: newHP };
            });
            gameRef.current.enemies.splice(idx, 1);
          } else if (e.hp <= 0) {
            gameRef.current.enemies.splice(idx, 1);
            gameRef.current.defeatedCount++;
            setGameState(prev => ({ ...prev, energyPoints: Math.min(MAX_ENERGY, prev.energyPoints + 2) }));
          }
        });
        
        gameRef.current.projectiles.forEach((p, idx) => {
          p.update();
          if (p.isDead) gameRef.current.projectiles.splice(idx, 1);
        });
        
        gameRef.current.nodes.forEach(n => {
          n.update(dt, gameRef.current.enemies, (node, target) => {
            gameRef.current.projectiles.push(new FirewallBuffer(node.x, node.y, target, node.damage, node));
          });
        });
        
        if (gameRef.current.enemiesToSpawn === 0 && gameRef.current.enemies.length === 0) endWave();
      }
      
      gameRef.current.enemies.forEach(e => e.draw(ctx));
      gameRef.current.nodes.forEach(n => n.draw(ctx));
      gameRef.current.projectiles.forEach(p => p.draw(ctx));
      
      if (reroutingNodeIndex !== null) {
          ctx.fillStyle = 'rgba(61, 220, 255, 0.05)';
          for(let i=0; i<GRID_SIZE; i++) {
              for(let j=0; j<GRID_SIZE; j++) {
                  const occupied = gameRef.current.nodes.find(n => n.gridX === i && n.gridY === j);
                  if (!occupied) ctx.fillRect(i * TILE_SIZE + 2, j * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
              }
          }
      }

      if (rerouteBeam) {
        ctx.strokeStyle = `rgba(156, 255, 87, ${rerouteBeam.opacity})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(rerouteBeam.from.x, rerouteBeam.from.y);
        ctx.lineTo(rerouteBeam.to.x, rerouteBeam.to.y);
        ctx.stroke();
        
        for(let i=0; i<5; i++) {
          const t = (Date.now() / 200 % 1) + (i / 5);
          const px = rerouteBeam.from.x + (rerouteBeam.to.x - rerouteBeam.from.x) * (t % 1);
          const py = rerouteBeam.from.y + (rerouteBeam.to.y - rerouteBeam.from.y) * (t % 1);
          ctx.fillStyle = '#3DDCFF';
          ctx.fillRect(px - 2, py - 2, 4, 4);
        }
      }

      if ((selectedIndices.length === 1 || reroutingNodeIndex !== null) && mousePos) {
          const card = reroutingNodeIndex !== null ? gameRef.current.nodes[reroutingNodeIndex].card : gameState.hand[selectedIndices[0]];
          const range = (card.stats?.range || 2) * TILE_SIZE;
          ctx.beginPath();
          ctx.arc(mousePos.x * TILE_SIZE + TILE_SIZE/2, mousePos.y * TILE_SIZE + TILE_SIZE/2, range, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(61, 220, 255, 0.1)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(61, 220, 255, 0.3)';
          ctx.stroke();

          ctx.strokeStyle = reroutingNodeIndex !== null ? 'rgba(61, 220, 255, 0.6)' : 'rgba(156, 255, 87, 0.4)';
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(mousePos.x * TILE_SIZE + 5, mousePos.y * TILE_SIZE + 5, 50, 50);
          ctx.setLineDash([]);
      }

      if (gameState.isScanning) {
        ctx.strokeStyle = '#3DDCFF';
        ctx.setLineDash([5, 15]);
        ctx.lineWidth = 2;
        const scanY = (Date.now() % 2000) / 2000 * 600;
        ctx.beginPath(); ctx.moveTo(0, scanY); ctx.lineTo(600, scanY); ctx.stroke();
        ctx.setLineDash([]);
      }
      requestRef = requestAnimationFrame(loop);
    };
    requestRef = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef);
  }, [activeWave, endWave, gameState.isScanning, gameState.isGameStarted, saveSession, selectedIndices, mousePos, gameState.hand, reroutingNodeIndex, rerouteBeam, bakeBackground]);

  const canFuse = selectedIndices.length === 2 && 
                  gameState.hand[selectedIndices[0]]?.id === gameState.hand[selectedIndices[1]]?.id &&
                  gameState.hand[selectedIndices[0]]?.fusionTargetId;

  const fuseCards = useCallback(() => {
    if (!canFuse) return;
    const [i1, i2] = selectedIndices;
    const card1 = gameState.hand[i1];
    const targetId = card1.fusionTargetId;
    if (!targetId) return;
    
    const fusedCard = MASTER_CARD_POOL[targetId];
    if (fusedCard) {
      addLog(`[SYS] FUSING DATA SIGNATURES: ${card1.name} x2 -> ${fusedCard.name}`);
      setGameState(prev => {
        const newHand = [...prev.hand];
        const toRemove = [i1, i2].sort((a, b) => b - a);
        newHand.splice(toRemove[0], 1);
        newHand.splice(toRemove[1], 1);
        newHand.push(fusedCard);
        return { ...prev, hand: newHand };
      });
      setSelectedIndices([]);
    }
  }, [selectedIndices, gameState.hand, canFuse]);

  const selectedNode = selectedNodeIndex !== null ? gameRef.current.nodes[selectedNodeIndex] : null;

  return (
    <div className="flex h-screen w-screen bg-[#050814] text-[#9CFF57] font-mono selection:bg-[#3DDCFF]/30 overflow-hidden relative">
      <aside className="w-1/4 border-r border-[#1A2A40] flex flex-col bg-[#050814]/50 backdrop-blur-sm z-20">
        <header className="p-4 border-b border-[#1A2A40] flex justify-between items-center bg-[#1A2A40]/10">
          <span className="font-black text-[#3DDCFF] italic text-xs tracking-wider uppercase">DIAG_ZONE_A</span>
          <div className="flex space-x-1">
            <div className={`w-2 h-2 rounded-full ${activeWave ? 'bg-red-500 animate-pulse' : 'bg-[#9CFF57]'}`}></div>
            <div className="w-2 h-2 rounded-full bg-[#3DDCFF]"></div>
          </div>
        </header>

        <section className="p-4 space-y-6 flex-1 overflow-hidden flex flex-col">
          <div className="space-y-4">
            <h1 className="text-xl font-black text-white tracking-tighter uppercase italic">Aegis_OS</h1>
            <div className="p-3 holographic-panel rounded shadow-inner">
              <div className="flex justify-between text-[10px] mb-1 font-bold text-gray-400">
                <span>CORE_INTEGRITY</span>
                <span 
                  role={gameState.kernelHP < 30 ? "alert" : undefined}
                  className={gameState.kernelHP < 30 ? "text-red-500 animate-pulse" : "text-[#9CFF57]"}
                >
                  {gameState.kernelHP}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-[#1A2A40]">
                <div className="h-full bg-[#3DDCFF] transition-all duration-700 shadow-[0_0_12px_#3DDCFF]" style={{width: `${gameState.kernelHP}%`}}></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className={`p-2 border border-[#1A2A40] bg-[#1A2A40]/10 transition-all ${ramFlash ? 'animate-ram-flash' : ''}`}>
                <div className="text-gray-500 font-bold tracking-widest uppercase">RAM_UNIT</div>
                <div className="text-[#3DDCFF] font-black text-lg">{gameState.energyPoints}<span className="text-[10px] ml-1 opacity-50">GB</span></div>
              </div>
              <div className="p-2 border border-[#1A2A40] bg-[#1A2A40]/10">
                <div className="text-gray-500 font-bold tracking-widest uppercase">THREAT_LVL</div>
                <div className="text-[#9CFF57] font-black text-lg">{gameState.waveNumber}</div>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0 border-t border-[#1A2A40] pt-4">
            <div className="text-gray-600 text-[9px] mb-2 uppercase tracking-[0.3em] font-black italic">>> KERNEL_LOG_STREAM</div>
            <div aria-live="polite" className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-[#1A2A40] px-1">
              {gameState.statusLog.map((log, i) => (
                <div key={i} className={`text-[10px] leading-relaxed break-all ${
                  log.includes('[AEGIS]') ? 'text-[#9CFF57]' : 
                  log.includes('[SCAN_RESULT]') ? 'text-yellow-400' : 
                  'text-gray-500'
                } flicker`}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="p-4 border-t border-[#1A2A40] bg-[#1A2A40]/5 space-y-2">
           <button 
            onClick={toggleTacticalOverlay}
            disabled={!gameState.isGameStarted}
            className={`w-full py-2 border font-black text-[9px] tracking-[0.2em] transition-all uppercase rounded ${
              gameState.isTacticalOverlayOpen ? "border-[#3DDCFF] text-[#3DDCFF] animate-pulse" : "border-[#1A2A40] text-gray-500 hover:text-[#3DDCFF] hover:border-[#3DDCFF]"
            }`}
          >
            {gameState.isTacticalOverlayOpen ? "CLOSE_TACTICAL" : "VISUAL_DIAGNOSTIC"}
          </button>
          <button 
            onClick={startWave}
            disabled={activeWave || gameState.isProcessing || !gameState.isGameStarted}
            className={`w-full py-4 border-2 font-black text-xs tracking-[0.3em] transition-all uppercase rounded ${
              activeWave || gameState.isProcessing || !gameState.isGameStarted ? "border-gray-800 text-gray-800" : "border-[#3DDCFF] text-[#3DDCFF] hover:bg-[#3DDCFF]/10 shadow-[0_0_15px_rgba(61,220,255,0.2)]"
            }`}
          >
            {gameState.isProcessing ? "REASONING..." : "INIT_BREACH"}
          </button>
        </footer>
      </aside>

      <main className="flex-1 relative flex flex-col bg-[#02040a] items-center justify-center p-8 overflow-hidden">
        <div className="absolute top-4 left-4 text-[10px] text-gray-800 pointer-events-none font-black uppercase tracking-widest italic">Sector_Grid_01 // 600x600_Mainframe</div>
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#3DDCFF]/20 to-[#9CFF57]/20 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <canvas 
            ref={canvasRef} 
            width={600} 
            height={600} 
            className="relative border border-[#1A2A40] shadow-2xl bg-black cursor-crosshair rounded-sm"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleCanvasClick}
          />
          {floatingTexts.map(ft => (
              <div key={ft.id} className="absolute text-[#3DDCFF] font-black text-xs pointer-events-none animate-drift-up z-50 whitespace-nowrap" style={{ left: ft.x, top: ft.y }}>{ft.text}</div>
          ))}
          {selectedNode && (
            <div className="absolute border-2 border-[#3DDCFF] animate-reticle pointer-events-none z-10" style={{ left: selectedNode.gridX * TILE_SIZE, top: selectedNode.gridY * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE, boxShadow: '0 0 10px #3DDCFF' }} />
          )}
          {selectedNode && (
            <div className="absolute z-40 holographic-panel p-4 shadow-[0_0_20px_rgba(156,255,87,0.2)] animate-monitor-on w-64" style={{ left: Math.min(selectedNode.gridX * TILE_SIZE + TILE_SIZE + 10, 600 - 256), top: Math.max(selectedNode.gridY * TILE_SIZE - 40, 0) }}>
              <div className="flex justify-between items-center mb-3 border-b border-[#9CFF57]/30 pb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#9CFF57] italic">PROT_SPEC: {selectedNode.card.name}</span>
                <button onClick={() => setSelectedNodeIndex(null)} className="text-red-500 hover:text-white transition-colors">[X]</button>
              </div>
              <div className="space-y-2 font-mono text-[10px]">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="flex flex-col"><span className="text-gray-500 font-bold uppercase tracking-tighter">BIT-DEPTH</span><span className="text-[#9CFF57] font-black">{selectedNode.damage} BD</span></div>
                  <div className="flex flex-col"><span className="text-gray-500 font-bold uppercase tracking-tighter">LATENCY</span><span className="text-[#3DDCFF] font-black">{(1/selectedNode.fireRate).toFixed(1)}s</span></div>
                </div>
                <div className="flex justify-between text-gray-400 border-t border-[#1A2A40] pt-2"><span className="font-bold">PURGED:</span><span className="text-white font-black">{selectedNode.killCount} PKTS</span></div>
                <div className="flex justify-between text-gray-400"><span className="font-bold">UP-TIME:</span><span className="text-white font-black">{Math.floor(selectedNode.upTime)}s</span></div>
                <div className="flex justify-between text-gray-400"><span className="font-bold">ORIGIN_COST:</span><span className="text-[#3DDCFF] font-black">{selectedNode.card.cost} GB</span></div>
                <div className="mt-4 p-2 bg-[#9CFF57]/5 border-l-2 border-[#9CFF57] italic text-[9px] text-[#9CFF57]/80 leading-relaxed uppercase">{selectedNode.card.reasoningTip}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={() => initReroute(selectedNodeIndex!)} className="py-2 border border-[#3DDCFF]/50 text-[#3DDCFF] hover:bg-[#3DDCFF] hover:text-black font-black uppercase text-[9px] tracking-[0.1em] transition-all">REROUTE</button>
                <button onClick={() => decompileNode(selectedNodeIndex!)} className="py-2 border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white font-black uppercase text-[9px] tracking-[0.1em] transition-all">DECOMPILE</button>
              </div>
            </div>
          )}
        </div>

        {gameState.isTacticalOverlayOpen && (
          <div className="absolute inset-0 z-40 bg-[#050814]/80 backdrop-blur-md flex items-center justify-center p-12 cursor-default" onClick={toggleTacticalOverlay}>
            <div className="scanline-overlay"></div>
            <div className="w-full h-full border-4 border-[#3DDCFF] holographic-panel shadow-[0_0_50px_rgba(61,220,255,0.3)] relative p-8 flex flex-col overflow-hidden animate-slide-left flicker" onClick={(e) => e.stopPropagation()}>
              <div className="absolute top-0 left-0 w-full h-1 bg-[#3DDCFF] animate-pulse"></div>
              <div className="flex justify-between items-start mb-8 border-b border-[#3DDCFF]/30 pb-4">
                <div><h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Tactical_Diagnostic</h2><div className="text-[#3DDCFF] text-[10px] tracking-[0.5em] font-black mt-1 uppercase">Deep_Scan_V2 // Sector_Analysis</div></div>
                <div className="flex space-x-2">
                   <button onClick={runVisualDiagnostic} disabled={gameState.isScanning} className="px-6 py-2 border-2 border-yellow-500 text-yellow-500 font-black uppercase tracking-widest hover:bg-yellow-500 hover:text-black transition-all text-xs glitch-hover">{gameState.isScanning ? "SCANNING..." : "[RUN_NEW_SCAN]"}</button>
                  <button onClick={toggleTacticalOverlay} className="px-6 py-2 border-2 border-[#3DDCFF] text-[#3DDCFF] font-black uppercase tracking-widest hover:bg-[#3DDCFF] hover:text-black transition-all text-xs">[CLOSE_OVERLAY]</button>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-8 overflow-hidden">
                <div className="flex flex-col space-y-6 overflow-hidden">
                  <div className="p-4 border border-[#3DDCFF]/30 bg-[#3DDCFF]/5 flex-1 flex flex-col">
                    <div className="text-[#3DDCFF] font-black text-[10px] mb-4 tracking-[0.2em] italic uppercase">>> Gemini_Visual_Intelligence</div>
                    {gameState.lastDiagnostic ? (
                      <div className="space-y-4 animate-in fade-in duration-700">
                        <div className="flex justify-between items-center bg-yellow-900/20 p-2 border border-yellow-500/30"><span className="text-yellow-500 font-black text-xs uppercase">Weakest_Sector:</span><span className="text-white font-black text-lg">{gameState.lastDiagnostic.weakest_sector}</span></div>
                        <div className="text-gray-300 text-sm leading-relaxed italic font-mono border-l-2 border-yellow-500 pl-4">"{gameState.lastDiagnostic.analysis}"</div>
                        <div className="p-2 border border-[#9CFF57]/30 bg-[#9CFF57]/5"><span className="text-[#9CFF57] font-black text-[10px] uppercase block mb-1">Recommended_Patch:</span><span className="text-white font-bold">{MASTER_CARD_POOL[gameState.lastDiagnostic.suggested_card_id]?.name || 'Adaptive Protocol'}</span></div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-700 font-black text-[10px] space-y-4"><div className="animate-spin h-8 w-8 border-2 border-gray-800 border-t-gray-500 rounded-full"></div><span className="tracking-widest">NO_DIAGNOSTIC_DATA_CAPTURED</span><button onClick={runVisualDiagnostic} className="text-[#3DDCFF] underline hover:text-white transition-colors cursor-pointer">INIT_CAPTURE_SEQUENCE</button></div>
                    )}
                  </div>
                  <div className="h-1/3 p-4 border border-gray-800 bg-black/40 text-[9px] font-mono text-gray-500 overflow-y-auto scrollbar-thin scrollbar-thumb-[#1A2A40]">
                    [LOG] Kernal integrity verified at {gameState.kernelHP}% <br/> [LOG] Visual feed synced with deep-think processor. <br/> [LOG] Detected anomalous packet bursts at junction 0x7. <br/> [WARN] Memory latency increasing in Sector B. <br/> [INFO] Aegis Core idling at optimal thermal range. <br/> [INFO] {gameState.hand.length} payload(s) ready for deployment.
                  </div>
                </div>
                <div className="space-y-4 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-[#1A2A40]">
                  <div className="text-[10px] text-gray-600 font-black uppercase tracking-widest border-b border-[#1A2A40] mb-4 pb-1 italic">>> SYSTEM_VULNERABILITY_INDEX</div>
                  {mockSystemVulnerabilities.map((v, i) => (
                    <div key={i} className="flex justify-between items-center p-3 border border-[#1A2A40] bg-[#1A2A40]/10 hover:bg-[#3DDCFF]/5 transition-colors group">
                      <div className="flex flex-col"><span className="text-[9px] text-gray-500 font-mono">{v.addr}</span><span className={`text-[11px] font-black tracking-wider ${v.risk === 'CRITICAL' ? 'text-red-500' : 'text-yellow-500'} group-hover:text-white`}>{v.status}</span></div>
                      <span className={`text-[9px] px-2 py-0.5 font-black border ${v.risk === 'CRITICAL' ? 'border-red-500 text-red-500 animate-pulse' : v.risk === 'HIGH' ? 'border-orange-500 text-orange-500' : 'border-blue-500 text-blue-500'}`}>{v.risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {(!gameState.isGameStarted || gameState.kernelHP <= 0) && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="relative p-12 holographic-panel border-2 border-[#3DDCFF] shadow-[0_0_30px_#3DDCFF] max-w-lg w-full text-center group transition-all animate-monitor-on">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#3DDCFF] flicker"></div>
              <div className="mb-8"><h2 role={gameState.kernelHP <= 0 ? "alert" : undefined} className={`text-5xl font-black italic tracking-tighter uppercase mb-2 flicker ${gameState.kernelHP <= 0 ? 'text-red-500 shadow-red-500' : 'text-[#3DDCFF]'}`}>{gameState.kernelHP <= 0 ? 'BREACH_CRITICAL' : 'CIRCUIT_BREACH'}</h2><div className="text-[10px] text-gray-500 tracking-[0.8em] font-black uppercase border-y border-[#1A2A40] py-2">Aegis_OS // Strategic_Defense_Kernel</div></div>
              {gameState.kernelHP <= 0 && <div className="mb-8 p-4 bg-red-900/10 border border-red-500/20 text-red-400 text-[10px] font-mono italic">KERNEL_PANIC: The mainframe core was overwhelmed by a recursive infection loop. System integrity zeroed.</div>}
              <button onClick={gameState.kernelHP <= 0 ? resetGame : startGame} className={`group relative w-full py-6 font-black text-sm tracking-[0.5em] uppercase transition-all overflow-hidden border-2 ${gameState.kernelHP <= 0 ? 'border-red-500 text-red-500 hover:bg-red-500/10' : 'border-[#9CFF57] text-[#9CFF57] hover:bg-[#9CFF57]/10'}`}><span className="relative z-10">{gameState.kernelHP <= 0 ? 'REBOOT_KERNEL' : 'INITIALIZE_SYSTEM'}</span><div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:left-full transition-all duration-700"></div></button>
            </div>
          </div>
        )}

        {gameState.isProcessing && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-30 flex items-center justify-center">
            <div className="p-8 border-y-2 border-[#3DDCFF]/30 w-full flex flex-col items-center bg-[#050814]/50 animate-monitor-on">
              <div className="text-[#3DDCFF] font-black animate-pulse text-2xl tracking-[1em] italic uppercase mb-2">Aegis_Thinking</div>
              <div className="text-[10px] text-gray-500 font-mono tracking-widest animate-bounce">SYNCING_DEEP_THINK_CORES...</div>
            </div>
          </div>
        )}
      </main>

      <aside className="w-1/4 border-l border-[#1A2A40] bg-[#050814]/50 backdrop-blur-sm flex flex-col z-20">
        <header className="p-4 border-b border-[#1A2A40] bg-[#1A2A40]/10 flex justify-between items-center"><span className="font-black text-[#9CFF57] italic text-xs tracking-wider uppercase">KIT_ZONE_B</span><span className="text-[10px] text-gray-600 font-mono">HAND: {gameState.hand.length}/5</span></header>
        <section className="p-4 border-b border-[#1A2A40] h-1/4 overflow-y-auto bg-[#1A2A40]/5">
           <div className="text-[9px] text-gray-500 font-black mb-3 tracking-widest uppercase italic">>> STRATEGIC_ADVISORY</div>
           {gameState.lastGeminiResponse ? (
             <div className="space-y-4 font-mono animate-monitor-on">
                <div className="p-3 bg-[#3DDCFF]/5 border border-[#3DDCFF]/20 rounded relative overflow-hidden"><div className="card-scanline opacity-10"></div><div className="text-[#3DDCFF] text-[10px] font-black uppercase mb-1 flex items-center"><span className="w-1.5 h-1.5 bg-[#3DDCFF] rounded-full mr-2 shadow-[0_0_5px_#3DDCFF]"></span>Performance_Gap</div><div className="text-white text-[10px] font-bold leading-tight uppercase tracking-tighter">{gameState.lastGeminiResponse.tactical_analysis.skill_gap_identified}</div><div className="mt-2 text-gray-500 italic text-[9px] leading-relaxed">"{gameState.lastGeminiResponse.tactical_analysis.causal_justification}"</div></div>
                <div className="text-[9px] text-gray-700 font-black text-center tracking-widest uppercase">DIFF_SCALAR: X{gameState.lastGeminiResponse.wave_parameters.wave_difficulty}</div>
             </div>
           ) : (<div className="text-[10px] text-gray-700 animate-pulse italic">WAITING_FOR_WAVE_DATA...</div>)}
        </section>
        <section className={`flex-1 overflow-hidden flex flex-col transition-all duration-500 ${gameState.isProcessing ? 'pulse-breach' : ''}`}>
          <div className="p-3 border-b border-[#1A2A40] flex justify-between items-center text-[10px]"><span className="text-gray-500 uppercase font-black tracking-widest">Active_Payloads</span>{selectedIndices.length > 0 && <span className="text-[#3DDCFF] font-black">[{selectedIndices.length}] READY</span>}</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin scrollbar-thumb-[#1A2A40]">
            {gameState.hand.map((card, i) => {
              const isSelected = selectedIndices.includes(i);
              const canAfford = gameState.energyPoints >= card.cost;
              const protocolId = `PRT-${card.id.substring(0, 3).toUpperCase()}-0x${i}`;
              return (
                <div key={card.id + '-' + i} onClick={() => toggleSelect(i)} className={`relative p-3 border border-[#9CFF57]/20 cursor-pointer transition-all duration-300 group overflow-hidden ${isSelected ? "bg-[#3DDCFF]/10 border-[#3DDCFF] scale-[1.02]" : "bg-[#0A0F23]/60 hover:bg-[#1A2A40]/40 hover:border-[#9CFF57]/40 hover:-translate-y-1"} ${!canAfford ? 'opacity-40 grayscale' : ''}`}>
                  <div className="card-scanline"></div>
                  <div className="flex justify-between items-start mb-2 relative z-10"><span className="text-[9px] font-mono text-[#3DDCFF] font-black tracking-tighter">{protocolId}</span><div className="flex items-center"><span className={`text-[12px] font-black mr-2 ${canAfford ? 'text-[#3DDCFF]' : 'text-red-500'} shadow-sm`}>{card.cost}</span><span className="text-[8px] text-gray-500 uppercase font-bold tracking-tighter">GB_RAM</span></div></div>
                  <h3 className={`font-black text-[11px] mb-1 relative z-10 tracking-tight uppercase ${card.rarity === 'LEGENDARY' ? 'text-yellow-500' : 'text-[#9CFF57]'}`}>{card.name}</h3>
                  <div className="grid grid-cols-2 gap-2 mt-3 relative z-10 border-t border-[#1A2A40] pt-2">
                    <div className="flex flex-col"><span className="text-[7px] text-gray-500 font-bold uppercase tracking-widest">Bit_Depth</span><span className="text-[10px] text-white font-black">{card.stats?.damage || 0} <span className="text-[7px] text-gray-500">BD</span></span></div>
                    <div className="flex flex-col"><span className="text-[7px] text-gray-500 font-bold uppercase tracking-widest">Latency</span><span className="text-[10px] text-[#3DDCFF] font-black">{card.stats?.fireRate ? (1/card.stats.fireRate).toFixed(1) : 'N/A'}<span className="text-[7px] text-gray-500 ml-0.5">s</span></span></div>
                    <div className="col-span-2 mt-2 border-t border-[#1A2A40]/50 pt-1">
                      <div className="flex justify-between items-center"><span className="text-[7px] text-[#9CFF57]/60 font-black tracking-widest uppercase italic">>> REASONING_TIP</span><button onClick={(e) => purgeCard(i, e)} className="text-[7px] px-1.5 py-0.5 border border-red-900/40 text-red-900/60 hover:border-red-500 hover:text-red-500 transition-colors uppercase font-black tracking-tighter bg-red-900/5">[PURGE]</button></div>
                      <p className="text-[8px] text-[#9CFF57]/50 font-bold mt-1 leading-tight uppercase truncate">{card.reasoningTip}</p>
                    </div>
                  </div>
                  {isSelected && (<div className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#3DDCFF] rounded-full shadow-[0_0_8px_#3DDCFF] animate-ping"/>)}
                </div>
              );
            })}
          </div>
        </section>
        <footer className="p-4 bg-[#1A2A40]/10 border-t border-[#1A2A40] space-y-3">
          <button disabled={!canFuse} onClick={fuseCards} className={`w-full py-4 border-2 font-black text-[10px] italic tracking-[0.3em] transition-all rounded shadow-sm ${canFuse ? "border-[#9CFF57] text-[#9CFF57] hover:bg-[#9CFF57]/10 animate-pulse shadow-[0_0_15px_rgba(156,255,87,0.2)]" : "border-gray-800 text-gray-800 opacity-50"}`}>FUSE_SIGNATURES</button>
        </footer>
      </aside>

      {showRedemption && gameState.redemptionCard && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl z-50 flex items-center justify-center p-12">
          <div className="max-w-md w-full p-8 border-4 border-yellow-500 bg-[#050814] shadow-[0_0_100px_rgba(234,179,8,0.5)] relative overflow-hidden group animate-monitor-on"><div className="absolute top-0 left-0 w-full h-1 bg-yellow-500 animate-ping opacity-20"></div><div className="text-yellow-500 font-black tracking-[0.4em] uppercase text-[10px] mb-6 flex items-center"><span className="flex-1 h-px bg-yellow-500/30"></span><span className="mx-4">Redemption_Module_Detected</span><span className="flex-1 h-px bg-yellow-500/30"></span></div><h2 className="text-4xl font-black text-white italic mb-2 tracking-tighter uppercase">{gameState.redemptionCard.name}</h2><p className="text-gray-400 text-sm mb-8 leading-relaxed italic border-l-2 border-yellow-500/50 pl-4 font-mono">"{gameState.redemptionCard.description}"</p><button onClick={() => { setShowRedemption(false); drawHand(); }} className="w-full py-5 bg-yellow-500 text-black font-black uppercase tracking-[0.5em] hover:bg-yellow-400 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(234,179,8,0.3)] glitch-hover">INTEGRATE_MODULE</button></div>
        </div>
      )}
    </div>
  );
};

export default App;

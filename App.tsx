
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, GameState, Point, CardType, SessionSummary, AegisResponse } from './types';
import { GRID_SIZE, TILE_SIZE, INITIAL_DECK, MAX_ENERGY, MASTER_CARD_POOL, INITIAL_HP } from './constants';
import { getAegisReasoning, getVisualDiagnostic, getRedemptionCard } from './services/gemini';
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
  const gameRef = useRef({
    nodes: [] as SecurityNode[],
    malwarePackets: [] as MalwarePacket[],
    projectiles: [] as FirewallBuffer[],
    defeatedCount: 0,
    malwareToSpawn: 0,
    spawnTimer: 0,
    difficultyMultiplier: 1.0,
    lastFrameTime: performance.now(),
    path: [
      { x: 0, y: 5 }, { x: 2, y: 5 }, { x: 2, y: 2 }, { x: 5, y: 2 },
      { x: 5, y: 7 }, { x: 8, y: 7 }, { x: 8, y: 5 }, { x: 9, y: 5 }
    ] as Point[]
  });

  const [gameState, setGameState] = useState<GameState>({
    kernelHP: INITIAL_HP,
    energyPoints: 20,
    waveNumber: 0,
    hand: [],
    exploitKit_Buffer: [...INITIAL_DECK],
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
      const buffer = [...prev.exploitKit_Buffer];
      const discard = [...prev.discard];
      const hand = overridingHand ? [...overridingHand] : [...prev.hand];
      
      while (hand.length < 5 && (buffer.length > 0 || discard.length > 0)) {
        if (buffer.length === 0) {
          buffer.push(...discard.splice(0, discard.length));
          buffer.sort(() => Math.random() - 0.5);
        }
        const card = buffer.pop();
        if (card) hand.push(card);
      }
      return { ...prev, hand, exploitKit_Buffer: buffer, discard };
    });
  }, []);

  const resetGame = useCallback(() => {
    gameRef.current.nodes = [];
    gameRef.current.malwarePackets = [];
    gameRef.current.projectiles = [];
    gameRef.current.defeatedCount = 0;
    gameRef.current.malwareToSpawn = 0;
    gameRef.current.spawnTimer = 0;
    gameRef.current.difficultyMultiplier = 1.0;
    gameRef.current.lastFrameTime = performance.now();

    setGameState(prev => ({
      ...prev,
      kernelHP: INITIAL_HP,
      energyPoints: 20,
      waveNumber: 0,
      hand: [],
      exploitKit_Buffer: [...INITIAL_DECK].sort(() => Math.random() - 0.5),
      discard: [],
      isProcessing: false,
      isScanning: false,
      isGameStarted: true,
      isTacticalOverlayOpen: false,
      lastGeminiResponse: undefined,
      lastDiagnostic: undefined,
      redemptionCard: undefined,
      statusLog: ['[SYS_REBOOT] FLUSHING CACHE...', '[SYS_REBOOT] KERNEL ACTIVE.'],
    }));

    setActiveWave(false);
    setSelectedIndices([]);
    setShowRedemption(false);
    setSelectedNodeIndex(null);
    setReroutingNodeIndex(null);
    setFloatingTexts([]);
    drawHand([]);
  }, [drawHand]);

  useEffect(() => {
    if (gameState.isGameStarted && gameState.hand.length === 0 && !gameState.isProcessing) {
      checkForRedemption();
      drawHand();
    }
  }, [gameState.isGameStarted, drawHand, gameState.isProcessing]);

  const startGame = () => setGameState(prev => ({ ...prev, isGameStarted: true }));

  const toggleTacticalOverlay = () => {
    setGameState(prev => ({ ...prev, isTacticalOverlayOpen: !prev.isTacticalOverlayOpen }));
    if (!gameState.isTacticalOverlayOpen) addLog('[SYS] INITIATING TACTICAL OVERLAY...');
  };

  const checkForRedemption = async () => {
    const recentHistory = gameState.history.slice(-3);
    if (recentHistory.length >= 2 && recentHistory.every(h => h.waveReached < 10)) {
      addLog('[AEGIS] PERSISTENT FAILURE DETECTED. SYNTHESIZING REDEMPTION...');
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
    gameRef.current.malwareToSpawn = 6 + gameState.waveNumber * 3;
    gameRef.current.spawnTimer = 0;
    setActiveWave(true);
  };

  const runVisualDiagnostic = async () => {
    if (!canvasRef.current || gameState.isScanning) return;
    setGameState(prev => ({ ...prev, isScanning: true }));
    const imageData = canvasRef.current.toDataURL('image/jpeg', 0.8);
    
    // TACTICAL CHANNEL: Gemini 3 Flash
    const diagnostic = await getVisualDiagnostic(imageData, gameState.waveNumber, gameState.kernelHP);
    if (diagnostic) {
      addLog(`[TACTICAL] WEAKNESS DETECTED: SECTOR ${diagnostic.weakest_sector}`);
      addLog(`[ADVICE] ${diagnostic.analysis}`);
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
    addLog('[SYS] BREACH CONCLUDED. ANALYZING STRATEGY...');

    const nodeTypes = gameRef.current.nodes.map(n => n.type);
    
    // STRATEGIC CHANNEL: Gemini 3 Pro
    const aegisPromise = getAegisReasoning(gameState, gameRef.current.nodes.length, gameRef.current.defeatedCount, nodeTypes);
    const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 2000));
    
    const aegis = await Promise.race([aegisPromise, timeoutPromise]);

    setGameState(prev => ({
        ...prev,
        discard: [...prev.discard, ...prev.hand],
        hand: []
    }));

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
    } else {
      addLog('[SYS] KERNEL LATENCY EXCEEDED. FALLBACK TO LOCAL OS.');
      setGameState(prev => ({
        ...prev,
        waveNumber: prev.waveNumber + 1,
        energyPoints: Math.min(MAX_ENERGY, prev.energyPoints + 10),
        isProcessing: false
      }));
      drawHand([]);
    }
  }, [gameState, drawHand]);

  const toggleSelect = (idx: number) => {
    setSelectedNodeIndex(null);
    setReroutingNodeIndex(null);
    setSelectedIndices(prev => {
      if (prev.includes(idx)) return prev.filter(i => i !== idx);
      return [idx];
    });
  };

  const purgeCard = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (gameState.energyPoints < 2) return addLog('[ERROR] INSUFFICIENT RAM.');
    setGameState(prev => ({
      ...prev,
      energyPoints: prev.energyPoints - 2,
      hand: prev.hand.filter((_, i) => i !== idx),
      discard: [...prev.discard, prev.hand[idx]]
    }));
    setSelectedIndices([]);
    addLog('[SYS] DATA PURGE EXECUTED.');
  };

  const spawnFloatingText = useCallback((x: number, y: number, text: string) => {
    const id = Date.now();
    setFloatingTexts(prev => [...prev, { id, x, y, text }]);
    setTimeout(() => setFloatingTexts(prev => prev.filter(ft => ft.id !== id)), 1200);
  }, []);

  const triggerRamFlash = useCallback(() => {
    setRamFlash(true);
    setTimeout(() => setRamFlash(false), 600);
  }, []);

  const decompileNode = (idx: number) => {
    const node = gameRef.current.nodes[idx];
    const card = node.card;
    setGameState(prev => {
      const isBufferFull = prev.hand.length >= 5;
      const ramRefund = Math.floor(card.cost * (isBufferFull ? 0.8 : 0.5));
      spawnFloatingText(node.x, node.y, `+${ramRefund} RAM`);
      triggerRamFlash();
      return {
        ...prev,
        hand: isBufferFull ? prev.hand : [...prev.hand, card],
        energyPoints: Math.min(MAX_ENERGY, prev.energyPoints + ramRefund)
      };
    });
    gameRef.current.nodes.splice(idx, 1);
    setSelectedNodeIndex(null);
  };

  const initReroute = (idx: number) => {
    setReroutingNodeIndex(idx);
    setSelectedNodeIndex(null);
    addLog('[SYS] REROUTE: SELECT DESTINATION.');
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
      if (gameRef.current.nodes.some(n => n.gridX === x && n.gridY === y)) return addLog('[ERROR] PORT OCCUPIED.');
      if (gameState.energyPoints < cost) return addLog('[ERROR] INSUFFICIENT RAM.');
      const oldPos = { x: node.x, y: node.y };
      node.setPosition(x, y);
      setRerouteBeam({ from: oldPos, to: { x: node.x, y: node.y }, opacity: 1 });
      setTimeout(() => setRerouteBeam(null), 500);
      setGameState(prev => ({ ...prev, energyPoints: prev.energyPoints - cost }));
      setReroutingNodeIndex(null);
      return;
    }

    const nodeIdx = gameRef.current.nodes.findIndex(n => n.gridX === x && n.gridY === y);
    if (nodeIdx !== -1) {
      setSelectedNodeIndex(nodeIdx);
      setSelectedIndices([]);
      return;
    }

    if (selectedIndices.length === 1) {
      const idx = selectedIndices[0];
      const card = gameState.hand[idx];
      if (card.type === CardType.SECURITY_NODE && gameState.energyPoints >= card.cost) {
        if (gameRef.current.nodes.some(n => n.gridX === x && n.gridY === y)) return;
        gameRef.current.nodes.push(new SecurityNode(x, y, card));
        setGameState(prev => ({
          ...prev,
          energyPoints: prev.energyPoints - card.cost,
          hand: prev.hand.filter((_, i) => i !== idx),
          discard: [...prev.discard, card]
        }));
        setSelectedIndices([]);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: Math.floor((e.clientX - rect.left) / TILE_SIZE), y: Math.floor((e.clientY - rect.top) / TILE_SIZE) });
  };

  useEffect(() => {
    if (!canvasRef.current || !gameState.isGameStarted) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    let requestRef: number;
    const loop = (time: number) => {
      const dt = (time - gameRef.current.lastFrameTime) / 1000;
      gameRef.current.lastFrameTime = time;
      ctx.fillStyle = '#050814';
      ctx.fillRect(0, 0, 600, 600);
      
      ctx.strokeStyle = '#101525'; ctx.lineWidth = 1;
      for(let i=0; i<=GRID_SIZE; i++) {
        ctx.beginPath(); ctx.moveTo(i*TILE_SIZE, 0); ctx.lineTo(i*TILE_SIZE, 600); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i*TILE_SIZE); ctx.lineTo(600, i*TILE_SIZE); ctx.stroke();
      }
      
      ctx.strokeStyle = '#1A2A40'; ctx.lineWidth = 4; ctx.beginPath();
      gameRef.current.path.forEach((p, i) => i === 0 ? ctx.moveTo(p.x * TILE_SIZE + 30, p.y * TILE_SIZE + 30) : ctx.lineTo(p.x * TILE_SIZE + 30, p.y * TILE_SIZE + 30));
      ctx.stroke();
      
      const core = gameRef.current.path[gameRef.current.path.length-1];
      ctx.fillStyle = '#3DDCFF'; ctx.shadowBlur = 15; ctx.shadowColor = '#3DDCFF';
      ctx.fillRect(core.x * TILE_SIZE + 5, core.y * TILE_SIZE + 5, 50, 50); ctx.shadowBlur = 0;

      if (activeWave) {
        if (gameRef.current.malwareToSpawn > 0) {
          gameRef.current.spawnTimer += dt;
          if (gameRef.current.spawnTimer >= 0.8) {
            gameRef.current.malwarePackets.push(new MalwarePacket(gameRef.current.path, { hp: 40 * gameRef.current.difficultyMultiplier, speed: 2.0 }));
            gameRef.current.malwareToSpawn--;
            gameRef.current.spawnTimer = 0;
          }
        }
        gameRef.current.malwarePackets.forEach((e, idx) => {
          if (e.update(dt)) {
            setGameState(prev => {
              const newHP = Math.max(0, prev.kernelHP - 12);
              if (newHP <= 0 && prev.kernelHP > 0) setTimeout(() => saveSession(), 100);
              return { ...prev, kernelHP: newHP };
            });
            gameRef.current.malwarePackets.splice(idx, 1);
          } else if (e.hp <= 0) {
            gameRef.current.malwarePackets.splice(idx, 1);
            gameRef.current.defeatedCount++;
            setGameState(prev => ({ ...prev, energyPoints: Math.min(MAX_ENERGY, prev.energyPoints + 2) }));
          }
        });
        gameRef.current.projectiles.forEach((p, idx) => { p.update(); if (p.isDead) gameRef.current.projectiles.splice(idx, 1); });
        gameRef.current.nodes.forEach(n => n.update(dt, gameRef.current.malwarePackets, (node, target) => gameRef.current.projectiles.push(new FirewallBuffer(node.x, node.y, target, node.damage, node))));
        if (gameRef.current.malwareToSpawn === 0 && gameRef.current.malwarePackets.length === 0) endWave();
      }
      
      gameRef.current.malwarePackets.forEach(e => e.draw(ctx));
      gameRef.current.nodes.forEach(n => n.draw(ctx));
      gameRef.current.projectiles.forEach(p => p.draw(ctx));

      if (reroutingNodeIndex !== null || selectedIndices.length === 1) {
          if (mousePos) {
              const card = reroutingNodeIndex !== null ? gameRef.current.nodes[reroutingNodeIndex].card : gameState.hand[selectedIndices[0]];
              const range = (card.stats?.range || 2) * TILE_SIZE;
              ctx.beginPath(); ctx.arc(mousePos.x * 60 + 30, mousePos.y * 60 + 30, range, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(61, 220, 255, 0.1)'; ctx.fill();
              ctx.strokeStyle = reroutingNodeIndex !== null ? 'rgba(61, 220, 255, 0.6)' : 'rgba(156, 255, 87, 0.4)';
              ctx.setLineDash([4, 4]); ctx.strokeRect(mousePos.x * 60 + 5, mousePos.y * 60 + 5, 50, 50); ctx.setLineDash([]);
          }
      }

      requestRef = requestAnimationFrame(loop);
    };
    requestRef = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef);
  }, [activeWave, endWave, gameState.isScanning, gameState.isGameStarted, saveSession, selectedIndices, mousePos, gameState.hand, reroutingNodeIndex, rerouteBeam]);

  const canFuse = selectedIndices.length === 2 && gameState.hand[selectedIndices[0]]?.id === gameState.hand[selectedIndices[1]]?.id && gameState.hand[selectedIndices[0]]?.fusionTargetId;

  const fuseCards = useCallback(() => {
    if (!canFuse) return;
    const [i1, i2] = selectedIndices;
    const card1 = gameState.hand[i1];
    const fusedCard = MASTER_CARD_POOL[card1.fusionTargetId!];
    if (fusedCard) {
      addLog(`[SYS] FUSING: ${card1.name} x2 -> ${fusedCard.name}`);
      setGameState(prev => {
        const newHand = [...prev.hand];
        const toRemove = [i1, i2].sort((a, b) => b - a);
        newHand.splice(toRemove[0], 1); newHand.splice(toRemove[1], 1); newHand.push(fusedCard);
        return { ...prev, hand: newHand };
      });
      setSelectedIndices([]);
    }
  }, [selectedIndices, gameState.hand, canFuse]);

  const selectedNode = selectedNodeIndex !== null ? gameRef.current.nodes[selectedNodeIndex] : null;

  // MASTERY FADE MECHANIC
  const masteryFadeOpacity = Math.max(0, 1 - (gameState.waveNumber / 10));

  return (
    <div className="flex h-screen w-screen bg-[#050814] text-[#9CFF57] font-mono selection:bg-[#3DDCFF]/30 overflow-hidden relative">
      <aside className="w-1/4 border-r border-[#1A2A40] flex flex-col bg-[#050814]/50 backdrop-blur-sm z-20">
        <header className="p-4 border-b border-[#1A2A40] flex justify-between items-center bg-[#1A2A40]/10">
          <span className="font-black text-[#3DDCFF] italic text-xs tracking-wider uppercase">DIAG_ZONE_A</span>
          <div className={`w-2 h-2 rounded-full ${activeWave ? 'bg-red-500 animate-pulse' : 'bg-[#9CFF57]'}`}></div>
        </header>

        <section className="p-4 space-y-6 flex-1 overflow-hidden flex flex-col">
          <div className="space-y-4">
            <h1 className="text-xl font-black text-white italic">Aegis_OS</h1>
            <div className="p-3 holographic-panel rounded">
              <div className="flex justify-between text-[10px] mb-1 font-bold text-gray-400">
                <span>CORE_INTEGRITY</span>
                <span className={gameState.kernelHP < 30 ? "text-red-500 animate-pulse" : "text-[#9CFF57]"}>{gameState.kernelHP}%</span>
              </div>
              <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-[#1A2A40]">
                <div className="h-full bg-[#3DDCFF]" style={{width: `${gameState.kernelHP}%`}}></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className={`p-2 border border-[#1A2A40] ${ramFlash ? 'animate-ram-flash' : ''}`}>
                <div className="text-gray-500 font-bold uppercase">RAM_UNIT</div>
                <div className="text-[#3DDCFF] font-black text-lg">{gameState.energyPoints}GB</div>
              </div>
              <div className="p-2 border border-[#1A2A40]">
                <div className="text-gray-500 font-bold uppercase">THREAT_LVL</div>
                <div className="text-[#9CFF57] font-black text-lg">{gameState.waveNumber}</div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 border-t border-[#1A2A40] pt-4">
            <div className="text-gray-600 text-[9px] mb-2 uppercase font-black italic">>> KERNEL_LOG</div>
            <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-[#1A2A40] px-1">
              {gameState.statusLog.map((log, i) => (
                <div key={i} className={`text-[10px] ${log.includes('[AEGIS]') ? 'text-[#9CFF57]' : log.includes('[TACTICAL]') ? 'text-yellow-400' : 'text-gray-500'} flicker`}>{log}</div>
              ))}
            </div>
          </div>
        </section>

        <footer className="p-4 border-t border-[#1A2A40] space-y-2">
           <button onClick={toggleTacticalOverlay} disabled={!gameState.isGameStarted} className={`w-full py-2 border font-black text-[9px] tracking-[0.2em] uppercase rounded ${gameState.isTacticalOverlayOpen ? "border-[#3DDCFF] text-[#3DDCFF] animate-pulse" : "border-[#1A2A40] text-gray-500"}`}>VISUAL_DIAGNOSTIC</button>
           <button onClick={startWave} disabled={activeWave || gameState.isProcessing || !gameState.isGameStarted} className={`w-full py-4 border-2 font-black text-xs tracking-[0.3em] uppercase rounded ${activeWave || gameState.isProcessing || !gameState.isGameStarted ? "border-gray-800 text-gray-800" : "border-[#3DDCFF] text-[#3DDCFF]"}`}>INIT_BREACH</button>
        </footer>
      </aside>

      <main className="flex-1 relative flex flex-col bg-[#02040a] items-center justify-center p-8 overflow-hidden">
        <div className="relative group">
          <canvas ref={canvasRef} width={600} height={600} className="relative border border-[#1A2A40] bg-black cursor-crosshair rounded-sm" onMouseMove={handleMouseMove} onMouseLeave={() => setMousePos(null)} onClick={handleCanvasClick} />
          {selectedNode && (
            <div className="absolute z-40 holographic-panel p-4 animate-monitor-on w-64" style={{ left: Math.min(selectedNode.gridX * 60 + 70, 600 - 256), top: Math.max(selectedNode.gridY * 60 - 40, 0) }}>
              <div className="flex justify-between items-center mb-3 border-b border-[#9CFF57]/30 pb-1">
                <span className="text-[10px] font-black text-[#9CFF57] italic">PROT_SPEC: {selectedNode.card.name}</span>
                <button onClick={() => setSelectedNodeIndex(null)} className="text-red-500">[X]</button>
              </div>
              <div className="space-y-2 font-mono text-[10px]">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-gray-500 uppercase">BIT-DEPTH</span><br/><span className="text-[#9CFF57] font-black">{selectedNode.damage} BD</span></div>
                  <div><span className="text-gray-500 uppercase">LATENCY</span><br/><span className="text-[#3DDCFF] font-black">{(1/selectedNode.fireRate).toFixed(1)}s</span></div>
                </div>
                <div className="flex justify-between border-t border-[#1A2A40] pt-2"><span>PURGED:</span><span>{selectedNode.killCount} PKTS</span></div>
                <div className="flex justify-between"><span>UP-TIME:</span><span>{Math.floor(selectedNode.upTime)}s</span></div>
                <div className="p-2 bg-[#9CFF57]/5 border-l-2 border-[#9CFF57] italic text-[9px] text-[#9CFF57]/80 uppercase">{selectedNode.card.reasoningTip}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={() => initReroute(selectedNodeIndex!)} className="py-2 border border-[#3DDCFF]/50 text-[#3DDCFF] text-[9px] uppercase">REROUTE</button>
                <button onClick={() => decompileNode(selectedNodeIndex!)} className="py-2 border border-red-500/50 text-red-500 text-[9px] uppercase">DECOMPILE</button>
              </div>
            </div>
          )}
        </div>

        {gameState.isTacticalOverlayOpen && (
          <div className="absolute inset-0 z-40 bg-[#050814]/80 backdrop-blur-md flex items-center justify-center p-12 pointer-events-none" style={{ opacity: masteryFadeOpacity }}>
            <div className="w-full h-full border-4 border-[#3DDCFF] holographic-panel p-8 flex flex-col overflow-hidden animate-slide-left flicker pointer-events-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-8 border-b border-[#3DDCFF]/30 pb-4">Tactical_Diagnostic</h2>
              <div className="flex-1 grid grid-cols-2 gap-8">
                <div className="p-4 border border-[#3DDCFF]/30 bg-[#3DDCFF]/5">
                  <div className="text-[#3DDCFF] font-black text-[10px] mb-4 italic uppercase">>> Aegis_Visual_Scan</div>
                  {gameState.lastDiagnostic ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-yellow-900/20 p-2 border border-yellow-500/30"><span className="text-yellow-500 font-black text-xs uppercase">Target_Sector:</span><span className="text-white font-black text-lg">{gameState.lastDiagnostic.weakest_sector}</span></div>
                      <div className="text-gray-300 text-sm leading-relaxed italic font-mono border-l-2 border-yellow-500 pl-4 uppercase">"{gameState.lastDiagnostic.analysis}"</div>
                      <div className="p-2 border border-[#9CFF57]/30"><span className="text-[#9CFF57] font-black text-[10px] uppercase">Suggested_Patch:</span><br/><span className="text-white font-bold">{MASTER_CARD_POOL[gameState.lastDiagnostic.suggested_card_id]?.name}</span></div>
                    </div>
                  ) : <div className="text-gray-700 uppercase">NO_SCAN_DATA</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {(!gameState.isGameStarted || gameState.kernelHP <= 0) && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="relative p-12 holographic-panel border-2 border-[#3DDCFF] shadow-[0_0_30px_#3DDCFF] max-w-lg w-full text-center group animate-monitor-on">
              <h2 className={`text-5xl font-black italic tracking-tighter uppercase mb-4 flicker ${gameState.kernelHP <= 0 ? 'text-red-500' : 'text-[#3DDCFF]'}`}>{gameState.kernelHP <= 0 ? 'CORE_BREACHED' : 'AEGIS_OS'}</h2>
              <button onClick={gameState.kernelHP <= 0 ? resetGame : startGame} className={`w-full py-6 font-black text-sm tracking-[0.5em] uppercase border-2 ${gameState.kernelHP <= 0 ? 'border-red-500 text-red-500' : 'border-[#9CFF57] text-[#9CFF57]'}`}>{gameState.kernelHP <= 0 ? 'REBOOT_CORE' : 'INITIALIZE_KERNEL'}</button>
            </div>
          </div>
        )}
      </main>

      <aside className="w-1/4 border-l border-[#1A2A40] bg-[#050814]/50 backdrop-blur-sm flex flex-col z-20">
        <header className="p-4 border-b border-[#1A2A40] bg-[#1A2A40]/10 flex justify-between items-center"><span className="font-black text-[#9CFF57] italic text-xs tracking-wider uppercase">EXPLOIT_KIT</span></header>
        <section className="flex-1 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-[#1A2A40] text-[10px]"><span className="text-gray-500 uppercase font-black tracking-widest">Active_Modules</span></div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin scrollbar-thumb-[#1A2A40]">
            {gameState.hand.map((card, i) => (
              <div key={card.id + i} onClick={() => toggleSelect(i)} className={`relative p-3 border cursor-pointer group overflow-hidden ${selectedIndices.includes(i) ? "bg-[#3DDCFF]/10 border-[#3DDCFF] scale-[1.02]" : "bg-[#0A0F23]/60 border-[#9CFF57]/20"}`}>
                <div className="flex justify-between items-start mb-2"><span className="text-[9px] font-mono text-[#3DDCFF]">MOD-0x{i}</span><span className={`text-[12px] font-black ${gameState.energyPoints >= card.cost ? 'text-[#3DDCFF]' : 'text-red-500'}`}>{card.cost}GB</span></div>
                <h3 className="font-black text-[11px] uppercase text-[#9CFF57]">{card.name}</h3>
                <div className="grid grid-cols-2 gap-2 mt-3 border-t border-[#1A2A40] pt-2">
                  <div><span className="text-[7px] text-gray-500 uppercase font-bold">Bit_Depth</span><br/><span className="text-[10px] text-white font-black">{card.stats?.damage || 0}</span></div>
                  <div><span className="text-[7px] text-gray-500 uppercase font-bold">Latency</span><br/><span className="text-[10px] text-[#3DDCFF] font-black">{card.stats?.fireRate ? (1/card.stats.fireRate).toFixed(1) : 'N/A'}s</span></div>
                  <div className="col-span-2 pt-1 flex justify-between items-center border-t border-[#1A2A40]/30"><span className="text-[7px] text-[#9CFF57]/50 font-black uppercase truncate">{card.reasoningTip}</span><button onClick={e => purgeCard(i, e)} className="text-red-900 text-[7px]">[PURGE]</button></div>
                </div>
              </div>
            ))}
          </div>
        </section>
        <footer className="p-4 bg-[#1A2A40]/10 border-t border-[#1A2A40]"><button disabled={!canFuse} onClick={fuseCards} className={`w-full py-4 border-2 font-black text-[10px] italic tracking-[0.3em] uppercase rounded ${canFuse ? "border-[#9CFF57] text-[#9CFF57] animate-pulse" : "border-gray-800 text-gray-800 opacity-50"}`}>FUSE_SIGNATURES</button></footer>
      </aside>
    </div>
  );
};

export default App;

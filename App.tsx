
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, GameState, Point, CardType, SessionSummary, AegisResponse } from './types';
import { GRID_SIZE, TILE_SIZE, INITIAL_DECK, MAX_ENERGY, MASTER_CARD_POOL, INITIAL_HP } from './constants';
import { getAegisReasoning, getVisualDiagnostic, getRedemptionCard } from './services/gemini';
import { SecurityNode, MalwarePacket, FirewallBuffer } from './utils/gameClasses';

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
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [floatingTexts, setFloatingTexts] = useState<{id: number, x: number, y: number, text: string}[]>([]);

  const addLog = (msg: string) => {
    setGameState(prev => ({
      ...prev,
      statusLog: [msg, ...prev.statusLog].slice(0, 25)
    }));
  };

  const saveSession = useCallback(async (waveNumber: number, history: SessionSummary[]) => {
    const summary: SessionSummary = {
      waveReached: waveNumber,
      defeatedCount: gameRef.current.defeatedCount,
      timestamp: Date.now()
    };
    
    const newHistory = [...history, summary].slice(-10);
    localStorage.setItem('aegis_history', JSON.stringify(newHistory));
    
    setGameState(prev => ({ ...prev, history: newHistory }));
    
    addLog('[SYS] DATA DUMP COMPLETE. ANALYZING FAILURE PATTERNS...');
    const redemption = await getRedemptionCard(newHistory);
    if (redemption) {
      setGameState(prev => ({ ...prev, redemptionCard: redemption }));
      setShowRedemption(true);
    }
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

    setGameState({
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
      statusLog: ['[SYS_REBOOT] FLUSHING CACHE...', '[SYS_REBOOT] AEGIS KERNEL ACTIVE.'],
      history: JSON.parse(localStorage.getItem('aegis_history') || '[]'),
    });

    setActiveWave(false);
    setSelectedIndices([]);
    setShowRedemption(false);
    setSelectedNodeIndex(null);
    setReroutingNodeIndex(null);
    setFloatingTexts([]);
    addLog('[SYS] RE-INITIALIZATION SUCCESSFUL.');
  }, []);

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

  useEffect(() => {
    if (gameState.isGameStarted && gameState.hand.length === 0 && !gameState.isProcessing) {
      drawHand();
    }
  }, [gameState.isGameStarted, drawHand, gameState.isProcessing]);

  const startGame = () => setGameState(prev => ({ ...prev, isGameStarted: true }));

  const askGeminiForNextWave = async () => {
    const nodeTypes = gameRef.current.nodes.map(n => n.type);
    const aegisPromise = getAegisReasoning(gameState, gameRef.current.nodes.length, gameRef.current.defeatedCount, nodeTypes);
    const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 2500));
    const aegis = await Promise.race([aegisPromise, timeoutPromise]);

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
    } else {
      addLog('[SYS] LATENCY EXCEEDED. LOCAL OS MODE ENGAGED.');
      setGameState(prev => ({
        ...prev,
        waveNumber: prev.waveNumber + 1,
        energyPoints: Math.min(MAX_ENERGY, prev.energyPoints + 10),
        isProcessing: false
      }));
      drawHand([]);
    }
  };

  const startWave = async () => {
    if (activeWave) return;
    addLog(`[WAVE_${gameState.waveNumber + 1}] COMMENCING SECURITY AUDIT...`);
    gameRef.current.malwareToSpawn = 6 + gameState.waveNumber * 3;
    gameRef.current.spawnTimer = 0;
    setActiveWave(true);
  };

  const endWave = useCallback(async () => {
    setActiveWave(false);
    setSelectedNodeIndex(null);
    setReroutingNodeIndex(null);
    setGameState(prev => ({ ...prev, isProcessing: true, isTacticalOverlayOpen: false }));
    addLog('[SYS] BREACH CONCLUDED. QUERYING DIRECTOR...');
    await askGeminiForNextWave();
    setGameState(prev => ({
        ...prev,
        discard: [...prev.discard, ...prev.hand],
        hand: []
    }));
  }, [gameState, drawHand]);

  const runVisualDiagnostic = async () => {
    if (!canvasRef.current || gameState.isScanning) return;
    setGameState(prev => ({ ...prev, isScanning: true, isTacticalOverlayOpen: true }));
    addLog('[SCANNER] CAPTURING MAINFRAME TELEMETRY...');
    const imageData = canvasRef.current.toDataURL('image/jpeg', 0.8);
    const diagnostic = await getVisualDiagnostic(imageData, gameState.waveNumber, gameState.kernelHP);
    if (diagnostic) {
      addLog(`[TACTICAL] VULNERABILITY DETECTED AT ${diagnostic.weakest_sector}`);
      setGameState(prev => ({ ...prev, isScanning: false, lastDiagnostic: diagnostic }));
    } else {
      addLog('[SCANNER] SIGNAL LOSS. REBOOTING SCANNER UNIT.');
      setGameState(prev => ({ ...prev, isScanning: false }));
    }
  };

  const toggleSelect = (idx: number) => {
    setSelectedNodeIndex(null);
    setReroutingNodeIndex(null);
    setSelectedIndices(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [idx]);
  };

  const purgeCard = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (gameState.energyPoints < 1) return addLog('[ERROR] RAM INSUFFICIENT FOR PURGE.');
    setGameState(prev => ({
      ...prev,
      energyPoints: prev.energyPoints - 1,
      hand: prev.hand.filter((_, i) => i !== idx),
      discard: [...prev.discard, prev.hand[idx]]
    }));
    setSelectedIndices([]);
    addLog('[SYS] DATA SEGMENT PURGED.');
  };

  const initReroute = (idx: number) => {
    setReroutingNodeIndex(idx);
    setSelectedNodeIndex(null);
    addLog(`[SYS] REROUTE SEQUENCE ARMED. SELECT TARGET JUNCTION.`);
  };

  const decompileNode = (idx: number) => {
    const node = gameRef.current.nodes[idx];
    if (node.isDissolving) return;

    const card = node.card;
    const isBufferFull = gameState.hand.length >= 5;
    const ramRefund = Math.floor(card.cost * (isBufferFull ? 0.8 : 0.5));

    // Reactive State Update
    setGameState(prev => ({
      ...prev,
      hand: isBufferFull ? prev.hand : [...prev.hand, card],
      energyPoints: Math.min(MAX_ENERGY, prev.energyPoints + ramRefund)
    }));

    // Spawn Floating RAM Text
    const textId = Date.now();
    setFloatingTexts(prev => [...prev, {
      id: textId,
      x: node.x,
      y: node.y - 20,
      text: `+${ramRefund} RAM`
    }]);

    // Trigger Dissolve Animation
    node.isDissolving = true;
    setSelectedNodeIndex(null);
    addLog(`[SYS] DECOMPILING ${card.name}. RECLAIMING ${ramRefund} GB.`);

    // Cleanup logic
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(t => t.id !== textId));
    }, 1200);

    setTimeout(() => {
      const liveIndex = gameRef.current.nodes.indexOf(node);
      if (liveIndex > -1) {
        gameRef.current.nodes.splice(liveIndex, 1);
      }
    }, node.DISSOLVE_DURATION * 1000);
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
      if (gameRef.current.nodes.some(n => n.gridX === x && n.gridY === y)) return addLog('[ERROR] JUNCTION OCCUPIED.');
      if (gameState.energyPoints < cost) return addLog('[ERROR] RAM INSUFFICIENT FOR REROUTE.');
      node.setPosition(x, y);
      setGameState(prev => ({ ...prev, energyPoints: prev.energyPoints - cost }));
      setReroutingNodeIndex(null);
      return;
    }

    const nodeIdx = gameRef.current.nodes.findIndex(n => n.gridX === x && n.gridY === y);
    if (nodeIdx !== -1) {
      if (gameRef.current.nodes[nodeIdx].isDissolving) return;
      setSelectedNodeIndex(nodeIdx);
      setSelectedIndices([]);
      addLog(`[DIAG] ACCESSING NODE ${gameRef.current.nodes[nodeIdx].type} AT PORT ${x},${y}`);
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
      } else if (card.id === 'system_scan') {
        if (gameState.energyPoints < card.cost) return addLog('[ERROR] RAM INSUFFICIENT FOR SCAN.');
        setGameState(prev => ({
          ...prev,
          energyPoints: prev.energyPoints - card.cost,
          hand: prev.hand.filter((_, i) => i !== idx),
          discard: [...prev.discard, card]
        }));
        runVisualDiagnostic();
        setSelectedIndices([]);
      }
    } else {
      setSelectedNodeIndex(null);
    }
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
      
      // GRID - Matrix Dark Theme
      ctx.strokeStyle = '#101525'; ctx.lineWidth = 1;
      for(let i=0; i<=GRID_SIZE; i++) {
        ctx.beginPath(); ctx.moveTo(i*TILE_SIZE, 0); ctx.lineTo(i*TILE_SIZE, 600); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i*TILE_SIZE); ctx.lineTo(600, i*TILE_SIZE); ctx.stroke();
      }
      
      // PATH - Cyber Blue Trace
      ctx.strokeStyle = '#1A2A40'; ctx.lineWidth = 4; ctx.beginPath();
      gameRef.current.path.forEach((p, i) => i === 0 ? ctx.moveTo(p.x * TILE_SIZE + 30, p.y * TILE_SIZE + 30) : ctx.lineTo(p.x * TILE_SIZE + 30, p.y * TILE_SIZE + 30));
      ctx.stroke();
      
      // KERNEL CORE
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
              if (newHP <= 0 && prev.kernelHP > 0) {
                const wave = prev.waveNumber;
                const hist = prev.history;
                setTimeout(() => saveSession(wave, hist), 100);
              }
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

      // RETICLE LOGIC: Draw neon targeting reticle around selected node
      if (selectedNodeIndex !== null) {
        const node = gameRef.current.nodes[selectedNodeIndex];
        const nx = node.x;
        const ny = node.y;
        const size = 30 + Math.sin(time / 200) * 5; // Pulsing reticle
        
        ctx.strokeStyle = '#3DDCFF';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#3DDCFF';
        
        // Draw 4 corners of the reticle
        const bracketLen = 12;
        // Top Left
        ctx.beginPath();
        ctx.moveTo(nx - size, ny - size + bracketLen);
        ctx.lineTo(nx - size, ny - size);
        ctx.lineTo(nx - size + bracketLen, ny - size);
        ctx.stroke();
        
        // Top Right
        ctx.beginPath();
        ctx.moveTo(nx + size, ny - size + bracketLen);
        ctx.lineTo(nx + size, ny - size);
        ctx.lineTo(nx + size - bracketLen, ny - size);
        ctx.stroke();
        
        // Bottom Left
        ctx.beginPath();
        ctx.moveTo(nx - size, ny + size - bracketLen);
        ctx.lineTo(nx - size, ny + size);
        ctx.lineTo(nx - size + bracketLen, ny + size);
        ctx.stroke();
        
        // Bottom Right
        ctx.beginPath();
        ctx.moveTo(nx + size, ny + size - bracketLen);
        ctx.lineTo(nx + size, ny + size);
        ctx.lineTo(nx + size - bracketLen, ny + size);
        ctx.stroke();
        
        ctx.shadowBlur = 0;

        // Draw node range circle
        ctx.beginPath();
        ctx.arc(nx, ny, node.range, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(61, 220, 255, 0.15)';
        ctx.setLineDash([10, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Placement ghosting
      if ((reroutingNodeIndex !== null || selectedIndices.length === 1) && mousePos) {
          const card = reroutingNodeIndex !== null ? gameRef.current.nodes[reroutingNodeIndex].card : gameState.hand[selectedIndices[0]];
          if (card && card.type === CardType.SECURITY_NODE) {
            ctx.beginPath(); ctx.arc(mousePos.x * 60 + 30, mousePos.y * 60 + 30, (card.stats?.range || 2) * TILE_SIZE, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(61, 220, 255, 0.1)'; ctx.fill();
            ctx.strokeStyle = 'rgba(61, 220, 255, 0.5)'; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
          }
      }

      requestRef = requestAnimationFrame(loop);
    };
    requestRef = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef);
  }, [activeWave, endWave, gameState.isScanning, gameState.isGameStarted, selectedIndices, mousePos, gameState.hand, reroutingNodeIndex, saveSession, selectedNodeIndex]);

  const canFuse = selectedIndices.length === 2 && gameState.hand[selectedIndices[0]]?.id === gameState.hand[selectedIndices[1]]?.id && gameState.hand[selectedIndices[0]]?.fusionTargetId;

  const fuseCards = useCallback(() => {
    if (!canFuse) return;
    const [i1, i2] = selectedIndices;
    const card1 = gameState.hand[i1];
    const fusedCard = MASTER_CARD_POOL[card1.fusionTargetId!];
    if (fusedCard) {
      addLog(`[SYNTHESIS] MERGING SIGNATURES: ${card1.name} -> ${fusedCard.name}`);
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

  return (
    <div className="flex h-screen w-screen bg-[#050814] text-[#9CFF57] font-mono selection:bg-[#3DDCFF]/30 overflow-hidden relative">
      
      {/* ZONE 1: KERNEL DIAGNOSTICS (Left Sidebar) */}
      <aside className="w-80 h-full border-r border-[#1A2A40] flex flex-col bg-[#050814]/95 backdrop-blur-xl z-30 shadow-[5px_0_30px_rgba(0,0,0,0.5)]">
        <header className="p-4 border-b border-[#1A2A40] flex justify-between items-center bg-[#1A2A40]/20">
          <span className="font-black text-[#3DDCFF] italic text-xs tracking-[0.3em] uppercase flicker">KERNEL_STATUS_A</span>
          <div className={`w-3 h-3 rounded-full ${activeWave ? 'bg-red-500 animate-pulse shadow-[0_0_10px_red]' : 'bg-[#9CFF57] shadow-[0_0_10px_#9CFF57]'}`}></div>
        </header>

        <section className="p-5 space-y-8 flex-1 overflow-hidden flex flex-col">
          <div className="space-y-6">
            <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase flicker leading-none">AEGIS_OS</h1>
            
            <div className="p-5 holographic-panel rounded border-[#3DDCFF]/30 shadow-inner">
              <div className="flex justify-between text-[11px] mb-2 font-black text-gray-500 tracking-[0.2em]">
                <span>CORE_HEALTH</span>
                <span className={gameState.kernelHP < 30 ? "text-red-500 animate-pulse" : "text-[#9CFF57]"}>{gameState.kernelHP}%</span>
              </div>
              <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden border border-[#1A2A40]">
                <div className="h-full bg-[#3DDCFF] shadow-[0_0_15px_#3DDCFF] transition-all duration-700 ease-out" style={{width: `${gameState.kernelHP}%`}}></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-[10px]">
              <div className="p-4 border border-[#1A2A40] bg-[#1A2A40]/30 rounded-sm group hover:border-[#3DDCFF]/40 transition-colors">
                <div className="text-gray-600 font-black uppercase tracking-widest mb-1">RAM_RESOURCES</div>
                <div className="text-[#3DDCFF] font-black text-2xl tracking-tighter">{gameState.energyPoints} <span className="text-xs opacity-40">GB</span></div>
              </div>
              <div className="p-4 border border-[#1A2A40] bg-[#1A2A40]/30 rounded-sm group hover:border-[#9CFF57]/40 transition-colors">
                <div className="text-gray-600 font-black uppercase tracking-widest mb-1">SECTOR_ID</div>
                <div className="text-[#9CFF57] font-black text-2xl tracking-tighter">0x{gameState.waveNumber.toString(16).toUpperCase().padStart(2, '0')}</div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 border-t border-[#1A2A40] pt-6">
            <div className="text-gray-700 text-[10px] mb-4 uppercase font-black italic tracking-[0.4em] flex items-center">
              <span className="w-2 h-2 bg-[#9CFF57] mr-3 rounded-full opacity-50"></span> LOG_STREAM_BUFFER
            </div>
            <div className="flex-1 overflow-y-auto space-y-2.5 scrollbar-thin scrollbar-thumb-[#1A2A40] px-1 font-mono text-[11px]">
              {gameState.statusLog.map((log, i) => (
                <div key={i} className={`leading-relaxed border-l-2 pl-4 transition-all duration-300 ${
                  log.includes('[AEGIS]') ? 'text-[#9CFF57] border-[#9CFF57]/60' : 
                  log.includes('[SYS]') ? 'text-gray-500 border-gray-900' :
                  log.includes('[TACTICAL]') ? 'text-yellow-400 border-yellow-500/60' :
                  'text-gray-600 border-gray-950 opacity-80'
                } flicker`}>{log}</div>
              ))}
            </div>
          </div>
        </section>

        <footer className="p-5 border-t border-[#1A2A40] bg-black/40 space-y-4">
           <button 
             onClick={startWave} 
             disabled={activeWave || gameState.isProcessing || !gameState.isGameStarted} 
             className={`w-full py-6 border-2 font-black text-sm tracking-[0.6em] uppercase transition-all overflow-hidden relative group rounded-sm ${
               activeWave || gameState.isProcessing || !gameState.isGameStarted ? "border-gray-900 text-gray-900" : "border-[#3DDCFF] text-[#3DDCFF] hover:bg-[#3DDCFF]/15 shadow-[0_0_20px_rgba(61,220,255,0.3)]"
             }`}
           >
             <span className="relative z-10">{gameState.isProcessing ? "SYNCING..." : "INIT_BREACH"}</span>
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
           </button>
        </footer>
      </aside>

      {/* CENTER & RIGHT: GRID + KIT */}
      <div className="flex-1 flex flex-col relative">
        
        {/* ZONE 2: CENTER GRID (THE MAINFRAME) */}
        <main className="flex-1 flex items-center justify-center p-12 bg-[#02040a] relative overflow-hidden group">
          <div className="scanline-overlay"></div>
          
          <div className="relative p-2 border-2 border-[#1A2A40]/60 bg-[#050814] shadow-[0_0_60px_rgba(0,0,0,1)] transition-transform duration-700 rounded-sm">
            <canvas 
              ref={canvasRef} 
              width={600} 
              height={600} 
              className="relative cursor-crosshair rounded-sm opacity-90 group-hover:opacity-100 transition-opacity" 
              onMouseMove={(e) => {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (!rect) return;
                setMousePos({ x: Math.floor((e.clientX - rect.left) / TILE_SIZE), y: Math.floor((e.clientY - rect.top) / TILE_SIZE) });
              }} 
              onMouseLeave={() => setMousePos(null)} 
              onClick={handleCanvasClick} 
            />
            
            {/* FLOATING RAM TEXTS */}
            {floatingTexts.map(t => (
              <div 
                key={t.id} 
                className="absolute z-[60] pointer-events-none text-[#3DDCFF] font-black text-lg animate-drift-up"
                style={{ left: t.x, top: t.y }}
              >
                {t.text}
              </div>
            ))}

            {/* FLOATING DIAGNOSTIC PANEL FOR SELECTED NODE */}
            {selectedNode && (
              <div className="absolute z-50 holographic-panel p-6 animate-monitor-on w-80 border-[#3DDCFF]/50 shadow-[0_0_50px_rgba(61,220,255,0.25)] rounded-sm" 
                   style={{ left: Math.min(selectedNode.gridX * 60 + 80, 600 - 320), top: Math.max(selectedNode.gridY * 60 - 60, 0) }}>
                <div className="flex justify-between items-center mb-5 border-b border-[#9CFF57]/40 pb-3">
                  <span className="text-[12px] font-black text-[#9CFF57] italic tracking-widest uppercase">LIVE_METRICS: {selectedNode.card.name}</span>
                  <button onClick={() => setSelectedNodeIndex(null)} className="text-red-500 hover:text-white transition-colors font-black text-sm">[X]</button>
                </div>
                <div className="space-y-4 font-mono text-[11px] uppercase tracking-tighter">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="p-2 border border-[#1A2A40] bg-black/40"><span className="text-gray-500 font-black text-[9px]">BIT_DEPTH</span><br/><span className="text-[#9CFF57] font-black text-base">{selectedNode.damage} BD</span></div>
                    <div className="p-2 border border-[#1A2A40] bg-black/40"><span className="text-gray-500 font-black text-[9px]">LATENCY</span><br/><span className="text-[#3DDCFF] font-black text-base">{(1/selectedNode.fireRate).toFixed(1)}s</span></div>
                  </div>
                  
                  {/* LIVE STATS */}
                  <div className="space-y-2 py-3 border-y border-[#1A2A40]/50">
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-black">NEUTRALIZED_PACKETS:</span>
                      <span className="text-white font-black">{selectedNode.killCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-black">UPTIME_RUNTIME:</span>
                      <span className="text-white font-black">{Math.floor(selectedNode.upTime)}s</span>
                    </div>
                  </div>

                  {/* REASONING TIP FROM MASTER DATA */}
                  <div className="p-4 bg-[#9CFF57]/10 border-l-2 border-[#9CFF57] italic text-[10px] text-[#9CFF57]/90 leading-relaxed mt-4 shadow-sm animate-pulse">
                    <span className="block text-[8px] font-black text-[#9CFF57]/40 mb-1 uppercase tracking-widest">>> KERNEL_REASONING_TIP</span>
                    {selectedNode.card.reasoningTip}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-8">
                  <button onClick={() => initReroute(selectedNodeIndex!)} className="py-3 bg-[#3DDCFF]/10 border border-[#3DDCFF]/40 text-[#3DDCFF] hover:bg-[#3DDCFF] hover:text-black transition-all text-[11px] font-black uppercase tracking-widest">REROUTE</button>
                  <button onClick={() => decompileNode(selectedNodeIndex!)} className="py-3 bg-red-500/10 border border-red-500/40 text-red-500 hover:bg-red-500 hover:text-white transition-all text-[11px] font-black uppercase tracking-widest">DECOMPILE</button>
                </div>
              </div>
            )}
          </div>

          {/* TACTICAL OVERLAY */}
          {gameState.isTacticalOverlayOpen && (
            <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex items-center justify-center p-20 transition-all duration-1000" style={{ opacity: Math.max(0.1, Math.max(0, 1 - (gameState.waveNumber / 10))) }}>
              <div className="w-full max-w-6xl h-full border-2 border-[#3DDCFF]/70 holographic-panel p-12 flex flex-col animate-slide-left overflow-hidden relative shadow-[0_0_80px_rgba(61,220,255,0.2)]">
                <div className="absolute top-6 right-8">
                   <button onClick={() => setGameState(prev => ({ ...prev, isTacticalOverlayOpen: false }))} className="text-[#3DDCFF] hover:text-white font-black tracking-[0.3em] uppercase text-xs border border-[#3DDCFF]/40 px-4 py-2 hover:bg-[#3DDCFF]/10 transition-all">[X] CLOSE_REPORT</button>
                </div>
                <h2 className="text-6xl font-black text-white italic tracking-tighter uppercase mb-10 border-b border-[#3DDCFF]/40 pb-8 flicker">MAINFRAME_AUDIT_DUMP</h2>
                
                <div className="flex-1 grid grid-cols-3 gap-12 overflow-hidden">
                  <div className="col-span-2 p-10 border border-[#3DDCFF]/20 bg-[#3DDCFF]/5 overflow-y-auto scrollbar-thin scrollbar-thumb-[#1A2A40] rounded-sm">
                    <div className="text-[#3DDCFF] font-black text-sm mb-8 italic tracking-[0.5em] uppercase">>> NEURAL_REASONING_CHAIN</div>
                    {gameState.isScanning ? (
                      <div className="flex flex-col items-center justify-center h-80 space-y-8">
                        <div className="w-20 h-20 border-4 border-[#3DDCFF] border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(61,220,255,0.5)]"></div>
                        <span className="text-[#3DDCFF] font-black text-2xl animate-pulse tracking-[0.4em] uppercase flicker italic">Analyzing Grid Geometries...</span>
                      </div>
                    ) : gameState.lastDiagnostic ? (
                      <div className="space-y-10 animate-monitor-on">
                        <div className="flex justify-between items-center bg-yellow-900/15 p-6 border border-yellow-500/40 shadow-inner">
                          <span className="text-yellow-500 font-black text-sm uppercase tracking-[0.5em] italic">Critical_Port:</span>
                          <span className="text-white font-black text-5xl tracking-tighter shadow-yellow-500/20">{gameState.lastDiagnostic.weakest_sector}</span>
                        </div>
                        <div className="text-gray-100 text-2xl leading-relaxed italic font-mono border-l-4 border-[#3DDCFF] pl-10 uppercase tracking-tighter opacity-90">
                          "{gameState.lastDiagnostic.analysis}"
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                          <div className="p-8 border border-[#9CFF57]/50 bg-[#9CFF57]/5 shadow-sm group hover:bg-[#9CFF57]/10 transition-all">
                            <span className="text-[#9CFF57] font-black text-[11px] uppercase tracking-widest block mb-3 opacity-70">Recommended_Module:</span>
                            <span className="text-white font-black text-3xl uppercase tracking-tighter">{MASTER_CARD_POOL[gameState.lastDiagnostic.suggested_card_id]?.name || 'N/A'}</span>
                          </div>
                          <div className="p-8 border border-red-500/50 bg-red-500/5 shadow-sm group hover:bg-red-500/10 transition-all">
                            <span className="text-red-500 font-black text-[11px] uppercase tracking-widest block mb-3 opacity-70">Risk_Assessment:</span>
                            <span className="text-white font-black text-3xl uppercase tracking-tighter flicker">{gameState.lastDiagnostic.severity_level}</span>
                          </div>
                        </div>
                      </div>
                    ) : <div className="text-gray-800 font-black uppercase tracking-[1.5em] text-center mt-40 text-3xl opacity-30 italic">SCAN_BUFFER_NULL</div>}
                  </div>
                  
                  <div className="space-y-8 flex flex-col h-full">
                    <div className="flex-1 p-8 border border-white/10 bg-black/50 text-[12px] font-mono text-gray-500 leading-relaxed uppercase shadow-inner">
                       <span className="text-[#3DDCFF] block mb-6 font-black uppercase tracking-[0.4em] border-b border-[#3DDCFF]/30 pb-3">>> KERNEL_METRICS</span>
                       [WAVE_PTR] 0x{gameState.waveNumber.toString(16).toUpperCase()} <br/>
                       [CORE_INT] {gameState.kernelHP}% <br/>
                       [RAM_ALLOC] {gameState.energyPoints} GB <br/>
                       [DIAG_STAT] {gameState.isScanning ? 'BUSY' : 'READY'} <br/>
                       [AI_VIS_OP] {Math.round(Math.max(0, 1 - (gameState.waveNumber / 10)) * 100)}% <br/>
                       <div className="mt-12 text-xs text-gray-700 italic font-black p-6 border border-dashed border-gray-900 leading-snug tracking-tighter bg-black/20">
                         ADAPTIVE LEARNING: AS SYSTEM OPERATOR PROFICIENCY INCREASES, VISUAL SCAFFOLDING AUTOMATICALLY RE-ALLOCATES TO KERNEL OPTIMIZATION.
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ZONE 3: EXPLOIT KIT (Bottom Tray) */}
        <section className="h-64 border-t-4 border-[#1A2A40] bg-[#050814] p-6 flex flex-col z-30 transition-all duration-700 shadow-[-10px_0_50px_rgba(0,0,0,0.9)]">
           <header className="flex justify-between items-center mb-5 px-6">
              <span className="text-[#9CFF57] font-black text-[12px] italic tracking-[0.6em] uppercase flicker">>> EXPLOIT_KIT_STREAM</span>
              <div className="flex items-center space-x-12">
                <button 
                  disabled={!canFuse} 
                  onClick={fuseCards} 
                  className={`px-10 py-2.5 border-2 font-black text-xs italic tracking-[0.3em] uppercase transition-all rounded-sm ${
                    canFuse ? "border-[#9CFF57] text-[#9CFF57] hover:bg-[#9CFF57]/20 animate-pulse shadow-[0_0_25px_#9CFF57]" : "border-gray-950 text-gray-950"
                  }`}
                >
                  SYNTHESIZE_SIGNATURES
                </button>
                <div className="flex flex-col items-end">
                  <span className="text-[11px] text-gray-700 font-black uppercase tracking-[0.3em] mb-1">ALLOCATION_LOAD</span>
                  <div className="flex space-x-1.5 mt-1">
                    {[0,1,2,3,4].map(i => (
                      <div key={i} className={`w-4 h-1.5 transition-all duration-300 ${gameState.hand.length > i ? 'bg-[#9CFF57] shadow-[0_0_5px_#9CFF57]' : 'bg-gray-950'}`}></div>
                    ))}
                  </div>
                </div>
              </div>
           </header>
           
           <div className="flex-1 flex space-x-6 overflow-x-auto px-6 pb-5 scrollbar-thin scrollbar-thumb-[#1A2A40] scrollbar-track-transparent">
            {gameState.hand.map((card, i) => {
              const isSelected = selectedIndices.includes(i);
              const canAfford = gameState.energyPoints >= card.cost;
              return (
                <div 
                  key={card.id + i} 
                  onClick={() => toggleSelect(i)} 
                  className={`flex-shrink-0 w-72 relative p-5 border-2 cursor-pointer transition-all duration-500 group overflow-hidden flex flex-col justify-between rounded-sm ${
                    isSelected ? "bg-[#3DDCFF]/15 border-[#3DDCFF] -translate-y-4 scale-105 shadow-[0_15px_40px_rgba(61,220,255,0.3)]" : 
                    "bg-[#0A0F23]/95 border-[#9CFF57]/25 hover:border-[#9CFF57]/60 hover:bg-[#1A2A40]/80"
                  } ${!canAfford ? 'opacity-30 grayscale blur-[0.5px] pointer-events-none' : ''}`}
                >
                  <div className="card-scanline opacity-30"></div>
                  <div className="flex justify-between items-start mb-2 z-10">
                    <span className="text-[10px] font-mono text-[#3DDCFF] font-black italic tracking-tighter opacity-60">MOD_0x{i.toString(16).toUpperCase()}</span>
                    <span className={`text-base font-black tracking-tighter ${canAfford ? 'text-[#3DDCFF]' : 'text-red-700'} flicker`}>{card.cost} <span className="text-[10px] opacity-50">GB</span></span>
                  </div>
                  
                  <h3 className={`font-black text-base uppercase tracking-tight z-10 leading-none mb-1 shadow-sm ${card.rarity === 'LEGENDARY' ? 'text-yellow-500' : 'text-[#9CFF57]'}`}>
                    {card.name}
                  </h3>
                  
                  {/* SPEC READOUTS */}
                  <div className="mt-5 border-t border-[#1A2A40]/60 pt-4 grid grid-cols-2 gap-4 z-10">
                    <div className="bg-black/40 p-1.5 border border-[#1A2A40]/30 rounded-xs">
                      <span className="text-[8px] text-gray-600 uppercase font-black tracking-widest block mb-0.5">BIT_DEPTH</span>
                      <span className="text-sm text-white font-black tracking-tighter">{card.stats?.damage || '0'} <span className="text-[9px] opacity-40">BD</span></span>
                    </div>
                    <div className="bg-black/40 p-1.5 border border-[#1A2A40]/30 rounded-xs">
                      <span className="text-[8px] text-gray-600 uppercase font-black tracking-widest block mb-0.5">LATENCY</span>
                      <span className="text-sm text-[#3DDCFF] font-black tracking-tighter">{card.stats?.fireRate ? (1/card.stats.fireRate).toFixed(1) : 'N/A'}<span className="text-[9px] opacity-40">s</span></span>
                    </div>
                  </div>
                  
                  <div className="mt-4 text-[10px] text-[#9CFF57]/60 font-black uppercase tracking-tighter truncate z-10 flex justify-between items-center group-hover:text-[#9CFF57]/95 transition-colors">
                    <span className="italic overflow-hidden truncate mr-2">{card.reasoningTip}</span>
                    <button 
                      onClick={e => purgeCard(i, e)} 
                      className="text-red-900 hover:text-red-500 font-black text-xs transition-colors px-1.5 border border-red-900/40 rounded-xs hover:bg-red-500/10"
                      title="PURGE MOD_SEGMENT"
                    >
                      X
                    </button>
                  </div>

                  {isSelected && <div className="absolute inset-x-0 bottom-0 h-1 bg-[#3DDCFF] animate-pulse pointer-events-none"></div>}
                </div>
              );
            })}
           </div>
        </section>

        {/* --- SYSTEM_HALTED / AEGIS_INIT SCREENS --- */}
        {(!gameState.isGameStarted || gameState.kernelHP <= 0) && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-[#050814]/98 backdrop-blur-3xl transition-all duration-1000">
            <div className="relative p-24 holographic-panel border-4 border-[#3DDCFF] shadow-[0_0_120px_rgba(61,220,255,0.4)] max-w-3xl w-full text-center group animate-monitor-on rounded-xs">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#3DDCFF] flicker shadow-[0_0_20px_#3DDCFF]"></div>
              
              <h2 className={`text-8xl font-black italic tracking-tighter uppercase mb-10 flicker leading-none ${gameState.kernelHP <= 0 ? 'text-red-600 shadow-[0_0_25px_rgba(255,0,0,0.5)]' : 'text-[#3DDCFF]'}`}>
                {gameState.kernelHP <= 0 ? 'SYSTEM_HALTED' : 'CIRCUIT_BREACH'}
              </h2>
              
              <div className="text-[16px] text-gray-600 tracking-[2em] font-black uppercase border-y border-white/5 py-8 mb-14 italic opacity-70">STRATEGIC_DEFENSE_KERNEL_V2.5</div>
              
              {gameState.kernelHP <= 0 && (
                <div className="mb-12 p-8 bg-red-900/15 border border-red-600/40 text-red-600 text-sm font-black uppercase tracking-[0.2em] animate-pulse italic leading-relaxed">
                  CORE_EXCEPTION_TRAP: KERNEL_INTEGRITY_COMPROMISED.
                  <br/>
                  MEM_SEGMENT_FAULT_AT: 0xDEADBEEF
                  <br/>
                  <span className="text-xs opacity-60">REBOOT_REQUIRED_TO_RE_INITIALIZE_DEFENSE_LAYER</span>
                </div>
              )}

              <button 
                onClick={gameState.kernelHP <= 0 ? resetGame : startGame} 
                className={`w-full py-8 font-black text-2xl tracking-[1em] uppercase border-2 transition-all hover:scale-[1.03] active:scale-[0.97] relative overflow-hidden group rounded-xs ${
                  gameState.kernelHP <= 0 ? 'border-red-600 text-red-600 hover:bg-red-600/10' : 'border-[#9CFF57] text-[#9CFF57] hover:bg-[#9CFF57]/15'
                }`}
              >
                <span className="relative z-10">{gameState.kernelHP <= 0 ? 'FORCE_REBOOT' : 'BOOT_KERNEL'}</span>
                <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-in-out"></div>
              </button>
              
              <div className="mt-12 text-[10px] text-gray-800 font-black tracking-[0.8em] uppercase opacity-50">
                AEGIS_V2.5_STABLE // NEURAL_CORE_GEMINI_3_PRO
              </div>
            </div>
          </div>
        )}

        {/* PROCESSING / RE_SYNCHING OVERLAY */}
        {gameState.isProcessing && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-[6px] z-50 flex items-center justify-center transition-all duration-700">
            <div className="p-20 border-y-4 border-[#3DDCFF]/30 w-full flex flex-col items-center bg-[#050814]/95 shadow-[0_0_120px_rgba(0,0,0,1)] animate-monitor-on relative">
              <div className="absolute top-0 w-64 h-1.5 bg-[#3DDCFF] animate-pulse shadow-[0_0_15px_#3DDCFF]"></div>
              <div className="text-[#3DDCFF] font-black animate-pulse text-6xl tracking-[1.5em] italic uppercase mb-8 flicker">RE_SYNCHING</div>
              <div className="text-[13px] text-gray-600 font-mono tracking-[0.8em] animate-bounce uppercase font-black italic">OPTIMIZING_THREAT_VECTORS_AND_RESOURCE_REGISTRY...</div>
              <div className="absolute bottom-0 w-64 h-1.5 bg-[#3DDCFF] animate-pulse shadow-[0_0_15px_#3DDCFF]"></div>
            </div>
          </div>
        )}

      </div>

      {/* ZONE 4: REDEMPTION (LEGENDARY OVERLAY) */}
      {showRedemption && gameState.redemptionCard && (
        <div className="absolute inset-0 bg-black/98 backdrop-blur-3xl z-[200] flex items-center justify-center p-20">
          <div className="max-w-2xl w-full p-16 border-4 border-yellow-500 bg-[#050814] shadow-[0_0_200px_rgba(234,179,8,0.5)] relative overflow-hidden group animate-monitor-on rounded-xs">
             <div className="absolute top-0 left-0 w-full h-1.5 bg-yellow-500 flicker shadow-[0_0_25px_yellow]"></div>
             <div className="text-yellow-500 font-black tracking-[0.8em] uppercase text-[12px] mb-12 flex items-center">
               <span className="flex-1 h-0.5 bg-yellow-500/30"></span>
               <span className="mx-8 italic">Neural_Redemption_Module_V3</span>
               <span className="flex-1 h-0.5 bg-yellow-500/30"></span>
             </div>
             <h2 className="text-6xl font-black text-white italic mb-8 tracking-tighter uppercase leading-none shadow-yellow-500/20">{gameState.redemptionCard.name}</h2>
             <p className="text-gray-400 text-xl mb-14 leading-relaxed italic border-l-4 border-yellow-500/60 pl-10 font-mono uppercase tracking-tight opacity-90">"{gameState.redemptionCard.description}"</p>
             <button 
               onClick={() => { setShowRedemption(false); drawHand(); }}
               className="w-full py-10 bg-yellow-500 text-black font-black uppercase tracking-[1em] hover:bg-yellow-400 hover:scale-[1.03] active:scale-[0.97] transition-all shadow-[0_0_60px_rgba(234,179,8,0.6)] text-3xl rounded-sm"
             >
               INJECT_PATCH
             </button>
             <div className="mt-10 text-center text-[11px] text-yellow-600 font-black uppercase tracking-[0.5em] italic animate-pulse opacity-70">
               AUTHORIZED_BY_KERNEL_RECOVERY_PROTOCOL_7
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

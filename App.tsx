
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, GameState, Point, CardType, SessionSummary } from './types';
import { GRID_SIZE, TILE_SIZE, INITIAL_DECK, MAX_ENERGY, MASTER_CARD_POOL, INITIAL_HP } from './constants';
import { getAegisReasoning, getVisualDiagnostic, getRedemptionCard } from './services/gemini';
import { SecurityNode, MalwarePacket, FirewallBuffer } from './utils/gameClasses';

const App: React.FC = () => {
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef({
    nodes: [] as SecurityNode[],
    enemies: [] as MalwarePacket[],
    projectiles: [] as FirewallBuffer[],
    path: [
      {x: 0, y: 5}, {x: 1, y: 5}, {x: 2, y: 5}, {x: 3, y: 5}, {x: 3, y: 2}, 
      {x: 6, y: 2}, {x: 6, y: 7}, {x: 9, y: 7}, {x: 9, y: 9}
    ] as Point[],
    defeatedCount: 0,
    enemiesToSpawn: 0,
    spawnTimer: 0,
    lastFrameTime: 0,
    difficultyMultiplier: 1.0
  });

  const drawHand = useCallback(() => {
    setGameState(prev => {
      const deck = [...prev.deck];
      const discard = [...prev.discard];
      const hand = [...prev.hand];
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
    drawHand();
  }, [drawHand]);

  useEffect(() => {
    if (gameState.isGameStarted && gameState.hand.length === 0) {
      checkForRedemption();
      drawHand();
    }
  }, [gameState.isGameStarted, drawHand]);

  const startGame = () => {
    setGameState(prev => ({ ...prev, isGameStarted: true }));
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
    setGameState(prev => ({ ...prev, isProcessing: true }));
    addLog('[SYS] BREACH EVENT CONCLUDED. ANALYZING DATA...');

    const nodeTypes = gameRef.current.nodes.map(n => n.type);
    const aegis = await getAegisReasoning(
      gameState, 
      gameRef.current.nodes.length, 
      gameRef.current.defeatedCount,
      nodeTypes
    );

    if (aegis) {
      addLog(`[AEGIS] ${aegis.kernel_log_message}`);
      const newCards = aegis.exploit_kit_update.suggested_cards_ids.map(id => MASTER_CARD_POOL[id] || MASTER_CARD_POOL['protocol_sentry']);
      
      setGameState(prev => ({
        ...prev,
        waveNumber: prev.waveNumber + 1,
        energyPoints: Math.min(MAX_ENERGY, prev.energyPoints + 15),
        discard: [...prev.discard, ...newCards],
        isProcessing: false,
        lastGeminiResponse: aegis
      }));
      
      gameRef.current.difficultyMultiplier = aegis.wave_parameters.wave_difficulty;
      drawHand();
      runVisualDiagnostic();
    } else {
      setGameState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [gameState, drawHand]);

  const toggleSelect = (idx: number) => {
    setSelectedIndices(prev => {
      if (prev.includes(idx)) return prev.filter(i => i !== idx);
      if (prev.length >= 2) return [prev[1], idx];
      return [...prev, idx];
    });
  };

  const fuseCards = () => {
    if (selectedIndices.length !== 2) return;
    const [i1, i2] = selectedIndices;
    const c1 = gameState.hand[i1];
    const c2 = gameState.hand[i2];
    if (c1.id === c2.id && c1.fusionTargetId) {
      const fusedCard = MASTER_CARD_POOL[c1.fusionTargetId];
      if (fusedCard) {
        addLog(`[FUSION] ${c1.name} x2 SYNTHESIZED INTO ${fusedCard.name}`);
        setGameState(prev => {
          const newHand = prev.hand.filter((_, idx) => !selectedIndices.includes(idx));
          newHand.push(fusedCard);
          return { ...prev, hand: newHand };
        });
        setSelectedIndices([]);
      }
    } else {
      addLog(`[ERROR] INCOMPATIBLE FUSION SIGNATURES DETECTED.`);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (selectedIndices.length !== 1) return;
    const idx = selectedIndices[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);
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
      
      ctx.strokeStyle = '#101525';
      ctx.lineWidth = 1;
      for(let i=0; i<=GRID_SIZE; i++) {
        ctx.beginPath(); ctx.moveTo(i*TILE_SIZE, 0); ctx.lineTo(i*TILE_SIZE, 600); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i*TILE_SIZE); ctx.lineTo(600, i*TILE_SIZE); ctx.stroke();
      }
      
      ctx.strokeStyle = '#1A2A40';
      ctx.lineWidth = 4;
      ctx.beginPath();
      gameRef.current.path.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x * TILE_SIZE + TILE_SIZE/2, p.y * TILE_SIZE + TILE_SIZE/2);
        else ctx.lineTo(p.x * TILE_SIZE + TILE_SIZE/2, p.y * TILE_SIZE + TILE_SIZE/2);
      });
      ctx.stroke();
      
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
            gameRef.current.projectiles.push(new FirewallBuffer(node.x, node.y, target, node.damage));
          });
        });
        
        if (gameRef.current.enemiesToSpawn === 0 && gameRef.current.enemies.length === 0) endWave();
      }
      
      gameRef.current.enemies.forEach(e => e.draw(ctx));
      gameRef.current.nodes.forEach(n => n.draw(ctx));
      gameRef.current.projectiles.forEach(p => p.draw(ctx));
      
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
  }, [activeWave, endWave, gameState.isScanning, gameState.isGameStarted, saveSession]);

  const canFuse = selectedIndices.length === 2 && 
                  gameState.hand[selectedIndices[0]].id === gameState.hand[selectedIndices[1]].id &&
                  gameState.hand[selectedIndices[0]].fusionTargetId;

  // Mock technical data for the Tactical Overlay
  const mockSystemData = useMemo(() => [
    { addr: "0x7FFD-8E12-F001", status: "BUFFER_OVERFLOW_RISK", severity: "HIGH" },
    { addr: "0x1129-C004-A921", status: "ENCRYPTION_KEY_EXPOSED", severity: "CRITICAL" },
    { addr: "0x9928-1122-BBCC", status: "UNAUTHORIZED_ACCESS_DETECTED", severity: "HIGH" },
    { addr: "0xCAFE-BABE-0021", status: "STALE_THREAD_STAGNATION", severity: "LOW" },
    { addr: "0xDEAD-BEEF-FFFF", status: "ROOT_KIT_SIGNATURE_FOUND", severity: "CRITICAL" },
    { addr: "0xFEED-FACE-8822", status: "VOLTAGE_FLUX_IN_SECTOR_7", severity: "MEDIUM" },
    { addr: "0x600D-BEEF-A110", status: "FIREWALL_PROTOCOL_BYPASS", severity: "HIGH" },
    { addr: "0xC0DE-DBAD-0000", status: "LOGIC_BOMB_ARMED_JUNCTION_3", severity: "HIGH" },
    { addr: "0xBAAD-F00D-4433", status: "PACKET_INJECTION_RECOGNIZED", severity: "MEDIUM" },
    { addr: "0xDEADC0DE-6622", status: "CORE_DUMP_RECOVERY_LOCKED", severity: "LOW" },
  ], []);

  return (
    <div className="flex h-screen w-screen bg-[#050814] text-[#9CFF57] font-mono selection:bg-[#3DDCFF]/30 overflow-hidden">
      
      {/* Zone 1: Kernel Diagnostics (Left Sidebar) */}
      <aside className="w-1/4 border-r border-[#1A2A40] flex flex-col bg-[#050814]/50 backdrop-blur-sm z-20">
        <header className="p-4 border-b border-[#1A2A40] flex justify-between items-center bg-[#1A2A40]/10">
          <span className="font-black text-[#3DDCFF] italic">DIAG_ZONE_A</span>
          <div className="flex space-x-1">
            <div className={`w-2 h-2 rounded-full ${activeWave ? 'bg-red-500 animate-pulse' : 'bg-[#9CFF57]'}`}></div>
            <div className="w-2 h-2 rounded-full bg-[#3DDCFF]"></div>
          </div>
        </header>

        <section className="p-4 space-y-6 flex-1 overflow-hidden flex flex-col">
          <div className="space-y-4">
            <h1 className="text-xl font-black text-white tracking-tighter uppercase italic">Aegis_OS</h1>
            
            <div className="p-3 bg-[#1A2A40]/20 border border-[#1A2A40] rounded shadow-inner">
              <div className="flex justify-between text-[10px] mb-1 font-bold text-gray-400">
                <span>CORE_INTEGRITY</span>
                <span className={gameState.kernelHP < 30 ? "text-red-500 animate-pulse" : "text-[#9CFF57]"}>{gameState.kernelHP}%</span>
              </div>
              <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-[#1A2A40]">
                <div className="h-full bg-[#3DDCFF] transition-all duration-700 shadow-[0_0_12px_#3DDCFF]" style={{width: `${gameState.kernelHP}%`}}></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 border border-[#1A2A40] bg-[#1A2A40]/10">
                <div className="text-gray-500 font-bold tracking-widest uppercase">ENERGY</div>
                <div className="text-[#3DDCFF] font-black text-lg">{gameState.energyPoints}</div>
              </div>
              <div className="p-2 border border-[#1A2A40] bg-[#1A2A40]/10">
                <div className="text-gray-500 font-bold tracking-widest uppercase">WAVE</div>
                <div className="text-[#9CFF57] font-black text-lg">{gameState.waveNumber}</div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 border-t border-[#1A2A40] pt-4">
            <div className="text-gray-600 text-[9px] mb-2 uppercase tracking-[0.3em] font-black italic">>> KERNEL_LOG_STREAM</div>
            <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-[#1A2A40]">
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
            {gameState.isTacticalOverlayOpen ? "CLOSE_TACTICAL_VIEW" : "VISUAL_DIAGNOSTIC"}
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

      {/* Zone 2: Mainframe Grid (Center) */}
      <main className="flex-1 relative flex flex-col bg-[#02040a] items-center justify-center p-8 overflow-hidden">
        <div className="absolute top-4 left-4 text-[10px] text-gray-800 pointer-events-none font-black uppercase tracking-widest">Sector_Grid_01 // 600x600_Mainframe</div>
        
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#3DDCFF]/20 to-[#9CFF57]/20 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <canvas 
            ref={canvasRef} 
            width={600} 
            height={600} 
            className="relative border border-[#1A2A40] shadow-2xl bg-black cursor-crosshair rounded-sm"
            onClick={handleCanvasClick}
          />
        </div>

        {/* Visual Diagnostic Tactical Overlay */}
        {gameState.isTacticalOverlayOpen && (
          <div 
            className="absolute inset-0 z-40 flex items-center justify-center bg-[#050814]/70 backdrop-blur-sm p-12 cursor-default"
            onClick={toggleTacticalOverlay}
          >
            <div 
              className="w-full h-full border-4 border-[#3DDCFF] bg-[#050814]/90 shadow-[0_0_50px_rgba(61,220,255,0.3)] relative p-8 flex flex-col overflow-hidden animate-in zoom-in duration-300 flicker"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-[#3DDCFF] animate-pulse"></div>
              
              <div className="flex justify-between items-start mb-8 border-b border-[#3DDCFF]/30 pb-4">
                <div>
                  <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">System_Vulnerabilities</h2>
                  <div className="text-[#3DDCFF] text-[10px] tracking-[0.5em] font-black mt-1 uppercase">Deep_Scan_Diagnostic // Sector_0x00A</div>
                </div>
                <button 
                  onClick={toggleTacticalOverlay}
                  className="px-6 py-2 border-2 border-[#3DDCFF] text-[#3DDCFF] font-black uppercase tracking-widest hover:bg-[#3DDCFF] hover:text-black transition-all"
                >
                  [CLOSE_SCAN]
                </button>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-8 overflow-hidden">
                <div className="space-y-4 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-[#1A2A40]">
                  <div className="text-[10px] text-gray-600 font-black uppercase tracking-widest border-b border-[#1A2A40] mb-4 pb-1 italic">>> MEMORY_VULN_LOG</div>
                  {mockSystemData.map((data, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 border border-[#1A2A40] bg-[#1A2A40]/10 hover:bg-[#3DDCFF]/5 transition-colors group">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-gray-500 font-mono">{data.addr}</span>
                        <span className={`text-[11px] font-black tracking-wider ${data.severity === 'CRITICAL' ? 'text-red-500' : 'text-yellow-500'} group-hover:text-white`}>
                          {data.status}
                        </span>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 font-black border ${
                        data.severity === 'CRITICAL' ? 'border-red-500 text-red-500' : 
                        data.severity === 'HIGH' ? 'border-orange-500 text-orange-500' : 
                        'border-blue-500 text-blue-500'
                      }`}>
                        {data.severity}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col space-y-6">
                   <div className="p-6 border border-[#3DDCFF]/30 bg-[#3DDCFF]/5 relative overflow-hidden group">
                      <div className="absolute -right-4 -bottom-4 w-24 h-24 border-4 border-[#3DDCFF]/20 rotate-45 group-hover:rotate-90 transition-transform duration-700"></div>
                      <div className="text-[#3DDCFF] font-black text-[10px] mb-4 tracking-[0.2em] italic">>> ENCRYPTION_MATRIX</div>
                      <div className="grid grid-cols-4 gap-2 font-mono text-[9px] text-gray-400">
                         {Array.from({length: 32}).map((_, i) => (
                           <div key={i} className="animate-pulse" style={{animationDelay: `${i * 100}ms`}}>
                             {Math.random().toString(16).substring(2, 6).toUpperCase()}
                           </div>
                         ))}
                      </div>
                   </div>

                   <div className="p-6 border border-[#9CFF57]/30 bg-[#9CFF57]/5 relative">
                      <div className="text-[#9CFF57] font-black text-[10px] mb-4 tracking-[0.2em] italic">>> CORE_HEARTBEAT</div>
                      <div className="flex items-end space-x-1 h-24">
                         {Array.from({length: 20}).map((_, i) => (
                           <div 
                             key={i} 
                             className="flex-1 bg-[#9CFF57] animate-pulse" 
                             style={{
                               height: `${10 + Math.random() * 80}%`,
                               animationDuration: `${0.5 + Math.random()}s`,
                               opacity: 0.3 + Math.random() * 0.7
                             }}
                           ></div>
                         ))}
                      </div>
                   </div>

                   <div className="flex-1 p-4 border border-gray-800 bg-black/40 text-gray-500 text-[9px] leading-relaxed font-mono">
                      [INFO] System diagnostics running in background thread 0x4492.<br/>
                      [WARN] Detected anomalous packet signature at Junction_Delta.<br/>
                      [CRIT] Kernal integrity verified at 99.4% but showing recursive decay.<br/>
                      [SYNC] Sector maps updated with current tower deployments.<br/>
                      [SCAN] Visual diagnostics powered by Aegis Visual Unit V5.0.
                   </div>
                </div>
              </div>

              <div className="mt-8 text-center text-[8px] text-gray-700 tracking-[1em] font-black uppercase italic">
                Aegis_Tactical_Diagnostic_Suite // Proprietary_Software
              </div>
            </div>
          </div>
        )}

        {gameState.lastDiagnostic && (
          <div className="absolute top-10 right-10 p-4 bg-[#050814]/95 border-2 border-yellow-500/50 backdrop-blur-md font-mono text-[10px] w-72 shadow-[0_0_30px_rgba(234,179,8,0.25)] z-30 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex justify-between items-center border-b border-yellow-500/30 pb-2 mb-2">
              <span className="text-yellow-500 font-black italic tracking-widest uppercase text-[11px]">Visual_Report</span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-black ${gameState.lastDiagnostic.severity_level === 'High' ? 'bg-red-900 text-red-200' : 'bg-yellow-900 text-yellow-200'}`}>
                {gameState.lastDiagnostic.severity_level}_THREAT
              </span>
            </div>
            <div className="mb-2">
              <span className="text-gray-500 uppercase font-bold text-[9px]">Weak_Coord:</span> <span className="text-[#3DDCFF] font-black">{gameState.lastDiagnostic.weakest_sector}</span>
            </div>
            <div className="text-gray-300 mb-3 leading-relaxed italic border-l border-yellow-500/50 pl-2">"{gameState.lastDiagnostic.analysis}"</div>
            <button 
              onClick={() => setGameState(p => ({...p, lastDiagnostic: undefined}))} 
              className="w-full py-1 text-gray-500 hover:text-white uppercase text-[8px] tracking-[0.4em] border border-gray-800 hover:border-gray-600 transition-colors"
            >
              [DISMISS_SCAN]
            </button>
          </div>
        )}

        {(!gameState.isGameStarted || gameState.kernelHP <= 0) && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="relative p-12 bg-[#050814]/90 border-2 border-[#3DDCFF] shadow-[0_0_30px_#3DDCFF] max-w-lg w-full text-center group transition-all">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#3DDCFF] flicker"></div>
              
              <div className="mb-8">
                <h2 className={`text-5xl font-black italic tracking-tighter uppercase mb-2 flicker ${gameState.kernelHP <= 0 ? 'text-red-500 shadow-red-500' : 'text-[#3DDCFF]'}`}>
                  {gameState.kernelHP <= 0 ? 'BREACH_CRITICAL' : 'CIRCUIT_BREACH'}
                </h2>
                <div className="text-[10px] text-gray-500 tracking-[0.8em] font-black uppercase border-y border-[#1A2A40] py-2">
                  Aegis_OS // Strategic_Defense_Kernel
                </div>
              </div>

              {gameState.kernelHP <= 0 && (
                <div className="mb-8 p-4 bg-red-900/10 border border-red-500/20 text-red-400 text-[10px] font-mono italic">
                  KERNEL_PANIC: The mainframe core was overwhelmed by a recursive infection loop. System integrity zeroed.
                </div>
              )}

              <button 
                onClick={gameState.kernelHP <= 0 ? resetGame : startGame}
                className={`group relative w-full py-6 font-black text-sm tracking-[0.5em] uppercase transition-all overflow-hidden border-2 ${
                  gameState.kernelHP <= 0 ? 'border-red-500 text-red-500 hover:bg-red-500/10' : 'border-[#9CFF57] text-[#9CFF57] hover:bg-[#9CFF57]/10'
                }`}
              >
                <span className="relative z-10">{gameState.kernelHP <= 0 ? 'REBOOT_KERNEL' : 'INITIALIZE_SYSTEM'}</span>
                <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:left-full transition-all duration-700"></div>
              </button>

              <div className="mt-6 text-[8px] text-gray-700 tracking-widest uppercase font-black italic">
                Secure_Link_Established // 128-Bit_Encrypted
              </div>
            </div>
          </div>
        )}

        {gameState.isProcessing && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-30 flex items-center justify-center">
            <div className="p-8 border-y-2 border-[#3DDCFF]/30 w-full flex flex-col items-center bg-[#050814]/50">
              <div className="text-[#3DDCFF] font-black animate-pulse text-2xl tracking-[1em] italic uppercase mb-2">Aegis_Thinking</div>
              <div className="text-[10px] text-gray-500 font-mono tracking-widest animate-bounce">SYNCING_DEEP_THINK_CORES...</div>
            </div>
          </div>
        )}
      </main>

      {/* Zone 3: Exploit Kit & Strategy (Bottom/Right Area) */}
      <aside className="w-1/4 border-l border-[#1A2A40] bg-[#050814]/50 backdrop-blur-sm flex flex-col z-20">
        <header className="p-4 border-b border-[#1A2A40] bg-[#1A2A40]/10 flex justify-between items-center">
          <span className="font-black text-[#9CFF57] italic">KIT_ZONE_B</span>
          <span className="text-[10px] text-gray-600 font-mono">HAND: {gameState.hand.length}/5</span>
        </header>

        <section className="p-4 border-b border-[#1A2A40] h-1/3 overflow-y-auto bg-[#1A2A40]/5">
           <div className="text-[9px] text-gray-500 font-black mb-3 tracking-widest uppercase italic">>> STRATEGIC_ADVISORY</div>
           {gameState.lastGeminiResponse ? (
             <div className="space-y-4 font-mono">
                <div className="p-3 bg-[#3DDCFF]/5 border border-[#3DDCFF]/20 rounded relative">
                   <div className="text-[#3DDCFF] text-[10px] font-black uppercase mb-1 flex items-center">
                     <span className="w-1.5 h-1.5 bg-[#3DDCFF] rounded-full mr-2 shadow-[0_0_5px_#3DDCFF]"></span>
                     Performance_Gap
                   </div>
                   <div className="text-white text-[11px] font-bold leading-tight uppercase">{gameState.lastGeminiResponse.tactical_analysis.skill_gap_identified}</div>
                   <div className="mt-2 text-gray-500 italic text-[10px] leading-relaxed">"{gameState.lastGeminiResponse.tactical_analysis.causal_justification}"</div>
                </div>
                <div className="flex items-center space-x-2">
                   <div className="flex-1 h-px bg-gray-800"></div>
                   <div className="text-[9px] text-gray-700 font-black">X{gameState.lastGeminiResponse.wave_parameters.wave_difficulty} SCALAR</div>
                   <div className="flex-1 h-px bg-gray-800"></div>
                </div>
             </div>
           ) : (
             <div className="text-[10px] text-gray-700 animate-pulse italic">WAITING_FOR_WAVE_DATA...</div>
           )}
        </section>

        <section className="flex-1 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-[#1A2A40] flex justify-between items-center text-[10px]">
            <span className="text-gray-500 uppercase font-black tracking-widest">Active_Payloads</span>
            {selectedIndices.length > 0 && <span className="text-[#3DDCFF] font-black">[{selectedIndices.length}] READY</span>}
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-[#1A2A40]">
            {gameState.hand.map((card, i) => {
              const isSelected = selectedIndices.includes(i);
              const canAfford = gameState.energyPoints >= card.cost;
              return (
                <div 
                  key={i}
                  onClick={() => toggleSelect(i)}
                  className={`p-3 border-l-4 cursor-pointer transition-all group relative ${
                    isSelected ? "bg-[#3DDCFF]/10 border-[#3DDCFF] translate-x-1" : "bg-[#1A2A40]/10 border-gray-800 hover:border-gray-500"
                  } ${!canAfford ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[8px] font-mono text-gray-600">ID:{card.id.substring(0,6)}</span>
                    <span className={`text-[10px] font-black ${canAfford ? 'text-[#3DDCFF]' : 'text-red-900'}`}>{card.cost} EP</span>
                  </div>
                  <h3 className={`font-black text-xs group-hover:text-[#3DDCFF] transition-colors ${card.rarity === 'LEGENDARY' ? 'text-yellow-500' : 'text-[#9CFF57]'}`}>
                    {card.name.toUpperCase()}
                  </h3>
                  <p className="text-[9px] text-gray-500 leading-tight mt-1 h-8 overflow-hidden line-clamp-2">{card.description}</p>
                  {isSelected && <div className="absolute top-1 right-1"><div className="w-2 h-2 bg-[#3DDCFF] rounded-full shadow-[0_0_8px_#3DDCFF]"/></div>}
                </div>
              );
            })}
          </div>
        </section>

        <footer className="p-4 bg-[#1A2A40]/10 border-t border-[#1A2A40] space-y-3">
          <button 
            disabled={!canFuse}
            onClick={fuseCards}
            className={`w-full py-4 border-2 font-black text-[10px] italic tracking-[0.3em] transition-all rounded shadow-sm ${
              canFuse ? "border-[#9CFF57] text-[#9CFF57] hover:bg-[#9CFF57]/10 animate-pulse shadow-[0_0_15px_rgba(156,255,87,0.2)]" : "border-gray-800 text-gray-800 opacity-50"
            }`}
          >
            FUSE_SIGNATURES
          </button>
        </footer>
      </aside>

      {/* Redemption Modal Layer */}
      {showRedemption && gameState.redemptionCard && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl z-50 flex items-center justify-center p-12">
          <div className="max-w-md w-full p-8 border-4 border-yellow-500 bg-[#050814] shadow-[0_0_100px_rgba(234,179,8,0.5)] relative overflow-hidden group">
             <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500 animate-ping opacity-20"></div>
             <div className="absolute -top-12 -right-12 w-24 h-24 border-4 border-yellow-500 rotate-45 group-hover:rotate-90 transition-transform duration-1000 opacity-30"></div>
             
             <div className="text-yellow-500 font-black tracking-[0.4em] uppercase text-[10px] mb-6 flex items-center">
               <span className="flex-1 h-px bg-yellow-500/30"></span>
               <span className="mx-4">Redemption_Module_Detected</span>
               <span className="flex-1 h-px bg-yellow-500/30"></span>
             </div>
             
             <h2 className="text-4xl font-black text-white italic mb-2 tracking-tighter uppercase">{gameState.redemptionCard.name}</h2>
             <div className="text-[#3DDCFF] text-[10px] font-black mb-6 uppercase tracking-widest border-b border-[#3DDCFF]/20 pb-2">Pattern_Mitigation_Active</div>
             
             <p className="text-gray-400 text-sm mb-8 leading-relaxed italic border-l-2 border-yellow-500/50 pl-4 font-mono">"{gameState.redemptionCard.description}"</p>
             
             <div className="grid grid-cols-2 gap-4 mb-10 text-[10px] font-black uppercase">
               <div className="bg-[#1A2A40]/30 p-3 border border-yellow-500/20">
                 <div className="text-gray-600 mb-1">Target_Dmg</div>
                 <div className="text-white text-xl">{gameState.redemptionCard.stats?.damage || 'N/A'}</div>
               </div>
               <div className="bg-[#1A2A40]/30 p-3 border border-yellow-500/20">
                 <div className="text-gray-600 mb-1">Eff_Range</div>
                 <div className="text-white text-xl">{gameState.redemptionCard.stats?.range || 'N/A'}</div>
               </div>
             </div>
             
             <button 
               onClick={() => { setShowRedemption(false); drawHand(); }}
               className="w-full py-5 bg-yellow-500 text-black font-black uppercase tracking-[0.5em] hover:bg-yellow-400 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(234,179,8,0.3)]"
             >
               INTEGRATE_MODULE
             </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;

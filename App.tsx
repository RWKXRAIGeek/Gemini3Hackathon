
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, GameState, Point, CardType } from './types';
import { GRID_SIZE, TILE_SIZE, INITIAL_DECK, MAX_ENERGY, MASTER_CARD_POOL } from './constants';
import { getAegisReasoning, getVisualDiagnostic } from './services/gemini';
import { SecurityNode, MalwarePacket, FirewallBuffer } from './utils/gameClasses';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    kernelHP: 100,
    energyPoints: 20,
    waveNumber: 0,
    hand: [],
    deck: [...INITIAL_DECK],
    discard: [],
    isProcessing: false,
    isScanning: false,
    statusLog: ['[SYS_INIT] AEGIS OS BOOTING...', '[SYS_INIT] KERNEL CORE ACTIVE.'],
  });

  const [activeWave, setActiveWave] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

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

  useEffect(() => {
    drawHand();
  }, []);

  const addLog = (msg: string) => {
    setGameState(prev => ({
      ...prev,
      statusLog: [msg, ...prev.statusLog].slice(0, 15)
    }));
  };

  const drawHand = () => {
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
  }, [gameState]);

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
    if (!canvasRef.current) return;
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
            setGameState(prev => ({ ...prev, kernelHP: Math.max(0, prev.kernelHP - 12) }));
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
  }, [activeWave, endWave, gameState.isScanning]);

  const canFuse = selectedIndices.length === 2 && 
                  gameState.hand[selectedIndices[0]].id === gameState.hand[selectedIndices[1]].id &&
                  gameState.hand[selectedIndices[0]].fusionTargetId;

  return (
    <div className="flex h-screen w-screen overflow-hidden text-sm select-none">
      <div className="w-1/4 border-r border-[#1A2A40] flex flex-col bg-[#050814] p-4 z-20 overflow-hidden">
        <div className="mb-6">
          <h1 className="text-xl font-black text-[#3DDCFF] mb-1 tracking-tighter italic uppercase">Aegis_OS_Kernel</h1>
          <div className="text-[10px] text-gray-600 mb-4 font-mono">DEEP_THINK_ENABLED_V5</div>
          <div className="space-y-4 font-mono">
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span>KERNEL_INTEGRITY</span>
                <span className={gameState.kernelHP < 30 ? "text-red-500 animate-pulse" : "text-[#9CFF57]"}>{gameState.kernelHP}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                <div className="h-full bg-[#3DDCFF] transition-all duration-700 shadow-[0_0_8px_#3DDCFF]" style={{width: `${gameState.kernelHP}%`}}></div>
              </div>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-500">ENERGY_FLUX</span>
              <span className="text-[#3DDCFF] font-bold">{gameState.energyPoints} / {MAX_ENERGY}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-1">
          <div className="text-gray-700 sticky top-0 bg-[#050814] pb-1 border-b border-gray-800 mb-2 font-bold uppercase tracking-widest">>> LOG_FEED</div>
          {gameState.statusLog.map((log, i) => (
            <div key={i} className={`leading-snug ${log.includes('[AEGIS]') ? 'text-[#9CFF57]' : log.includes('[SCAN_RESULT]') ? 'text-yellow-400' : 'text-gray-500'} flicker`}>
              {log}
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          <button 
            onClick={runVisualDiagnostic}
            disabled={activeWave || gameState.isScanning}
            className={`w-full py-2 border font-bold text-[10px] tracking-[0.1em] transition-all uppercase ${
              gameState.isScanning ? "border-yellow-600 text-yellow-600 animate-pulse" : "border-gray-700 text-gray-500 hover:text-[#3DDCFF] hover:border-[#3DDCFF]"
            }`}
          >
            {gameState.isScanning ? "SCANNING_SECTORS..." : "VISUAL_DIAGNOSTIC"}
          </button>
          
          <button 
            onClick={startWave}
            disabled={activeWave || gameState.isProcessing}
            className={`w-full py-4 border-2 font-bold text-xs tracking-[0.2em] transition-all uppercase ${
              activeWave || gameState.isProcessing ? "border-gray-800 text-gray-800" : "border-[#3DDCFF] text-[#3DDCFF] hover:bg-[#3DDCFF]/10"
            }`}
          >
            {gameState.isProcessing ? "SYNCING_DEEP_THINK..." : "INIT_BREACH_WAVE"}
          </button>
        </div>
      </div>

      <div className="relative flex-1 bg-black flex items-center justify-center p-4">
        <canvas ref={canvasRef} width={600} height={600} className="border border-[#1A2A40] shadow-2xl shadow-[#3DDCFF]/5" onClick={handleCanvasClick}/>
        
        {gameState.lastDiagnostic && (
          <div className="absolute top-10 left-10 p-4 bg-[#050814]/90 border border-yellow-500/50 backdrop-blur-md font-mono text-[10px] w-80 shadow-[0_0_20px_rgba(234,179,8,0.2)] z-30">
            <div className="flex justify-between items-center border-b border-yellow-500/30 pb-2 mb-2">
              <span className="text-yellow-500 font-bold tracking-widest uppercase italic">Visual_Scan</span>
              <span className={`px-1 rounded ${gameState.lastDiagnostic.severity_level === 'High' ? 'bg-red-900 text-red-200' : 'bg-yellow-900 text-yellow-200'}`}>
                {gameState.lastDiagnostic.severity_level}
              </span>
            </div>
            <div className="mb-2">
              <span className="text-gray-500">WEAK_SECTOR:</span> <span className="text-[#3DDCFF]">{gameState.lastDiagnostic.weakest_sector}</span>
            </div>
            <div className="text-gray-400 mb-2 leading-tight">"{gameState.lastDiagnostic.analysis}"</div>
            <button onClick={() => setGameState(p => ({...p, lastDiagnostic: undefined}))} className="text-gray-600 hover:text-gray-400 uppercase text-[8px] tracking-widest">[CLOSE]</button>
          </div>
        )}

        {gameState.kernelHP <= 0 && (
          <div className="absolute inset-0 bg-black/95 z-40 flex flex-col items-center justify-center text-[#FF3B3B] font-mono">
            <div className="text-8xl font-black mb-2 italic">HALTED</div>
            <button onClick={() => window.location.reload()} className="px-12 py-4 border-2 border-[#FF3B3B] text-[#FF3B3B] hover:bg-[#FF3B3B]/10 font-bold">REBOOT_SYSTEM</button>
          </div>
        )}

        {gameState.isProcessing && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-md z-30 flex items-center justify-center">
            <div className="text-[#3DDCFF] font-mono animate-pulse text-xl tracking-[0.8em] font-black italic">AEGIS_REASONING...</div>
          </div>
        )}
      </div>

      <div className="w-1/4 border-l border-[#1A2A40] bg-[#050814] p-4 flex flex-col overflow-hidden z-20">
        <div className="mb-4 flex justify-between items-baseline border-b border-gray-800 pb-2">
          <h2 className="text-sm font-bold text-[#9CFF57] tracking-widest uppercase italic">EXPLOIT_KIT</h2>
          <span className="text-[10px] font-mono text-gray-600">H:{gameState.hand.length}/5</span>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {gameState.hand.map((card, i) => {
            const isSelected = selectedIndices.includes(i);
            const canAfford = gameState.energyPoints >= card.cost;
            return (
              <div 
                key={i}
                onClick={() => toggleSelect(i)}
                className={`p-3 border-l-4 transition-all group relative ${
                  isSelected ? "bg-[#3DDCFF]/10 border-[#3DDCFF] translate-x-1" : "bg-[#1A2A40]/20 border-gray-800 hover:border-gray-500"
                } ${!canAfford ? 'opacity-40' : ''}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-mono text-gray-500">0x{card.id.substring(0,4)}</span>
                  <span className={`text-[10px] font-bold ${canAfford ? 'text-[#3DDCFF]' : 'text-red-900'}`}>{card.cost} EP</span>
                </div>
                <h3 className="font-bold text-[#9CFF57] group-hover:text-[#3DDCFF] transition-colors">{card.name}</h3>
                <p className="text-[10px] text-gray-500 leading-tight mt-1">{card.description}</p>
                {isSelected && <div className="absolute top-0 right-0 p-1"><div className="w-2 h-2 bg-[#3DDCFF] rounded-full shadow-[0_0_5px_#3DDCFF]"/></div>}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-[#1A2A40] space-y-3">
          <button 
            disabled={!canFuse}
            onClick={fuseCards}
            className={`w-full py-4 border-2 font-black text-xs italic tracking-widest transition-all ${
              canFuse ? "border-[#9CFF57] text-[#9CFF57] hover:bg-[#9CFF57]/10 animate-pulse" : "border-gray-800 text-gray-800 opacity-50"
            }`}
          >
            FUSE_SIGNATURES
          </button>
          
          {gameState.lastGeminiResponse && (
            <div className="p-3 bg-[#1A2A40]/30 border border-[#3DDCFF]/20 rounded text-[10px] font-mono leading-relaxed">
              <div className="text-[#3DDCFF] font-black uppercase mb-1 tracking-widest italic border-b border-[#3DDCFF]/10 pb-1">Deep_Think_Analysis</div>
              <div className="text-gray-500 mb-1">GAP: <span className="text-[#9CFF57]">{gameState.lastGeminiResponse.tactical_analysis.skill_gap_identified}</span></div>
              <div className="text-gray-400 italic mb-2">"{gameState.lastGeminiResponse.tactical_analysis.causal_justification}"</div>
              <div className="text-[#3DDCFF] border-t border-[#3DDCFF]/10 pt-1 uppercase text-[9px]">Scalar: x{gameState.lastGeminiResponse.wave_parameters.wave_difficulty}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;

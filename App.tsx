
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, GameState, AegisResponse, Point, CardType } from './types';
import { GRID_SIZE, TILE_SIZE, INITIAL_DECK, MAX_ENERGY, MASTER_CARD_POOL } from './constants';
import { getAegisReasoning } from './services/gemini';
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
    statusLog: ['[SYS_INIT] AEGIS OS BOOTING...', '[SYS_INIT] KERNEL CORE ACTIVE.'],
  });

  const [activeWave, setActiveWave] = useState(false);
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);

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

  // Initialization: Draw first hand
  useEffect(() => {
    drawHand();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLog = (msg: string) => {
    setGameState(prev => ({
      ...prev,
      statusLog: [msg, ...prev.statusLog].slice(0, 10)
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
    gameRef.current.enemiesToSpawn = 5 + gameState.waveNumber * 2;
    gameRef.current.spawnTimer = 0;
    setActiveWave(true);
  };

  const endWave = useCallback(async () => {
    setActiveWave(false);
    setGameState(prev => ({ ...prev, isProcessing: true }));
    addLog('[SYS] BREACH EVENT CONCLUDED. ANALYZING DATA...');

    const aegis = await getAegisReasoning(
      gameState, 
      gameRef.current.nodes.length, 
      gameRef.current.defeatedCount
    );

    if (aegis) {
      addLog(`[AEGIS] ${aegis.kernel_log_message}`);
      // Add new cards to discard
      const newCards = aegis.exploit_kit_update.suggested_cards_ids.map(id => MASTER_CARD_POOL[id] || MASTER_CARD_POOL['node_laser_basic']);
      
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.waveNumber, gameState.energyPoints, gameState.hand.length]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (selectedCardIdx === null) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    const card = gameState.hand[selectedCardIdx];
    if (card.type === CardType.SECURITY_NODE && gameState.energyPoints >= card.cost) {
      // Check if grid is occupied
      const occupied = gameRef.current.nodes.find(n => n.gridX === x && n.gridY === y);
      if (occupied) return;

      const newNode = new SecurityNode(x, y, card);
      gameRef.current.nodes.push(newNode);
      
      setGameState(prev => ({
        ...prev,
        energyPoints: prev.energyPoints - card.cost,
        hand: prev.hand.filter((_, i) => i !== selectedCardIdx),
        discard: [...prev.discard, card]
      }));
      setSelectedCardIdx(null);
      addLog(`[SYS] NODE ${card.name} DEPLOYED TO [${x},${y}]`);
    }
  };

  // Game Loop
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    let requestRef: number;

    const loop = (time: number) => {
      const dt = (time - gameRef.current.lastFrameTime) / 1000;
      gameRef.current.lastFrameTime = time;

      // Clear
      ctx.fillStyle = '#050814';
      ctx.fillRect(0, 0, 600, 600);

      // Draw Grid
      ctx.strokeStyle = '#101525';
      ctx.lineWidth = 1;
      for(let i=0; i<=GRID_SIZE; i++) {
        ctx.beginPath(); ctx.moveTo(i*TILE_SIZE, 0); ctx.lineTo(i*TILE_SIZE, 600); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i*TILE_SIZE); ctx.lineTo(600, i*TILE_SIZE); ctx.stroke();
      }

      // Draw Path
      ctx.strokeStyle = '#1A2A40';
      ctx.lineWidth = 4;
      ctx.beginPath();
      gameRef.current.path.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x * TILE_SIZE + TILE_SIZE/2, p.y * TILE_SIZE + TILE_SIZE/2);
        else ctx.lineTo(p.x * TILE_SIZE + TILE_SIZE/2, p.y * TILE_SIZE + TILE_SIZE/2);
      });
      ctx.stroke();

      // Draw Kernel Core
      const core = gameRef.current.path[gameRef.current.path.length-1];
      ctx.fillStyle = '#3DDCFF';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#3DDCFF';
      ctx.fillRect(core.x * TILE_SIZE + 5, core.y * TILE_SIZE + 5, 50, 50);
      ctx.shadowBlur = 0;

      if (activeWave) {
        // Spawning
        if (gameRef.current.enemiesToSpawn > 0) {
          gameRef.current.spawnTimer += dt;
          if (gameRef.current.spawnTimer >= 1) {
            const enemy = new MalwarePacket(
              gameRef.current.path, 
              { hp: 30 * gameRef.current.difficultyMultiplier, speed: 1.5 },
              'STANDARD'
            );
            gameRef.current.enemies.push(enemy);
            gameRef.current.enemiesToSpawn--;
            gameRef.current.spawnTimer = 0;
          }
        }

        // Updates
        gameRef.current.enemies.forEach((e, idx) => {
          const reached = e.update(dt);
          if (reached) {
            setGameState(prev => ({ ...prev, kernelHP: Math.max(0, prev.kernelHP - 10) }));
            gameRef.current.enemies.splice(idx, 1);
          } else if (e.hp <= 0) {
            gameRef.current.enemies.splice(idx, 1);
            gameRef.current.defeatedCount++;
            setGameState(prev => ({ ...prev, energyPoints: Math.min(MAX_ENERGY, prev.energyPoints + 1) }));
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

        // Check Wave End
        if (gameRef.current.enemiesToSpawn === 0 && gameRef.current.enemies.length === 0) {
          endWave();
        }
      }

      // Render
      gameRef.current.enemies.forEach(e => e.draw(ctx));
      gameRef.current.nodes.forEach(n => n.draw(ctx));
      gameRef.current.projectiles.forEach(p => p.draw(ctx));

      requestRef = requestAnimationFrame(loop);
    };

    requestRef = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef);
  }, [activeWave, endWave]);

  return (
    <div className="flex h-screen w-screen overflow-hidden text-sm md:text-base">
      {/* Left Panel: Stats & Log */}
      <div className="w-1/4 border-r border-[#1A2A40] flex flex-col bg-[#050814]/80 backdrop-blur-sm p-4 z-20">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-[#3DDCFF] mb-2 tracking-widest">CIRCUIT_BREACH.OS</h1>
          <div className="space-y-2 font-mono">
            <div className="flex justify-between">
              <span>KERNEL_INTEGRITY:</span>
              <span className={gameState.kernelHP < 30 ? "text-red-500 animate-pulse" : "text-[#9CFF57]"}>{gameState.kernelHP}%</span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded">
              <div className="h-full bg-[#3DDCFF] transition-all duration-500" style={{width: `${gameState.kernelHP}%`}}></div>
            </div>
            <div className="flex justify-between">
              <span>ENERGY_FLUX:</span>
              <span className="text-[#3DDCFF]">{gameState.energyPoints} / {MAX_ENERGY}</span>
            </div>
            <div className="flex justify-between">
              <span>WAVE_SECURITY:</span>
              <span className="text-[#9CFF57]">Lvl {gameState.waveNumber}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto font-mono text-xs opacity-80">
          <div className="text-gray-500 mb-2 border-b border-gray-800 pb-1">KERNEL_LOG_FEED</div>
          {gameState.statusLog.map((log, i) => (
            <div key={i} className="mb-1 leading-tight flicker">
              <span className="text-gray-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
              {log}
            </div>
          ))}
        </div>

        <button 
          onClick={startWave}
          disabled={activeWave || gameState.isProcessing}
          className={`mt-4 w-full py-3 border-2 font-bold transition-all ${
            activeWave || gameState.isProcessing
            ? "border-gray-700 text-gray-700 cursor-not-allowed"
            : "border-[#3DDCFF] text-[#3DDCFF] hover:bg-[#3DDCFF]/10 active:scale-95"
          }`}
        >
          {gameState.isProcessing ? "AEGIS_SYNCING..." : "INIT_BREACH_WAVE"}
        </button>
      </div>

      {/* Main Game: Canvas & Overlay */}
      <div className="relative flex-1 bg-black flex items-center justify-center p-4">
        <canvas 
          ref={canvasRef} 
          width={600} 
          height={600} 
          className="border border-[#1A2A40] shadow-2xl shadow-[#3DDCFF]/10"
          onClick={handleCanvasClick}
        />
        
        {/* Game Over / Processing Overlay */}
        {gameState.kernelHP <= 0 && (
          <div className="absolute inset-0 bg-black/90 z-40 flex flex-col items-center justify-center text-[#FF3B3B] font-mono">
            <h2 className="text-6xl font-bold mb-4 tracking-tighter">CORE CRITICAL</h2>
            <p className="text-xl mb-8">SYSTEM_INTEGRITY_COMPROMISED_0x004</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 border-2 border-[#FF3B3B] hover:bg-[#FF3B3B]/10"
            >
              REBOOT_SYSTEM
            </button>
          </div>
        )}

        {gameState.isProcessing && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 flex items-center justify-center">
            <div className="text-[#3DDCFF] font-mono animate-pulse text-2xl tracking-[0.5em]">
              AEGIS_OS_THINKING...
            </div>
          </div>
        )}
      </div>

      {/* Right Panel: Exploit Kit (Cards) */}
      <div className="w-1/4 border-l border-[#1A2A40] bg-[#050814]/80 p-4 flex flex-col overflow-y-auto z-20">
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-lg font-bold text-[#9CFF57] tracking-widest">EXPLOIT_KIT</h2>
          <span className="text-xs text-gray-500 font-mono">D:{gameState.deck.length} / H:{gameState.hand.length} / G:{gameState.discard.length}</span>
        </div>

        <div className="space-y-4">
          {gameState.hand.length === 0 && (
            <div className="text-gray-600 font-mono text-center py-10 italic">
              -- DECK_EXHAUSTED --
            </div>
          )}
          {gameState.hand.map((card, i) => (
            <div 
              key={i}
              onClick={() => setSelectedCardIdx(selectedCardIdx === i ? null : i)}
              className={`p-4 border-l-4 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${
                selectedCardIdx === i 
                ? "bg-[#3DDCFF]/10 border-[#3DDCFF] ring-1 ring-[#3DDCFF]" 
                : "bg-[#1A2A40]/30 border-gray-700 hover:border-[#9CFF57]"
              } ${gameState.energyPoints < card.cost ? "opacity-50 grayscale" : ""}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold text-gray-500">[{card.type}]</span>
                <span className="text-sm font-bold text-[#3DDCFF]">{card.cost} EP</span>
              </div>
              <h3 className="font-bold text-[#9CFF57] mb-1">{card.name}</h3>
              <p className="text-[10px] text-gray-400 mb-2 leading-tight">{card.description}</p>
              <div className="flex gap-2">
                <span className={`text-[9px] px-1 rounded ${
                  card.rarity === 'COMMON' ? 'bg-gray-700' : 
                  card.rarity === 'RARE' ? 'bg-purple-900' : 'bg-yellow-900'
                }`}>
                  {card.rarity}
                </span>
              </div>
            </div>
          ))}
        </div>

        {gameState.lastGeminiResponse && (
          <div className="mt-auto pt-6 border-t border-[#1A2A40]">
            <div className="text-[10px] text-gray-500 mb-1 font-mono uppercase">AEGIS_INTELLIGENCE_REPORT:</div>
            <div className="text-[11px] text-[#9CFF57] p-2 bg-[#9CFF57]/5 border border-[#9CFF57]/20 rounded italic leading-snug">
              {gameState.lastGeminiResponse.exploit_kit_update.reasoning}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

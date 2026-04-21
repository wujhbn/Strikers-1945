import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Music, Pause, Play } from 'lucide-react';
import { audioSystem } from '../audio';
import { GAME_LEVELS } from '../levels';

// 定義遊戲狀態的類型
interface Entity {
  active: boolean; // 用於 Object Pooling
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  vx?: number;
  vy?: number;
  type?: string;
  state?: number;
  timer?: number;
  hp?: number;
}

interface GameState {
  player: {
    x: number;
    y: number;
    width: number;
    height: number;
    speed: number;
    lastFireTime: number;
    invulnerableTimer: number;
    fireLevel: number;
  };
  keys: {
    [key: string]: boolean;
  };
  stars: { x: number; y: number; size: number; speed: number }[];
  playerBullets: Entity[];
  enemyBullets: Entity[];
  enemies: Entity[];
  items: Entity[];
  bossSpawned: boolean;
  bossDefeated: boolean;
  lastTime: number;
  enemySpawnTimer: number;
  score: number;
  gameOver: boolean;
  gameWon: boolean;
  lives: number;
  currentLevelIndex: number;
  levelTime: number;
  levelTransitionTimer: number;
  levelStartScore: number;
}

// 建立物件池
const createPool = (size: number): Entity[] => {
  return Array.from({ length: size }, () => ({
    active: false, x: 0, y: 0, width: 0, height: 0, speed: 0
  }));
};

// 從物件池中取出可用物件
const spawnEntity = (pool: Entity[], props: Partial<Entity>) => {
  const entity = pool.find(e => !e.active);
  if (entity) {
    Object.assign(entity, { ...props, active: true });
  }
};

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);
  const requestRef = useRef<number>();
  const isPointerDown = useRef(false);

  // 使用 useRef 儲存遊戲狀態，避免觸發 React 重新渲染
  const gameState = useRef<GameState>({
    player: { x: 0, y: 0, width: 40, height: 40, speed: 300, lastFireTime: 0, invulnerableTimer: 0, fireLevel: 1 },
    keys: {},
    stars: [],
    playerBullets: createPool(100),
    enemyBullets: createPool(300),
    enemies: createPool(50),
    items: createPool(20),
    bossSpawned: false,
    bossDefeated: false,
    lastTime: 0,
    enemySpawnTimer: 0,
    score: 0,
    gameOver: false,
    gameWon: false,
    lives: 3,
    currentLevelIndex: 0,
    levelTime: 0,
    levelTransitionTimer: 0,
    levelStartScore: 0,
  });

  // AABB 碰撞檢測輔助函數
  const checkAABBCollision = (
    rect1: { x: number; y: number; width: number; height: number },
    rect2: { x: number; y: number; width: number; height: number }
  ) => {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  };

  // 初始化遊戲（例如背景星星）
  const initGame = (width: number, height: number, resetPlayer = false) => {
    const state = gameState.current;
    if (state.stars.length === 0) {
      const stars = [];
      for (let i = 0; i < 100; i++) {
          stars.push({
              x: Math.random() * width,
              y: Math.random() * height,
              size: Math.random() * 2 + 1,
              speed: Math.random() * 50 + 20
          });
      }
      state.stars = stars;
    }
    
    if (resetPlayer) {
      state.player.x = width / 2 - state.player.width / 2;
      state.player.y = height - 100;
      state.player.invulnerableTimer = 0;
      state.player.fireLevel = 1;
      state.playerBullets.forEach(b => b.active = false);
      state.enemyBullets.forEach(b => b.active = false);
      state.enemies.forEach(e => e.active = false);
      state.items.forEach(e => e.active = false);
      state.bossSpawned = false;
      state.bossDefeated = false;
      state.score = 0;
      state.gameOver = false;
      state.gameWon = false;
      state.enemySpawnTimer = 0;
      state.lives = 3;
      state.currentLevelIndex = 0;
      state.levelTime = 0;
      state.levelTransitionTimer = 0;
      state.levelStartScore = 0;
    }
  }

  // 處理滑鼠與觸控的指標事件
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPlaying || isPaused || gameState.current.gameOver || gameState.current.gameWon) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    isPointerDown.current = true;
    updatePlayerPosition(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPlaying || isPaused || gameState.current.gameOver || gameState.current.gameWon || !isPointerDown.current) return;
    updatePlayerPosition(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isPointerDown.current = false;
    if ((e.target as HTMLCanvasElement).hasPointerCapture(e.pointerId)) {
        (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    }
  };

  const updatePlayerPosition = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    gameState.current.player.x = x - gameState.current.player.width / 2;
    gameState.current.player.y = y - gameState.current.player.height / 2;
  };

  // 處理畫布大小調整
  useEffect(() => {
    const resizeCanvas = () => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
        initGame(canvasRef.current.width, canvasRef.current.height, false);
      }
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // 處理鍵盤輸入
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      gameState.current.keys[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      gameState.current.keys[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 遊戲邏輯更新
  const update = (deltaTime: number, width: number, height: number, timestamp: number) => {
    const state = gameState.current;
    if (state.gameOver || state.gameWon) return;

    const level = GAME_LEVELS[state.currentLevelIndex];

    // 如果在過場動畫中
    if (state.levelTransitionTimer > 0) {
      state.levelTransitionTimer -= deltaTime;
      
      // 過場期間只保留星星背景捲動
      state.stars.forEach(star => {
        star.y += star.speed * level.backgroundSpeed * deltaTime;
        if (star.y > height) {
          star.y = 0;
          star.x = Math.random() * width;
        }
      });

      // 倒數結束，正式切換至下一關
      if (state.levelTransitionTimer <= 0) {
        state.currentLevelIndex++;
        state.levelTime = 0;
        state.enemySpawnTimer = 0;
        state.levelStartScore = state.score;
        // 重置玩家位置至畫面下方中央
        state.player.x = width / 2 - state.player.width / 2;
        state.player.y = height - 100;
        // 給予 2 秒的無敵避免出生被撞
        state.player.invulnerableTimer = 2; 
      }
      return; // 暫停其他遊戲邏輯
    }

    state.levelTime += deltaTime;

    // 檢查過關條件
    let isLevelClear = false;
    if (level.winCondition.type === 'survive' && state.levelTime >= level.winCondition.seconds) {
      isLevelClear = true;
    } else if (level.winCondition.type === 'score' && (state.score - state.levelStartScore) >= level.winCondition.target) {
      isLevelClear = true;
    }

    if (isLevelClear) {
      if (state.currentLevelIndex < GAME_LEVELS.length - 1) {
        // 進入過場動畫
        state.levelTransitionTimer = 3.0; // 維持 3 秒
        // 立即清理殘留的敵人和子彈
        state.enemies.forEach(e => e.active = false);
        state.enemyBullets.forEach(b => b.active = false);
        state.playerBullets.forEach(b => b.active = false);
        return;
      } else {
        // 所有關卡全破
        state.gameWon = true;
        return;
      }
    }

    // 更新背景星星（垂直捲軸效果）
    state.stars.forEach(star => {
      star.y += star.speed * level.backgroundSpeed * deltaTime;
      if (star.y > height) {
        star.y = 0;
        star.x = Math.random() * width;
      }
    });

    // 更新玩家位置
    if (state.keys['ArrowLeft'] || state.keys['KeyA']) {
      state.player.x -= state.player.speed * deltaTime;
    }
    if (state.keys['ArrowRight'] || state.keys['KeyD']) {
      state.player.x += state.player.speed * deltaTime;
    }
    if (state.keys['ArrowUp'] || state.keys['KeyW']) {
      state.player.y -= state.player.speed * deltaTime;
    }
    if (state.keys['ArrowDown'] || state.keys['KeyS']) {
      state.player.y += state.player.speed * deltaTime;
    }

    // 邊界檢查
    state.player.x = Math.max(0, Math.min(state.player.x, width - state.player.width));
    state.player.y = Math.max(0, Math.min(state.player.y, height - state.player.height));

    // 發射子彈 - 依據火力等級 (fireLevel)
    const currentTime = timestamp / 1000;
    if (currentTime - state.player.lastFireTime > 0.15) {
      audioSystem.playShoot();
      const fireLvl = state.player.fireLevel || 1;
      const cx = state.player.x + state.player.width / 2;
      const cy = state.player.y;
      
      if (fireLvl === 1) {
        spawnEntity(state.playerBullets, { x: cx - 4, y: cy, width: 8, height: 20, vy: -800, vx: 0 });
      } else if (fireLvl === 2) {
        spawnEntity(state.playerBullets, { x: cx - 12, y: cy, width: 8, height: 20, vy: -800, vx: 0 });
        spawnEntity(state.playerBullets, { x: cx + 4, y: cy, width: 8, height: 20, vy: -800, vx: 0 });
      } else {
        // 等級 3 或以上：三向散彈
        spawnEntity(state.playerBullets, { x: cx - 4, y: cy - 5, width: 8, height: 20, vy: -800, vx: 0 });
        spawnEntity(state.playerBullets, { x: cx - 15, y: cy + 5, width: 8, height: 20, vy: -750, vx: -150 });
        spawnEntity(state.playerBullets, { x: cx + 7, y: cy + 5, width: 8, height: 20, vy: -750, vx: 150 });
      }
      state.player.lastFireTime = currentTime;
    }

    // 更新玩家子彈位置
    state.playerBullets.forEach((b) => {
      if (!b.active) return;
      b.x += (b.vx || 0) * deltaTime;
      b.y += (b.vy || 0) * deltaTime;
      if (b.y + b.height < 0 || b.x < 0 || b.x > width) b.active = false;
    });

    // Boss 生成邏輯
    if (level.winCondition.type === 'bossKill' && !state.bossSpawned && state.levelTime > 3) {
      state.bossSpawned = true;
      spawnEntity(state.enemies, {
        x: width / 2 - 60,
        y: -150, // 從畫面外進場
        width: 120,
        height: 100,
        speed: 150,
        vy: 50, 
        vx: 150, 
        type: 'Boss',
        state: 0, // 0 = 進場期，1 = 戰鬥期
        timer: 0,
        hp: 150 // Boss 高血量
      });
    }

    // 雜魚生成邏輯 (如果 Boss 出現就大幅降低雜魚機率，或者照常)
    if (!state.bossSpawned) {
      state.enemySpawnTimer += deltaTime;
      if (state.enemySpawnTimer > level.enemySpawnRate / 1000) { 
        const allowedTypes = level.enemyTypes;
        const type = allowedTypes[Math.floor(Math.random() * allowedTypes.length)];
        
        let ew = 40, eh = 40, espd = 150 + Math.random() * 150, ehp = 1;
        if (type === 'Carrier') { ew = 60; eh = 60; espd = 80; ehp = 5; }
        else if (type === 'Meteor') { ew = 30; eh = 30; espd = 200 + Math.random() * 200; ehp = 2; }
        else if (type === 'Fighter') { ew = 35; eh = 40; espd = 150 + Math.random() * 100; ehp = 1; }

        spawnEntity(state.enemies, {
          x: Math.random() * (width - ew),
          y: -eh,
          width: ew,
          height: eh,
          speed: espd,
          vy: espd,
          type: type,
          state: 0,
          timer: 0,
          hp: ehp, 
        });
        state.enemySpawnTimer = 0;
      }
    }

    // 更新敵機位置與動作
    state.enemies.forEach((e) => {
      if (!e.active) return;
      e.timer = (e.timer || 0) + deltaTime;

      if (e.type === 'Meteor') {
        e.y += (e.vy || e.speed) * deltaTime;
        // 隕石簡單旋轉效果在 draw 處理
      } else if (e.type === 'Fighter') {
        e.y += (e.vy || e.speed) * deltaTime;
        if (e.timer! > 2.0 && e.y < height * 0.7) { // 每兩秒發射一次單發直下子彈
           e.timer = 0;
           spawnEntity(state.enemyBullets, {
               x: e.x + e.width / 2 - 4,
               y: e.y + e.height,
               width: 8, height: 16, vx: 0, vy: 400
           });
        }
      } else if (e.type === 'Carrier') {
        e.y += (e.vy || 80) * deltaTime; // 緩慢向下
      } else if (e.type === 'Boss') {
        if (e.state === 0) { // 進場
          e.y += (e.vy || 50) * deltaTime;
          if (e.y >= 50) {
            e.state = 1; // 開始戰鬥左右移動
            e.timer = 0;
            e.vx = 150; 
          }
        } else if (e.state === 1) { // 戰鬥期
          e.x += (e.vx || 150) * deltaTime;
          // 碰到邊界反彈
          if (e.x <= 0) { e.x = 0; e.vx = Math.abs(e.vx || 150); }
          if (e.x + e.width >= width) { e.x = width - e.width; e.vx = -Math.abs(e.vx || 150); }

          if (e.timer! > 3.0) { // 每三秒發射扇形散彈
            e.timer = 0;
            const angles = [-40, -20, 0, 20, 40]; 
            const speed = 350;
            angles.forEach(angle => {
               const rad = angle * Math.PI / 180;
               spawnEntity(state.enemyBullets, {
                 x: e.x + e.width / 2 - 5,
                 y: e.y + e.height,
                 width: 10, height: 10,
                 vx: Math.sin(rad) * speed,
                 vy: Math.cos(rad) * speed,
               });
            });
            // 讓 Boss 身材稍微抖動當作發射動畫，或閃個光
          }
        }
      } else if (e.type === 'B') {
        // 保留原有的 turret 邏輯 (舊關卡如有需要)
        if (e.state === 0) {
          e.y += e.speed * deltaTime;
          if (e.y > height * 0.2) {
            e.state = 1; // 停頓
            e.timer = 0;
          }
        } else if (e.state === 1) {
          if (e.timer! > 1) { // 稍微停頓 1 秒才發射
            const angles = [-Math.PI / 8, 0, Math.PI / 8]; 
            const speed = 300;
            angles.forEach(angle => {
               spawnEntity(state.enemyBullets, {
                 x: e.x + e.width / 2 - 4,
                 y: e.y + e.height,
                 width: 10, 
                 height: 10,
                 vx: Math.sin(angle) * speed,
                 vy: Math.cos(angle) * speed,
               });
            });
            e.state = 2; 
            e.timer = 0;
          }
        } else if (e.state === 2) {
           if (e.timer! > 1) { // 射完再停留 1 秒
               e.state = 3; 
           }
        } else if (e.state === 3) {
           e.y += e.speed * deltaTime; // 繼續向下
        }
      } else {
        // A 型，直線往下
        e.y += (e.vy || e.speed) * deltaTime;
      }

      if (e.y > height) e.active = false;
    });

    // 更新掉落道具位置
    state.items.forEach(item => {
       if (!item.active) return;
       item.y += (item.vy || 100) * deltaTime;
       if (item.y > height) item.active = false;
    });

    // 更新敵軍子彈位置
    state.enemyBullets.forEach(b => {
       if (!b.active) return;
       b.x += (b.vx || 0) * deltaTime;
       b.y += (b.vy || 0) * deltaTime;
       if (b.y > height || b.x < 0 || b.x > width) b.active = false;
    });

    // AABB 碰撞偵測 - 玩家與道具
    state.items.forEach(item => {
       if (item.active && checkAABBCollision(state.player, item)) {
           item.active = false;
           state.player.fireLevel = Math.min(3, state.player.fireLevel + 1);
           state.score += 200;
           audioSystem.playShoot(); // 可換成吃到道具的音效，這裡暫代
       }
    });

    // AABB 碰撞偵測 - 子彈擊中敵機
    state.playerBullets.forEach((bullet) => {
      if (!bullet.active) return;
      state.enemies.forEach((enemy) => {
        if (!enemy.active) return;
        if (checkAABBCollision(bullet, enemy)) {
          bullet.active = false;
          enemy.hp = (enemy.hp || 1) - 1;
          if (enemy.hp <= 0) {
              audioSystem.playExplosion();
              enemy.active = false;
              
              if (enemy.type === 'Carrier') {
                 // 掉落火力升級道具
                 spawnEntity(state.items, {
                    x: enemy.x + enemy.width / 2 - 15,
                    y: enemy.y + enemy.height / 2 - 15,
                    width: 30, height: 30, vy: 120, type: 'PowerUp'
                 });
                 state.score += 800;
              } else if (enemy.type === 'Boss') {
                 state.bossDefeated = true;
                 state.score += 5000;
              } else {
                 state.score += 100;
              }
          }
        }
      });
    });

    // 檢查 Boss 死後勝利條件
    if (level.winCondition.type === 'bossKill' && state.bossDefeated) {
       isLevelClear = true; // 將觸發下一次 update 迴圈進入切換
    }

    if (state.player.invulnerableTimer > 0) {
      state.player.invulnerableTimer -= deltaTime;
    }

    // AABB 碰撞偵測 - 玩家撞擊敵機 與 敵軍子彈
    if (state.player.invulnerableTimer <= 0) {
      const hitBox = {
          x: state.player.x + state.player.width / 2 - 5,
          y: state.player.y + state.player.height / 2 - 5,
          width: 10,
          height: 10
      };

      // 撞擊敵軍部隊
      state.enemies.forEach((enemy) => {
        if (enemy.active && checkAABBCollision(hitBox, enemy)) {
          audioSystem.playDamage();
          state.lives -= 1;
          enemy.active = false; // 敵機撞毀後消失
          
          if (state.lives <= 0) {
             state.gameOver = true;
             audioSystem.setGameOver(true);
          } else {
             state.player.invulnerableTimer = 3; // 給予 3 秒的無敵時間
          }
        }
      });

      // 撞擊敵軍子彈
      if (state.player.invulnerableTimer <= 0) {
        state.enemyBullets.forEach((bullet) => {
          if (bullet.active && checkAABBCollision(hitBox, bullet)) {
             audioSystem.playDamage();
             state.lives -= 1;
             bullet.active = false; 
             
             if (state.lives <= 0) {
                state.gameOver = true;
                audioSystem.setGameOver(true);
             } else {
                state.player.invulnerableTimer = 3; // 給予 3 秒的無敵時間
             }
          }
        });
      }
    }

    // 更新背景星星（垂直捲軸效果）
    state.stars.forEach(star => {
        star.y += star.speed * deltaTime;
        if (star.y > height) {
            star.y = 0;
            star.x = Math.random() * width;
        }
    });
  };

  // 遊戲畫面渲染
  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const state = gameState.current;
    const level = GAME_LEVELS[state.currentLevelIndex];

    // 清除畫布並畫上深色背景
    ctx.fillStyle = level.backgroundColor || '#0f172a'; // Tailwind slate-900 預設
    ctx.fillRect(0, 0, width, height);

    // 畫出星星
    ctx.fillStyle = '#cbd5e1'; // Tailwind slate-300
    state.stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // 畫出玩家子彈
    ctx.fillStyle = '#fbbf24'; // Tailwind amber-400
    state.playerBullets.forEach((b) => {
      if (b.active) {
        ctx.fillRect(b.x, b.y, b.width, b.height);
      }
    });

    // 畫出敵軍子彈
    ctx.fillStyle = '#f97316'; // Tailwind orange-500
    state.enemyBullets.forEach((b) => {
      if (b.active) {
        ctx.beginPath();
        ctx.arc(b.x + b.width/2, b.y + b.height/2, b.width/2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 畫出敵機
    state.enemies.forEach((e) => {
      if (!e.active) return;
      
      ctx.save();
      ctx.translate(e.x + e.width / 2, e.y + e.height / 2);

      if (e.type === 'Fighter' || e.type === 'A') {
        // 銳利的敵軍輕型戰機
        ctx.fillStyle = '#ef4444'; // Tailwind red-500
        ctx.beginPath();
        ctx.moveTo(0, 20); // 機鼻朝下
        ctx.lineTo(20, -10); // 右翼尖端
        ctx.lineTo(5, -5); // 右翼內側
        ctx.lineTo(0, -20); // 尾翼
        ctx.lineTo(-5, -5); // 左翼內側
        ctx.lineTo(-20, -10); // 左翼尖端
        ctx.closePath();
        ctx.fill();

        // 座艙
        ctx.fillStyle = '#fca5a5'; // Tailwind red-300
        ctx.beginPath();
        ctx.ellipse(0, 5, 3, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        
      } else if (e.type === 'Meteor') {
        // 簡單旋轉的太空隕石模型
        ctx.rotate((e.y * 0.02) % (Math.PI * 2));
        ctx.fillStyle = '#64748b'; // Tailwind slate-500
        ctx.beginPath();
        ctx.moveTo(-10, -15);
        ctx.lineTo(10, -12);
        ctx.lineTo(15, 5);
        ctx.lineTo(5, 15);
        ctx.lineTo(-12, 10);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#334155'; // Tailwind slate-700
        ctx.beginPath();
        ctx.arc(-2, -2, 3, 0, Math.PI * 2);
        ctx.arc(5, 5, 2, 0, Math.PI * 2);
        ctx.fill();

      } else if (e.type === 'Boss') {
        const blinkBoss = e.timer && e.timer > 2.5 && Math.floor(e.timer * 15) % 2 === 0;
        
        // 巨型守護者核心
        ctx.fillStyle = blinkBoss ? '#ef4444' : '#1e3a8a'; // blue-900 
        ctx.beginPath();
        ctx.moveTo(0, 50); // 前端 (向下)
        ctx.lineTo(60, 0); // 右側
        ctx.lineTo(40, -50); // 右後
        ctx.lineTo(-40, -50); // 左後
        ctx.lineTo(-60, 0); // 左側
        ctx.closePath();
        ctx.fill();

        // 巨型裝甲護翼
        ctx.fillStyle = '#0f172a'; // slate-900
        ctx.beginPath();
        ctx.moveTo(40, -20);
        ctx.lineTo(70, -30);
        ctx.lineTo(70, 20);
        ctx.lineTo(20, 40);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-40, -20);
        ctx.lineTo(-70, -30);
        ctx.lineTo(-70, 20);
        ctx.lineTo(-20, 40);
        ctx.closePath();
        ctx.fill();

        // Boss 之眼 / 核心能量匣
        ctx.fillStyle = blinkBoss ? '#ffffff' : '#f43f5e'; // rose-500
        ctx.beginPath();
        ctx.ellipse(0, 10, 15, 25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = blinkBoss ? '#f43f5e' : '#fda4af'; // rose-300
        ctx.beginPath();
        ctx.ellipse(0, 10, 8, 15, 0, 0, Math.PI * 2);
        ctx.fill();

      } else if (e.type === 'B' || e.type === 'Carrier') {
        // 發射前的閃爍警告 (狀態 1 且 timer > 0.5)
        const isWarning = e.state === 1 && (e.timer || 0) > 0.5;
        const blinkRed = isWarning && Math.floor((e.timer || 0) * 15) % 2 === 0;

        // 裝甲六角形本體 (Heavy hexagon hull)
        ctx.fillStyle = blinkRed ? '#ef4444' : '#9333ea'; // Tailwind purple-600
        ctx.beginPath();
        ctx.moveTo(0, -25);
        ctx.lineTo(25, -10);
        ctx.lineTo(25, 10);
        ctx.lineTo(0, 25);
        ctx.lineTo(-25, 10);
        ctx.lineTo(-25, -10);
        ctx.closePath();
        ctx.fill();

        // 核心裝甲 (Inner lighter core)
        ctx.fillStyle = blinkRed ? '#fee2e2' : '#c084fc'; // Tailwind purple-400
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(15, -5);
        ctx.lineTo(15, 5);
        ctx.lineTo(0, 15);
        ctx.lineTo(-15, 5);
        ctx.lineTo(-15, -5);
        ctx.closePath();
        ctx.fill();

        // 雙管重型火砲 (Twin cannons)
        ctx.fillStyle = blinkRed ? '#991b1b' : '#581c87'; // purple-950
        ctx.fillRect(-15, 5, 8, 25);
        ctx.fillRect(7, 5, 8, 25);
        
        // 砲口能量發射點 (Cannon glow)
        ctx.fillStyle = blinkRed ? '#fca5a5' : '#f87171';
        ctx.fillRect(-12, 28, 2, 6);
        ctx.fillRect(10, 28, 2, 6);
      }
      
      ctx.restore();
    });

    // 畫出掉落物
    state.items.forEach(item => {
      if (!item.active) return;
      ctx.save();
      ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
      ctx.rotate((item.y * 0.05) % (Math.PI * 2));
      
      ctx.fillStyle = '#10b981'; // emerald-500
      ctx.fillRect(-10, -10, 20, 20);
      
      ctx.fillStyle = '#ecfdf5'; // emerald-50
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', 0, 0);

      ctx.restore();
    });

    // 閃爍效果：如果處於無敵狀態，每隔 0.1 秒閃爍隱藏一次
    const isVisible = state.player.invulnerableTimer <= 0 || Math.floor(state.player.invulnerableTimer * 10) % 2 === 0;

    if (isVisible) {
      ctx.save();
      // 將繪圖原點移動到飛機正中心
      ctx.translate(state.player.x + state.player.width / 2, state.player.y + state.player.height / 2);

      // 主機身 (Main fuselage)
      ctx.fillStyle = '#2563eb'; // Tailwind blue-600
      ctx.beginPath();
      ctx.moveTo(0, -20); // 機鼻
      ctx.lineTo(10, -5);
      ctx.lineTo(10, 15);
      ctx.lineTo(-10, 15);
      ctx.lineTo(-10, -5);
      ctx.closePath();
      ctx.fill();

      // 前掠翼 (Swept-forward wings)
      ctx.fillStyle = '#1e40af'; // Tailwind blue-800
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(25, 10);
      ctx.lineTo(25, 15);
      ctx.lineTo(10, 5);
      ctx.lineTo(-10, 5);
      ctx.lineTo(-25, 15);
      ctx.lineTo(-25, 10);
      ctx.closePath();
      ctx.fill();

      // 高科技座艙 (Cockpit canopy)
      ctx.fillStyle = '#67e8f9'; // Tailwind cyan-300
      ctx.beginPath();
      ctx.ellipse(0, -5, 4, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // 高能雙引擎火焰特效 (Twin Engine flames)
      ctx.fillStyle = '#ef4444'; // Tailwind red-500
      ctx.beginPath();
      ctx.moveTo(-8, 15);
      ctx.lineTo(-2, 15);
      ctx.lineTo(-5, 15 + Math.random() * 15 + 5);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(2, 15);
      ctx.lineTo(8, 15);
      ctx.lineTo(5, 15 + Math.random() * 15 + 5);
      ctx.closePath();
      ctx.fill();

      // 顯示碰撞核心 (Hitbox core) 讓玩家精準躲避
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ec4899'; // 亮粉色核心 Tailwind pink-500
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 畫出狀態 UI
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px monospace';
    // 左上角畫分數
    ctx.fillText(`SCORE: ${state.score.toString().padStart(6, '0')}`, 20, 40);
    // 左上角分數下方畫生命值
    ctx.fillText(`LIVES: ${state.lives}`, 20, 70);

    // 中間上方畫關卡進度與條件
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#64748b'; // slate-500
    ctx.fillText(level.name, width / 2, 30);
    
    ctx.fillStyle = '#94a3b8'; // slate-400
    if (level.winCondition.type === 'survive') {
      const timeLeft = Math.max(0, Math.ceil(level.winCondition.seconds - state.levelTime));
      ctx.fillText(`SURVIVE: ${timeLeft}s`, width / 2, 55);
    } else if (level.winCondition.type === 'score') {
      const currentLevelScore = state.score - state.levelStartScore;
      ctx.fillText(`TARGET SCORE: ${currentLevelScore} / ${level.winCondition.target}`, width / 2, 55);
    }
    ctx.textAlign = 'left'; // 恢復預設

    // 畫出 Level Clear 過場動畫字卡
    if (state.levelTransitionTimer > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // 半透明遮罩
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 42px monospace';
      ctx.fillText('LEVEL CLEAR', width / 2, height / 2 - 20);

      const nextLevel = GAME_LEVELS[state.currentLevelIndex + 1];
      if (nextLevel) {
        ctx.fillStyle = '#cbd5e1'; // slate-300
        ctx.font = 'bold 20px monospace';
        ctx.fillText(`NEXT: ${nextLevel.name}`, width / 2, height / 2 + 25);
      }
      ctx.textAlign = 'left';
    }
  };

  // 主要遊戲迴圈
  const gameLoop = (timestamp: number) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (gameState.current.gameOver || gameState.current.gameWon) {
      setIsPlaying(false);
    }

    if (isPaused) {
      // 就算暫停也需要更新 timestamp 防止解除暫停時計算出超大的 deltaTime 導致暴衝
      gameState.current.lastTime = timestamp;
      requestRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    // 計算 deltaTime (秒)
    let deltaTime = (timestamp - gameState.current.lastTime) / 1000;
    if (deltaTime > 0.1) deltaTime = 0.1; // 避免切換分頁時產生巨大的 deltaTime
    gameState.current.lastTime = timestamp;

    update(deltaTime, canvas.width, canvas.height, timestamp);
    draw(ctx, canvas.width, canvas.height);

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  // 控制遊戲啟動與暫停
  useEffect(() => {
    if (isPlaying) {
      // 因為 initGame 只有按 START/RETRY 時才會重製，這裡不再強制 initGame
      // 以支援透過暫停恢復
      gameState.current.lastTime = performance.now();
      requestRef.current = requestAnimationFrame(gameLoop);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, isPaused]);

  return (
    <div className="relative w-full h-full bg-slate-950 flex items-center justify-center font-sans">
      {/* 限制遊戲區域的最大寬度，類似大型機台的螢幕比例 */}
      <div 
        ref={containerRef} 
        className="relative w-full max-w-2xl h-full max-h-[900px] bg-slate-900 overflow-hidden shadow-2xl shadow-blue-900/20"
      >
        {/* 控制面板 */}
        <div className="absolute top-4 right-4 z-20 flex flex-row gap-2">
          <button 
            onClick={() => {
              if (gameState.current.gameOver || gameState.current.gameWon) return;
              const newPaused = !isPaused;
              setIsPaused(newPaused);
              audioSystem.setPaused(newPaused);
            }} 
            className="p-2 bg-slate-800/80 hover:bg-slate-700/80 backdrop-blur-sm text-white rounded-full transition shadow-lg outline-none"
            aria-label="Pause button"
          >
            {isPaused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button 
            onClick={() => {
              const newMusicOn = !musicOn;
              setMusicOn(newMusicOn);
              audioSystem.setMusicEnabled(newMusicOn);
            }} 
            className={`p-2 backdrop-blur-sm rounded-full transition shadow-lg outline-none relative overflow-hidden ${musicOn ? 'bg-slate-800/80 text-white hover:bg-slate-700/80' : 'bg-slate-800/40 text-slate-400 hover:bg-slate-700/60'}`}
            title="Toggle Music"
          >
            <Music size={18} />
            {!musicOn && <div className="absolute top-1/2 left-1/2 w-6 h-[2px] bg-red-400 -translate-x-1/2 -translate-y-1/2 rotate-45 transform" />}
          </button>
          <button 
            onClick={() => {
              const newSfxOn = !sfxOn;
              setSfxOn(newSfxOn);
              audioSystem.setSFXEnabled(newSfxOn);
            }} 
            className={`p-2 backdrop-blur-sm rounded-full transition shadow-lg outline-none relative overflow-hidden ${sfxOn ? 'bg-slate-800/80 text-white hover:bg-slate-700/80' : 'bg-slate-800/40 text-slate-400 hover:bg-slate-700/60'}`}
            title="Toggle SFX"
          >
            {sfxOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>

        <canvas 
          ref={canvasRef} 
          className="block w-full h-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        
        {!isPlaying && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-10 text-white">
            <h1 className="text-5xl font-bold mb-2 tracking-widest text-transparent bg-clip-text bg-gradient-to-tr from-blue-400 to-indigo-300 drop-shadow-sm text-center px-4">
                {gameState.current.gameWon ? 'Game Over - You Win' : (gameState.current.gameOver ? 'MISSION FAILED' : 'GEOMETRIC STRIKER')}
            </h1>
            {(gameState.current.gameOver || gameState.current.gameWon) && (
              <p className="text-2xl mb-4 font-mono text-amber-400">SCORE: {gameState.current.score.toString().padStart(6, '0')}</p>
            )}
            <p className="text-slate-400 mb-8 tracking-widest text-sm">
              {gameState.current.gameWon ? 'ALL SECTORS CLEARED' : (gameState.current.gameOver ? 'SCRAMBLE AGAIN?' : 'PRESS START TO MISSION')}
            </p>
            <button
              onClick={() => {
                if (canvasRef.current) initGame(canvasRef.current.width, canvasRef.current.height, true);
                audioSystem.init();
                audioSystem.setGameOver(false);
                setIsPlaying(true);
                setIsPaused(false);
              }}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow-[0_0_15px_rgba(37,99,235,0.5)] transition-all active:scale-95 tracking-wider cursor-pointer"
            >
              {gameState.current.gameOver || gameState.current.gameWon ? 'RETRY' : 'START GAME'}
            </button>
            <p className="mt-8 text-xs text-slate-500">Use Mouse/Touch drag or WASD to move.</p>
          </div>
        )}

        {isPaused && isPlaying && (!gameState.current.gameOver && !gameState.current.gameWon) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-[2px] z-10 text-white">
            <h2 className="text-4xl font-bold tracking-[0.2em] mb-8 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">PAUSED</h2>
            <button
              onClick={() => {
                setIsPaused(false);
                audioSystem.setPaused(false);
              }}
              className="px-8 py-3 outline-none border border-blue-400/50 bg-slate-800/80 hover:bg-slate-700/80 text-blue-200 font-bold rounded transition-all active:scale-95 tracking-wider cursor-pointer"
            >
              RESUME
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

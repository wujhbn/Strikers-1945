export type WinCondition = 
  | { type: 'survive'; seconds: number }
  | { type: 'score'; target: number }
  | { type: 'bossKill' };

export interface LevelConfig {
  levelId: number;
  name: string;
  backgroundColor: string;
  backgroundSpeed: number;
  enemySpawnRate: number; // 毫秒 (ms)
  enemyTypes: string[];
  winCondition: WinCondition;
}

export const GAME_LEVELS: LevelConfig[] = [
  {
    levelId: 1,
    name: "MISSION 1: ASTEROID FIELD",
    backgroundColor: '#0f172a', // 深藍色
    backgroundSpeed: 1.0,
    enemySpawnRate: 1000,
    enemyTypes: ['Meteor'], // 只有隕石
    winCondition: { 
      type: 'score', 
      target: 3000
    }
  },
  {
    levelId: 2,
    name: "MISSION 2: LIGHT DOGFIGHT",
    backgroundColor: '#1e1b4b', // 深靛色
    backgroundSpeed: 1.5,
    enemySpawnRate: 800,
    enemyTypes: ['Fighter', 'Fighter', 'Fighter', 'Carrier'], // 運輸機機率較低，會掉落火力升級
    winCondition: { 
      type: 'score', 
      target: 6000
    }
  },
  {
    levelId: 3,
    name: "MISSION 3: THE GUARDIAN",
    backgroundColor: '#3b0764', // 深紫色星空
    backgroundSpeed: 2.5,
    enemySpawnRate: 2000, // 生成頻率降低，讓玩家有空間躲避 Boss
    enemyTypes: ['Fighter'],
    winCondition: { 
      type: 'bossKill' 
    }
  }
];

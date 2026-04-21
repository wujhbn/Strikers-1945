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
    name: "MISSION 1: ADAPTATION",
    backgroundColor: '#0f172a',
    backgroundSpeed: 1.0,
    enemySpawnRate: 1500,
    enemyTypes: ['Meteor', 'Turret'],
    winCondition: { type: 'survive', seconds: 45 }
  },
  {
    levelId: 2,
    name: "MISSION 2: AWARENESS",
    backgroundColor: '#1e1b4b',
    backgroundSpeed: 1.5,
    enemySpawnRate: 1200,
    enemyTypes: ['VFormation', 'SpreadShooter'],
    winCondition: { type: 'score', target: 5000 }
  },
  {
    levelId: 3,
    name: "MISSION 3: PRIORITY",
    backgroundColor: '#312e81',
    backgroundSpeed: 2.0,
    enemySpawnRate: 1000,
    enemyTypes: ['HeavyArmor', 'Turret'],
    winCondition: { type: 'score', target: 8000 }
  },
  {
    levelId: 4,
    name: "MISSION 4: PRESSURE",
    backgroundColor: '#4c1d95',
    backgroundSpeed: 2.5,
    enemySpawnRate: 900,
    enemyTypes: ['Sweeper', 'VFormation'],
    winCondition: { type: 'score', target: 12000 }
  },
  {
    levelId: 5,
    name: "FINAL MISSION: THE END",
    backgroundColor: '#581c87',
    backgroundSpeed: 3.5,
    enemySpawnRate: 3000, 
    enemyTypes: [], 
    winCondition: { type: 'bossKill' }
  }
];

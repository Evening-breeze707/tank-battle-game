(() => {
  const app = window.TankGame;
  const { refs, levels } = app;

  levels.createTank = function createTank(x, y, color, isPlayer = false, overrides = {}) {
    return {
      x,
      y,
      width: overrides.width ?? 32,
      height: overrides.height ?? 32,
      speed: overrides.speed ?? (isPlayer ? 180 : 95),
      color,
      dir: 'up',
      isPlayer,
      isBoss: Boolean(overrides.isBoss),
      hp: overrides.hp ?? 1,
      shotCooldown: 0,
      aiShootTimer: 0,
      aiTurnTimer: 0,
      aiPath: [],
      aiPathTimer: 0,
      aiTargetCellKey: '',
      stuckTimer: 0,
      aiStepTarget: null,
      aiStepDir: '',
    };
  };

  function createBlock(x, y, type) {
    return { x, y, width: 40, height: 40, type, hp: type === 'brick' ? 2 : 999 };
  }

  function createTerrain(x, y, type, patchId = '') {
    return { x, y, width: 40, height: 40, type, patchId };
  }

  function addLineBlocks(blocks, fromX, y, toX, step, typeGetter, skipXs = []) {
    for (let x = fromX; x <= toX; x += step) {
      if (skipXs.includes(x)) continue;
      blocks.push(createBlock(x, y, typeGetter(x)));
    }
  }

  function addTerrainRect(terrainTiles, fromX, fromY, toX, toY, type, patchId = '') {
    for (let y = fromY; y <= toY; y += 40) {
      for (let x = fromX; x <= toX; x += 40) {
        terrainTiles.push(createTerrain(x, y, type, patchId));
      }
    }
  }

  function createLevelMap1() {
    const blocks = [];
    const terrainTiles = [];
    addLineBlocks(blocks, 120, 200, 640, 40, (x) => (x % 80 === 0 ? 'steel' : 'brick'));
    addLineBlocks(blocks, 80, 320, 680, 40, (x) => (x % 120 === 0 ? 'steel' : 'brick'), [360, 400]);
    for (let y = 80; y <= 360; y += 40) {
      blocks.push(createBlock(40, y, 'steel'));
      blocks.push(createBlock(720, y, 'steel'));
    }
    addTerrainRect(terrainTiles, 120, 80, 240, 160, 'grass', 'l1-grass-left');
    addTerrainRect(terrainTiles, 560, 80, 680, 160, 'grass', 'l1-grass-right');
    addTerrainRect(terrainTiles, 320, 360, 440, 440, 'grass', 'l1-grass-bottom');
    return { blocks, terrainTiles };
  }

  function createLevelMap2() {
    const blocks = [];
    const terrainTiles = [];
    for (let y = 120; y <= 360; y += 40) {
      blocks.push(createBlock(200, y, y === 240 ? 'steel' : 'brick'));
      blocks.push(createBlock(560, y, y === 240 ? 'steel' : 'brick'));
    }
    addLineBlocks(blocks, 280, 120, 480, 40, () => 'steel');
    addLineBlocks(blocks, 280, 360, 480, 40, (x) => (x === 360 || x === 400 ? 'steel' : 'brick'));
    addLineBlocks(blocks, 80, 260, 680, 40, (x) => (x % 160 === 0 ? 'steel' : 'brick'), [360, 400]);
    addTerrainRect(terrainTiles, 80, 120, 160, 240, 'grass', 'l2-grass-left');
    addTerrainRect(terrainTiles, 640, 120, 720, 240, 'grass', 'l2-grass-right');
    addTerrainRect(terrainTiles, 320, 400, 480, 440, 'grass', 'l2-grass-bottom');
    return { blocks, terrainTiles };
  }

  function createBossMap() {
    const blocks = [];
    const terrainTiles = [];
    addLineBlocks(blocks, 80, 180, 680, 40, (x) => (x % 120 === 0 ? 'steel' : 'brick'));
    addLineBlocks(blocks, 80, 300, 680, 40, (x) => (x % 120 === 40 ? 'steel' : 'brick'));
    for (let y = 80; y <= 360; y += 40) {
      if (y === 240) continue;
      blocks.push(createBlock(360, y, y % 80 === 0 ? 'steel' : 'brick'));
      blocks.push(createBlock(400, y, y % 80 === 0 ? 'steel' : 'brick'));
    }
    addTerrainRect(terrainTiles, 120, 80, 240, 120, 'grass', 'boss-grass-top-left');
    addTerrainRect(terrainTiles, 560, 80, 680, 120, 'grass', 'boss-grass-top-right');
    addTerrainRect(terrainTiles, 120, 360, 240, 440, 'grass', 'boss-grass-bottom-left');
    addTerrainRect(terrainTiles, 560, 360, 680, 440, 'grass', 'boss-grass-bottom-right');
    return { blocks, terrainTiles };
  }

  levels.randomEnemySpawnX = function randomEnemySpawnX() {
    const candidates = [80, 240, 400, 560, 680];
    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  levels.LEVELS = [
    {
      name: '沙漠据点',
      waves: [5, 7],
      enemySpeed: 95,
      maxAlive: 4,
      map: createLevelMap1,
    },
    {
      name: '钢铁走廊',
      waves: [7, 9],
      enemySpeed: 105,
      maxAlive: 5,
      map: createLevelMap2,
    },
    {
      name: '终极基地',
      waves: [0],
      enemySpeed: 115,
      maxAlive: 1,
      map: createBossMap,
      boss: {
        hp: 24,
        speed: 90,
        color: '#c93a3a',
        score: 1200,
      },
    },
  ];
})();

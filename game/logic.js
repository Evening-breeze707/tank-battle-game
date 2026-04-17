(() => {
  const app = window.TankGame;
  const { refs, input, constants, state, api, levels, logic } = app;
  const { canvas } = refs;
  const { STATE, MAX_LIVES, GRASS_SLOW_FACTOR, GRID_SIZE, GRID_COLS, GRID_ROWS } = constants;

  logic.stageText = function stageText() {
    if (!state.game) return '1-1';
    return `${state.game.levelIndex + 1}-${Math.min(state.game.waveIndex + 1, state.game.level.waves.length)}`;
  };

  logic.syncPanel = function syncPanel() {
    refs.stageEl.textContent = logic.stageText();
    refs.scoreEl.textContent = String(state.game.score);
    refs.livesEl.textContent = String(state.game.lives);
    refs.enemiesEl.textContent = String(state.game.enemies.length + state.game.spawnRemain);
  };

  logic.setStatus = function setStatus(text, color = '#7ce38b') {
    refs.statusEl.textContent = text;
    refs.statusEl.style.color = color;
  };

  logic.startGame = function startGame() {
    if (!state.game) logic.resetGame();
    state.game.state = STATE.running;
    logic.setStatus(`第 ${state.game.levelIndex + 1} 关 ${state.game.level.name} 开始`);
  };

  logic.endGame = function endGame(win) {
    state.game.state = STATE.over;
    logic.setStatus(
      win ? '最终胜利！点击“开始游戏”再战' : '失败！点击“开始游戏”重来',
      win ? '#7ce38b' : '#ff8d8d',
    );
    api.saveProfile();
    api.submitScore();
  };

  function createInitialGame() {
    state.game = {
      state: STATE.ready,
      score: 0,
      lives: 3,
      player: levels.createTank(canvas.width / 2 - 16, canvas.height - 60, '#4ad66d', true),
      bullets: [],
      explosions: [],
      pickups: [],
      enemies: [],
      levelIndex: 0,
      waveIndex: 0,
      spawnRemain: 0,
      spawnTimer: 0,
      shieldTimer: 0,
      rapidFireTimer: 0,
      level: levels.LEVELS[0],
      mapBlocks: [],
      terrainTiles: [],
    };
  }

  logic.resetGame = function resetGame() {
    createInitialGame();
    logic.loadLevel(0, true);
    logic.syncPanel();
    logic.setStatus('按下“开始游戏”');
    app.render.draw();
  };

  logic.loadLevel = function loadLevel(levelIndex, initial = false) {
    state.game.levelIndex = levelIndex;
    state.game.level = levels.LEVELS[levelIndex];
    state.game.waveIndex = 0;
    state.game.spawnRemain = state.game.level.waves[0];
    state.game.spawnTimer = 0;
    state.game.enemies = [];
    state.game.bullets = [];
    state.game.pickups = [];

    const levelData = state.game.level.map();
    state.game.mapBlocks = levelData.blocks || levelData;
    state.game.terrainTiles = levelData.terrainTiles || [];

    state.game.player.x = canvas.width / 2 - state.game.player.width / 2;
    state.game.player.y = canvas.height - 60;
    state.game.player.dir = 'up';

    if (state.game.level.boss) {
      spawnBoss();
      state.game.spawnRemain = 0;
    }

    if (!initial) {
      logic.setStatus(`进入第 ${levelIndex + 1} 关：${state.game.level.name}`, '#ffe08a');
    }
  };

  function spawnBoss() {
    const cfg = state.game.level.boss;
    const candidates = [
      { x: 280, y: 30 },
      { x: 480, y: 30 },
      { x: 80, y: 30 },
      { x: 640, y: 30 },
    ];

    for (const candidate of candidates) {
      const boss = levels.createTank(
        candidate.x,
        candidate.y,
        cfg.color,
        false,
        { width: 40, height: 40, speed: cfg.speed, isBoss: true, hp: cfg.hp },
      );
      snapTankToCell(boss);
      if (!tankBlocked(boss, boss)) {
        state.game.enemies.push(boss);
        return;
      }
    }
  }

  logic.fireBullet = function fireBullet(fromTank) {
    if (fromTank.shotCooldown > 0) return;

    const speed = fromTank.isPlayer ? 340 : fromTank.isBoss ? 280 : 240;
    state.game.bullets.push({
      x: fromTank.x + fromTank.width / 2,
      y: fromTank.y + fromTank.height / 2,
      radius: fromTank.isBoss ? 5 : 4,
      speed,
      ownerPlayer: fromTank.isPlayer,
      dir: fromTank.dir,
    });

    if (fromTank.isPlayer) {
      fromTank.shotCooldown = state.game.rapidFireTimer > 0 ? 0.1 : 0.24;
    } else if (fromTank.isBoss) {
      fromTank.shotCooldown = 0.45;
    } else {
      fromTank.shotCooldown = 0.9;
    }
  };

  function clampTank(tank) {
    tank.x = Math.max(0, Math.min(canvas.width - tank.width, tank.x));
    tank.y = Math.max(0, Math.min(canvas.height - tank.height, tank.y));
  }

  function intersects(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function tankBlockedByMap(tank) {
    return state.game.mapBlocks.some((block) => intersects(tank, block));
  }

  function tankBlockedByEnemies(tank, ignoreTank = null) {
    return state.game.enemies.some((enemy) => enemy !== ignoreTank && intersects(tank, enemy));
  }

  function tankBlocked(tank, ignoreTank = null) {
    return tankBlockedByMap(tank) || tankBlockedByEnemies(tank, ignoreTank);
  }

  function tankCenterPoint(tank) {
    return {
      x: tank.x + tank.width / 2,
      y: tank.y + tank.height / 2,
    };
  }

  logic.isTankInTerrain = function isTankInTerrain(tank, type) {
    const point = tankCenterPoint(tank);
    return state.game.terrainTiles.some((tile) => tile.type === type && rectHitPoint(tile, point.x, point.y));
  };

  function getTankTerrainPatchId(tank, type) {
    const point = tankCenterPoint(tank);
    const tile = state.game.terrainTiles.find((entry) => entry.type === type && rectHitPoint(entry, point.x, point.y));
    return tile?.patchId || '';
  }

  logic.isTankInGrass = function isTankInGrass(tank) {
    return logic.isTankInTerrain(tank, 'grass');
  };

  logic.isSameGrassPatch = function isSameGrassPatch(tankA, tankB) {
    const patchA = getTankTerrainPatchId(tankA, 'grass');
    if (!patchA) return false;
    return patchA === getTankTerrainPatchId(tankB, 'grass');
  };

  function getTankMoveSpeed(tank) {
    return tank.speed * (logic.isTankInGrass(tank) ? GRASS_SLOW_FACTOR : 1);
  }

  function moveTankWithCollision(tank, dx, dy, ignoreTank = null) {
    const oldX = tank.x;
    const oldY = tank.y;

    tank.x += dx;
    clampTank(tank);
    if (tankBlocked(tank, ignoreTank)) tank.x = oldX;

    tank.y += dy;
    clampTank(tank);
    if (tankBlocked(tank, ignoreTank)) tank.y = oldY;
  }

  function updatePlayer(dt) {
    const p = state.game.player;
    const activeDir = app.input.getActiveDirection();
    let vx = 0;
    let vy = 0;

    if (activeDir === 'up') {
      vy = -1;
      p.dir = 'up';
    } else if (activeDir === 'down') {
      vy = 1;
      p.dir = 'down';
    } else if (activeDir === 'left') {
      vx = -1;
      p.dir = 'left';
    } else if (activeDir === 'right') {
      vx = 1;
      p.dir = 'right';
    }

    const moveSpeed = getTankMoveSpeed(p);
    moveTankWithCollision(p, vx * moveSpeed * dt, vy * moveSpeed * dt);
    p.shotCooldown = Math.max(0, p.shotCooldown - dt);
  }

  function chooseRandomDir() {
    const dirs = ['up', 'down', 'left', 'right'];
    return dirs[Math.floor(Math.random() * dirs.length)];
  }

  function shuffleDirections(dirs) {
    const result = [...dirs];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function getDirectionVector(dir) {
    if (dir === 'up') return { vx: 0, vy: -1 };
    if (dir === 'down') return { vx: 0, vy: 1 };
    if (dir === 'left') return { vx: -1, vy: 0 };
    return { vx: 1, vy: 0 };
  }

  function cellKey(cx, cy) {
    return `${cx},${cy}`;
  }

  function pointToCell(x, y) {
    return {
      cx: Math.max(0, Math.min(GRID_COLS - 1, Math.floor(x / GRID_SIZE))),
      cy: Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(y / GRID_SIZE))),
    };
  }

  function tankToCell(tank) {
    const point = tankCenterPoint(tank);
    return pointToCell(point.x, point.y);
  }

  function getCellAlignedPosition(cx, cy, tank) {
    return {
      x: cx * GRID_SIZE + (GRID_SIZE - tank.width) / 2,
      y: cy * GRID_SIZE + (GRID_SIZE - tank.height) / 2,
    };
  }

  function snapTankToCell(tank) {
    const point = tankCenterPoint(tank);
    const cell = pointToCell(point.x, point.y);
    const aligned = getCellAlignedPosition(cell.cx, cell.cy, tank);
    tank.x = aligned.x;
    tank.y = aligned.y;
  }

  function isCellWalkable(cx, cy, tank) {
    if (cx < 0 || cx >= GRID_COLS || cy < 0 || cy >= GRID_ROWS) return false;

    const aligned = getCellAlignedPosition(cx, cy, tank);
    const probe = { ...tank, x: aligned.x, y: aligned.y };
    return !tankBlockedByMap(probe);
  }

  function getStepDir(fromCell, toCell) {
    if (toCell.cx > fromCell.cx) return 'right';
    if (toCell.cx < fromCell.cx) return 'left';
    if (toCell.cy > fromCell.cy) return 'down';
    if (toCell.cy < fromCell.cy) return 'up';
    return '';
  }

  function getOrderedNeighborCells(cell, targetCell) {
    const neighbors = [
      { cx: cell.cx, cy: cell.cy - 1 },
      { cx: cell.cx, cy: cell.cy + 1 },
      { cx: cell.cx - 1, cy: cell.cy },
      { cx: cell.cx + 1, cy: cell.cy },
    ];

    return neighbors.sort((a, b) => {
      const distA = Math.abs(targetCell.cx - a.cx) + Math.abs(targetCell.cy - a.cy);
      const distB = Math.abs(targetCell.cx - b.cx) + Math.abs(targetCell.cy - b.cy);
      return distA - distB;
    });
  }

  function getNextCell(cell, dir) {
    if (dir === 'up') return { cx: cell.cx, cy: cell.cy - 1 };
    if (dir === 'down') return { cx: cell.cx, cy: cell.cy + 1 };
    if (dir === 'left') return { cx: cell.cx - 1, cy: cell.cy };
    return { cx: cell.cx + 1, cy: cell.cy };
  }

  function findPathToCell(tank, targetCell) {
    const startCell = tankToCell(tank);
    const startKey = cellKey(startCell.cx, startCell.cy);
    const targetKey = cellKey(targetCell.cx, targetCell.cy);

    if (startKey === targetKey) return [];

    const queue = [startCell];
    const parents = new Map([[startKey, null]]);

    while (queue.length > 0) {
      const cell = queue.shift();

      for (const next of getOrderedNeighborCells(cell, targetCell)) {
        const nextKey = cellKey(next.cx, next.cy);
        if (parents.has(nextKey) || !isCellWalkable(next.cx, next.cy, tank)) continue;

        parents.set(nextKey, cell);
        if (nextKey === targetKey) {
          const path = [next];
          let current = cell;

          while (current) {
            path.push(current);
            current = parents.get(cellKey(current.cx, current.cy));
          }

          path.reverse();
          path.shift();
          return path;
        }

        queue.push(next);
      }
    }

    return [];
  }

  function canTankAdvance(tank, dir, distance = 12) {
    const { vx, vy } = getDirectionVector(dir);
    const probe = { ...tank, x: tank.x + vx * distance, y: tank.y + vy * distance };
    clampTank(probe);
    return !tankBlocked(probe, tank);
  }

  function getAdvanceableDir(tank, dirs) {
    for (const dir of dirs) {
      if (canTankAdvance(tank, dir)) return dir;
    }
    return dirs[0] || chooseRandomDir();
  }

  function getStableMoveDir(tank, intendedDir, alignThreshold = 1.5) {
    if (!intendedDir) return '';

    const currentCell = tankToCell(tank);
    const aligned = getCellAlignedPosition(currentCell.cx, currentCell.cy, tank);

    if (intendedDir === 'up' || intendedDir === 'down') {
      if (Math.abs(tank.x - aligned.x) > alignThreshold) {
        return tank.x < aligned.x ? 'right' : 'left';
      }
    } else if (Math.abs(tank.y - aligned.y) > alignThreshold) {
      return tank.y < aligned.y ? 'down' : 'up';
    }

    return intendedDir;
  }

  function isTankAtTarget(tank, target, threshold = 1.5) {
    if (!target) return true;
    return Math.abs(tank.x - target.x) <= threshold && Math.abs(tank.y - target.y) <= threshold;
  }

  function planEnemyStep(enemy, desiredDir) {
    if (!desiredDir) return null;

    const currentCell = tankToCell(enemy);
    const stableDir = getStableMoveDir(enemy, desiredDir);

    if (stableDir !== desiredDir) {
      return {
        dir: stableDir,
        target: getCellAlignedPosition(currentCell.cx, currentCell.cy, enemy),
      };
    }

    const nextCell = getNextCell(currentCell, desiredDir);
    if (!isCellWalkable(nextCell.cx, nextCell.cy, enemy)) return null;

    return {
      dir: desiredDir,
      target: getCellAlignedPosition(nextCell.cx, nextCell.cy, enemy),
    };
  }

  function moveTankTowardTarget(tank, target, speed, dt, ignoreTank = null) {
    if (!target) return false;

    const maxStep = speed * dt;
    const dx = target.x - tank.x;
    const dy = target.y - tank.y;

    if (Math.abs(dx) > 0.01) {
      const stepX = Math.abs(dx) <= maxStep ? dx : Math.sign(dx) * maxStep;
      moveTankWithCollision(tank, stepX, 0, ignoreTank);
    }

    if (Math.abs(dy) > 0.01) {
      const stepY = Math.abs(dy) <= maxStep ? dy : Math.sign(dy) * maxStep;
      moveTankWithCollision(tank, 0, stepY, ignoreTank);
    }

    if (isTankAtTarget(tank, target)) {
      tank.x = target.x;
      tank.y = target.y;
      return true;
    }

    return false;
  }

  function canEnemySeePlayer(enemy) {
    return !(logic.isTankInGrass(state.game.player) && !logic.isSameGrassPatch(enemy, state.game.player));
  }

  function isBlockBetweenPoints(x1, y1, x2, y2) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    return state.game.mapBlocks.some((block) => {
      const overlapsX = maxX > block.x && minX < block.x + block.width;
      const overlapsY = maxY > block.y && minY < block.y + block.height;
      return overlapsX && overlapsY;
    });
  }

  function getEnemyAttackLane(enemy, alignThreshold = 26) {
    const enemyCenter = tankCenterPoint(enemy);
    const playerCenter = tankCenterPoint(state.game.player);
    const dx = playerCenter.x - enemyCenter.x;
    const dy = playerCenter.y - enemyCenter.y;

    if (Math.abs(dx) <= alignThreshold) {
      const blocked = isBlockBetweenPoints(
        enemyCenter.x - 2,
        enemyCenter.y,
        playerCenter.x + 2,
        playerCenter.y,
      );
      if (!blocked) return { dir: dy > 0 ? 'down' : 'up', clear: true };
    }

    if (Math.abs(dy) <= alignThreshold) {
      const blocked = isBlockBetweenPoints(
        enemyCenter.x,
        enemyCenter.y - 2,
        playerCenter.x,
        playerCenter.y + 2,
      );
      if (!blocked) return { dir: dx > 0 ? 'right' : 'left', clear: true };
    }

    return { dir: '', clear: false };
  }

  function getEnemyPreferredDirs(enemy) {
    const allDirs = ['up', 'down', 'left', 'right'];
    let preferredDirs = shuffleDirections(allDirs);

    if (canEnemySeePlayer(enemy)) {
      const dx = state.game.player.x - enemy.x;
      const dy = state.game.player.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      const chaseRange = enemy.isBoss ? 420 : 280;

      if (distance < chaseRange) {
        const primaryDir = Math.abs(dx) > Math.abs(dy)
          ? dx > 0 ? 'right' : 'left'
          : dy > 0 ? 'down' : 'up';
        const secondaryDir = primaryDir === 'left' || primaryDir === 'right'
          ? dy > 0 ? 'down' : 'up'
          : dx > 0 ? 'right' : 'left';
        const remainingDirs = shuffleDirections(
          allDirs.filter((dir) => dir !== primaryDir && dir !== secondaryDir),
        );

        preferredDirs = [primaryDir, secondaryDir, ...remainingDirs];
      }
    }

    return preferredDirs;
  }

  function getEnemyPathDir(enemy) {
    const currentCell = tankToCell(enemy);

    while (
      enemy.aiPath.length > 0
      && enemy.aiPath[0].cx === currentCell.cx
      && enemy.aiPath[0].cy === currentCell.cy
    ) {
      enemy.aiPath.shift();
    }

    const nextCell = enemy.aiPath[0];
    if (!nextCell) return '';

    const stepDir = getStepDir(currentCell, nextCell);
    return getStableMoveDir(enemy, stepDir);
  }

  function refreshEnemyPath(enemy, force = false) {
    const targetCell = tankToCell(state.game.player);
    const targetKey = cellKey(targetCell.cx, targetCell.cy);

    if (!force && enemy.aiPathTimer > 0 && enemy.aiTargetCellKey === targetKey && enemy.aiPath.length > 0) {
      return;
    }

    enemy.aiPath = findPathToCell(enemy, targetCell);
    enemy.aiPathTimer = enemy.isBoss ? 0.12 : 0.18;
    enemy.aiTargetCellKey = targetKey;
  }

  function resolveEnemyOverlap(enemy) {
    if (!tankBlockedByEnemies(enemy, enemy)) return;

    const currentCell = tankToCell(enemy);
    const candidateCells = [currentCell, ...getOrderedNeighborCells(currentCell, tankToCell(state.game.player))];

    for (const cell of candidateCells) {
      if (!isCellWalkable(cell.cx, cell.cy, enemy)) continue;

      const aligned = getCellAlignedPosition(cell.cx, cell.cy, enemy);
      const probe = { ...enemy, x: aligned.x, y: aligned.y };

      if (!tankBlockedByEnemies(probe, enemy)) {
        enemy.x = aligned.x;
        enemy.y = aligned.y;
        return;
      }
    }
  }

  function chooseEnemyDir(enemy) {
    const preferredDirs = getEnemyPreferredDirs(enemy);
    for (const dir of preferredDirs) {
      if (planEnemyStep(enemy, dir)) return dir;
    }

    return enemy.aiStepDir || enemy.dir || preferredDirs[0] || chooseRandomDir();
  }

  function updateEnemyAI(enemy, dt) {
    resolveEnemyOverlap(enemy);

    enemy.speed = enemy.isBoss ? state.game.level.boss.speed : state.game.level.enemySpeed;
    enemy.shotCooldown = Math.max(0, enemy.shotCooldown - dt);
    enemy.aiTurnTimer -= dt;
    enemy.aiShootTimer -= dt;
    enemy.aiPathTimer -= dt;
    const hasLockedStep = enemy.aiStepTarget && !isTankAtTarget(enemy, enemy.aiStepTarget);
    let desiredDir = '';

    if (!hasLockedStep) {
      if (canEnemySeePlayer(enemy)) {
        const distance = Math.hypot(state.game.player.x - enemy.x, state.game.player.y - enemy.y);
        const attackLane = getEnemyAttackLane(enemy, 26);

        if (attackLane.clear) {
          desiredDir = attackLane.dir;
          enemy.aiTurnTimer = enemy.isBoss ? 0.06 : 0.1;
          enemy.aiShootTimer = Math.min(enemy.aiShootTimer, enemy.isBoss ? 0.08 : 0.12);
          enemy.aiPath = [];
          enemy.aiPathTimer = 0;
        } else {
          refreshEnemyPath(enemy, enemy.stuckTimer > 0.08);
          const pathDir = getEnemyPathDir(enemy);

          if (pathDir) {
            desiredDir = pathDir;
            enemy.aiTurnTimer = enemy.isBoss ? 0.08 : 0.12;
            enemy.aiShootTimer = Math.min(enemy.aiShootTimer, distance < 220 ? 0.18 : 0.28);
          } else {
            desiredDir = chooseEnemyDir(enemy);
          }
        }
      } else {
        enemy.aiPath = [];
        enemy.aiTargetCellKey = '';
        desiredDir = chooseEnemyDir(enemy);
      }
    }

    if (!hasLockedStep && (!desiredDir || enemy.aiTurnTimer <= 0)) {
      desiredDir = chooseEnemyDir(enemy);
      enemy.aiTurnTimer = enemy.isBoss ? 0.22 + Math.random() * 0.2 : 0.28 + Math.random() * 0.28;
    }

    const moveSpeed = getTankMoveSpeed(enemy);
    const oldX = enemy.x;
    const oldY = enemy.y;

    if (
      !enemy.aiStepTarget
      || isTankAtTarget(enemy, enemy.aiStepTarget)
      || enemy.stuckTimer > 0.08
    ) {
      const stepPlan = planEnemyStep(enemy, desiredDir || enemy.aiStepDir || chooseEnemyDir(enemy))
        || planEnemyStep(enemy, chooseEnemyDir(enemy));
      if (stepPlan) {
        enemy.aiStepDir = stepPlan.dir;
        enemy.aiStepTarget = stepPlan.target;
      } else {
        enemy.aiStepDir = '';
        enemy.aiStepTarget = null;
      }
    }

    if (enemy.aiStepDir) enemy.dir = enemy.aiStepDir;
    moveTankTowardTarget(enemy, enemy.aiStepTarget, moveSpeed, dt, enemy);

    if (enemy.x === oldX && enemy.y === oldY) {
      enemy.stuckTimer += dt;
      enemy.aiPath = [];
      enemy.aiTargetCellKey = '';
      enemy.aiStepTarget = null;
      enemy.aiStepDir = '';
      enemy.dir = chooseEnemyDir(enemy);
      enemy.aiTurnTimer = 0.08;
      enemy.aiPathTimer = 0;
    } else {
      enemy.stuckTimer = 0;
      if (isTankAtTarget(enemy, enemy.aiStepTarget)) enemy.aiStepTarget = null;
    }

    if (enemy.aiShootTimer <= 0) {
      logic.fireBullet(enemy);
      if (canEnemySeePlayer(enemy)) {
        enemy.aiShootTimer = enemy.isBoss ? 0.2 + Math.random() * 0.18 : 0.32 + Math.random() * 0.28;
      } else {
        enemy.aiShootTimer = enemy.isBoss ? 0.35 + Math.random() * 0.25 : 0.55 + Math.random() * 0.55;
      }
    }
  }

  function bulletVelocity(b) {
    if (b.dir === 'up') return { vx: 0, vy: -b.speed };
    if (b.dir === 'down') return { vx: 0, vy: b.speed };
    if (b.dir === 'left') return { vx: -b.speed, vy: 0 };
    return { vx: b.speed, vy: 0 };
  }

  function rectHitPoint(rect, px, py) {
    return px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height;
  }

  function addExplosion(x, y, color = '#ffd166') {
    state.game.explosions.push({ x, y, radius: 8, life: 0.35, color });
  }

  function dropPickup(x, y) {
    if (Math.random() > 0.28) return;
    const types = ['heal', 'shield', 'rapid'];
    const type = types[Math.floor(Math.random() * types.length)];
    state.game.pickups.push({ x: x - 10, y: y - 10, width: 20, height: 20, type, life: 10 });
  }

  function handleBulletHitBlock(blockIndex) {
    const block = state.game.mapBlocks[blockIndex];
    if (!block) return;
    if (block.type === 'brick') {
      block.hp -= 1;
      if (block.hp <= 0) {
        addExplosion(block.x + block.width / 2, block.y + block.height / 2, '#d8944f');
        state.game.mapBlocks.splice(blockIndex, 1);
      }
    }
  }

  function damageEnemy(enemyIndex, amount = 1) {
    const enemy = state.game.enemies[enemyIndex];
    if (!enemy) return;

    enemy.hp -= amount;
    addExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.isBoss ? '#ffae6d' : '#ff7b7b');

    if (enemy.hp > 0) return;

    const removed = state.game.enemies.splice(enemyIndex, 1)[0];
    if (removed.isBoss) {
      state.game.score += state.game.level.boss.score;
      logic.setStatus('Boss 已击败！', '#9cf3ab');
    } else {
      state.game.score += 100;
      dropPickup(removed.x + removed.width / 2, removed.y + removed.height / 2);
    }
  }

  function updateBullets(dt) {
    const remained = [];

    for (const bullet of state.game.bullets) {
      const { vx, vy } = bulletVelocity(bullet);
      bullet.x += vx * dt;
      bullet.y += vy * dt;

      if (bullet.x < -10 || bullet.x > canvas.width + 10 || bullet.y < -10 || bullet.y > canvas.height + 10) continue;

      let consumed = false;

      for (let i = state.game.mapBlocks.length - 1; i >= 0; i -= 1) {
        const block = state.game.mapBlocks[i];
        if (rectHitPoint(block, bullet.x, bullet.y)) {
          handleBulletHitBlock(i);
          consumed = true;
          break;
        }
      }

      if (consumed) continue;

      if (bullet.ownerPlayer) {
        for (let i = state.game.enemies.length - 1; i >= 0; i -= 1) {
          const enemy = state.game.enemies[i];
          if (rectHitPoint(enemy, bullet.x, bullet.y)) {
            damageEnemy(i, 1);
            consumed = true;
            break;
          }
        }
      } else if (rectHitPoint(state.game.player, bullet.x, bullet.y)) {
        consumed = true;

        if (state.game.shieldTimer > 0) {
          state.game.shieldTimer = Math.max(0, state.game.shieldTimer - 1.5);
          addExplosion(state.game.player.x + state.game.player.width / 2, state.game.player.y + state.game.player.height / 2, '#90d5ff');
        } else {
          state.game.lives -= 1;
          addExplosion(state.game.player.x + state.game.player.width / 2, state.game.player.y + state.game.player.height / 2, '#9ad1ff');
        }

        state.game.player.x = canvas.width / 2 - state.game.player.width / 2;
        state.game.player.y = canvas.height - 60;
        state.game.player.dir = 'up';
      }

      if (!consumed) remained.push(bullet);
    }

    state.game.bullets = remained;
  }

  function applyPickup(type) {
    if (type === 'heal') {
      state.game.lives = Math.min(MAX_LIVES, state.game.lives + 1);
      logic.setStatus('拾取补给：生命 +1');
      return;
    }

    if (type === 'shield') {
      state.game.shieldTimer = 8;
      logic.setStatus('拾取补给：护盾已激活（8秒）');
      return;
    }

    state.game.rapidFireTimer = 7;
    logic.setStatus('拾取补给：连发模式（7秒）');
  }

  function updatePickups(dt) {
    const remained = [];

    for (const pickup of state.game.pickups) {
      pickup.life -= dt;
      if (pickup.life <= 0) continue;

      if (intersects(state.game.player, pickup)) {
        applyPickup(pickup.type);
        continue;
      }

      remained.push(pickup);
    }

    state.game.pickups = remained;
  }

  function updateExplosions(dt) {
    state.game.explosions = state.game.explosions
      .map((explosion) => ({ ...explosion, life: explosion.life - dt, radius: explosion.radius + dt * 80 }))
      .filter((explosion) => explosion.life > 0);
  }

  function spawnEnemyIfNeeded(dt) {
    if (state.game.level.boss) return;
    if (state.game.spawnRemain <= 0 || state.game.enemies.length >= state.game.level.maxAlive) return;

    state.game.spawnTimer -= dt;
    if (state.game.spawnTimer > 0) return;

    const x = levels.randomEnemySpawnX();
    const enemy = levels.createTank(x, 30, '#ff6b6b', false, { speed: state.game.level.enemySpeed });
    snapTankToCell(enemy);
    if (!tankBlocked(enemy, enemy)) {
      state.game.enemies.push(enemy);
      state.game.spawnRemain -= 1;
    } else {
      state.game.spawnTimer = 0.16;
      return;
    }

    state.game.spawnTimer = 0.75 + Math.random() * 0.7;
  }

  function advanceWaveOrLevelIfNeeded() {
    if (state.game.spawnRemain > 0 || state.game.enemies.length > 0) return;

    if (state.game.waveIndex < state.game.level.waves.length - 1) {
      state.game.waveIndex += 1;
      state.game.spawnRemain = state.game.level.waves[state.game.waveIndex];
      logic.setStatus(`第 ${state.game.levelIndex + 1} 关 第 ${state.game.waveIndex + 1} 波`, '#ffe08a');
      return;
    }

    if (state.game.levelIndex < levels.LEVELS.length - 1) {
      logic.loadLevel(state.game.levelIndex + 1);
      return;
    }

    logic.endGame(true);
  }

  function updateBuffTimers(dt) {
    state.game.shieldTimer = Math.max(0, state.game.shieldTimer - dt);
    state.game.rapidFireTimer = Math.max(0, state.game.rapidFireTimer - dt);
  }

  logic.update = function update(dt) {
    if (!state.game || state.game.state !== STATE.running) return;

    updateBuffTimers(dt);
    updatePlayer(dt);
    spawnEnemyIfNeeded(dt);

    for (const enemy of state.game.enemies) updateEnemyAI(enemy, dt);

    updateBullets(dt);
    updatePickups(dt);
    updateExplosions(dt);
    advanceWaveOrLevelIfNeeded();

    if (state.game.lives <= 0) {
      logic.endGame(false);
    } else if (state.game.state === STATE.running) {
      const buffs = [];
      if (state.game.shieldTimer > 0) buffs.push(`护盾 ${state.game.shieldTimer.toFixed(1)}s`);
      if (state.game.rapidFireTimer > 0) buffs.push(`连发 ${state.game.rapidFireTimer.toFixed(1)}s`);
      logic.setStatus(`第 ${state.game.levelIndex + 1} 关 ${state.game.level.name}${buffs.length ? ` | ${buffs.join(' | ')}` : ''}`);
    }

    logic.syncPanel();
  };

  logic.loop = function loop(timestamp) {
    const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000 || 0);
    state.lastTime = timestamp;

    logic.update(dt);
    app.render.draw();

    requestAnimationFrame(logic.loop);
  };
})();

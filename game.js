const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const stageEl = document.getElementById('stage');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const enemiesEl = document.getElementById('enemies');
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userNameEl = document.getElementById('userName');
const leaderboardListEl = document.getElementById('leaderboardList');
const mobileControls = document.querySelector('.mobile-controls');

const keys = new Set();
const keyMap = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

const API_BASE = '/.netlify/functions';
let authToken = localStorage.getItem('tank_token') || '';
let authUser = null;

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(`${API_BASE}/${path}`, { ...options, headers, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || '请求失败');
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

function updateAuthUI() {
  userNameEl.textContent = authUser?.nickname || '未登录';
}

async function refreshLeaderboard() {
  try {
    const data = await apiFetch('leaderboard');
    const list = data.items || [];
    leaderboardListEl.innerHTML = list.length
      ? list.map((item) => `<li>${item.nickname}：${item.best_score} 分</li>`).join('')
      : '<li>暂无数据</li>';
  } catch {
    leaderboardListEl.innerHTML = '<li>排行榜加载失败</li>';
  }
}

async function loadProfile() {
  if (!authToken) return;

  try {
    const me = await apiFetch('auth-me');
    authUser = me.user;
    updateAuthUI();

    const profileData = await apiFetch('profile-get');
    const p = profileData.profile;
    if (p && game) {
      game.score = Number(p.score || 0);
      game.lives = Number(p.lives || 3);
      game.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, Number(p.level || 1) - 1));
      loadLevel(game.levelIndex, true);
      syncPanel();
      setStatus('已读取云存档');
    }
  } catch (err) {
    const msg = String(err?.message || '');
    if (msg.includes('未登录') || msg.includes('过期') || msg.includes('权限')) {
      authToken = '';
      authUser = null;
      localStorage.removeItem('tank_token');
      updateAuthUI();
    }
  }
}

async function saveProfile() {
  if (!authToken || !game) return;

  try {
    await apiFetch('profile-save', {
      method: 'POST',
      body: JSON.stringify({
        level: game.levelIndex + 1,
        score: game.score,
        lives: game.lives,
      }),
    });
  } catch {
    // ignore
  }
}

async function submitScore() {
  if (!authToken || !game) return;

  try {
    await apiFetch('score-submit', {
      method: 'POST',
      body: JSON.stringify({
        score: game.score,
        stage: stageText(),
        duration_sec: 0,
      }),
    });
    await refreshLeaderboard();
  } catch {
    // ignore
  }
}

const STATE = {
  ready: 'ready',
  running: 'running',
  over: 'over',
};

const MAX_LIVES = 5;

const LEVELS = [
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

let game = null;
let lastTime = 0;

function createTank(x, y, color, isPlayer = false, overrides = {}) {
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
  };
}

function createLevelMap1() {
  const blocks = [];
  addLineBlocks(blocks, 120, 200, 640, 40, (x) => (x % 80 === 0 ? 'steel' : 'brick'));
  addLineBlocks(blocks, 80, 320, 680, 40, (x) => (x % 120 === 0 ? 'steel' : 'brick'), [360, 400]);
  for (let y = 80; y <= 360; y += 40) {
    blocks.push(createBlock(40, y, 'steel'));
    blocks.push(createBlock(720, y, 'steel'));
  }
  return blocks;
}

function createLevelMap2() {
  const blocks = [];
  for (let y = 120; y <= 360; y += 40) {
    blocks.push(createBlock(200, y, y === 240 ? 'steel' : 'brick'));
    blocks.push(createBlock(560, y, y === 240 ? 'steel' : 'brick'));
  }
  addLineBlocks(blocks, 280, 120, 480, 40, () => 'steel');
  addLineBlocks(blocks, 280, 360, 480, 40, (x) => (x === 360 || x === 400 ? 'steel' : 'brick'));
  addLineBlocks(blocks, 80, 260, 680, 40, (x) => (x % 160 === 0 ? 'steel' : 'brick'), [360, 400]);
  return blocks;
}

function createBossMap() {
  const blocks = [];
  addLineBlocks(blocks, 80, 180, 680, 40, (x) => (x % 120 === 0 ? 'steel' : 'brick'));
  addLineBlocks(blocks, 80, 300, 680, 40, (x) => (x % 120 === 40 ? 'steel' : 'brick'));
  for (let y = 80; y <= 360; y += 40) {
    if (y === 240) continue;
    blocks.push(createBlock(360, y, y % 80 === 0 ? 'steel' : 'brick'));
    blocks.push(createBlock(400, y, y % 80 === 0 ? 'steel' : 'brick'));
  }
  return blocks;
}

function createBlock(x, y, type) {
  return { x, y, width: 40, height: 40, type, hp: type === 'brick' ? 2 : 999 };
}

function addLineBlocks(blocks, fromX, y, toX, step, typeGetter, skipXs = []) {
  for (let x = fromX; x <= toX; x += step) {
    if (skipXs.includes(x)) continue;
    blocks.push(createBlock(x, y, typeGetter(x)));
  }
}

function randomEnemySpawnX() {
  const candidates = [80, 240, 400, 560, 680];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function stageText() {
  if (!game) return '1-1';
  return `${game.levelIndex + 1}-${Math.min(game.waveIndex + 1, game.level.waves.length)}`;
}

function resetGame() {
  game = {
    state: STATE.ready,
    score: 0,
    lives: 3,
    player: createTank(canvas.width / 2 - 16, canvas.height - 60, '#4ad66d', true),
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
    level: LEVELS[0],
    mapBlocks: [],
  };

  loadLevel(0, true);
  syncPanel();
  setStatus('按下“开始游戏”');
  draw();
}

function loadLevel(levelIndex, initial = false) {
  game.levelIndex = levelIndex;
  game.level = LEVELS[levelIndex];
  game.waveIndex = 0;
  game.spawnRemain = game.level.waves[0];
  game.spawnTimer = 0;
  game.enemies = [];
  game.bullets = [];
  game.pickups = [];
  game.mapBlocks = game.level.map();

  game.player.x = canvas.width / 2 - game.player.width / 2;
  game.player.y = canvas.height - 60;
  game.player.dir = 'up';

  if (game.level.boss) {
    spawnBoss();
    game.spawnRemain = 0;
  }

  if (!initial) {
    setStatus(`进入第 ${levelIndex + 1} 关：${game.level.name}`, '#ffe08a');
  }
}

function spawnBoss() {
  const cfg = game.level.boss;
  const boss = createTank(
    canvas.width / 2 - 24,
    30,
    cfg.color,
    false,
    { width: 48, height: 48, speed: cfg.speed, isBoss: true, hp: cfg.hp },
  );
  game.enemies.push(boss);
}

function syncPanel() {
  stageEl.textContent = stageText();
  scoreEl.textContent = String(game.score);
  livesEl.textContent = String(game.lives);
  enemiesEl.textContent = String(game.enemies.length + game.spawnRemain);
}

function setStatus(text, color = '#7ce38b') {
  statusEl.textContent = text;
  statusEl.style.color = color;
}

function startGame() {
  if (!game) resetGame();
  game.state = STATE.running;
  setStatus(`第 ${game.levelIndex + 1} 关 ${game.level.name} 开始`);
}

function endGame(win) {
  game.state = STATE.over;
  setStatus(win ? '最终胜利！点击“开始游戏”再战' : '失败！点击“开始游戏”重来', win ? '#7ce38b' : '#ff8d8d');
  saveProfile();
  submitScore();
}

function fireBullet(fromTank) {
  if (fromTank.shotCooldown > 0) return;

  const speed = fromTank.isPlayer ? 340 : fromTank.isBoss ? 280 : 240;
  game.bullets.push({
    x: fromTank.x + fromTank.width / 2,
    y: fromTank.y + fromTank.height / 2,
    radius: fromTank.isBoss ? 5 : 4,
    speed,
    ownerPlayer: fromTank.isPlayer,
    dir: fromTank.dir,
  });

  if (fromTank.isPlayer) {
    fromTank.shotCooldown = game.rapidFireTimer > 0 ? 0.1 : 0.24;
  } else if (fromTank.isBoss) {
    fromTank.shotCooldown = 0.45;
  } else {
    fromTank.shotCooldown = 0.9;
  }
}

function clampTank(tank) {
  tank.x = Math.max(0, Math.min(canvas.width - tank.width, tank.x));
  tank.y = Math.max(0, Math.min(canvas.height - tank.height, tank.y));
}

function intersects(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function tankBlocked(tank) {
  return game.mapBlocks.some((block) => intersects(tank, block));
}

function moveTankWithCollision(tank, dx, dy) {
  const oldX = tank.x;
  const oldY = tank.y;

  tank.x += dx;
  clampTank(tank);
  if (tankBlocked(tank)) tank.x = oldX;

  tank.y += dy;
  clampTank(tank);
  if (tankBlocked(tank)) tank.y = oldY;
}

function updatePlayer(dt) {
  const p = game.player;
  let vx = 0;
  let vy = 0;

  if (keys.has('up')) {
    vy -= 1;
    p.dir = 'up';
  }
  if (keys.has('down')) {
    vy += 1;
    p.dir = 'down';
  }
  if (keys.has('left')) {
    vx -= 1;
    p.dir = 'left';
  }
  if (keys.has('right')) {
    vx += 1;
    p.dir = 'right';
  }

  const len = Math.hypot(vx, vy) || 1;
  moveTankWithCollision(p, (vx / len) * p.speed * dt, (vy / len) * p.speed * dt);

  p.shotCooldown = Math.max(0, p.shotCooldown - dt);
}

function chooseRandomDir() {
  const dirs = ['up', 'down', 'left', 'right'];
  return dirs[Math.floor(Math.random() * dirs.length)];
}

function updateEnemyAI(enemy, dt) {
  enemy.speed = enemy.isBoss ? game.level.boss.speed : game.level.enemySpeed;
  enemy.shotCooldown = Math.max(0, enemy.shotCooldown - dt);
  enemy.aiTurnTimer -= dt;
  enemy.aiShootTimer -= dt;

  if (enemy.aiTurnTimer <= 0) {
    enemy.dir = chooseRandomDir();
    enemy.aiTurnTimer = enemy.isBoss ? 0.5 + Math.random() * 0.8 : 0.7 + Math.random() * 1.4;
  }

  const dx = game.player.x - enemy.x;
  const dy = game.player.y - enemy.y;
  const distance = Math.hypot(dx, dy);

  if (distance < (enemy.isBoss ? 420 : 280)) {
    if (Math.abs(dx) > Math.abs(dy)) enemy.dir = dx > 0 ? 'right' : 'left';
    else enemy.dir = dy > 0 ? 'down' : 'up';
  }

  let vx = 0;
  let vy = 0;
  if (enemy.dir === 'up') vy = -1;
  if (enemy.dir === 'down') vy = 1;
  if (enemy.dir === 'left') vx = -1;
  if (enemy.dir === 'right') vx = 1;

  const oldX = enemy.x;
  const oldY = enemy.y;
  moveTankWithCollision(enemy, vx * enemy.speed * dt, vy * enemy.speed * dt);
  if (enemy.x === oldX && enemy.y === oldY) enemy.dir = chooseRandomDir();

  if (enemy.aiShootTimer <= 0) {
    fireBullet(enemy);
    enemy.aiShootTimer = enemy.isBoss ? 0.4 + Math.random() * 0.35 : 0.75 + Math.random() * 1.3;
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
  game.explosions.push({ x, y, radius: 8, life: 0.35, color });
}

function dropPickup(x, y) {
  if (Math.random() > 0.28) return;
  const types = ['heal', 'shield', 'rapid'];
  const type = types[Math.floor(Math.random() * types.length)];
  game.pickups.push({ x: x - 10, y: y - 10, width: 20, height: 20, type, life: 10 });
}

function handleBulletHitBlock(blockIndex) {
  const block = game.mapBlocks[blockIndex];
  if (!block) return;
  if (block.type === 'brick') {
    block.hp -= 1;
    if (block.hp <= 0) {
      addExplosion(block.x + block.width / 2, block.y + block.height / 2, '#d8944f');
      game.mapBlocks.splice(blockIndex, 1);
    }
  }
}

function damageEnemy(enemyIndex, amount = 1) {
  const enemy = game.enemies[enemyIndex];
  if (!enemy) return;

  enemy.hp -= amount;
  addExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.isBoss ? '#ffae6d' : '#ff7b7b');

  if (enemy.hp > 0) return;

  const removed = game.enemies.splice(enemyIndex, 1)[0];
  if (removed.isBoss) {
    game.score += game.level.boss.score;
    setStatus('Boss已击败！', '#9cf3ab');
  } else {
    game.score += 100;
    dropPickup(removed.x + removed.width / 2, removed.y + removed.height / 2);
  }
}

function updateBullets(dt) {
  const remained = [];

  for (const b of game.bullets) {
    const { vx, vy } = bulletVelocity(b);
    b.x += vx * dt;
    b.y += vy * dt;

    if (b.x < -10 || b.x > canvas.width + 10 || b.y < -10 || b.y > canvas.height + 10) continue;

    let consumed = false;

    for (let i = game.mapBlocks.length - 1; i >= 0; i -= 1) {
      const block = game.mapBlocks[i];
      if (rectHitPoint(block, b.x, b.y)) {
        handleBulletHitBlock(i);
        consumed = true;
        break;
      }
    }

    if (consumed) continue;

    if (b.ownerPlayer) {
      for (let i = game.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = game.enemies[i];
        if (rectHitPoint(enemy, b.x, b.y)) {
          damageEnemy(i, 1);
          consumed = true;
          break;
        }
      }
    } else if (rectHitPoint(game.player, b.x, b.y)) {
      consumed = true;

      if (game.shieldTimer > 0) {
        game.shieldTimer = Math.max(0, game.shieldTimer - 1.5);
        addExplosion(game.player.x + game.player.width / 2, game.player.y + game.player.height / 2, '#90d5ff');
      } else {
        game.lives -= 1;
        addExplosion(game.player.x + game.player.width / 2, game.player.y + game.player.height / 2, '#9ad1ff');
      }

      game.player.x = canvas.width / 2 - game.player.width / 2;
      game.player.y = canvas.height - 60;
      game.player.dir = 'up';
    }

    if (!consumed) remained.push(b);
  }

  game.bullets = remained;
}

function applyPickup(type) {
  if (type === 'heal') {
    game.lives = Math.min(MAX_LIVES, game.lives + 1);
    setStatus('拾取补给：生命 +1');
    return;
  }

  if (type === 'shield') {
    game.shieldTimer = 8;
    setStatus('拾取补给：护盾已激活（8秒）');
    return;
  }

  game.rapidFireTimer = 7;
  setStatus('拾取补给：连发模式（7秒）');
}

function updatePickups(dt) {
  const remained = [];

  for (const p of game.pickups) {
    p.life -= dt;
    if (p.life <= 0) continue;

    if (intersects(game.player, p)) {
      applyPickup(p.type);
      continue;
    }

    remained.push(p);
  }

  game.pickups = remained;
}

function updateExplosions(dt) {
  game.explosions = game.explosions
    .map((e) => ({ ...e, life: e.life - dt, radius: e.radius + dt * 80 }))
    .filter((e) => e.life > 0);
}

function spawnEnemyIfNeeded(dt) {
  if (game.level.boss) return;
  if (game.spawnRemain <= 0 || game.enemies.length >= game.level.maxAlive) return;

  game.spawnTimer -= dt;
  if (game.spawnTimer > 0) return;

  const x = randomEnemySpawnX();
  const enemy = createTank(x, 30, '#ff6b6b', false, { speed: game.level.enemySpeed });
  if (!tankBlocked(enemy)) {
    game.enemies.push(enemy);
    game.spawnRemain -= 1;
  }

  game.spawnTimer = 0.75 + Math.random() * 0.7;
}

function advanceWaveOrLevelIfNeeded() {
  if (game.spawnRemain > 0 || game.enemies.length > 0) return;

  if (game.waveIndex < game.level.waves.length - 1) {
    game.waveIndex += 1;
    game.spawnRemain = game.level.waves[game.waveIndex];
    setStatus(`第 ${game.levelIndex + 1} 关 第 ${game.waveIndex + 1} 波`, '#ffe08a');
    return;
  }

  if (game.levelIndex < LEVELS.length - 1) {
    loadLevel(game.levelIndex + 1);
    return;
  }

  endGame(true);
}

function updateBuffTimers(dt) {
  game.shieldTimer = Math.max(0, game.shieldTimer - dt);
  game.rapidFireTimer = Math.max(0, game.rapidFireTimer - dt);
}

function update(dt) {
  if (!game || game.state !== STATE.running) return;

  updateBuffTimers(dt);
  updatePlayer(dt);
  spawnEnemyIfNeeded(dt);

  for (const enemy of game.enemies) updateEnemyAI(enemy, dt);

  updateBullets(dt);
  updatePickups(dt);
  updateExplosions(dt);
  advanceWaveOrLevelIfNeeded();

  if (game.lives <= 0) {
    endGame(false);
  } else if (game.state === STATE.running) {
    const buffs = [];
    if (game.shieldTimer > 0) buffs.push(`护盾 ${game.shieldTimer.toFixed(1)}s`);
    if (game.rapidFireTimer > 0) buffs.push(`连发 ${game.rapidFireTimer.toFixed(1)}s`);
    setStatus(`第 ${game.levelIndex + 1} 关 ${game.level.name}${buffs.length ? ` | ${buffs.join(' | ')}` : ''}`);
  }

  syncPanel();
}

function drawTank(tank) {
  ctx.save();
  ctx.translate(tank.x + tank.width / 2, tank.y + tank.height / 2);

  const rot = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[tank.dir];
  ctx.rotate(rot);

  ctx.fillStyle = tank.color;
  ctx.fillRect(-tank.width / 2 + 2, -tank.height / 2 + 2, tank.width - 4, tank.height - 4);

  ctx.fillStyle = '#0c111a';
  ctx.fillRect(-6, -10, 12, 20);

  ctx.fillStyle = '#d9e2f2';
  ctx.fillRect(-3, -tank.height / 2 - 8, 6, tank.height / 2 + 6);

  if (tank.isBoss) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-18, tank.height / 2 + 6, 36, 4);
    ctx.fillStyle = '#ff6a6a';
    const hpRatio = Math.max(0, tank.hp / game.level.boss.hp);
    ctx.fillRect(-18, tank.height / 2 + 6, 36 * hpRatio, 4);
  }

  ctx.restore();
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = 'rgba(160, 190, 255, 0.08)';
  ctx.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBlocks() {
  for (const block of game.mapBlocks) {
    if (block.type === 'brick') {
      ctx.fillStyle = block.hp === 2 ? '#b56d39' : '#cc8a53';
      ctx.fillRect(block.x + 2, block.y + 2, block.width - 4, block.height - 4);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.strokeRect(block.x + 6, block.y + 6, block.width - 12, block.height - 12);
    } else {
      ctx.fillStyle = '#8a97a8';
      ctx.fillRect(block.x + 2, block.y + 2, block.width - 4, block.height - 4);
      ctx.strokeStyle = '#d8dfeb';
      ctx.strokeRect(block.x + 4, block.y + 4, block.width - 8, block.height - 8);
    }
  }
}

function drawPickups() {
  for (const p of game.pickups) {
    const lifeAlpha = Math.max(0.2, Math.min(1, p.life / 10));
    ctx.save();
    ctx.globalAlpha = lifeAlpha;

    if (p.type === 'heal') {
      ctx.fillStyle = '#81f495';
      ctx.fillRect(p.x, p.y, p.width, p.height);
      ctx.fillStyle = '#16301a';
      ctx.fillRect(p.x + 8, p.y + 3, 4, 14);
      ctx.fillRect(p.x + 3, p.y + 8, 14, 4);
    } else if (p.type === 'shield') {
      ctx.fillStyle = '#7ec8ff';
      ctx.beginPath();
      ctx.arc(p.x + 10, p.y + 10, 9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(p.x, p.y, p.width, p.height);
      ctx.fillStyle = '#3a2b10';
      ctx.fillRect(p.x + 4, p.y + 4, 12, 12);
    }

    ctx.restore();
  }
}

function drawPlayerShield() {
  if (game.shieldTimer <= 0) return;

  const p = game.player;
  ctx.save();
  ctx.strokeStyle = 'rgba(130, 206, 255, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x + p.width / 2, p.y + p.height / 2, 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#1d2a38');
  bg.addColorStop(1, '#121922');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();
  if (!game) return;

  drawBlocks();
  drawPickups();

  drawTank(game.player);
  for (const enemy of game.enemies) drawTank(enemy);
  drawPlayerShield();

  ctx.fillStyle = '#ffd166';
  for (const bullet of game.bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const e of game.explosions) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, e.life / 0.35);
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (game.state === STATE.ready) {
    drawCenterText('点击左侧“开始游戏”', 'rgba(255,255,255,0.92)');
  }

  if (game.state === STATE.over) {
    drawCenterText(game.lives > 0 ? '全部通关！' : '游戏结束', game.lives > 0 ? '#9cf3ab' : '#ff9d9d');
  }
}

function drawCenterText(text, color) {
  ctx.save();
  ctx.fillStyle = 'rgba(3, 8, 14, 0.5)';
  ctx.fillRect(0, canvas.height / 2 - 35, canvas.width, 70);
  ctx.fillStyle = color;
  ctx.font = 'bold 36px "Segoe UI", "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

function loop(timestamp) {
  const dt = Math.min(0.033, (timestamp - lastTime) / 1000 || 0);
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => {
  if (e.code in keyMap) {
    keys.add(keyMap[e.code]);
    e.preventDefault();
    return;
  }

  if (e.code === 'Space') {
    if (game && game.state === STATE.running) fireBullet(game.player);
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code in keyMap) {
    keys.delete(keyMap[e.code]);
    e.preventDefault();
  }
});

startBtn.addEventListener('click', () => {
  resetGame();
  startGame();
});

function setAuthActionLoading(loading, text = '') {
  registerBtn.disabled = loading;
  loginBtn.disabled = loading;
  registerBtn.textContent = loading && text === 'register' ? '注册中...' : '注册';
  loginBtn.textContent = loading && text === 'login' ? '登录中...' : '登录';
}

async function loginWithCredentials(email, password) {
  const data = await apiFetch('auth-login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  authToken = data.token;
  authUser = data.user;
  localStorage.setItem('tank_token', authToken);
  updateAuthUI();
  setStatus(`欢迎回来，${authUser.nickname}`);

  loadProfile();
  refreshLeaderboard();
}

registerBtn.addEventListener('click', async () => {
  const email = window.prompt('请输入邮箱：');
  const nickname = window.prompt('请输入昵称：');
  const password = window.prompt('请输入密码（至少6位）：');
  if (!email || !nickname || !password) return;

  setAuthActionLoading(true, 'register');
  setStatus('正在注册并自动登录...', '#ffe08a');

  try {
    await apiFetch('auth-register', {
      method: 'POST',
      body: JSON.stringify({ email, nickname, password }),
    });
    await loginWithCredentials(email, password);
    setStatus(`注册成功，已自动登录：${nickname}`, '#9cf3ab');
  } catch (err) {
    setStatus(`注册失败：${err.message}`, '#ff9d9d');
  } finally {
    setAuthActionLoading(false);
  }
});

loginBtn.addEventListener('click', async () => {
  const email = window.prompt('邮箱：');
  const password = window.prompt('密码：');
  if (!email || !password) return;

  setAuthActionLoading(true, 'login');
  setStatus('正在登录...', '#ffe08a');

  try {
    await loginWithCredentials(email, password);
  } catch (err) {
    setStatus(`登录失败：${err.message}`, '#ff9d9d');
  } finally {
    setAuthActionLoading(false);
  }
});

logoutBtn.addEventListener('click', () => {
  authToken = '';
  authUser = null;
  localStorage.removeItem('tank_token');
  updateAuthUI();
  setStatus('已退出登录', '#ffe08a');
});

function bindMobileControls() {
  if (!mobileControls) return;

  const directionButtons = mobileControls.querySelectorAll('[data-key]');
  directionButtons.forEach((btn) => {
    const dir = btn.dataset.key;
    if (!dir) return;

    const press = (e) => {
      e.preventDefault();
      keys.add(dir);
    };

    const release = (e) => {
      e.preventDefault();
      keys.delete(dir);
    };

    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  });

  const fireBtn = mobileControls.querySelector('[data-action="fire"]');
  if (fireBtn) {
    fireBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (game && game.state === STATE.running) fireBullet(game.player);
    });
  }
}

bindMobileControls();
resetGame();
updateAuthUI();
setStatus('正在连接服务...', '#ffe08a');
Promise.all([refreshLeaderboard(), loadProfile()])
  .then(() => {
    if (authUser) setStatus(`欢迎回来，${authUser.nickname}`);
    else setStatus('按下“开始游戏”');
  })
  .catch(() => {
    setStatus('服务连接异常，请稍后重试', '#ff9d9d');
  });
requestAnimationFrame(loop);

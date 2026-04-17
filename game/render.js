(() => {
  const app = window.TankGame;
  const { refs, state, render, logic } = app;
  const { canvas, ctx } = refs;

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
      const hpRatio = Math.max(0, tank.hp / state.game.level.boss.hp);
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
    for (const block of state.game.mapBlocks) {
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

  function drawTerrain(overlay = false) {
    for (const tile of state.game.terrainTiles) {
      if (tile.type !== 'grass') continue;

      if (!overlay) {
        ctx.fillStyle = '#2f6f3f';
        ctx.fillRect(tile.x + 1, tile.y + 1, tile.width - 2, tile.height - 2);
        ctx.fillStyle = 'rgba(137, 214, 119, 0.3)';
        ctx.fillRect(tile.x + 6, tile.y + 4, 10, 12);
        ctx.fillRect(tile.x + 18, tile.y + 10, 12, 14);
        ctx.fillRect(tile.x + 28, tile.y + 6, 8, 16);
        continue;
      }

      ctx.fillStyle = 'rgba(74, 143, 73, 0.6)';
      ctx.fillRect(tile.x, tile.y, tile.width, tile.height);
      ctx.fillStyle = 'rgba(174, 233, 137, 0.38)';
      ctx.fillRect(tile.x + 4, tile.y + 4, 8, 28);
      ctx.fillRect(tile.x + 16, tile.y + 8, 8, 24);
      ctx.fillRect(tile.x + 28, tile.y + 5, 7, 26);
    }
  }

  function drawPickups() {
    for (const pickup of state.game.pickups) {
      const lifeAlpha = Math.max(0.2, Math.min(1, pickup.life / 10));
      ctx.save();
      ctx.globalAlpha = lifeAlpha;

      if (pickup.type === 'heal') {
        ctx.fillStyle = '#81f495';
        ctx.fillRect(pickup.x, pickup.y, pickup.width, pickup.height);
        ctx.fillStyle = '#16301a';
        ctx.fillRect(pickup.x + 8, pickup.y + 3, 4, 14);
        ctx.fillRect(pickup.x + 3, pickup.y + 8, 14, 4);
      } else if (pickup.type === 'shield') {
        ctx.fillStyle = '#7ec8ff';
        ctx.beginPath();
        ctx.arc(pickup.x + 10, pickup.y + 10, 9, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(pickup.x, pickup.y, pickup.width, pickup.height);
        ctx.fillStyle = '#3a2b10';
        ctx.fillRect(pickup.x + 4, pickup.y + 4, 12, 12);
      }

      ctx.restore();
    }
  }

  function drawPlayerShield() {
    if (state.game.shieldTimer <= 0) return;

    const player = state.game.player;
    ctx.save();
    ctx.strokeStyle = 'rgba(130, 206, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
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

  render.draw = function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, '#1d2a38');
    bg.addColorStop(1, '#121922');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();
    if (!state.game) return;

    drawTerrain();
    drawBlocks();
    drawPickups();

    drawTank(state.game.player);
    for (const enemy of state.game.enemies) {
      if (logic.isTankInGrass(enemy) && !logic.isSameGrassPatch(enemy, state.game.player)) continue;
      drawTank(enemy);
    }
    drawPlayerShield();
    drawTerrain(true);

    ctx.fillStyle = '#ffd166';
    for (const bullet of state.game.bullets) {
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const explosion of state.game.explosions) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, explosion.life / 0.35);
      ctx.fillStyle = explosion.color;
      ctx.beginPath();
      ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (state.game.state === app.constants.STATE.ready) {
      drawCenterText('点击左侧“开始游戏”', 'rgba(255,255,255,0.92)');
    }

    if (state.game.state === app.constants.STATE.over) {
      drawCenterText(state.game.lives > 0 ? '全部通关！' : '游戏结束', state.game.lives > 0 ? '#9cf3ab' : '#ff9d9d');
    }
  };
})();

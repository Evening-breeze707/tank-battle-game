(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  window.TankGame = {
    refs: {
      canvas,
      ctx,
      stageEl: document.getElementById('stage'),
      scoreEl: document.getElementById('score'),
      livesEl: document.getElementById('lives'),
      enemiesEl: document.getElementById('enemies'),
      statusEl: document.getElementById('status'),
      startBtn: document.getElementById('startBtn'),
      registerBtn: document.getElementById('registerBtn'),
      loginBtn: document.getElementById('loginBtn'),
      logoutBtn: document.getElementById('logoutBtn'),
      userNameEl: document.getElementById('userName'),
      leaderboardListEl: document.getElementById('leaderboardList'),
      mobileControls: document.querySelector('.mobile-controls'),
    },
    input: {
      keys: new Set(),
      directionStack: [],
      keyMap: {
        ArrowUp: 'up',
        KeyW: 'up',
        ArrowDown: 'down',
        KeyS: 'down',
        ArrowLeft: 'left',
        KeyA: 'left',
        ArrowRight: 'right',
        KeyD: 'right',
      },
    },
    auth: {
      token: localStorage.getItem('tank_token') || '',
      user: null,
    },
    constants: {
      API_BASE: '/.netlify/functions',
      STATE: {
        ready: 'ready',
        running: 'running',
        over: 'over',
      },
      MAX_LIVES: 5,
      GRASS_SLOW_FACTOR: 0.58,
      GRID_SIZE: 40,
      GRID_COLS: canvas.width / 40,
      GRID_ROWS: canvas.height / 40,
    },
    state: {
      game: null,
      lastTime: 0,
    },
    api: {},
    levels: {},
    logic: {},
    render: {},
    ui: {},
    bootstrap: null,
  };
})();

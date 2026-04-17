(() => {
  const app = window.TankGame;
  const { refs, auth, constants, state, api } = app;

  api.apiFetch = async function apiFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(`${constants.API_BASE}/${path}`, { ...options, headers, signal: controller.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '请求失败');
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  api.updateAuthUI = function updateAuthUI() {
    refs.userNameEl.textContent = auth.user?.nickname || '未登录';
  };

  api.setAuthActionLoading = function setAuthActionLoading(loading, text = '') {
    refs.registerBtn.disabled = loading;
    refs.loginBtn.disabled = loading;
    refs.registerBtn.textContent = loading && text === 'register' ? '注册中...' : '注册';
    refs.loginBtn.textContent = loading && text === 'login' ? '登录中...' : '登录';
  };

  api.refreshLeaderboard = async function refreshLeaderboard() {
    try {
      const data = await api.apiFetch('leaderboard');
      const list = data.items || [];
      refs.leaderboardListEl.innerHTML = list.length
        ? list.map((item) => `<li>${item.nickname}：${item.best_score} 分</li>`).join('')
        : '<li>暂无数据</li>';
    } catch {
      refs.leaderboardListEl.innerHTML = '<li>排行榜加载失败</li>';
    }
  };

  api.loadProfile = async function loadProfile() {
    if (!auth.token) return;

    try {
      const me = await api.apiFetch('auth-me');
      auth.user = me.user;
      api.updateAuthUI();

      const profileData = await api.apiFetch('profile-get');
      const profile = profileData.profile;
      if (profile && state.game) {
        state.game.score = Number(profile.score || 0);
        state.game.lives = Number(profile.lives || 3);
        state.game.levelIndex = Math.max(0, Math.min(app.levels.LEVELS.length - 1, Number(profile.level || 1) - 1));
        app.logic.loadLevel(state.game.levelIndex, true);
        app.logic.syncPanel();
        app.logic.setStatus('已读取云存档');
      }
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.includes('未登录') || msg.includes('过期') || msg.includes('权限')) {
        auth.token = '';
        auth.user = null;
        localStorage.removeItem('tank_token');
        api.updateAuthUI();
      }
    }
  };

  api.saveProfile = async function saveProfile() {
    if (!auth.token || !state.game) return;

    try {
      await api.apiFetch('profile-save', {
        method: 'POST',
        body: JSON.stringify({
          level: state.game.levelIndex + 1,
          score: state.game.score,
          lives: state.game.lives,
        }),
      });
    } catch {
      // ignore
    }
  };

  api.submitScore = async function submitScore() {
    if (!auth.token || !state.game) return;

    try {
      await api.apiFetch('score-submit', {
        method: 'POST',
        body: JSON.stringify({
          score: state.game.score,
          stage: app.logic.stageText(),
          duration_sec: 0,
        }),
      });
      await api.refreshLeaderboard();
    } catch {
      // ignore
    }
  };

  api.loginWithCredentials = async function loginWithCredentials(email, password) {
    const data = await api.apiFetch('auth-login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    auth.token = data.token;
    auth.user = data.user;
    localStorage.setItem('tank_token', auth.token);
    api.updateAuthUI();
    app.logic.setStatus(`欢迎回来，${auth.user.nickname}`);

    api.loadProfile();
    api.refreshLeaderboard();
  };
})();

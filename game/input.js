(() => {
  const app = window.TankGame;
  const { refs, input, api, auth } = app;

  input.pressDirection = function pressDirection(dir) {
    if (!dir) return;
    input.keys.add(dir);

    const existingIndex = input.directionStack.indexOf(dir);
    if (existingIndex >= 0) input.directionStack.splice(existingIndex, 1);
    input.directionStack.push(dir);
  };

  input.releaseDirection = function releaseDirection(dir) {
    if (!dir) return;
    input.keys.delete(dir);

    const existingIndex = input.directionStack.indexOf(dir);
    if (existingIndex >= 0) input.directionStack.splice(existingIndex, 1);
  };

  input.getActiveDirection = function getActiveDirection() {
    while (input.directionStack.length > 0) {
      const dir = input.directionStack[input.directionStack.length - 1];
      if (input.keys.has(dir)) return dir;
      input.directionStack.pop();
    }

    return '';
  };

  function bindMobileControls() {
    if (!refs.mobileControls) return;

    const directionButtons = refs.mobileControls.querySelectorAll('[data-key]');
    directionButtons.forEach((btn) => {
      const dir = btn.dataset.key;
      if (!dir) return;

      const press = (e) => {
        e.preventDefault();
        input.pressDirection(dir);
      };

      const release = (e) => {
        e.preventDefault();
        input.releaseDirection(dir);
      };

      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
    });

    const fireBtn = refs.mobileControls.querySelector('[data-action="fire"]');
    if (fireBtn) {
      fireBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (app.state.game && app.state.game.state === app.constants.STATE.running) {
          app.logic.fireBullet(app.state.game.player);
        }
      });
    }
  }

  function bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.code in input.keyMap) {
        input.pressDirection(input.keyMap[e.code]);
        e.preventDefault();
        return;
      }

      if (e.code === 'Space') {
        if (app.state.game && app.state.game.state === app.constants.STATE.running) {
          app.logic.fireBullet(app.state.game.player);
        }
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code in input.keyMap) {
        input.releaseDirection(input.keyMap[e.code]);
        e.preventDefault();
      }
    });

    window.addEventListener('blur', () => {
      input.keys.clear();
      input.directionStack.length = 0;
    });
  }

  function bindButtons() {
    refs.startBtn.addEventListener('click', () => {
      app.logic.resetGame();
      app.logic.startGame();
    });

    refs.registerBtn.addEventListener('click', async () => {
      const email = window.prompt('请输入邮箱：');
      const nickname = window.prompt('请输入昵称：');
      const password = window.prompt('请输入密码（至少6位）：');
      if (!email || !nickname || !password) return;

      api.setAuthActionLoading(true, 'register');
      app.logic.setStatus('正在注册并自动登录...', '#ffe08a');

      try {
        await api.apiFetch('auth-register', {
          method: 'POST',
          body: JSON.stringify({ email, nickname, password }),
        });
        await api.loginWithCredentials(email, password);
        app.logic.setStatus(`注册成功，已自动登录：${nickname}`, '#9cf3ab');
      } catch (err) {
        app.logic.setStatus(`注册失败：${err.message}`, '#ff9d9d');
      } finally {
        api.setAuthActionLoading(false);
      }
    });

    refs.loginBtn.addEventListener('click', async () => {
      const email = window.prompt('邮箱：');
      const password = window.prompt('密码：');
      if (!email || !password) return;

      api.setAuthActionLoading(true, 'login');
      app.logic.setStatus('正在登录...', '#ffe08a');

      try {
        await api.loginWithCredentials(email, password);
      } catch (err) {
        app.logic.setStatus(`登录失败：${err.message}`, '#ff9d9d');
      } finally {
        api.setAuthActionLoading(false);
      }
    });

    refs.logoutBtn.addEventListener('click', () => {
      auth.token = '';
      auth.user = null;
      localStorage.removeItem('tank_token');
      api.updateAuthUI();
      app.logic.setStatus('已退出登录', '#ffe08a');
    });
  }

  app.input.bind = function bind() {
    bindKeyboard();
    bindButtons();
    bindMobileControls();
  };
})();

(() => {
  const app = window.TankGame;

  app.bootstrap = function bootstrap() {
    app.input.bind();
    app.logic.resetGame();
    app.api.updateAuthUI();
    app.logic.setStatus('正在连接服务...', '#ffe08a');

    Promise.all([app.api.refreshLeaderboard(), app.api.loadProfile()])
      .then(() => {
        if (app.auth.user) app.logic.setStatus(`欢迎回来，${app.auth.user.nickname}`);
        else app.logic.setStatus('按下“开始游戏”');
      })
      .catch(() => {
        app.logic.setStatus('服务连接异常，请稍后重试', '#ff9d9d');
      });

    requestAnimationFrame(app.logic.loop);
  };

  app.bootstrap();
})();

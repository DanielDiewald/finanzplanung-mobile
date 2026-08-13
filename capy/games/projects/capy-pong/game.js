(() => {
  'use strict';

  const FIRST_TO = 5;
  const WIN_BONUS = 250;
  const POINT_VALUE = 100;

  const canvas = document.getElementById('arena');
  const ctx = canvas.getContext('2d');
  const intro = document.getElementById('intro');
  const introText = document.getElementById('introText');
  const startButton = document.getElementById('startButton');
  const playerName = document.getElementById('playerName');
  const playerScore = document.getElementById('playerScore');
  const rivalScore = document.getElementById('rivalScore');
  const winsCopy = document.getElementById('winsCopy');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const finishOverlay = document.getElementById('finishOverlay');
  const finishTitle = document.getElementById('finishTitle');
  const finishCopy = document.getElementById('finishCopy');

  const player = { x: 0, y: 0, w: 96, h: 12 };
  const rival = { x: 0, y: 26, w: 96, h: 12 };
  const ball = { x: 0, y: 0, vx: 0, vy: 0, r: 8 };

  let width = 0;
  let height = 0;
  let playerPoints = 0;
  let rivalPoints = 0;
  let phase = 'idle';
  let paused = false;
  let startedAt = 0;
  let pausedAt = 0;
  let pausedTotal = 0;
  let roundDelay = 0;
  let serveDirection = 1;
  let lastFrame = performance.now();
  let wins = 0;
  let colors = {};

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function refreshColors() {
    const style = getComputedStyle(document.documentElement);
    colors = {
      line: style.getPropertyValue('--line').trim() || 'rgba(255,255,255,.16)',
      player: style.getPropertyValue('--player').trim() || '#78d9ba',
      rival: style.getPropertyValue('--rival').trim() || '#ff9b6a',
      ball: style.getPropertyValue('--ball').trim() || '#fff7d8',
      shadow: style.getPropertyValue('--shadow').trim() || 'rgba(0,0,0,.28)'
    };
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.max(240, rect.width);
    const nextHeight = Math.max(280, rect.height);
    const oldWidth = width || nextWidth;
    const oldHeight = height || nextHeight;
    width = nextWidth;
    height = nextHeight;

    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const paddleWidth = clamp(width * 0.29, 76, 116);
    player.w = rival.w = paddleWidth;
    player.h = rival.h = clamp(height * 0.018, 10, 14);
    player.y = height - clamp(height * 0.075, 34, 48);
    rival.y = clamp(height * 0.055, 24, 38);

    if (oldWidth > 0 && oldHeight > 0) {
      ball.x = clamp((ball.x / oldWidth) * width, ball.r, width - ball.r);
      ball.y = clamp((ball.y / oldHeight) * height, ball.r, height - ball.r);
      player.x = clamp((player.x / oldWidth) * width, 0, width - player.w);
      rival.x = clamp((rival.x / oldWidth) * width, 0, width - rival.w);
    }

    if (phase === 'idle') centerPieces();
  }

  function centerPieces() {
    player.x = (width - player.w) / 2;
    rival.x = (width - rival.w) / 2;
    ball.x = width / 2;
    ball.y = height / 2;
  }

  function updateScoreboard() {
    playerScore.textContent = String(playerPoints);
    rivalScore.textContent = String(rivalPoints);
  }

  function resetBall(direction = Math.random() < 0.5 ? -1 : 1) {
    const speed = clamp(width * 0.82, 235, 380);
    const horizontal = speed * (0.22 + Math.random() * 0.25) * (Math.random() < 0.5 ? -1 : 1);
    ball.x = width / 2;
    ball.y = height / 2;
    ball.vx = horizontal;
    ball.vy = direction * Math.sqrt(Math.max(1, speed * speed - horizontal * horizontal));
  }

  function bounceFromPaddle(paddle, verticalDirection) {
    const center = paddle.x + paddle.w / 2;
    const offset = clamp((ball.x - center) / (paddle.w / 2), -1, 1);
    const currentSpeed = Math.hypot(ball.vx, ball.vy);
    const speed = clamp(currentSpeed * 1.045, width * 0.82, width * 1.28);
    const angle = offset * (Math.PI / 3.15);
    ball.vx = speed * Math.sin(angle);
    ball.vy = verticalDirection * Math.abs(speed * Math.cos(angle));
  }

  function hitPaddle(paddle, isPlayer) {
    const movingToward = isPlayer ? ball.vy > 0 : ball.vy < 0;
    if (!movingToward) return false;
    const intersectsX = ball.x + ball.r >= paddle.x && ball.x - ball.r <= paddle.x + paddle.w;
    const intersectsY = ball.y + ball.r >= paddle.y && ball.y - ball.r <= paddle.y + paddle.h;
    if (!intersectsX || !intersectsY) return false;

    if (isPlayer) {
      ball.y = paddle.y - ball.r - 0.5;
      bounceFromPaddle(paddle, -1);
    } else {
      ball.y = paddle.y + paddle.h + ball.r + 0.5;
      bounceFromPaddle(paddle, 1);
    }
    return true;
  }

  function scorePoint(side) {
    if (side === 'player') playerPoints += 1;
    else rivalPoints += 1;
    updateScoreboard();

    if (playerPoints >= FIRST_TO || rivalPoints >= FIRST_TO) {
      void finishMatch();
      return;
    }

    serveDirection = side === 'player' ? 1 : -1;
    roundDelay = 0.72;
    ball.x = width / 2;
    ball.y = height / 2;
    ball.vx = 0;
    ball.vy = 0;
  }

  function updateAi(dt, now) {
    const center = rival.x + rival.w / 2;
    const tracking = ball.vy < 0 ? ball.x : width / 2;
    const wobble = Math.sin(now / 720) * Math.min(24, width * 0.055);
    const target = clamp(tracking + wobble, rival.w / 2, width - rival.w / 2);
    const maxMove = clamp(width * 0.58, 165, 265) * dt;
    const delta = clamp(target - center, -maxMove, maxMove);
    rival.x = clamp(rival.x + delta, 0, width - rival.w);
  }

  function update(dt, now) {
    if (phase !== 'playing' || paused) return;

    updateAi(dt, now);

    if (roundDelay > 0) {
      roundDelay -= dt;
      if (roundDelay <= 0) resetBall(serveDirection);
      return;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.r <= 0 && ball.vx < 0) {
      ball.x = ball.r;
      ball.vx *= -1;
    } else if (ball.x + ball.r >= width && ball.vx > 0) {
      ball.x = width - ball.r;
      ball.vx *= -1;
    }

    hitPaddle(player, true);
    hitPaddle(rival, false);

    if (ball.y - ball.r > height) scorePoint('rival');
    else if (ball.y + ball.r < 0) scorePoint('player');
  }

  function roundRect(x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCourt() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 10]);
    ctx.beginPath();
    ctx.moveTo(18, height / 2);
    ctx.lineTo(width - 18, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.095, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawPaddle(paddle, color) {
    ctx.save();
    ctx.shadowColor = colors.shadow;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    roundRect(paddle.x, paddle.y, paddle.w, paddle.h, paddle.h / 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBall() {
    ctx.save();
    ctx.shadowColor = colors.shadow;
    ctx.shadowBlur = 14;
    ctx.fillStyle = colors.ball;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    drawCourt();
    drawPaddle(rival, colors.rival);
    drawPaddle(player, colors.player);
    drawBall();
  }

  function frame(now) {
    const dt = Math.min(0.032, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    resizeCanvas();
    update(dt, now);
    draw();
    requestAnimationFrame(frame);
  }

  function movePlayer(clientX) {
    if (phase !== 'playing' || paused) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    player.x = clamp(x - player.w / 2, 0, width - player.w);
  }

  canvas.addEventListener('pointerdown', event => {
    if (phase !== 'playing' || paused) return;
    try { canvas.setPointerCapture(event.pointerId); } catch {}
    movePlayer(event.clientX);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.buttons || event.pointerType === 'touch' || event.pointerType === 'pen') movePlayer(event.clientX);
  });

  window.addEventListener('keydown', event => {
    if (phase !== 'playing' || paused) return;
    const step = Math.max(22, width * 0.075);
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      player.x = clamp(player.x - step, 0, width - player.w);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      player.x = clamp(player.x + step, 0, width - player.w);
    }
  });

  async function beginMatch() {
    if (phase === 'playing' || phase === 'finishing') return;
    startButton.disabled = true;
    finishOverlay.hidden = true;
    try {
      await CapytGame.start();
      playerPoints = 0;
      rivalPoints = 0;
      updateScoreboard();
      centerPieces();
      resetBall(Math.random() < 0.5 ? -1 : 1);
      roundDelay = 0.55;
      phase = 'playing';
      paused = false;
      pausedTotal = 0;
      pausedAt = 0;
      startedAt = performance.now();
      lastFrame = performance.now();
      intro.hidden = true;
    } catch (error) {
      startButton.disabled = false;
      introText.textContent = error?.message || 'Spiel konnte nicht gestartet werden.';
    }
  }

  async function finishMatch() {
    if (phase !== 'playing') return;
    phase = 'finishing';
    ball.vx = 0;
    ball.vy = 0;
    roundDelay = 0;

    const won = playerPoints > rivalPoints;
    const gameScore = playerPoints * POINT_VALUE + (won ? WIN_BONUS : 0);
    const now = performance.now();
    const currentPause = paused && pausedAt ? now - pausedAt : 0;
    const durationMs = Math.max(1000, Math.round(now - startedAt - pausedTotal - currentPause));

    finishTitle.textContent = won ? 'Du hast gewonnen! 🏆' : 'Rivalen-Capy gewinnt';
    finishCopy.textContent = `${playerPoints}:${rivalPoints} · Game-Score ${gameScore} · Ergebnis wird geprüft …`;
    finishOverlay.hidden = false;

    try {
      await CapytGame.submitScore({ score: gameScore });
      if (won) {
        wins += 1;
        await CapytGame.storage.set('wins', wins);
      }
      await CapytGame.storage.set('lastMatch', {
        player: playerPoints,
        rival: rivalPoints,
        won,
        score: gameScore
      });
      const result = await CapytGame.finish({ score: gameScore, durationMs });
      finishCopy.textContent = `${playerPoints}:${rivalPoints} · ${result.coinsAwarded || 0} Coins`;
    } catch (error) {
      phase = 'idle';
      finishTitle.textContent = 'Ergebnis konnte nicht gesendet werden';
      finishCopy.textContent = error?.message || 'Game Bridge Fehler.';
    }
  }

  async function initialize() {
    refreshColors();
    resizeCanvas();
    const init = await CapytGame.ready();
    const capy = init?.capy || await CapytGame.getCapy();
    const name = String(capy?.name || 'Dein Capy').trim() || 'Dein Capy';
    playerName.textContent = name;
    introText.textContent = `${name} spielt gegen das Rivalen-Capy. Ziehe deinen Schläger nach links und rechts. Erster bei 5 Punkten gewinnt.`;
    wins = Math.max(0, Number(await CapytGame.storage.get('wins')) || 0);
    winsCopy.textContent = `Siege: ${wins}`;
    startButton.disabled = false;
  }

  startButton.addEventListener('click', () => void beginMatch());

  CapytGame.onThemeChange(() => {
    refreshColors();
    draw();
  });

  CapytGame.onLifecycle(state => {
    if (state === 'paused' && phase === 'playing' && !paused) {
      paused = true;
      pausedAt = performance.now();
      pauseOverlay.hidden = false;
    } else if (state === 'playing' && phase === 'playing' && paused) {
      const now = performance.now();
      pausedTotal += Math.max(0, now - pausedAt);
      pausedAt = 0;
      paused = false;
      lastFrame = now;
      pauseOverlay.hidden = true;
    } else if (state === 'closed') {
      phase = 'closed';
      paused = true;
    }
  });

  initialize().catch(error => {
    startButton.disabled = true;
    introText.textContent = error?.message || 'Game Bridge nicht verfügbar.';
  });

  requestAnimationFrame(frame);
})();

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const highScoreElement = document.getElementById("highScore");
const lengthElement = document.getElementById("length");
const overlay = document.getElementById("overlay");
const overlayKicker = document.getElementById("overlayKicker");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const restartButton = document.getElementById("restartButton");
const soundButton = document.getElementById("soundButton");
const soundIcon = document.getElementById("soundIcon");
const board = document.querySelector(".board-wrap");

const WORLD_SIZE = 3200;
const WORLD_MARGIN = 28;
const FOOD_COUNT = 55;
const MAX_FOOD_COUNT = 240;
const BOT_COUNT = 8;
const SEGMENT_DISTANCE = 7;
const START_SEGMENTS = 34;
const GROWTH_PER_FOOD = 7;
const HEAD_RADIUS = 12;
const BASE_SPEED = 108;
const MAX_SPEED = 178;
const TURN_SPEED = 9.5;
const FOOD_COLORS = ["#ff4f91", "#ffc857", "#7cf7ff", "#b67cff", "#ff785a"];
const BOT_COLORS = ["#ff6b8a", "#64d8ff", "#ffd166", "#c77dff", "#ff8c42", "#56e39f", "#ff70d2"];

let snake = [];
let bots = [];
let foods = [];
let particles = [];
let angle = 0;
let targetAngle = 0;
let score = 0;
let gameState = "ready";
let lastFrame = performance.now();
let camera = { x: 0, y: 0 };
let pointer = { active: false, id: null, x: 0, y: 0 };
let soundEnabled = true;
let audioContext;
let viewportWidth = 400;
let viewportHeight = 400;
let highScore = Number(localStorage.getItem("freeSnakeHighScore")) || 0;

highScoreElement.textContent = highScore;

function resetGame() {
  const startX = WORLD_SIZE / 2;
  const startY = WORLD_SIZE / 2;
  snake = Array.from({ length: START_SEGMENTS }, (_, index) => ({
    x: startX - index * SEGMENT_DISTANCE,
    y: startY,
  }));
  foods = [];
  bots = [];
  particles = [];
  angle = 0;
  targetAngle = 0;
  score = 0;
  gameState = "ready";
  camera.x = startX - viewWidth() / 2;
  camera.y = startY - viewHeight() / 2;
  scoreElement.textContent = "0";
  lengthElement.textContent = displayLength(snake.length);
  pauseButton.disabled = true;
  pauseButton.innerHTML = "<span>Ⅱ</span> 暂停";
  while (foods.length < FOOD_COUNT) spawnFood();
  while (bots.length < BOT_COUNT) spawnBot();
}

function viewWidth() {
  return viewportWidth;
}

function viewHeight() {
  return viewportHeight;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  viewportWidth = rect.width || 400;
  viewportHeight = rect.height || 400;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(viewportWidth * dpr));
  const height = Math.max(1, Math.round(viewportHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function spawnFood() {
  let food;
  do {
    food = {
      x: 80 + Math.random() * (WORLD_SIZE - 160),
      y: 80 + Math.random() * (WORLD_SIZE - 160),
      radius: 6 + Math.random() * 4,
      color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
      phase: Math.random() * Math.PI * 2,
    };
  } while (snake.some((part) => distance(part, food) < 90));
  foods.push(food);
}

function spawnBot() {
  let x;
  let y;
  do {
    x = 180 + Math.random() * (WORLD_SIZE - 360);
    y = 180 + Math.random() * (WORLD_SIZE - 360);
  } while (distance({ x, y }, snake[0]) < 500);

  const botAngle = Math.random() * Math.PI * 2;
  const segmentCount = 30 + Math.floor(Math.random() * 46);
  const color = BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)];
  bots.push({
    parts: Array.from({ length: segmentCount }, (_, index) => ({
      x: x - Math.cos(botAngle) * index * SEGMENT_DISTANCE,
      y: y - Math.sin(botAngle) * index * SEGMENT_DISTANCE,
    })),
    angle: botAngle,
    targetAngle: botAngle,
    color,
    speed: 78 + Math.random() * 35,
    thinkTimer: Math.random(),
    name: `游蛇 ${Math.floor(10 + Math.random() * 90)}`,
  });
}

function startGame() {
  if (gameState === "running") return;
  if (gameState === "over") resetGame();
  gameState = "running";
  lastFrame = performance.now();
  overlay.classList.add("hidden");
  pauseButton.disabled = false;
  pauseButton.innerHTML = "<span>Ⅱ</span> 暂停";
  playTone(440, 0.06);
}

function togglePause() {
  if (gameState === "running") {
    gameState = "paused";
    overlayKicker.textContent = "稍作休息";
    overlayTitle.textContent = "已暂停";
    overlayText.textContent = "点击继续，蛇会从当前位置接着前进";
    startButton.textContent = "继续";
    overlay.classList.remove("hidden");
    pauseButton.innerHTML = "<span>▶</span> 继续";
  } else if (gameState === "paused") {
    startGame();
  }
}

function restartGame() {
  resetGame();
  overlayKicker.textContent = "自由移动模式";
  overlayTitle.textContent = "准备出发";
  overlayText.textContent = "按住屏幕滑动，蛇头会平滑跟随你的手指";
  startButton.textContent = "开始";
  overlay.classList.remove("hidden");
}

function update(delta) {
  if (gameState !== "running") return;

  if (pointer.active) updatePointerTarget();
  const turnDifference = shortestAngle(angle, targetAngle);
  const turnBoost = 1 + Math.min(1.35, Math.abs(turnDifference) * 0.8);
  angle += turnDifference * Math.min(1, TURN_SPEED * turnBoost * delta);
  const speed = Math.min(MAX_SPEED, BASE_SPEED + score * 2.4);
  const head = snake[0];
  head.x += Math.cos(angle) * speed * delta;
  head.y += Math.sin(angle) * speed * delta;

  for (let i = 1; i < snake.length; i += 1) {
    const previous = snake[i - 1];
    const current = snake[i];
    const dx = previous.x - current.x;
    const dy = previous.y - current.y;
    const length = Math.hypot(dx, dy) || 1;
    const correction = length - SEGMENT_DISTANCE;
    current.x += (dx / length) * correction;
    current.y += (dy / length) * correction;
  }

  if (
    head.x < WORLD_MARGIN ||
    head.y < WORLD_MARGIN ||
    head.x > WORLD_SIZE - WORLD_MARGIN ||
    head.y > WORLD_SIZE - WORLD_MARGIN
  ) {
    endGame("撞到世界边界了");
    return;
  }

  for (let i = 24; i < snake.length; i += 1) {
    if (distance(head, snake[i]) < HEAD_RADIUS + 4) {
      endGame("撞到自己了");
      return;
    }
  }

  for (let i = foods.length - 1; i >= 0; i -= 1) {
    if (distance(head, foods[i]) < HEAD_RADIUS + foods[i].radius + 3) {
      eatFood(i);
    }
  }

  updateBots(delta);

  for (const bot of bots) {
    for (let i = 8; i < bot.parts.length; i += 2) {
      if (distance(head, bot.parts[i]) < HEAD_RADIUS + 7) {
        endGame("撞到其他蛇了");
        return;
      }
    }
  }

  particles.forEach((particle) => {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.life -= delta;
  });
  particles = particles.filter((particle) => particle.life > 0);

  const desiredX = clamp(head.x - viewWidth() / 2, 0, WORLD_SIZE - viewWidth());
  const desiredY = clamp(head.y - viewHeight() / 2, 0, WORLD_SIZE - viewHeight());
  camera.x += (desiredX - camera.x) * Math.min(1, delta * 5.5);
  camera.y += (desiredY - camera.y) * Math.min(1, delta * 5.5);
  lengthElement.textContent = displayLength(snake.length);
}

function eatFood(index) {
  const food = foods[index];
  foods.splice(index, 1);
  score += 1;
  scoreElement.textContent = score;

  const tail = snake[snake.length - 1];
  for (let i = 0; i < GROWTH_PER_FOOD; i += 1) {
    snake.push({ x: tail.x, y: tail.y });
  }

  for (let i = 0; i < 12; i += 1) {
    const burstAngle = Math.random() * Math.PI * 2;
    particles.push({
      x: food.x,
      y: food.y,
      vx: Math.cos(burstAngle) * (35 + Math.random() * 55),
      vy: Math.sin(burstAngle) * (35 + Math.random() * 55),
      color: food.color,
      life: 0.45 + Math.random() * 0.25,
      radius: 1.5 + Math.random() * 2.5,
    });
  }

  spawnFood();
  playTone(590 + Math.min(score, 20) * 15, 0.07);
  if (navigator.vibrate) navigator.vibrate(12);
}

function updateBots(delta) {
  for (let botIndex = bots.length - 1; botIndex >= 0; botIndex -= 1) {
    const bot = bots[botIndex];
    const head = bot.parts[0];
    bot.thinkTimer -= delta;

    if (bot.thinkTimer <= 0) {
      bot.thinkTimer = 0.22 + Math.random() * 0.42;
      const target = nearestFood(head, 520);
      const wallTurn = wallAvoidance(head);
      if (wallTurn !== null) {
        bot.targetAngle = wallTurn;
      } else if (target && Math.random() < 0.82) {
        bot.targetAngle = Math.atan2(target.y - head.y, target.x - head.x);
      } else {
        bot.targetAngle += (Math.random() - 0.5) * 1.15;
      }
    }

    bot.angle += shortestAngle(bot.angle, bot.targetAngle) * Math.min(1, delta * 3.2);
    head.x += Math.cos(bot.angle) * bot.speed * delta;
    head.y += Math.sin(bot.angle) * bot.speed * delta;
    followBody(bot.parts);

    if (
      head.x < WORLD_MARGIN ||
      head.y < WORLD_MARGIN ||
      head.x > WORLD_SIZE - WORLD_MARGIN ||
      head.y > WORLD_SIZE - WORLD_MARGIN
    ) {
      killBot(botIndex);
      continue;
    }

    for (let foodIndex = foods.length - 1; foodIndex >= 0; foodIndex -= 1) {
      if (distance(head, foods[foodIndex]) < 16 + foods[foodIndex].radius) {
        foods.splice(foodIndex, 1);
        const tail = bot.parts[bot.parts.length - 1];
        for (let i = 0; i < 3; i += 1) bot.parts.push({ x: tail.x, y: tail.y });
        spawnFood();
        break;
      }
    }

    let botDied = false;
    for (let i = 10; i < snake.length; i += 2) {
      if (distance(head, snake[i]) < 15) {
        killBot(botIndex);
        botDied = true;
        break;
      }
    }
    if (botDied) continue;

    for (let otherIndex = 0; otherIndex < bots.length; otherIndex += 1) {
      if (otherIndex === botIndex) continue;
      const other = bots[otherIndex];
      for (let i = 10; i < other.parts.length; i += 3) {
        if (distance(head, other.parts[i]) < 14) {
          killBot(botIndex);
          botDied = true;
          break;
        }
      }
      if (botDied) break;
    }
  }

  while (bots.length < BOT_COUNT) spawnBot();
}

function followBody(parts) {
  for (let i = 1; i < parts.length; i += 1) {
    const previous = parts[i - 1];
    const current = parts[i];
    const dx = previous.x - current.x;
    const dy = previous.y - current.y;
    const length = Math.hypot(dx, dy) || 1;
    const correction = length - SEGMENT_DISTANCE;
    current.x += (dx / length) * correction;
    current.y += (dy / length) * correction;
  }
}

function nearestFood(origin, maxDistance) {
  let nearest = null;
  let nearestDistance = maxDistance;
  for (const food of foods) {
    const candidateDistance = distance(origin, food);
    if (candidateDistance < nearestDistance) {
      nearest = food;
      nearestDistance = candidateDistance;
    }
  }
  return nearest;
}

function wallAvoidance(head) {
  const safeDistance = 170;
  if (head.x < safeDistance) return 0;
  if (head.x > WORLD_SIZE - safeDistance) return Math.PI;
  if (head.y < safeDistance) return Math.PI / 2;
  if (head.y > WORLD_SIZE - safeDistance) return -Math.PI / 2;
  return null;
}

function killBot(index) {
  const [bot] = bots.splice(index, 1);
  if (!bot) return;

  bot.parts.forEach((part, partIndex) => {
    if (partIndex % 3 !== 0 || foods.length >= MAX_FOOD_COUNT) return;
    foods.push({
      x: clamp(part.x + (Math.random() - 0.5) * 18, 25, WORLD_SIZE - 25),
      y: clamp(part.y + (Math.random() - 0.5) * 18, 25, WORLD_SIZE - 25),
      radius: 7 + Math.random() * 3,
      color: bot.color,
      phase: Math.random() * Math.PI * 2,
      reward: true,
    });
  });

  const head = bot.parts[0];
  for (let i = 0; i < 28; i += 1) {
    const burstAngle = Math.random() * Math.PI * 2;
    particles.push({
      x: head.x,
      y: head.y,
      vx: Math.cos(burstAngle) * (45 + Math.random() * 90),
      vy: Math.sin(burstAngle) * (45 + Math.random() * 90),
      color: bot.color,
      life: 0.65 + Math.random() * 0.4,
      radius: 2 + Math.random() * 3,
    });
  }
  playTone(220, 0.12);
}

function endGame(reason) {
  gameState = "over";
  pauseButton.disabled = true;
  playTone(150, 0.18);

  if (score > highScore) {
    highScore = score;
    localStorage.setItem("freeSnakeHighScore", highScore);
    highScoreElement.textContent = highScore;
    overlayKicker.textContent = "新的最高纪录";
  } else {
    overlayKicker.textContent = reason;
  }

  overlayTitle.textContent = `${score} 分`;
  overlayText.textContent = "再来一次，去更远的地方探索。";
  startButton.textContent = "再玩一次";
  overlay.classList.remove("hidden");
}

function steerTo(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = clamp(clientX - rect.left, 0, rect.width);
  pointer.y = clamp(clientY - rect.top, 0, rect.height);
  updatePointerTarget();
}

function updatePointerTarget() {
  const head = snake[0];
  const headScreenX = head.x - camera.x;
  const headScreenY = head.y - camera.y;
  const dx = pointer.x - headScreenX;
  const dy = pointer.y - headScreenY;
  if (Math.hypot(dx, dy) > 6) targetAngle = Math.atan2(dy, dx);
}

function draw() {
  resizeCanvas();
  const width = viewWidth();
  const height = viewHeight();

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#06110d";
  ctx.fillRect(0, 0, width, height);
  drawWorld(width, height);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawFoods();
  drawParticles();
  drawBots();
  drawSnake();
  ctx.restore();

  drawMinimap(width);
  if (pointer.active && gameState === "running") drawPointerGuide();
}

function drawWorld(width, height) {
  const grid = 80;
  const startX = -((camera.x % grid) + grid) % grid;
  const startY = -((camera.y % grid) + grid) % grid;
  ctx.strokeStyle = "rgba(102, 255, 159, 0.055)";
  ctx.lineWidth = 1;
  for (let x = startX; x < width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = startY; y < height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  ctx.strokeStyle = "rgba(255, 79, 145, 0.55)";
  ctx.lineWidth = 5;
  ctx.shadowColor = "#ff4f91";
  ctx.shadowBlur = 18;
  ctx.strokeRect(2, 2, WORLD_SIZE - 4, WORLD_SIZE - 4);
  ctx.restore();
}

function drawFoods() {
  const time = performance.now() / 500;
  foods.forEach((food) => {
    if (!isVisible(food.x, food.y, 30)) return;
    const pulse = 1 + Math.sin(time + food.phase) * 0.14;
    ctx.save();
    ctx.shadowColor = food.color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = food.color;
    ctx.beginPath();
    ctx.arc(food.x, food.y, food.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.24;
    ctx.beginPath();
    ctx.arc(food.x, food.y, food.radius * 1.9 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawParticles() {
  particles.forEach((particle) => {
    ctx.globalAlpha = Math.min(1, particle.life * 2.2);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawSnake() {
  for (let i = snake.length - 1; i >= 0; i -= 1) {
    const part = snake[i];
    if (!isVisible(part.x, part.y, 25)) continue;
    const progress = 1 - i / snake.length;
    const radius = i === 0 ? HEAD_RADIUS : 5.5 + progress * 3.1;
    ctx.save();
    ctx.fillStyle = `hsl(${138 + progress * 18} 100% ${58 + progress * 12}%)`;
    if (i === 0) {
      ctx.shadowColor = "#66ff9f";
      ctx.shadowBlur = 18;
    }
    ctx.beginPath();
    ctx.arc(part.x, part.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const head = snake[0];
  const forwardX = Math.cos(angle);
  const forwardY = Math.sin(angle);
  const sideX = -forwardY;
  const sideY = forwardX;
  ctx.fillStyle = "#062312";
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.arc(
      head.x + forwardX * 6 + sideX * side * 4.8,
      head.y + forwardY * 6 + sideY * side * 4.8,
      2.1,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  });
}

function drawBots() {
  for (const bot of bots) {
    for (let i = bot.parts.length - 1; i >= 0; i -= 1) {
      const part = bot.parts[i];
      if (!isVisible(part.x, part.y, 25)) continue;
      const progress = 1 - i / bot.parts.length;
      const radius = i === 0 ? 10.5 : 5 + progress * 2.4;
      ctx.save();
      ctx.globalAlpha = 0.86 + progress * 0.14;
      ctx.fillStyle = bot.color;
      if (i === 0) {
        ctx.shadowColor = bot.color;
        ctx.shadowBlur = 14;
      }
      ctx.beginPath();
      ctx.arc(part.x, part.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const head = bot.parts[0];
    if (!isVisible(head.x, head.y, 80)) continue;
    const forwardX = Math.cos(bot.angle);
    const forwardY = Math.sin(bot.angle);
    const sideX = -forwardY;
    const sideY = forwardX;
    ctx.fillStyle = "#10151a";
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.arc(
        head.x + forwardX * 5.5 + sideX * side * 4,
        head.y + forwardY * 5.5 + sideY * side * 4,
        1.8,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    });
    ctx.fillStyle = "rgba(235,255,244,0.58)";
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(bot.name, head.x, head.y - 18);
  }
}

function drawPointerGuide() {
  const head = snake[0];
  const x = head.x - camera.x;
  const y = head.y - camera.y;
  ctx.save();
  ctx.strokeStyle = "rgba(157, 255, 193, 0.26)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 7]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(pointer.x, pointer.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(157, 255, 193, 0.7)";
  ctx.beginPath();
  ctx.arc(pointer.x, pointer.y, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawMinimap(width) {
  const size = 62;
  const x = width - size - 12;
  const y = 12;
  const scale = size / WORLD_SIZE;
  ctx.fillStyle = "rgba(3, 12, 8, 0.7)";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "rgba(102, 255, 159, 0.35)";
  ctx.strokeRect(x, y, size, size);
  ctx.fillStyle = "#66ff9f";
  ctx.beginPath();
  ctx.arc(x + snake[0].x * scale, y + snake[0].y * scale, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff739c";
  bots.forEach((bot) => {
    ctx.beginPath();
    ctx.arc(x + bot.parts[0].x * scale, y + bot.parts[0].y * scale, 1.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function animationLoop(now) {
  const delta = Math.min(0.035, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  update(delta);
  draw();
  requestAnimationFrame(animationLoop);
}

function shortestAngle(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function displayLength(segmentCount) {
  return Math.round(segmentCount * SEGMENT_DISTANCE);
}

function isVisible(x, y, padding) {
  return (
    x > camera.x - padding &&
    y > camera.y - padding &&
    x < camera.x + viewWidth() + padding &&
    y < camera.y + viewHeight() + padding
  );
}

function playTone(frequency, duration) {
  if (!soundEnabled) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.045, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch {
    // 音频不可用时不影响游戏。
  }
}

board.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button")) return;
  event.preventDefault();
  pointer.active = true;
  pointer.id = event.pointerId;
  board.setPointerCapture?.(event.pointerId);
  steerTo(event.clientX, event.clientY);
  if (gameState === "ready") startGame();
});

board.addEventListener("pointermove", (event) => {
  if (!pointer.active || event.pointerId !== pointer.id) return;
  event.preventDefault();
  steerTo(event.clientX, event.clientY);
});

function releasePointer(event) {
  if (event.pointerId !== pointer.id) return;
  pointer.active = false;
  pointer.id = null;
}

board.addEventListener("pointerup", releasePointer);
board.addEventListener("pointercancel", releasePointer);

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    if (gameState === "ready" || gameState === "over") startGame();
    else togglePause();
    return;
  }
  if (["ArrowLeft", "a", "A"].includes(event.key)) targetAngle -= Math.PI / 8;
  if (["ArrowRight", "d", "D"].includes(event.key)) targetAngle += Math.PI / 8;
  if (["ArrowUp", "w", "W"].includes(event.key)) targetAngle = -Math.PI / 2;
  if (["ArrowDown", "s", "S"].includes(event.key)) targetAngle = Math.PI / 2;
  if (gameState === "ready") startGame();
});

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", restartGame);
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundButton.classList.toggle("muted", !soundEnabled);
  soundIcon.textContent = soundEnabled ? "♪" : "×";
  if (soundEnabled) playTone(500, 0.06);
});
window.addEventListener("resize", resizeCanvas);

resetGame();
resizeCanvas();
requestAnimationFrame(animationLoop);

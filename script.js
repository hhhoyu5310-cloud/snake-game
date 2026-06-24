const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const highScoreElement = document.getElementById("highScore");
const speedElement = document.getElementById("speed");
const overlay = document.getElementById("overlay");
const overlayKicker = document.getElementById("overlayKicker");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const restartButton = document.getElementById("restartButton");
const soundButton = document.getElementById("soundButton");
const soundIcon = document.getElementById("soundIcon");

const gridSize = 20;
const tileCount = canvas.width / gridSize;
const initialSpeed = 145;
const minSpeed = 65;

let snake;
let food;
let direction;
let nextDirection;
let score;
let timer = null;
let gameState = "ready";
let soundEnabled = true;
let audioContext;

let highScore = Number(localStorage.getItem("neonSnakeHighScore")) || 0;
highScoreElement.textContent = highScore;

function resetGame() {
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  gameState = "ready";
  scoreElement.textContent = "0";
  speedElement.textContent = "1×";
  pauseButton.disabled = true;
  pauseButton.innerHTML = "<span>Ⅱ</span> 暂停";
  placeFood();
  draw();
}

function placeFood() {
  do {
    food = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };
  } while (snake?.some((segment) => segment.x === food.x && segment.y === food.y));
}

function currentDelay() {
  return Math.max(minSpeed, initialSpeed - Math.floor(score / 5) * 12);
}

function startGame() {
  if (gameState === "running") return;
  if (gameState === "over") resetGame();
  gameState = "running";
  overlay.classList.add("hidden");
  pauseButton.disabled = false;
  pauseButton.innerHTML = "<span>Ⅱ</span> 暂停";
  scheduleTick();
  playTone(440, 0.06);
}

function scheduleTick() {
  clearTimeout(timer);
  if (gameState === "running") {
    timer = setTimeout(gameLoop, currentDelay());
  }
}

function gameLoop() {
  direction = nextDirection;
  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  const hitWall =
    head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount;
  const hitSelf = snake.some(
    (segment, index) => index !== snake.length - 1 && segment.x === head.x && segment.y === head.y,
  );

  if (hitWall || hitSelf) {
    endGame();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 1;
    scoreElement.textContent = score;
    speedElement.textContent = `${(initialSpeed / currentDelay()).toFixed(1)}×`;
    playTone(620 + Math.min(score, 15) * 18, 0.07);
    placeFood();
  } else {
    snake.pop();
  }

  draw();
  scheduleTick();
}

function endGame() {
  clearTimeout(timer);
  gameState = "over";
  pauseButton.disabled = true;
  playTone(150, 0.18);

  if (score > highScore) {
    highScore = score;
    localStorage.setItem("neonSnakeHighScore", highScore);
    highScoreElement.textContent = highScore;
    overlayKicker.textContent = "新的最高纪录";
  } else {
    overlayKicker.textContent = "游戏结束";
  }

  overlayTitle.textContent = `${score} 分`;
  overlayText.textContent = score === 0 ? "再来一次，果实就在前方。" : "差一点就能吃得更长了。";
  startButton.textContent = "再玩一次";
  overlay.classList.remove("hidden");
}

function togglePause() {
  if (gameState === "running") {
    gameState = "paused";
    clearTimeout(timer);
    overlayKicker.textContent = "稍作休息";
    overlayTitle.textContent = "已暂停";
    overlayText.textContent = "按空格键或点击下方按钮继续";
    startButton.textContent = "继续";
    overlay.classList.remove("hidden");
    pauseButton.innerHTML = "<span>▶</span> 继续";
  } else if (gameState === "paused") {
    startGame();
    pauseButton.innerHTML = "<span>Ⅱ</span> 暂停";
  }
}

function restartGame() {
  clearTimeout(timer);
  resetGame();
  overlayKicker.textContent = "全新一局";
  overlayTitle.textContent = "准备出发";
  overlayText.textContent = "使用方向键、WASD 或下方按钮控制";
  startButton.textContent = "开始";
  overlay.classList.remove("hidden");
}

function setDirection(name) {
  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const candidate = directions[name];
  if (!candidate) return;
  if (candidate.x + direction.x === 0 && candidate.y + direction.y === 0) return;
  nextDirection = candidate;
}

function draw() {
  ctx.fillStyle = "#06110d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(102, 255, 159, 0.055)";
  ctx.lineWidth = 1;
  for (let i = 1; i < tileCount; i += 1) {
    const position = i * gridSize;
    ctx.beginPath();
    ctx.moveTo(position, 0);
    ctx.lineTo(position, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, position);
    ctx.lineTo(canvas.width, position);
    ctx.stroke();
  }

  const pulse = 0.72 + Math.sin(Date.now() / 170) * 0.12;
  ctx.save();
  ctx.shadowColor = "#ff4f91";
  ctx.shadowBlur = 16;
  ctx.fillStyle = `rgba(255, 79, 145, ${pulse})`;
  ctx.beginPath();
  ctx.arc(
    food.x * gridSize + gridSize / 2,
    food.y * gridSize + gridSize / 2,
    gridSize * 0.32,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();

  snake.forEach((segment, index) => {
    const x = segment.x * gridSize + 2;
    const y = segment.y * gridSize + 2;
    const size = gridSize - 4;
    const intensity = Math.max(0.45, 1 - index / (snake.length * 1.45));

    ctx.save();
    if (index === 0) {
      ctx.shadowColor = "#66ff9f";
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = `rgba(102, 255, 159, ${intensity})`;
    roundRect(ctx, x, y, size, size, index === 0 ? 7 : 5);
    ctx.fill();

    if (index === 0) drawEyes(x, y, size);
    ctx.restore();
  });

}

function renderLoop() {
  draw();
  requestAnimationFrame(renderLoop);
}

function drawEyes(x, y, size) {
  const eyes =
    direction.x !== 0
      ? [
          { x: x + size * 0.68, y: y + size * 0.3 },
          { x: x + size * 0.68, y: y + size * 0.7 },
        ]
      : [
          { x: x + size * 0.3, y: y + size * 0.32 },
          { x: x + size * 0.7, y: y + size * 0.32 },
        ];

  ctx.fillStyle = "#04210f";
  eyes.forEach((eye) => {
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, 1.7, 0, Math.PI * 2);
    ctx.fill();
  });
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function playTone(frequency, duration) {
  if (!soundEnabled) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.05, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch {
    // 部分浏览器会限制音频，游戏本身不受影响。
  }
}

document.addEventListener("keydown", (event) => {
  const keyMap = {
    ArrowUp: "up",
    w: "up",
    W: "up",
    ArrowDown: "down",
    s: "down",
    S: "down",
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowRight: "right",
    d: "right",
    D: "right",
  };

  if (keyMap[event.key]) {
    event.preventDefault();
    setDirection(keyMap[event.key]);
    if (gameState === "ready") startGame();
  }

  if (event.code === "Space") {
    event.preventDefault();
    if (gameState === "ready" || gameState === "over") startGame();
    else togglePause();
  }
});

document.querySelectorAll(".direction").forEach((button) => {
  button.addEventListener("pointerdown", () => {
    setDirection(button.dataset.direction);
    if (gameState === "ready") startGame();
  });
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

resetGame();
requestAnimationFrame(renderLoop);

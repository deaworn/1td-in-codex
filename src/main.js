const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statsEl = document.getElementById("stats");
const logEl = document.getElementById("log");
const towerGrid = document.getElementById("tower-grid");
const startBtn = document.getElementById("start");
const nextWaveBtn = document.getElementById("next-wave");
const resetBtn = document.getElementById("reset");

const gridSize = 40;
const towerRadius = 14;

const path = [
  { x: 40, y: 80 },
  { x: 280, y: 80 },
  { x: 280, y: 220 },
  { x: 520, y: 220 },
  { x: 520, y: 420 },
  { x: 760, y: 420 },
  { x: 760, y: 560 },
];

const waves = [
  { label: "Felderítők", count: 10, hp: 60, speed: 55, reward: 7 },
  { label: "Rohamlók", count: 12, hp: 95, speed: 65, reward: 9 },
  { label: "Tank drónok", count: 14, hp: 140, speed: 50, reward: 12 },
  { label: "Páncélozott raj", count: 18, hp: 180, speed: 60, reward: 14 },
  { label: "Gépintelligencia", count: 1, hp: 1200, speed: 38, reward: 0 },
];

const towerTypes = [
  {
    id: "rail",
    name: "Rail ágyú",
    color: "#5ad0ff",
    description: "Gyors, pontos, közepes hatótáv.",
    cost: 75,
    damage: 30,
    range: 150,
    fireRate: 1.4,
    projectileSpeed: 420,
  },
  {
    id: "plasma",
    name: "Plazma torony",
    color: "#d65aff",
    description: "Nagy sebzés, lassabb tüzelés.",
    cost: 110,
    damage: 55,
    range: 190,
    fireRate: 0.9,
    projectileSpeed: 360,
  },
  {
    id: "cry",
    name: "Kriotron",
    color: "#4ad991",
    description: "Kisebb sebzés, de lassítja a célpontot.",
    cost: 95,
    damage: 22,
    range: 160,
    fireRate: 1.2,
    projectileSpeed: 320,
    slow: 0.65,
    slowTime: 1.8,
  },
];

let state;
let projectiles;
let towers;
let enemies;
let running = false;
let activeTower = towerTypes[0];
let selectedTower = null;
let lastTime = performance.now();

function resetGame() {
  state = {
    money: 250,
    health: 20,
    wave: 0,
    time: 0,
  };
  projectiles = [];
  towers = [];
  enemies = [];
  selectedTower = null;
  running = false;
  logEl.innerHTML = "";
  appendLog("Játék visszaállítva. Helyezz el tornyokat és indítsd a hullámot!");
  updateStats();
  draw();
}

function appendLog(message) {
  const el = document.createElement("div");
  el.innerHTML = `<strong>${new Date().toLocaleTimeString()}:</strong> ${message}`;
  logEl.prepend(el);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function spawnWave() {
  const wave = waves[state.wave];
  if (!wave) return;
  const spawnInterval = 0.85;
  let spawned = 0;

  const spawn = () => {
    if (!running || spawned >= wave.count) return;
    const enemy = {
      x: path[0].x,
      y: path[0].y,
      hp: wave.hp,
      maxHp: wave.hp,
      speed: wave.speed,
      reward: wave.reward,
      progress: 0,
      pathIndex: 0,
      slowTimer: 0,
    };
    enemies.push(enemy);
    spawned += 1;
    if (spawned < wave.count) {
      setTimeout(spawn, spawnInterval * 1000);
    }
  };
  spawn();
  appendLog(`Hullám indítva: ${wave.label}`);
}

function canPlaceTower(cell) {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const closest = closestPointOnSegment(cell, a, b);
    if (distance(cell, closest) < gridSize * 0.8) return false;
  }
  return true;
}

function closestPointOnSegment(p, a, b) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ap = { x: p.x - a.x, y: p.y - a.y };
  const abLenSq = ab.x * ab.x + ab.y * ab.y;
  const t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / abLenSq));
  return { x: a.x + ab.x * t, y: a.y + ab.y * t };
}

function handleCanvasClick(evt) {
const rect = canvas.getBoundingClientRect();
const scaleX = canvas.width / rect.width;
const scaleY = canvas.height / rect.height;

const x = (evt.clientX - rect.left) * scaleX;
const y = (evt.clientY - rect.top) * scaleY;

  const cell = {
    x: Math.floor(x / gridSize) * gridSize + gridSize / 2,
    y: Math.floor(y / gridSize) * gridSize + gridSize / 2,
  };

  const clickedTower = towers.find((tower) => distance(tower, { x, y }) <= towerRadius);
  if (clickedTower) {
    selectedTower = clickedTower;
    draw();
    return;
  }

  selectedTower = null;

  if (!canPlaceTower(cell)) {
    appendLog("Nem helyezhetsz tornyot a pályára vagy közvetlen mellé.");
    return;
  }
  if (state.money < activeTower.cost) {
    appendLog("Nincs elég kredited ehhez a toronyhoz.");
    return;
  }
  towers.push({ ...cell, ...activeTower, cooldown: 0 });
  state.money -= activeTower.cost;
  appendLog(`${activeTower.name} lerakva (${cell.x}, ${cell.y}).`);
  updateStats();
}

function update(delta) {
  state.time += delta;
  enemies.forEach((enemy) => {
    const slowFactor = enemy.slowTimer > 0 ? 0.6 : 1;
    enemy.slowTimer = Math.max(0, enemy.slowTimer - delta);
    const speed = enemy.speed * slowFactor;
    const nextIdx = Math.min(path.length - 1, enemy.pathIndex + 1);
    const from = path[enemy.pathIndex];
    const to = path[nextIdx];
    const dir = { x: to.x - from.x, y: to.y - from.y };
    const segLength = Math.hypot(dir.x, dir.y);
    if (segLength === 0) return;
    const step = (speed * delta) / segLength;
    enemy.progress += step;
    if (enemy.progress >= 1) {
      enemy.pathIndex += 1;
      enemy.progress = 0;
      if (enemy.pathIndex >= path.length - 1) {
        enemy.reachedEnd = true;
      }
    }
    const base = path[enemy.pathIndex];
    const next = path[Math.min(path.length - 1, enemy.pathIndex + 1)];
    enemy.x = lerp(base.x, next.x, enemy.progress);
    enemy.y = lerp(base.y, next.y, enemy.progress);
  });

  enemies = enemies.filter((enemy) => {
    if (enemy.reachedEnd) {
      state.health -= 1;
      appendLog("Egy egység áttört a védelmen!");
      updateStats();
      return false;
    }
    if (enemy.hp <= 0) {
      state.money += enemy.reward;
      updateStats();
      return false;
    }
    return true;
  });

  towers.forEach((tower) => {
    tower.cooldown -= delta;
    const target = enemies
      .filter((e) => distance(e, tower) <= tower.range)
      .sort((a, b) => b.pathIndex - a.pathIndex || b.progress - a.progress)[0];
    if (target && tower.cooldown <= 0) {
      shoot(tower, target);
    }
  });

  projectiles.forEach((proj) => {
    proj.x += proj.vx * delta;
    proj.y += proj.vy * delta;
    proj.life -= delta;
    const hit = enemies.find((e) => distance(e, proj) < 12);
    if (hit) {
      hit.hp -= proj.damage;
      if (proj.slow) {
        hit.slowTimer = proj.slowTime;
      }
      proj.life = 0;
    }
  });
  projectiles = projectiles.filter((p) => p.life > 0);

  if (state.health <= 0) {
    running = false;
    appendLog("Elestél. Nyomd meg a Reset gombot az újrakezdéshez.");
  }

  if (running && enemies.length === 0 && state.wave === waves.length - 1) {
    running = false;
    appendLog("Minden hullámot visszavertél – nyomj Resetet az újrakezdéshez!");
  }
}

function shoot(tower, target) {
  const angle = Math.atan2(target.y - tower.y, target.x - tower.x);
  const speed = tower.projectileSpeed;
  const projectile = {
    x: tower.x,
    y: tower.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 1.8,
    damage: tower.damage,
    color: tower.color,
    slow: tower.slow,
    slowTime: tower.slowTime,
  };
  tower.cooldown = 1 / tower.fireRate;
  projectiles.push(projectile);
}

function drawGrid() {
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let x = gridSize; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = gridSize; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawPath() {
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = gridSize - 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.stroke();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawPath();

  towers.forEach((tower) => {
    ctx.fillStyle = tower.color;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, towerRadius, 0, Math.PI * 2);
    ctx.fill();

    if (tower === selectedTower) {
      ctx.strokeStyle = `${tower.color}22`;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  enemies.forEach((enemy) => {
    ctx.fillStyle = "#ffb347";
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f1324";
    ctx.fillRect(enemy.x - 16, enemy.y - 18, 32, 6);
    ctx.fillStyle = enemy.hp / enemy.maxHp < 0.35 ? "#ff7b7b" : "#4ad991";
    ctx.fillRect(enemy.x - 16, enemy.y - 18, (enemy.hp / enemy.maxHp) * 32, 6);
  });

  projectiles.forEach((proj) => {
    ctx.fillStyle = proj.color;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function animate() {
  const now = performance.now();
  const delta = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (running) {
    update(delta);
  }
  draw();
  requestAnimationFrame(animate);
}

function updateStats() {
  const healthClass = state.health <= 5 ? "health-low" : "";
  statsEl.innerHTML = `
    <span class="badge">Élet: <strong class="${healthClass}">${state.health}</strong></span>
    <span class="badge">Kredit: <strong>${state.money}</strong></span>
    <span class="badge">Hullám: <strong>${state.wave + 1}/${waves.length}</strong></span>
  `;
}

function buildTowerGrid() {
  towerGrid.innerHTML = "";
  towerTypes.forEach((tower) => {
    const card = document.createElement("button");
    card.className = "tower-card";
    card.innerHTML = `
      <h3>${tower.name}</h3>
      <div class="tower-meta">${tower.description}</div>
      <div class="tower-stats">
        <span class="tower-cost">${tower.cost} kredit</span>
        <span>DMG: ${tower.damage}</span>
        <span>Hatótáv: ${tower.range}</span>
        <span>Tűzgyorsaság: ${tower.fireRate.toFixed(1)}/s</span>
      </div>
    `;
    card.onclick = () => {
      activeTower = tower;
      Array.from(towerGrid.children).forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
    };
    if (tower.id === activeTower.id) card.classList.add("active");
    towerGrid.appendChild(card);
  });
}

function startGame() {
  if (running) return;
  running = true;
  spawnWave();
}

function nextWave() {
  if (state.wave >= waves.length - 1) {
    appendLog("Minden hullámot legyőztél – gratulálunk!");
    return;
  }
  if (enemies.length > 0) {
    appendLog("Várd meg, amíg az aktuális hullám elfogy.");
    return;
  }
  if (!running) running = true;
  state.wave += 1;
  spawnWave();
  updateStats();
}

  function init() {
    buildTowerGrid();
    resetGame();
    canvas.addEventListener("click", handleCanvasClick);
    startBtn.addEventListener("click", () => {
      if (!running) startGame();
    });
  nextWaveBtn.addEventListener("click", nextWave);
  resetBtn.addEventListener("click", resetGame);
  animate();
}

init();

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statsEl = document.getElementById("stats");
const logEl = document.getElementById("log");
const towerGrid = document.getElementById("tower-grid");
const startBtn = document.getElementById("start");
const nextWaveBtn = document.getElementById("next-wave");
const resetBtn = document.getElementById("reset");
const pauseBtn = document.getElementById("pause-toggle");
const speedButtons = document.querySelectorAll("[data-speed]");
const versionEl = document.getElementById("version");
const towerActionsEl = document.getElementById("tower-actions");
const settingsListEl = document.getElementById("settings-list");
const settingsStatusEl = document.getElementById("settings-status");

const GAME_VERSION = "v0.5.0";
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 640;
const gridSize = 40;
const towerRadius = 14;
const maxTowerLevel = 2;

const UPGRADE_SPECS = {
  rail: {
    costMultiplier: 2,
    description: "DMG +90%, +25 hatótáv, +15% tűzgyorsaság.",
    apply: (tower) => {
      tower.damage = Math.round((tower.baseDamage || tower.damage) * 1.9);
      tower.range = (tower.baseRange || tower.range) + 25;
      tower.fireRate = (tower.baseFireRate || tower.fireRate) * 1.15;
    },
  },
  plasma: {
    costMultiplier: 2,
    description: "Dupla lövés, DMG +85%, +30 hatótáv, +20% tűzgyorsaság.",
    apply: (tower) => {
      tower.damage = Math.round((tower.baseDamage || tower.damage) * 1.85);
      tower.range = (tower.baseRange || tower.range) + 30;
      tower.fireRate = (tower.baseFireRate || tower.fireRate) * 1.2;
      tower.multiShot = 2;
    },
  },
  cry: {
    costMultiplier: 2,
    description: "Erősebb, hosszabb lassítás, +20 hatótáv, +10% tűzgyorsaság.",
    apply: (tower) => {
      tower.damage = Math.round((tower.baseDamage || tower.damage) * 1.35);
      tower.range = (tower.baseRange || tower.range) + 20;
      tower.fireRate = (tower.baseFireRate || tower.fireRate) * 1.1;
      tower.slow = Math.max(0.2, (tower.baseSlow || tower.slow || 1) * 0.7);
      tower.slowTime = (tower.baseSlowTime || tower.slowTime || 0) + 0.9;
    },
  },
  default: {
    costMultiplier: 2,
    description: "+90% sebzés és jobb hatótáv.",
    apply: (tower) => {
      tower.damage = Math.round((tower.baseDamage || tower.damage) * 1.9);
      tower.range = (tower.baseRange || tower.range) + 20;
      tower.fireRate = (tower.baseFireRate || tower.fireRate) * 1.1;
    },
  },
};

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

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
let damageTexts;
let running = false;
let activeTower = null;
let selectedTower = null;
let hoverCell = null;
let lastTime = performance.now();
let upgradePreviewRange = null;
let isPaused = false;
let speedMultiplier = 1;
let rebindTarget = null;

const KEY_ACTIONS = {
  pause: "P",
  speedUp: "+",
  slowDown: "-",
  start: "Start",
  nextWave: "Következő hullám",
  reset: "Reset",
  tower1: "1. torony",
  tower2: "2. torony",
  tower3: "3. torony",
  clearSelection: "Kijelölés törlése",
};

const keyBindings = {
  pause: ["p"],
  speedUp: ["+"],
  slowDown: ["-"],
  start: ["s", "Enter"],
  nextWave: ["n"],
  reset: ["r"],
  tower1: ["1"],
  tower2: ["2"],
  tower3: ["3"],
  clearSelection: ["Escape"],
};

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
  damageTexts = [];
  clearActiveTowerSelection();
  selectedTower = null;
  hoverCell = null;
  upgradePreviewRange = null;
  isPaused = false;
  speedMultiplier = 1;
  running = false;
  logEl.innerHTML = "";
  appendLog("Játék visszaállítva. Helyezz el tornyokat és indítsd a hullámot!");
  updateStats();
  updateTowerActions();
  updateSpeedControls();
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
  const scaling = Math.pow(1.08, state.wave);

  const spawn = () => {
    if (!running || spawned >= wave.count) return;
    const isElite = state.wave >= 1 && (spawned + 1) % 3 === 0;
    const baseHp = Math.round(wave.hp * scaling * (isElite ? 1.6 : 1));
    const baseReward = Math.round(wave.reward * scaling * (isElite ? 1.8 : 1));
    const enemy = {
      x: path[0].x,
      y: path[0].y,
      hp: baseHp,
      maxHp: baseHp,
      speed: wave.speed * (isElite ? 0.9 : 1),
      reward: baseReward,
      progress: 0,
      pathIndex: 0,
      slowTimer: 0,
      slowStrength: 1,
      elite: isElite,
      radius: isElite ? 15 : 12,
      color: isElite ? "#ff6bd6" : "#ffb347",
      hpBarHeight: isElite ? 8 : 6,
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

function getCellFromEvent(evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (evt.clientX - rect.left) * scaleX;
  const y = (evt.clientY - rect.top) * scaleY;
  return {
    x: Math.floor(x / gridSize) * gridSize + gridSize / 2,
    y: Math.floor(y / gridSize) * gridSize + gridSize / 2,
  };
}

function clearActiveTowerSelection() {
  activeTower = null;
  if (!towerGrid) return;
  Array.from(towerGrid.children).forEach((card) => card.classList.remove("active"));
}

function clearSelectionAndPlacement() {
  selectedTower = null;
  hoverCell = null;
  upgradePreviewRange = null;
  clearActiveTowerSelection();
  updateTowerActions();
  draw();
}

function handleCanvasClick(evt) {
  const cell = getCellFromEvent(evt);

  const selectionRadius = Math.max(gridSize / 2, towerRadius);
  const clickedTower = towers.find((tower) => distance(tower, cell) <= selectionRadius);
  if (clickedTower) {
    selectedTower = clickedTower;
    upgradePreviewRange = null;
    clearActiveTowerSelection();
    updateTowerActions();
    draw();
    return;
  }

  const canAttemptPlacement = !selectedTower && activeTower && canPlaceTower(cell);
  if (canAttemptPlacement) {
    if (state.money < activeTower.cost) {
      appendLog("Nincs elég kredited ehhez a toronyhoz.");
      return;
    }
    towers.push({
      ...cell,
      ...activeTower,
      cooldown: 0,
      level: 1,
      baseDamage: activeTower.damage,
      baseCost: activeTower.cost,
      baseRange: activeTower.range,
      baseFireRate: activeTower.fireRate,
      baseProjectileSpeed: activeTower.projectileSpeed,
      baseSlow: activeTower.slow,
      baseSlowTime: activeTower.slowTime,
      multiShot: activeTower.multiShot || 1,
    });
    state.money -= activeTower.cost;
    appendLog(`${activeTower.name} lerakva (${cell.x}, ${cell.y}).`);
    updateStats();
    clearSelectionAndPlacement();
    return;
  }

  clearSelectionAndPlacement();
}

function handleCanvasMouseMove(evt) {
  hoverCell = activeTower ? getCellFromEvent(evt) : null;
  if (!activeTower) {
    upgradePreviewRange = null;
  }
}

function handleCanvasMouseLeave() {
  hoverCell = null;
}

function setActiveTowerByIndex(index) {
  if (index < 0 || index >= towerTypes.length) return;
  activeTower = towerTypes[index];
  selectedTower = null;
  hoverCell = null;
  upgradePreviewRange = null;
  updateTowerGridHighlight();
  updateTowerActions();
}

function updateTowerGridHighlight() {
  if (!towerGrid) return;
  Array.from(towerGrid.children).forEach((c) => c.classList.remove("active"));
  if (!activeTower) return;
  const match = Array.from(towerGrid.children).find(
    (c) => c.dataset.towerId === activeTower.id
  );
  if (match) match.classList.add("active");
}

function upgradeSelectedTower() {
  if (!selectedTower) return;
  if (!canUpgrade(selectedTower)) return;
  const cost = getUpgradeCost(selectedTower);
  if (state.money < cost) {
    appendLog("Nincs elég kredited a fejlesztéshez.");
    return;
  }
  state.money -= cost;
  selectedTower.level = Math.min(maxTowerLevel, (selectedTower.level || 1) + 1);
  applyUpgradeSpec(selectedTower);
  appendLog(`${selectedTower.name} fejlesztve (szint ${selectedTower.level}).`);
  updateStats();
  updateTowerActions();
  draw();
}

function getUpgradeCost(tower) {
  const spec = UPGRADE_SPECS[tower.id] || UPGRADE_SPECS.default;
  return Math.ceil((tower.baseCost || tower.cost) * (spec.costMultiplier || 2));
}

function canUpgrade(tower) {
  return tower.level < maxTowerLevel;
}

function applyUpgradeSpec(tower) {
  const spec = UPGRADE_SPECS[tower.id] || UPGRADE_SPECS.default;
  spec.apply(tower);
}

function getUpgradedRange(tower) {
  if (!tower) return null;
  const spec = UPGRADE_SPECS[tower.id] || UPGRADE_SPECS.default;
  const clone = { ...tower };
  applyUpgradeSpec(clone);
  return clone.range;
}

function updateSpeedControls() {
  if (pauseBtn) {
    pauseBtn.textContent = isPaused ? "▶" : "⏸";
    pauseBtn.classList.toggle("active", isPaused);
  }
  speedButtons.forEach((btn) => {
    const target = Number(btn.dataset.speed);
    const isActive = !isPaused && speedMultiplier === target;
    btn.classList.toggle("active", isActive);
  });
}

function setSpeed(multiplier) {
  speedMultiplier = multiplier;
  isPaused = false;
  updateSpeedControls();
}

function togglePause() {
  isPaused = !isPaused;
  updateSpeedControls();
}

function normalizeKey(key) {
  if (!key) return "";
  if (key.length === 1) return key.toLowerCase();
  return key;
}

function formatKey(key) {
  if (!key) return "";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function findActionForKey(key) {
  const norm = normalizeKey(key);
  return Object.entries(keyBindings).find(([, keys]) => keys.map(normalizeKey).includes(norm));
}

function setKeyBinding(action, key) {
  const norm = normalizeKey(key);
  const existing = findActionForKey(key);
  if (existing && existing[0] !== action) {
    if (settingsStatusEl) {
      settingsStatusEl.textContent = `A "${formatKey(key)}" már a(z) "${KEY_ACTIONS[existing[0]]}" műveleté.`;
    }
    return false;
  }
  const list = keyBindings[action] || [];
  if (!list.map(normalizeKey).includes(norm)) {
    list.push(key);
    keyBindings[action] = list;
  }
  if (settingsStatusEl) {
    settingsStatusEl.textContent = `"${formatKey(key)}" hozzárendelve: ${KEY_ACTIONS[action]}.`;
  }
  rebindTarget = null;
  renderSettings();
  return true;
}

function handleRebind(key) {
  if (!rebindTarget) return;
  setKeyBinding(rebindTarget, key);
}

function handleAction(action) {
  switch (action) {
    case "pause":
      togglePause();
      break;
    case "speedUp":
      if (speedMultiplier < 2) setSpeed(speedMultiplier === 1 ? 1.5 : 2);
      break;
    case "slowDown":
      if (speedMultiplier > 1) setSpeed(speedMultiplier === 2 ? 1.5 : 1);
      break;
    case "start":
      isPaused = false;
      updateSpeedControls();
      startGame();
      break;
    case "nextWave":
      nextWave();
      break;
    case "reset":
      resetGame();
      break;
    case "tower1":
      setActiveTowerByIndex(0);
      break;
    case "tower2":
      setActiveTowerByIndex(1);
      break;
    case "tower3":
      setActiveTowerByIndex(2);
      break;
    case "clearSelection":
      clearSelectionAndPlacement();
      break;
    default:
      break;
  }
}

function handleKeyDown(evt) {
  if (rebindTarget) {
    evt.preventDefault();
    handleRebind(evt.key);
    return;
  }
  const binding = findActionForKey(evt.key);
  if (binding) {
    evt.preventDefault();
    handleAction(binding[0]);
  }
}

function renderSettings() {
  if (!settingsListEl) return;
  settingsListEl.innerHTML = "";
  Object.entries(KEY_ACTIONS).forEach(([action, label]) => {
    const row = document.createElement("div");
    row.className = "settings-row";
    const keys = keyBindings[action] || [];
    row.innerHTML = `
      <div class="settings-row__label">${label}</div>
      <div class="settings-row__keys">
        ${keys.map((k) => `<span class="key-chip">${formatKey(k)}</span>`).join("")}
      </div>
      <button class="settings-row__bind" data-action="${action}">Új gomb</button>
    `;
    settingsListEl.appendChild(row);
  });

  const bindButtons = settingsListEl.querySelectorAll(".settings-row__bind");
  bindButtons.forEach((btn) => {
    btn.onclick = () => {
      rebindTarget = btn.dataset.action;
      if (settingsStatusEl) {
        settingsStatusEl.textContent = `${KEY_ACTIONS[rebindTarget]} → nyomj egy gombot a hozzárendeléshez.`;
      }
    };
  });
}

function update(delta) {
  state.time += delta;
  enemies.forEach((enemy) => {
    const slowFactor = enemy.slowTimer > 0 ? enemy.slowStrength || 0.6 : 1;
    enemy.slowTimer = Math.max(0, enemy.slowTimer - delta);
    if (enemy.slowTimer === 0) {
      enemy.slowStrength = 1;
    }
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
    const hit = enemies.find((e) => distance(e, proj) < e.radius);
    if (hit) {
      const damageAmount = Math.min(proj.damage, hit.hp);
      hit.hp -= proj.damage;
      if (proj.slow) {
        hit.slowTimer = proj.slowTime;
        hit.slowStrength = Math.min(proj.slow, 0.6);
      }
      damageTexts.push({
        x: hit.x,
        y: hit.y,
        elapsed: 0,
        duration: 0.7,
        text: `-${Math.round(damageAmount)}`,
        color: hit.elite ? "#ffb347" : "#f4f7ff",
      });
      proj.life = 0;
    }
  });
  projectiles = projectiles.filter((p) => p.life > 0);

  damageTexts.forEach((text) => {
    text.elapsed += delta;
    text.y -= delta * 32;
  });
  damageTexts = damageTexts.filter((text) => text.elapsed < text.duration);

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
  const shots = Math.max(1, tower.multiShot || 1);
  const spread = shots > 1 ? 0.08 : 0;
  for (let i = 0; i < shots; i++) {
    const offset = spread * (i - (shots - 1) / 2);
    const projectile = {
      x: tower.x,
      y: tower.y,
      vx: Math.cos(angle + offset) * speed,
      vy: Math.sin(angle + offset) * speed,
      life: 1.8,
      damage: tower.damage,
      color: tower.color,
      slow: tower.slow,
      slowTime: tower.slowTime,
    };
    projectiles.push(projectile);
  }
  tower.cooldown = 1 / tower.fireRate;
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
  const time = performance.now() / 1000;
  drawGrid();
  drawPath();

  drawHoverPreview();

  towers.forEach((tower) => {
    ctx.fillStyle = tower.color;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, towerRadius, 0, Math.PI * 2);
    ctx.fill();

    if ((tower.level || 1) > 1) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = `${tower.color}44`;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, towerRadius + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = `${tower.color}cc`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, towerRadius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (tower === selectedTower) {
      const rangeToShow = upgradePreviewRange || tower.range;
      const pulse = 0.6 + 0.4 * Math.sin(time * 2.2);

      ctx.save();
      ctx.globalAlpha = 0.6 + pulse * 0.2;
      ctx.strokeStyle = `${tower.color}cc`;
      ctx.lineWidth = 4.5;
      ctx.shadowColor = `${tower.color}aa`;
      ctx.shadowBlur = 16 + pulse * 6;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, towerRadius + 5 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.22 + pulse * 0.12;
      ctx.fillStyle = `${tower.color}33`;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, towerRadius + 10 + pulse * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = `${tower.color}66`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, rangeToShow, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  });

  enemies.forEach((enemy) => {
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f1324";
    ctx.fillRect(
      enemy.x - 16,
      enemy.y - (enemy.radius + enemy.hpBarHeight),
      32,
      enemy.hpBarHeight
    );
    ctx.fillStyle = enemy.hp / enemy.maxHp < 0.35 ? "#ff7b7b" : "#4ad991";
    ctx.fillRect(
      enemy.x - 16,
      enemy.y - (enemy.radius + enemy.hpBarHeight),
      (enemy.hp / enemy.maxHp) * 32,
      enemy.hpBarHeight
    );
  });

  damageTexts.forEach((text) => {
    const alpha = 1 - text.elapsed / text.duration;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = text.color;
    ctx.font = "16px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text.text, text.x, text.y - 6);
    ctx.restore();
  });

  projectiles.forEach((proj) => {
    ctx.fillStyle = proj.color;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawHoverPreview() {
  if (!hoverCell || !activeTower) return;
  const isValid = canPlaceTower(hoverCell);

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = isValid ? `${activeTower.color}66` : "#ff7b7b66";
  ctx.strokeStyle = isValid ? `${activeTower.color}aa` : "#ff7b7baa";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(hoverCell.x, hoverCell.y, towerRadius + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = isValid ? `${activeTower.color}88` : "#ff7b7b88";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(hoverCell.x, hoverCell.y, activeTower.range, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function animate() {
  const now = performance.now();
  const delta = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (running) {
    const effectiveDelta = isPaused ? 0 : delta * speedMultiplier;
    if (effectiveDelta > 0) {
      update(effectiveDelta);
    }
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

function updateTowerActions() {
  if (!towerActionsEl) return;
  if (!selectedTower) {
    upgradePreviewRange = null;
    towerActionsEl.innerHTML =
      '<div class="tower-actions__hint">Nincs kiválasztott torony. Kattints egy lerakott toronyra a fejlesztéshez.</div>';
    return;
  }
  const towerLevel = selectedTower.level || 1;
  const upgradeCost = getUpgradeCost(selectedTower);
  const atMax = !canUpgrade(selectedTower);
  const upgradeSpec = UPGRADE_SPECS[selectedTower.id] || UPGRADE_SPECS.default;

  towerActionsEl.innerHTML = `
    <div class="tower-actions__header">
      <div>
        <div class="tower-actions__title">${selectedTower.name}</div>
        <div class="tower-actions__level">Szint: ${towerLevel}/${maxTowerLevel}</div>
      </div>
      <button class="upgrade-btn" ${atMax ? "disabled" : ""}>Fejlesztés (${upgradeCost} cr)</button>
    </div>
    <div class="tower-actions__hint">${
      atMax ? "Elérte a maximális szintet." : `Következő szinten: ${upgradeSpec.description}`
    }</div>
  `;

  const upgradeBtn = towerActionsEl.querySelector(".upgrade-btn");
  if (upgradeBtn && !atMax) {
    upgradeBtn.onclick = upgradeSelectedTower;
    upgradeBtn.onmouseenter = () => {
      upgradePreviewRange = getUpgradedRange(selectedTower);
      draw();
    };
    upgradeBtn.onmouseleave = () => {
      upgradePreviewRange = null;
      draw();
    };
  } else {
    upgradePreviewRange = null;
  }
}

function buildTowerGrid() {
  towerGrid.innerHTML = "";
  towerTypes.forEach((tower) => {
    const card = document.createElement("button");
    card.className = "tower-card";
    card.dataset.towerId = tower.id;
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
      setActiveTowerByIndex(towerTypes.findIndex((t) => t.id === tower.id));
      updateTowerGridHighlight();
    };
    if (activeTower && tower.id === activeTower.id) card.classList.add("active");
    towerGrid.appendChild(card);
  });
}

function startGame() {
  if (running) return;
  running = true;
  isPaused = false;
  updateSpeedControls();
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
  versionEl.textContent = GAME_VERSION;
  buildTowerGrid();
  resetGame();
  canvas.addEventListener("click", handleCanvasClick);
  canvas.addEventListener("mousemove", handleCanvasMouseMove);
  canvas.addEventListener("mouseleave", handleCanvasMouseLeave);
  document.addEventListener("keydown", handleKeyDown);
  startBtn.addEventListener("click", () => {
    isPaused = false;
    updateSpeedControls();
    if (!running) startGame();
  });
  nextWaveBtn.addEventListener("click", nextWave);
  resetBtn.addEventListener("click", resetGame);
  if (pauseBtn) {
    pauseBtn.addEventListener("click", () => {
      togglePause();
    });
  }
  speedButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setSpeed(Number(btn.dataset.speed));
    });
  });
  renderSettings();
  updateSpeedControls();
  animate();
}

init();

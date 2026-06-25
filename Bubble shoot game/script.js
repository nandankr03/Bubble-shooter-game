const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("highScore");
const shotsEl = document.getElementById("shots");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const overlayBtn = document.getElementById("overlayBtn");
const htmlCurrentBubble = document.getElementById("htmlCurrentBubble");
const htmlNextBubble = document.getElementById("htmlNextBubble");

// Game Constants
const RADIUS = 18;
const DIAMETER = RADIUS * 2;
const ROW_HEIGHT = RADIUS * Math.sqrt(3); // Hex grid height
const ROWS = 16;
const COLS = Math.floor(canvas.width / DIAMETER);
const COLORS = ["#ef4444", "#3b82f6", "#10b981", "#eab308", "#a855f7", "#06b6d4"];

// Game State
let grid = [];
let bubbles = []; // Active falling/popping bubbles
let particles = [];
let projectile = null;
let currentBubbleColor = "";
let nextBubbleColor = "";
let score = 0;
let highScore = localStorage.getItem("bubbleShooterHighScore") || 0;
let maxShots = 35;
let shots = maxShots;
let gameState = "playing"; // playing, paused, gameover, victory
let mouseX = canvas.width / 2;
let mouseY = 0;
let animationId;

// Initialize
function init() {
  highScoreEl.textContent = highScore;
  
  // Event Listeners
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mousedown", onClick);
  pauseBtn.addEventListener("click", togglePause);
  restartBtn.addEventListener("click", resetGame);
  overlayBtn.addEventListener("click", resetGame);
  
  // Touch support
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (gameState !== "playing") return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouseX = (touch.clientX - rect.left) * scaleX;
    mouseY = (touch.clientY - rect.top) * scaleY;
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (gameState !== "playing") return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouseX = (touch.clientX - rect.left) * scaleX;
    mouseY = (touch.clientY - rect.top) * scaleY;
  }, { passive: false });
  
  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    onClick();
  }, { passive: false });
  
  resetGame();
  gameLoop();
}

function resetGame() {
  score = 0;
  shots = maxShots;
  gameState = "playing";
  grid = [];
  bubbles = [];
  particles = [];
  overlay.classList.add("hidden");
  pauseBtn.textContent = "Pause";
  
  updateUI();
  
  // Initialize grid (top 6 rows)
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    const colsInRow = r % 2 === 0 ? COLS : COLS - 1;
    for (let c = 0; c < colsInRow; c++) {
      if (r < 6) {
        grid[r][c] = {
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          active: true
        };
      } else {
        grid[r][c] = null;
      }
    }
  }
  
  currentBubbleColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  nextBubbleColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  projectile = null;
}

// Coordinates will be calculated dynamically in render

// Helpers to calculate coordinates
function getGridCoords(r, c) {
  const offsetX = r % 2 === 0 ? RADIUS : DIAMETER;
  return {
    x: c * DIAMETER + offsetX,
    y: r * ROW_HEIGHT + RADIUS
  };
}

// Draw functions
function drawGrid() {
  for (let r = 0; r < ROWS; r++) {
    const colsInRow = r % 2 === 0 ? COLS : COLS - 1;
    for (let c = 0; c < colsInRow; c++) {
      const bubble = grid[r][c];
      if (bubble && bubble.active) {
        const coords = getGridCoords(r, c);
        drawBubble(coords.x, coords.y, bubble.color);
      }
    }
  }
}

function drawBubble(x, y, color, radius = RADIUS, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  
  // Soft glow for vibrant colors
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  
  // Create gradient for 3D effect
  const grad = ctx.createRadialGradient(x - radius/3, y - radius/3, radius/10, x, y, radius);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.3, color);
  grad.addColorStop(1, color); 
  
  ctx.fillStyle = grad;
  ctx.fill();
  
  // Reset shadow for subsequent drawings
  ctx.shadowBlur = 0;
  
  // Visible inner edge
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
  ctx.stroke();
  
  // Highlight reflection (top left)
  ctx.beginPath();
  ctx.arc(x - radius/2.5, y - radius/2.5, radius/3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();
  
  // Secondary reflection (bottom right)
  ctx.beginPath();
  ctx.arc(x + radius/3, y + radius/3, radius/4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fill();
  
  ctx.restore();
}

function drawShooter() {
  if (!currentBubbleColor) currentBubbleColor = COLORS[0];
  if (!nextBubbleColor) nextBubbleColor = COLORS[0];

  const cX = canvas.width / 2;
  const cY = canvas.height - RADIUS - 25; // Base center
  
  let angle = 0;
  if (gameState === "playing") {
    angle = Math.atan2(mouseY - cY, mouseX - cX);
    if (angle > -0.1) angle = -0.1;
    if (angle < -Math.PI + 0.1) angle = -Math.PI + 0.1;
  } else {
    angle = -Math.PI / 2; // Point up when not playing
  }

  // Draw aiming line
  if (gameState === "playing") {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cX, cY);
    
    let aimX = cX;
    let aimY = cY;
    let aimDx = Math.cos(angle);
    let aimDy = Math.sin(angle);
    
    ctx.strokeStyle = currentBubbleColor;
    ctx.setLineDash([4, 12]);
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    
    // Add glow to aiming line
    ctx.shadowColor = currentBubbleColor;
    ctx.shadowBlur = 5;
    
    for (let i = 0; i < 35; i++) {
      aimX += aimDx * 15;
      aimY += aimDy * 15;
      
      if (aimX - RADIUS <= 0 || aimX + RADIUS >= canvas.width) {
        aimDx *= -1;
      }
      if (aimY <= 0) break; 
      
      ctx.lineTo(aimX, aimY);
    }
    
    ctx.stroke();
    ctx.restore();
  }

  // Draw Cannon Base (Dark semi-circle)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cX, cY + 10, 55, 0, Math.PI * 2);
  ctx.fillStyle = "#0f172a"; // Dark navy background
  ctx.fill();
  
  // Outer glow/border of the base
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#38bdf8"; // Bright blue border
  ctx.shadowColor = "#38bdf8";
  ctx.shadowBlur = 15;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Draw Rotating Cannon Pointer
  ctx.save();
  ctx.translate(cX, cY);
  ctx.rotate(angle + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(-12, -25);
  ctx.lineTo(12, -25);
  ctx.lineTo(8, -55);
  ctx.lineTo(-8, -55);
  ctx.closePath();
  ctx.fillStyle = "#1e293b";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#38bdf8";
  ctx.stroke();
  ctx.restore();
  
  // Inner ring for current bubble
  ctx.save();
  ctx.beginPath();
  ctx.arc(cX, cY, RADIUS + 6, 0, Math.PI * 2);
  ctx.fillStyle = "#1e293b";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#94a3b8"; // Silver-ish inner ring
  ctx.stroke();
  ctx.restore();

  // Reload Icon under current bubble
  ctx.save();
  ctx.translate(cX, cY + 30);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Simple curved arrows to look like reload
  ctx.arc(0, 0, 8, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 8, Math.PI + 0.2, Math.PI * 2 - 0.2);
  ctx.stroke();
  // Arrow heads
  ctx.beginPath();
  ctx.moveTo(7, 3);
  ctx.lineTo(10, -2);
  ctx.lineTo(4, -2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-7, -3);
  ctx.lineTo(-10, 2);
  ctx.lineTo(-4, 2);
  ctx.fill();
  ctx.restore();

  // Draw Next Bubble Container
  ctx.save();
  const boxWidth = 70;
  const boxHeight = 85;
  const boxX = canvas.width - boxWidth - 15;
  const boxY = canvas.height - boxHeight - 15;
  
  // Draw rounded rectangle manually for compatibility
  ctx.beginPath();
  ctx.moveTo(boxX + 10, boxY);
  ctx.lineTo(boxX + boxWidth - 10, boxY);
  ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + 10);
  ctx.lineTo(boxX + boxWidth, boxY + boxHeight - 10);
  ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - 10, boxY + boxHeight);
  ctx.lineTo(boxX + 10, boxY + boxHeight);
  ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - 10);
  ctx.lineTo(boxX, boxY + 10);
  ctx.quadraticCurveTo(boxX, boxY, boxX + 10, boxY);
  ctx.closePath();
  
  ctx.fillStyle = "#0f172a"; // Dark background
  ctx.fill();
  
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#3b82f6";
  ctx.shadowColor = "#3b82f6";
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;
  
  ctx.fillStyle = "white";
  ctx.font = "600 14px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Next", boxX + boxWidth / 2, boxY + 22);
  ctx.restore();

  // Draw projectile if active
  if (projectile) {
    drawBubble(projectile.x, projectile.y, projectile.color);
  }
}

function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.fill();
    ctx.globalAlpha = 1;
    
    p.x += p.dx;
    p.y += p.dy;
    p.life -= 0.03;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function drawFallingBubbles() {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    let b = bubbles[i];
    drawBubble(b.x, b.y, b.color, RADIUS, b.alpha || 1);
    
    if (b.type === 'fall') {
      b.dy += 0.4; // gravity
      b.x += b.dx;
      b.y += b.dy;
      if (b.y > canvas.height + RADIUS) {
        bubbles.splice(i, 1);
      }
    } else if (b.type === 'pop') {
      b.alpha -= 0.1;
      b.radius += 1;
      if (b.alpha <= 0) {
        bubbles.splice(i, 1);
      }
    }
  }
}

// Input Handlers
function onMouseMove(e) {
  if (gameState !== "playing") return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouseX = (e.clientX - rect.left) * scaleX;
  mouseY = (e.clientY - rect.top) * scaleY;
}

function onClick(e) {
  if (gameState !== "playing" || projectile) return;
  
  // If event exists, update mouseX and mouseY to ensure accurate click location
  if (e && e.clientX !== undefined) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouseX = (e.clientX - rect.left) * scaleX;
    mouseY = (e.clientY - rect.top) * scaleY;
  }

  // Define a rectangular playable area that only includes the bubble grid.
  // Ignore clicks on the shooter, current bubble, next bubble preview, and bottom control area.
  const BOARD_LEFT = 0;
  const BOARD_RIGHT = canvas.width;
  const BOARD_TOP = 0;
  const BOARD_BOTTOM = canvas.height - 150;

  if (
    mouseX < BOARD_LEFT ||
    mouseX > BOARD_RIGHT ||
    mouseY < BOARD_TOP ||
    mouseY > BOARD_BOTTOM
  ) {
    return;
  }
  
  const cX = canvas.width / 2;
  const cY = canvas.height - RADIUS - 25;
  
  let angle = Math.atan2(mouseY - cY, mouseX - cX);
  // Constrain angle
  if (angle > -0.1) angle = -0.1;
  if (angle < -Math.PI + 0.1) angle = -Math.PI + 0.1;
  
  const speed = 18;
  projectile = {
    x: cX,
    y: cY,
    dx: Math.cos(angle) * speed,
    dy: Math.sin(angle) * speed,
    color: currentBubbleColor
  };
  
  // Reload immediately
  currentBubbleColor = nextBubbleColor;
  nextBubbleColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  if (!nextBubbleColor) nextBubbleColor = COLORS[0]; // fallback
  
  shots--;
  updateUI();
}

function togglePause() {
  if (gameState === "playing") {
    gameState = "paused";
    pauseBtn.textContent = "Resume";
  } else if (gameState === "paused") {
    gameState = "playing";
    pauseBtn.textContent = "Pause";
  }
}

function updateUI() {
  scoreEl.textContent = score;
  shotsEl.textContent = shots;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("bubbleShooterHighScore", highScore);
    highScoreEl.textContent = highScore;
  }
}

// Physics & Logic
function updateShooter() {
  if (!projectile || gameState !== "playing") return;

  projectile.x += projectile.dx;
  projectile.y += projectile.dy;

  // Wall bounce
  if (projectile.x - RADIUS <= 0) {
    projectile.x = RADIUS;
    projectile.dx *= -1;
  } else if (projectile.x + RADIUS >= canvas.width) {
    projectile.x = canvas.width - RADIUS;
    projectile.dx *= -1;
  }

  // Top collision
  if (projectile.y - RADIUS <= 0) {
    snapBubble();
    return;
  }

  // Bubble collision
  for (let r = 0; r < ROWS; r++) {
    const colsInRow = r % 2 === 0 ? COLS : COLS - 1;
    for (let c = 0; c < colsInRow; c++) {
      let bubble = grid[r][c];
      if (!bubble || !bubble.active) continue;

      const coords = getGridCoords(r, c);
      const dx = projectile.x - coords.x;
      const dy = projectile.y - coords.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= DIAMETER - 2) { 
        snapBubble();
        return;
      }
    }
  }
}

function snapBubble() {
  // Find closest empty grid position based on current projectile pos
  let minDist = Infinity;
  let bestPos = null;

  for (let r = 0; r < ROWS; r++) {
    const colsInRow = r % 2 === 0 ? COLS : COLS - 1;
    for (let c = 0; c < colsInRow; c++) {
      if (!grid[r][c]) {
        const coords = getGridCoords(r, c);
        const dist = Math.hypot(projectile.x - coords.x, projectile.y - coords.y);
        if (dist < minDist) {
          minDist = dist;
          bestPos = { r, c };
        }
      }
    }
  }

  if (bestPos) {
    grid[bestPos.r][bestPos.c] = { color: projectile.color, active: true };
    checkMatches(bestPos.r, bestPos.c);
    
    // Check Game Over condition if bubbles reach bottom area
    if (bestPos.r >= ROWS - 2) {
      endGame("Game Over", "Bubbles reached the bottom!");
      return;
    }
  }

  projectile = null;

  if (shots <= 0 && gameState === "playing") {
    endGame("Out of Shots", "You have no shots left!");
    return;
  }
  
  checkVictory();
}

function getNeighbors(r, c) {
  const neighbors = [];
  const dirsEven = [[-1,-1], [-1,0], [0,-1], [0,1], [1,-1], [1,0]];
  const dirsOdd = [[-1,0], [-1,1], [0,-1], [0,1], [1,0], [1,1]];
  
  const dirs = r % 2 === 0 ? dirsEven : dirsOdd;
  
  for (let dir of dirs) {
    const nr = r + dir[0];
    const nc = c + dir[1];
    if (nr >= 0 && nr < ROWS) {
      const colsInRow = nr % 2 === 0 ? COLS : COLS - 1;
      if (nc >= 0 && nc < colsInRow) {
        if (grid[nr][nc]) {
          neighbors.push({r: nr, c: nc});
        }
      }
    }
  }
  return neighbors;
}

function checkMatches(startR, startC) {
  const targetColor = grid[startR][startC].color;
  const matchStack = [{r: startR, c: startC}];
  const matched = [];
  const visited = new Set();
  
  visited.add(`${startR},${startC}`);
  
  while(matchStack.length > 0) {
    const {r, c} = matchStack.pop();
    matched.push({r, c});
    
    const neighbors = getNeighbors(r, c);
    for(let n of neighbors) {
      if (!visited.has(`${n.r},${n.c}`) && grid[n.r][n.c].color === targetColor) {
        visited.add(`${n.r},${n.c}`);
        matchStack.push(n);
      }
    }
  }
  
  if (matched.length >= 3) {
    matched.forEach(m => {
      createParticles(m.r, m.c, grid[m.r][m.c].color);
      grid[m.r][m.c] = null;
    });
    score += matched.length * 10;
    updateUI();
    removeDisconnected();
  }
}

function removeDisconnected() {
  const connected = new Set();
  const stack = [];
  
  // Start from top row
  for(let c = 0; c < COLS; c++) {
    if (grid[0][c]) {
      stack.push({r: 0, c: c});
      connected.add(`0,${c}`);
    }
  }
  
  while(stack.length > 0) {
    const {r, c} = stack.pop();
    const neighbors = getNeighbors(r, c);
    for(let n of neighbors) {
      if (!connected.has(`${n.r},${n.c}`)) {
        connected.add(`${n.r},${n.c}`);
        stack.push(n);
      }
    }
  }
  
  // Find all not in connected and remove them
  let fell = 0;
  for(let r = 0; r < ROWS; r++) {
    const colsInRow = r % 2 === 0 ? COLS : COLS - 1;
    for(let c = 0; c < colsInRow; c++) {
      if (grid[r][c] && !connected.has(`${r},${c}`)) {
        const coords = getGridCoords(r, c);
        bubbles.push({
          x: coords.x,
          y: coords.y,
          dx: (Math.random() - 0.5) * 4,
          dy: Math.random() * -2 - 2, // jump up a bit then fall
          color: grid[r][c].color,
          type: 'fall'
        });
        grid[r][c] = null;
        fell++;
      }
    }
  }
  if (fell > 0) {
    score += fell * 20;
    updateUI();
  }
}

function createParticles(r, c, color) {
  const coords = getGridCoords(r, c);
  for (let i=0; i<8; i++) {
    particles.push({
      x: coords.x,
      y: coords.y,
      dx: (Math.random() - 0.5) * 10,
      dy: (Math.random() - 0.5) * 10,
      radius: Math.random() * 4 + 2,
      color: color,
      life: 1
    });
  }
}

function checkVictory() {
  let empty = true;
  for (let r = 0; r < ROWS; r++) {
    const colsInRow = r % 2 === 0 ? COLS : COLS - 1;
    for (let c = 0; c < colsInRow; c++) {
      if (grid[r][c]) {
        empty = false;
        break;
      }
    }
    if (!empty) break;
  }
  if (empty) {
    endGame("Victory!", `You cleared all bubbles! Score: ${score}`);
  }
}

function endGame(title, msg) {
  gameState = "gameover";
  overlayTitle.textContent = title;
  overlayTitle.style.background = title === "Victory!" ? "linear-gradient(to right, #10b981, #3b82f6)" : "linear-gradient(to right, #ef4444, #eab308)";
  overlayTitle.style.webkitBackgroundClip = "text";
  overlayTitle.style.webkitTextFillColor = "transparent";
  overlayMessage.textContent = msg;
  overlay.classList.remove("hidden");
}

function updateHTMLBubbles() {
  if (htmlCurrentBubble && htmlNextBubble) {
    htmlCurrentBubble.style.setProperty('--bubble-color', currentBubbleColor);
    htmlNextBubble.style.setProperty('--bubble-color', nextBubbleColor);
  }
}

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  drawGrid();
  drawFallingBubbles();
  drawParticles();
  
  if (gameState === "playing") {
    updateShooter();
    drawShooter();
  } else if (gameState === "paused") {
    drawShooter();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0,0,canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "bold 40px Outfit";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", canvas.width/2, canvas.height/2);
  } else if (gameState === "gameover" || gameState === "victory") {
    drawShooter(); // Just to show final position
  }
  
  updateHTMLBubbles();
  
  requestAnimationFrame(gameLoop);
}

// Start the game
init();

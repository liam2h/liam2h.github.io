// Snake, rendered as a text grid inside the terminal output.
// Calls onExit() when the game ends so the terminal can resume input.
function startSnake(term, onExit) {
  if (window.matchMedia("(pointer: coarse)").matches) {
    term.print("snake needs a keyboard — come back on a desktop.");
    onExit();
    return;
  }

  const W = 24, H = 12, TICK = 120;
  let snake = [{ x: 5, y: 6 }, { x: 4, y: 6 }, { x: 3, y: 6 }];
  let dir = { x: 1, y: 0 };
  let nextDir = dir;
  let food = null;
  let score = 0;

  const pre = document.createElement("pre");
  pre.className = "snake";
  term.append(pre);
  term.print("arrows / WASD to move · q or Esc to quit");

  function placeFood() {
    do {
      food = { x: (Math.random() * W) | 0, y: (Math.random() * H) | 0 };
    } while (snake.some((s) => s.x === food.x && s.y === food.y));
  }
  placeFood();

  function draw() {
    // ASCII only — fancy block glyphs fall back to another font and break the grid
    const grid = Array.from({ length: H }, () => Array(W).fill(" "));
    grid[food.y][food.x] = "*";
    snake.forEach((s, i) => (grid[s.y][s.x] = i === 0 ? "@" : "o"));
    const border = "+" + "-".repeat(W) + "+";
    pre.textContent =
      ` score: ${score}\n` +
      border + "\n" +
      grid.map((row) => "|" + row.join("") + "|").join("\n") + "\n" +
      border;
  }

  function tick() {
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const hitWall = head.x < 0 || head.x >= W || head.y < 0 || head.y >= H;
    const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) return end(`game over — score ${score}`);
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score++;
      placeFood();
    } else {
      snake.pop();
    }
    draw();
  }

  const DIRS = {
    ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
  };

  function onKey(e) {
    if (e.key === "q" || e.key === "Escape") return end(`quit — score ${score}`);
    const d = DIRS[e.key];
    if (d) {
      e.preventDefault();
      // no instant 180° reversal
      if (d.x !== -dir.x || d.y !== -dir.y) nextDir = d;
    }
  }

  function end(msg) {
    clearInterval(timer);
    document.removeEventListener("keydown", onKey);
    term.print(msg);
    onExit();
  }

  document.addEventListener("keydown", onKey);
  const timer = setInterval(tick, TICK);
  draw();
}

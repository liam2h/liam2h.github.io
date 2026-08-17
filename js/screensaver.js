// Idle screensaver: matrix rain after 20s of no input; any activity wakes it.
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const IDLE = 20000;
  const GLYPHS = "アイウエオカキクケコ0123456789ABCDEF<>[]{}=+*/ﾊﾋﾌﾍﾎ";
  let timer = null, raf = null, canvas = null, active = false;

  function phosphor() {
    // theme-aware: borrow the terminal's current text colour
    const el = document.getElementById("terminal") || document.body;
    return getComputedStyle(el).color || "#6ee08c";
  }

  function start() {
    if (active) return;
    active = true;
    canvas = document.createElement("canvas");
    canvas.id = "saver";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const FS = 16;
    let cols, drops;
    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cols = Math.ceil(canvas.width / FS);
      drops = Array.from({ length: cols }, () => Math.random() * -50);
    }
    resize();
    canvas._resize = resize;
    window.addEventListener("resize", resize);
    const col = phosphor();

    (function frame() {
      ctx.fillStyle = "rgba(0,0,0,0.08)";       // fade trails
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = FS + "px monospace";
      ctx.fillStyle = col;
      for (let i = 0; i < cols; i++) {
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        ctx.fillText(ch, i * FS, drops[i] * FS);
        if (drops[i] * FS > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.5;
      }
      raf = requestAnimationFrame(frame);
    })();
  }

  function stop() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(raf);
    if (canvas) {
      window.removeEventListener("resize", canvas._resize);
      canvas.remove();
      canvas = null;
    }
  }

  function wake() {
    stop();
    clearTimeout(timer);
    timer = setTimeout(start, IDLE);
  }

  ["keydown", "pointerdown", "pointermove", "wheel", "touchstart"].forEach((e) =>
    window.addEventListener(e, wake, { passive: true })
  );
  wake();

  window.saverAPI = { start, stop }; // for manual testing
})();

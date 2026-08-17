// Core terminal: output, input, history, boot sequence, click-to-run.
(function () {
  const crt = document.getElementById("crt");
  const output = document.getElementById("output");
  const input = document.getElementById("cmd-input");
  const promptLine = document.getElementById("prompt-line");
  const promptLabel = document.getElementById("prompt-label");
  const cmdBar = document.getElementById("cmd-bar");
  const PROMPT_DEFAULT = "visitor@liam:~$";

  let askResolve = null; // non-null while `ask()` is waiting for a line

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // keep the input sized to its text so the block cursor sits right after it
  const DECODE_GLYPHS = "!<>-_\\/[]{}=+*^?#01x";
  function syncCursor() {
    input.size = Math.max(1, input.value.length);
  }

  const history = [];
  let historyIdx = -1;
  let busy = false;

  // typing queue: print() calls are synchronous for callers, but each line
  // types out char-by-char in order behind the scenes
  let typeQueue = Promise.resolve();
  const CHAR_MS = 8;

  const term = {
    print(text) {
      const div = document.createElement("div");
      div.className = "line";
      output.appendChild(div);
      if (reducedMotion || !text) {
        div.textContent = text;
        this.scroll();
        return;
      }
      typeQueue = typeQueue.then(() => new Promise((resolve) => {
        // time-based typing: shows CHAR_MS-per-char normally, catches up in
        // one chunk if the tab was backgrounded and timers got throttled
        const t0 = Date.now();
        const id = setInterval(() => {
          const n = Math.min(text.length, Math.ceil((Date.now() - t0) / CHAR_MS));
          div.textContent = text.slice(0, n);
          this.scroll();
          if (n >= text.length) { clearInterval(id); resolve(); }
        }, CHAR_MS);
      }));
    },
    printHTML(html) {
      // HTML lines reveal whole (buttons/links can't type char-by-char),
      // but through the queue so they stay in order with typed lines
      const div = document.createElement("div");
      div.className = "line";
      output.appendChild(div);
      typeQueue = typeQueue.then(() => {
        div.innerHTML = html;
        this.scroll();
      });
    },
    append(el) {
      output.appendChild(el);
      this.scroll();
    },
    printPre(text, cls) {
      // whole-block reveal for ASCII art — typing it char-by-char looks broken
      const pre = document.createElement("pre");
      pre.className = "ascii" + (cls ? " " + cls : "");
      output.appendChild(pre);
      typeQueue = typeQueue.then(() => {
        pre.textContent = text;
        this.scroll();
      });
    },
    printDecode(text, cls) {
      // scramble-in reveal: each char cycles random glyphs, then locks L→R
      const pre = document.createElement("pre");
      pre.className = "ascii decode" + (cls ? " " + cls : "");
      output.appendChild(pre);
      if (reducedMotion) {
        typeQueue = typeQueue.then(() => { pre.textContent = text; this.scroll(); });
        return;
      }
      const chars = [...text];
      const DURATION = 900; // ms — progress tracks wall time, so background-tab
                            //      timer throttling can't stall the reveal
      typeQueue = typeQueue.then(() => new Promise((resolve) => {
        const t0 = Date.now();
        const id = setInterval(() => {
          const p = (Date.now() - t0) / DURATION;
          const locked = chars.length * p;
          pre.textContent = chars.map((c, i) => {
            if (c === "\n" || c === " ") return c;
            if (i <= locked) return c;
            return DECODE_GLYPHS[(Math.random() * DECODE_GLYPHS.length) | 0];
          }).join("");
          this.scroll();
          if (p >= 1) { clearInterval(id); pre.textContent = text; resolve(); }
        }, 26);
      }));
    },
    spinner(label) {
      // live loader that animates outside the type queue; returns a stop fn
      const div = document.createElement("div");
      div.className = "line spinner";
      output.appendChild(div);
      this.scroll();
      const frames = ["|", "/", "-", "\\"];
      let f = 0, id = null;
      const tick = () => { div.textContent = frames[f++ % 4] + " " + label; };
      if (reducedMotion) div.textContent = "... " + label;
      else { tick(); id = setInterval(tick, 90); }
      return (finalText) => {
        if (id) clearInterval(id);
        if (finalText === undefined) div.remove();
        else div.textContent = finalText;
        this.scroll();
      };
    },
    clear() {
      output.innerHTML = "";
    },
    pause(ms) {
      return new Promise((r) => setTimeout(r, reducedMotion ? 0 : ms));
    },
    async ask(promptText) {
      // interactive prompt inside a running command; resolves with the line,
      // or null if the visitor hits Esc
      await typeQueue;
      promptLine.classList.remove("busy"); // show prompt + cursor while asking
      promptLabel.textContent = promptText;
      input.value = "";
      syncCursor();
      input.focus({ preventScroll: true });
      this.scroll();
      return new Promise((resolve) => {
        askResolve = (answer) => {
          promptLabel.textContent = PROMPT_DEFAULT;
          promptLine.classList.add("busy"); // command is still running
          askResolve = null;
          if (answer !== null) this.print(promptText + answer);
          resolve(answer);
        };
      });
    },
    scroll() {
      promptLine.scrollIntoView({ block: "end" });
    },
    async run(line) {
      line = line.trim();
      if (!line || busy) return;
      busy = true;
      promptLine.classList.add("busy");
      this.printHTML(`<span class="prompt-echo">visitor@liam:~$</span> ${escapeHTML(line)}`);
      history.push(line);
      historyIdx = history.length;

      const [name, ...args] = line.split(/\s+/);
      const cmd = COMMANDS[name.toLowerCase()];
      try {
        if (cmd) {
          await cmd.run(this, args);
        } else {
          this.print(`command not found: ${name} — try \`help\``);
        }
      } catch (err) {
        this.print(`error: ${err.message}`);
      }
      await typeQueue; // let queued typing finish before accepting input
      busy = false;
      promptLine.classList.remove("busy");
      this.scroll();
      input.focus({ preventScroll: true });
    },
  };

  function escapeHTML(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  // ── tab completion ────────────────────────────────────────────────
  function complete() {
    const v = input.value;
    let head = "", base = v, pool = Object.keys(COMMANDS).filter((c) => !COMMANDS[c].hidden);
    const m = v.match(/^(cat\s+)(\S*)$/);
    if (m) {
      head = m[1];
      base = m[2];
      pool = Object.keys(VFS);
    }
    // dotfiles stay hidden unless explicitly asked for
    const matches = pool.filter((p) => p.startsWith(base) && (base.startsWith(".") || !p.startsWith(".")));
    if (!matches.length) return;
    let common = matches[0];
    for (const s of matches) {
      while (!s.startsWith(common)) common = common.slice(0, -1);
    }
    if (common.length > base.length) {
      input.value = head + common + (matches.length === 1 && !head ? " " : "");
    } else if (matches.length > 1) {
      term.print(matches.join("   "));
    }
    syncCursor();
  }

  // ── input handling ────────────────────────────────────────────────
  input.addEventListener("input", syncCursor);
  input.addEventListener("keydown", (e) => {
    // interactive ask() mode intercepts everything first
    if (askResolve) {
      if (e.key === "Enter") {
        const answer = input.value;
        input.value = "";
        syncCursor();
        askResolve(answer);
      } else if (e.key === "Escape") {
        input.value = "";
        syncCursor();
        askResolve(null);
      }
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      complete();
    } else if (e.key === "Enter") {
      const line = input.value;
      input.value = "";
      term.run(line);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIdx > 0) input.value = history[--historyIdx];
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx < history.length - 1) {
        input.value = history[++historyIdx];
      } else {
        historyIdx = history.length;
        input.value = "";
      }
    }
    syncCursor();
  });

  // click any [data-cmd] element to run it; click elsewhere focuses input
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-cmd]");
    if (el) {
      term.run(el.dataset.cmd);
    } else if (!window.getSelection().toString() && e.target.closest("#screen")) {
      input.focus({ preventScroll: true });
    }
  });

  // ── command bar ───────────────────────────────────────────────────
  for (const [name, cmd] of Object.entries(COMMANDS)) {
    if (cmd.hidden) continue;
    const btn = document.createElement("button");
    btn.className = "cmd";
    btn.dataset.cmd = name;
    btn.textContent = name;
    cmdBar.appendChild(btn);
  }

  // ── boot sequence ─────────────────────────────────────────────────
  const BOOT_LINES = [
    "LIAM-OS BIOS v1.0 — (c) hubbard industries",
    "memory check .......... 640K OK (should be enough for anybody)",
    "mounting /dev/career .. ok",
    "starting ambition daemon .. ok",
    "loading portfolio kernel ....",
    "boot complete.",
  ];

  let bootSkipped = false;
  function skipBoot() {
    bootSkipped = true;
  }

  async function boot() {
    const seen = localStorage.getItem("seen-boot");
    if (seen || reducedMotion) return;

    document.addEventListener("keydown", skipBoot, { once: true });
    document.addEventListener("click", skipBoot, { once: true });

    for (const line of BOOT_LINES) {
      if (bootSkipped) break;
      term.print(line);
      await term.pause(120); // typing effect adds the rest of the rhythm
    }
    localStorage.setItem("seen-boot", "1");
    if (bootSkipped) term.clear();

    document.removeEventListener("keydown", skipBoot);
    document.removeEventListener("click", skipBoot);
  }

  // ── intro: identity banner + pointers ─────────────────────────────
  async function intro() {
    COMMANDS.banner.run(term);
    term.print("");
    term.printHTML(
      `type or click <button class="cmd" data-cmd="help">help</button>` +
        ` — or start with <button class="cmd" data-cmd="projects">projects</button>.`
    );
    await typeQueue;
    term.scroll();
  }

  // ── go ────────────────────────────────────────────────────────────
  async function main() {
    document.body.classList.add("js");
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) document.documentElement.dataset.theme = savedTheme;
    crt.hidden = false;
    crt.setAttribute("aria-hidden", "true"); // screen readers use #fallback
    input.focus({ preventScroll: true });
    await boot();
    await intro();
  }

  main();
})();

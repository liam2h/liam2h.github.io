// Command registry. Each command: { desc, run(term, args) }.
// run may return a Promise; the terminal re-enables input when it settles.
// hidden: true keeps a command out of `help` and the command bar.

async function fetchRepo(user, name) {
  const key = `repo2:${user}/${name}`;
  const cached = sessionStorage.getItem(key);
  if (cached) return JSON.parse(cached);
  const res = await fetch(`https://api.github.com/repos/${user}/${name}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  const slim = {
    name: d.name,
    desc: d.description || "no description",
    lang: d.language || "—",
    stars: d.stargazers_count,
    url: d.html_url,
    pushed: d.pushed_at,
  };
  sessionStorage.setItem(key, JSON.stringify(slim));
  return slim;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function ago(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

// bordered ASCII card for one repo (ASCII only — VT323 lacks box-drawing glyphs)
function repoCard(term, p, user) {
  const lang = (CONFIG.langOverrides && CONFIG.langOverrides[p.name]) || p.lang;
  const link = `> github.com/${user}/${p.name}`;
  const meta = `${lang} · updated ${ago(p.pushed)}`;
  const W = Math.min(
    Math.max(meta.length, link.length, Math.min(p.desc.length, 44), p.name.length + 12, 30),
    52
  );
  const cut = (s) => (s.length > W ? s.slice(0, W - 1) + "…" : s);
  const pad = (s) => s + " ".repeat(W - Math.min(s.length, W));
  const head = `+- ${p.name} `;
  const tail = ` * ${p.stars} -+`;
  const fill = Math.max(1, W + 4 - head.length - tail.length);
  term.printHTML(esc(head) + "-".repeat(fill) + esc(tail));
  term.printHTML(`| ${esc(pad(cut(p.desc)))} |`);
  term.printHTML(`| <span class="dim">${esc(pad(cut(meta)))}</span> |`);
  term.printHTML(
    `| <a href="${p.url}" target="_blank" rel="noopener">${esc(link)}</a>` +
      " ".repeat(W - link.length) + " |"
  );
  term.print(`+${"-".repeat(W + 2)}+`);
}

// personal sections only exist when CONFIG has content for them
const HAS = {
  about: CONFIG.bio.length > 0,
  skills: Object.keys(CONFIG.skills).length > 0,
  whoami: !!CONFIG.whoami,
  sudo: CONFIG.sudoHireMe.length > 0,
  resume: !!CONFIG.resumeUrl,
};

// virtual filesystem: file -> command it reads from (or a special handler)
const VFS = {
  ...(HAS.about && { "about.txt": "about" }),
  ...(HAS.skills && { "skills.txt": "skills" }),
  "projects.txt": "projects",
  "contact.txt": "contact",
  ...(HAS.resume && { "resume.pdf": "__resume" }),
  ...(HAS.sudo && { ".secret": "__secret" }),
};

const COMMANDS = {
  help: {
    desc: "list available commands",
    run(term) {
      term.print("available commands:");
      for (const [name, cmd] of Object.entries(COMMANDS)) {
        if (cmd.hidden) continue;
        term.printHTML(
          `  <button class="cmd" data-cmd="${name}">${name}</button>${" ".repeat(Math.max(1, 11 - name.length))}${cmd.desc}`
        );
      }
      term.print("(commands are clickable — no typing required)");
    },
  },

  about: {
    hidden: !HAS.about,
    desc: "who is liam?",
    run(term) {
      if (!HAS.about) return term.print("about: nothing here yet.");
      term.print(`${CONFIG.name} — ${CONFIG.tagline}`);
      term.print("");
      CONFIG.bio.forEach((p) => {
        term.print(p);
        term.print("");
      });
    },
  },

  projects: {
    desc: "things I've built (live from GitHub)",
    async run(term) {
      term.print("PROJECTS");
      term.printHTML(`<span class="dim">${"=".repeat(24)}</span>`);
      const stop = term.spinner("contacting github...");
      const results = await Promise.allSettled(
        CONFIG.repos.map((r) => fetchRepo(CONFIG.githubUser, r))
      );
      stop();
      let shown = 0;
      results.forEach((res, i) => {
        if (res.status === "fulfilled") {
          repoCard(term, res.value, CONFIG.githubUser);
          shown++;
        } else {
          term.print(`  ${CONFIG.repos[i]}: unavailable (${res.reason.message})`);
        }
      });
      if (shown === 0) {
        term.print("GitHub API unreachable or rate-limited — try again later,");
        term.printHTML(
          `or browse directly: <a href="https://github.com/${CONFIG.githubUser}" target="_blank" rel="noopener">github.com/${CONFIG.githubUser}</a>`
        );
      }
    },
  },

  skills: {
    hidden: !HAS.skills,
    desc: "tech I work with",
    run(term) {
      if (!HAS.skills) return term.print("skills: nothing here yet.");
      for (const [group, items] of Object.entries(CONFIG.skills)) {
        term.print(`${group}:`);
        term.print(`  ${items.join(" · ")}`);
      }
    },
  },

  contact: {
    desc: "get in touch",
    run(term) {
      term.printPre(
        [
          " ______________________",
          "|\\                     /|",
          "| \\___________________/ |",
          "|                       |",
          "|_______________________|",
        ].join("\n")
      );
      // assembled at runtime — never present in page source
      const email = `${CONFIG.emailUser}@${CONFIG.emailDomain}`;
      term.printHTML(`email:    <a href="mailto:${email}">${email}</a>`);
      term.printHTML(
        `github:   <a href="https://github.com/${CONFIG.githubUser}" target="_blank" rel="noopener">github.com/${CONFIG.githubUser}</a>`
      );
      term.printHTML(
        `linkedin: <a href="${CONFIG.linkedin}" target="_blank" rel="noopener">${CONFIG.linkedin.replace("https://www.", "")}</a>`
      );
      if (CONFIG.resumeUrl) {
        term.printHTML(`resume:   <a href="${CONFIG.resumeUrl}" download>download PDF</a>`);
      }
      term.printHTML(
        `<span class="dim">or send a note right here: <button class="cmd" data-cmd="message">message</button></span>`
      );
    },
  },

  message: {
    desc: "send me a note",
    async run(term) {
      if (!CONFIG.formspreeId) {
        term.print("message: not set up yet — reach me via `contact` instead.");
        return;
      }
      term.print("send me a note (Esc to cancel)");
      const name = await term.ask("name: ");
      if (name === null) return term.print("cancelled.");
      let email;
      while (true) {
        email = await term.ask("email: ");
        if (email === null) return term.print("cancelled.");
        if (/^\S+@\S+\.\S+$/.test(email.trim())) break;
        term.print("that doesn't look like an email — try again.");
      }
      let body;
      while (true) {
        body = await term.ask("message: ");
        if (body === null) return term.print("cancelled.");
        if (body.trim()) break;
        term.print("empty message — say something!");
      }
      const yn = await term.ask("send? (y/n): ");
      if (yn === null || !/^y/i.test(yn.trim())) return term.print("cancelled.");
      const stop = term.spinner("sending...");
      try {
        const res = await fetch(`https://formspree.io/f/${CONFIG.formspreeId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ name: name.trim(), email: email.trim(), message: body.trim() }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        stop("✓ sent. thanks — I'll get back to you.");
      } catch (err) {
        stop(`send failed (${err.message}) — email me instead via \`contact\`.`);
      }
    },
  },

  ls: {
    desc: "look around",
    run(term, args) {
      const all = args.includes("-a");
      const files = Object.keys(VFS).filter((f) => all || !f.startsWith("."));
      term.print(files.join("   "));
      term.printHTML(`<span class="dim">(cat &lt;file&gt; to read — Tab completes)</span>`);
    },
  },

  cat: {
    hidden: true,
    desc: "read a file",
    async run(term, args) {
      const f = args[0];
      if (!f) return term.print("usage: cat <file>");
      const target = VFS[f];
      if (!target) return term.print(`cat: ${f}: no such file`);
      if (target === "__resume") {
        if (CONFIG.resumeUrl) {
          term.printHTML(`binary file — <a href="${CONFIG.resumeUrl}" download>download resume.pdf</a>`);
        } else {
          term.print("cat: resume.pdf: file is still being written (coming soon)");
        }
        return;
      }
      if (target === "__secret") {
        term.print("you found it. curiosity is the whole point of this site.");
        term.printHTML(`try <button class="cmd" data-cmd="sudo hire-me">sudo hire-me</button> — you've earned it.`);
        return;
      }
      await COMMANDS[target].run(term, []);
    },
  },

  pwd: {
    hidden: true,
    desc: "where am I",
    run(term) {
      term.print("/home/visitor");
    },
  },

  date: {
    hidden: true,
    desc: "what time is it",
    run(term) {
      term.print(new Date().toString());
    },
  },

  echo: {
    hidden: true,
    desc: "repeat after me",
    run(term, args) {
      term.print(args.join(" "));
    },
  },

  whoami: {
    hidden: !HAS.whoami,
    desc: "identity check",
    run(term) {
      term.print(CONFIG.whoami || "visitor");
    },
  },

  theme: {
    desc: "phosphor: green · amber · blue",
    run(term, args) {
      const themes = ["green", "amber", "blue"];
      const t = (args[0] || "").toLowerCase();
      if (!themes.includes(t)) {
        term.printHTML(
          `usage: theme &lt;color&gt; — ` +
            themes.map((x) => `<button class="cmd" data-cmd="theme ${x}">${x}</button>`).join(" ")
        );
        return;
      }
      document.documentElement.dataset.theme = t;
      localStorage.setItem("theme", t);
      term.print(`phosphor set to ${t}.`);
    },
  },

  banner: {
    hidden: true,
    desc: "system identification",
    run(term) {
      term.printDecode(
        [
          " _     ___    _    __  __ ",
          "| |   |_ _|  / \\  |  \\/  |",
          "| |    | |  / _ \\ | |\\/| |",
          "| |___ | | / ___ \\| |  | |",
          "|_____|___/_/   \\_\\_|  |_|",
        ].join("\n"),
        "banner"
      );
      term.printPre(
        [
          `visitor@liam`,
          `------------`,
          `Projects: run \`projects\``,
          `Contact:  run \`contact\``,
        ].join("\n"),
        "sysinfo"
      );
    },
  },

  clear: {
    desc: "clear the screen",
    run(term) {
      term.clear();
    },
  },

  sudo: {
    hidden: true,
    desc: "with great power...",
    async run(term, args) {
      if (args.join(" ") === "hire-me" && HAS.sudo) {
        for (const line of CONFIG.sudoHireMe) {
          term.print(line);
          await term.pause(250);
        }
      } else {
        term.print("visitor is not in the sudoers file. this incident will be reported.");
      }
    },
  },

  snake: {
    hidden: true,
    desc: "ssssss",
    run(term) {
      return new Promise((resolve) => startSnake(term, resolve));
    },
  },
};

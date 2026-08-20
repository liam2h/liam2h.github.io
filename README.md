# terminal portfolio

> **Status:** actively developed

my portfolio site, but its a fake CRT terminal. plain html/css/js, no build step, no dependencies.

you type (or click) commands like `about`, `projects`, `skills`, `contact`. projects pull live from the github api. theres a fake filesystem with `ls`/`cat`/tab-completion, phosphor themes, a matrix rain screensaver, snake, and a couple easter eggs.

all the content lives in `config.js` — name, bio, skills, repo list, resume link, formspree id for the contact form. want to steal it for your own site? change that one file and youre done.

## run locally

```
python -m http.server 8123
```

any static server works — fetch to github needs a server, `file://` mostly works otherwise.

## deploy

its github pages. repo named `<username>.github.io`, push to main, settings → pages → deploy from branch. live in a minute.

## files

- `index.html` — markup + no-js fallback content
- `css/style.css` — all the CRT stuff (glow, scanlines, flicker), tokens in `:root`, `prefers-reduced-motion` kills the animations
- `js/terminal.js` — input, history, tab completion, boot sequence
- `js/commands.js` — command registry, fake filesystem, github cards, contact form
- `js/snake.js`, `js/screensaver.js` — the toys

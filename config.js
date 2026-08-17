// ── Edit this file. Everything personal lives here. ──────────────────
// Empty values hide their command (about / skills / whoami / sudo hire-me / resume).
const CONFIG = {
  name: "Liam Hubbard",
  tagline: "developer",

  githubUser: "liam2h",

  bio: [],

  skills: {},

  linkedin: "https://www.linkedin.com/in/liam-hubbard-37b286333/",

  // In-terminal contact form (`message` command). Sign up free at formspree.io,
  // create a form, and paste its id here (the part after /f/ in the endpoint).
  formspreeId: null,

  // Email is split so the address never appears assembled in page source
  emailUser: "liammhubbardd",
  emailDomain: "gmail.com",

  // Curated repos shown by `projects` — live data fetched from GitHub API.
  // Add repo names here as you publish projects.
  repos: ["paperlight", "honeypot", "trump-quotes", "neetcode-submissions"],

  // override GitHub's dominant-language guess for a repo (repo name -> language)
  langOverrides: { paperlight: "TypeScript", "trump-quotes": "JavaScript", honeypot: "Python" },

  resumeUrl: null,

  whoami: "",

  sudoHireMe: [],
};

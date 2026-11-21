// What the Ai: theme switch, the typing brand, and thumbnail previews.
// Every link on the site works without this file.
(() => {
  const root = document.documentElement;
  const toggle = document.getElementById("darkModeToggle");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const systemTheme = matchMedia("(prefers-color-scheme: dark)");
  let explicitTheme = false;
  try {
    explicitTheme = ["true", "false"].includes(localStorage.getItem("darkMode"));
  } catch {
    /* The theme still works without storage. */
  }
  function updateThemeButton() {
    const dark = root.classList.contains("dark-mode");
    const label = dark ? "Switch to light mode" : "Switch to dark mode";
    toggle.setAttribute("aria-pressed", String(dark));
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
  }
  if (toggle) {
    toggle.hidden = false;
    updateThemeButton();
    toggle.addEventListener("click", () => {
      const dark = root.classList.toggle("dark-mode");
      explicitTheme = true;
      try {
        localStorage.setItem("darkMode", String(dark));
      } catch {
        /* Remembered for this page only. */
      }
      updateThemeButton();
    });
    systemTheme.addEventListener("change", (event) => {
      if (explicitTheme) return;
      root.classList.toggle("dark-mode", event.matches);
      updateThemeButton();
    });
  }

  // Pointing at a version shows what that version looks like.
  for (const card of document.querySelectorAll(".game-item")) {
    const image = card.querySelector(".thumbnail img"),
      link = card.querySelector(".game-link"),
      chips = [...card.querySelectorAll(".chip[data-thumb]")];
    if (!image || !chips.length) continue;
    const home = { src: image.getAttribute("src"), href: link.getAttribute("href") };
    const show = (src, href) => {
      if (image.getAttribute("src") !== src) image.src = src;
      link.setAttribute("href", href);
    };
    for (const chip of chips) {
      const preview = () => show(chip.dataset.thumb, chip.getAttribute("href"));
      chip.addEventListener("pointerenter", preview);
      chip.addEventListener("focus", preview);
    }
    card.addEventListener("pointerleave", () => show(home.src, home.href));
    card.addEventListener("focusout", (event) => {
      if (!card.contains(event.relatedTarget)) show(home.src, home.href);
    });
  }
  for (const img of document.querySelectorAll(".thumbnail img, .shot img, .strip img, .cover img")) {
    const hide = () => (img.style.visibility = "hidden");
    img.addEventListener("error", hide);
    img.addEventListener("load", () => (img.style.visibility = ""));
    if (img.complete && !img.naturalWidth) hide();
  }
  const year = document.getElementById("copyright-year");
  if (year) year.textContent = String(new Date().getFullYear());

  // The brand asks its question in a different language every few seconds.
  const title = document.getElementById("dynamic-title");
  const titles = ["What the Ai", "¿Qué la IA?", "Quoi l’IA ?", "Was die KI?", "Cosa l’IA?", "O que a IA?", "Что за ИИ?", "何だAI？", "什么AI？", "뭐야 AI?", "ما ال IA؟", "क्या एआई?", "Wat de AI?", "Vad AI?", "Hva AI?", "Hvad AI?", "Mitä tekoäly?", "Co AI?", "Ne AI?", "Τι το AI;", "מה ה-AI?"];
  const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
  const letters = (text) => (segmenter ? [...segmenter.segment(text)].map((x) => x.segment) : Array.from(text));
  let index = 0,
    count = letters(titles[0]).length,
    deleting = true,
    timer;
  function tick() {
    if (motion.matches || document.hidden) return;
    const chars = letters(titles[index]);
    count += deleting ? -1 : 1;
    title.textContent = chars.slice(0, count).join("");
    let delay = deleting ? 45 : 90;
    if (count === 0) {
      deleting = false;
      index = (index + 1) % titles.length;
      delay = 180;
    } else if (!deleting && count === chars.length) {
      deleting = true;
      delay = 4500;
    }
    timer = setTimeout(tick, delay);
  }
  function scheduleTitle() {
    clearTimeout(timer);
    if (motion.matches) {
      title.textContent = titles[0];
      index = 0;
      count = letters(titles[0]).length;
      deleting = true;
    } else if (!document.hidden) timer = setTimeout(tick, 4500);
  }
  if (title) {
    motion.addEventListener("change", scheduleTitle);
    document.addEventListener("visibilitychange", scheduleTitle);
    scheduleTitle();
  }
  const logo = document.getElementById("spin-emoji");
  if (logo) {
    logo.addEventListener("click", (event) => {
      if (motion.matches) return;
      event.preventDefault();
      logo.classList.remove("spin");
      void logo.offsetWidth;
      logo.classList.add("spin");
    });
    logo.addEventListener("animationend", () => logo.classList.remove("spin"));
  }
})();

(() => {
  const root = document.documentElement;
  const toggle = document.getElementById("darkModeToggle");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const systemTheme = matchMedia("(prefers-color-scheme: dark)");
  let explicitTheme = false;
  try {
    explicitTheme = ["true", "false"].includes(
      localStorage.getItem("darkMode"),
    );
  } catch {
    /* Theme remains usable without storage. */
  }
  function updateThemeButton() {
    const dark = root.classList.contains("dark-mode");
    toggle.setAttribute("aria-pressed", String(dark));
    toggle.setAttribute(
      "aria-label",
      dark ? "Switch to light mode" : "Switch to dark mode",
    );
    toggle.title = dark ? "Switch to light mode" : "Switch to dark mode";
  }
  toggle.hidden = false;
  updateThemeButton();
  toggle.addEventListener("click", () => {
    const dark = root.classList.toggle("dark-mode");
    explicitTheme = true;
    try {
      localStorage.setItem("darkMode", String(dark));
    } catch {
      /* Remember for this page even if storage is blocked. */
    }
    updateThemeButton();
  });
  systemTheme.addEventListener("change", (event) => {
    if (!explicitTheme) {
      root.classList.toggle("dark-mode", event.matches);
      updateThemeButton();
    }
  });

  const selectors = [...document.querySelectorAll(".version-select")];
  function syncVersion(select) {
    const card = select.closest(".game-item");
    const link = card.querySelector(".game-link");
    const option = select.selectedOptions[0];
    if (!option) return;
    link.setAttribute("href", option.value);
    const image = card.querySelector(".thumbnail img");
    if (
      image &&
      option.dataset.thumbnail &&
      image.getAttribute("src") !== option.dataset.thumbnail
    ) {
      image.hidden = false;
      image.src = option.dataset.thumbnail;
    }
    link.setAttribute(
      "aria-label",
      `Open ${card.querySelector(".game-title").textContent.trim()} — ${option.textContent.trim()}`,
    );
  }
  for (const select of selectors) {
    select.hidden = false;
    select.closest(".game-info").querySelector(".model-name").hidden = true;
    select.addEventListener("change", () => syncVersion(select));
    syncVersion(select);
  }
  // Browsers can restore a selected option when returning from a game.
  // Reconcile its destination as well, so the displayed model always opens.
  window.addEventListener("pageshow", () => selectors.forEach(syncVersion));

  for (const img of document.querySelectorAll(".thumbnail img")) {
    const fallback = () => {
      img.hidden = true;
    };
    img.addEventListener("error", fallback);
    img.addEventListener("load", () => {
      img.hidden = false;
    });
    if (img.complete && !img.naturalWidth) fallback();
  }
  document.getElementById("copyright-year").textContent = String(
    new Date().getFullYear(),
  );

  const title = document.getElementById("dynamic-title");
  const titles = [
    "What the Ai",
    "¿Qué la IA?",
    "Quoi l’IA ?",
    "Was die KI?",
    "Cosa l’IA?",
    "O que a IA?",
    "Что за ИИ?",
    "何だAI？",
    "什么AI？",
    "뭐야 AI?",
    "ما ال IA؟",
    "क्या एआई?",
    "Wat de AI?",
    "Vad AI?",
    "Hva AI?",
    "Hvad AI?",
    "Mitä tekoäly?",
    "Co AI?",
    "Ne AI?",
    "Τι το AI;",
    "מה ה-AI?",
  ];
  const segmenter =
    typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
      : null;
  const letters = (text) =>
    segmenter
      ? [...segmenter.segment(text)].map((x) => x.segment)
      : Array.from(text);
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
  motion.addEventListener("change", scheduleTitle);
  document.addEventListener("visibilitychange", scheduleTitle);
  scheduleTitle();
  const logo = document.getElementById("spin-emoji");
  logo.addEventListener("click", (event) => {
    if (motion.matches) return;
    event.preventDefault();
    logo.classList.remove("spin-animation");
    void logo.offsetWidth;
    logo.classList.add("spin-animation");
  });
  logo.addEventListener("animationend", () =>
    logo.classList.remove("spin-animation"),
  );
})();

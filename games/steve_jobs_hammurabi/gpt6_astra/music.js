// Preserve Elysium, the original game's soundtrack. Web Audio gain gives iOS
// the same in-game volume control as desktop, with a media-element fallback.
export function createMusic(audio, button, slider, storage) {
  let context,
    gain,
    started = false,
    enabled = true,
    volume = 0.35;
  try {
    enabled = storage.getItem("hammurabi_astra_muted") !== "true";
    const saved = storage.getItem("hammurabi_astra_volume");
    if (saved !== null && Number.isFinite(Number(saved)))
      volume = Math.max(0, Math.min(1, Number(saved)));
  } catch {}
  function update() {
    button.textContent = enabled ? "Music on" : "Music off";
    button.setAttribute("aria-pressed", String(enabled));
    button.setAttribute("aria-label", enabled ? "Mute music" : "Turn music on");
    slider.value = String(volume);
    audio.muted = !enabled;
    if (gain) gain.gain.setTargetAtTime(volume, context.currentTime, 0.05);
    else audio.volume = volume;
  }
  function prepare() {
    if (context) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      context = new AudioContext();
      gain = context.createGain();
      context.createMediaElementSource(audio).connect(gain);
      gain.connect(context.destination);
      audio.volume = 1;
      gain.gain.value = volume;
    } catch {
      gain = null;
    }
  }
  function start() {
    started = true;
    prepare();
    update();
    if (!enabled || document.hidden) return;
    context?.resume().catch(() => {});
    audio.play().catch(() => {
      button.textContent = "Play music";
    });
  }
  button.addEventListener("click", () => {
    // If playback was blocked, a new gesture should retry, not mute it.
    if (button.textContent === "Play music") {
      enabled = true;
      start();
      return;
    }
    enabled = !enabled;
    try {
      storage.setItem("hammurabi_astra_muted", String(!enabled));
    } catch {}
    if (enabled) start();
    else audio.pause();
    update();
  });
  slider.addEventListener("input", () => {
    volume = Number(slider.value);
    try {
      storage.setItem("hammurabi_astra_volume", String(volume));
    } catch {}
    update();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) audio.pause();
    else if (started && enabled) start();
  });
  update();
  return {
    start,
    chime(kind = "year") {
      if (!enabled || !context || context.state !== "running" || !gain) return;
      const notes =
        kind === "end" ? [220, 277.18, 329.63, 440] : [220, 329.63, 440];
      notes.forEach((frequency, index) => {
        const at = context.currentTime + index * 0.13,
          osc = context.createOscillator(),
          envelope = context.createGain();
        osc.type = "sine";
        osc.frequency.value = frequency;
        envelope.gain.setValueAtTime(0, at);
        envelope.gain.linearRampToValueAtTime(volume * 0.065, at + 0.025);
        envelope.gain.exponentialRampToValueAtTime(0.001, at + 0.75);
        osc.connect(envelope);
        envelope.connect(context.destination);
        osc.start(at);
        osc.stop(at + 0.8);
      });
    },
  };
}

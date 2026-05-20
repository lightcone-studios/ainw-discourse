import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.1", (api) => {
  const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
  const DEFAULT_SPEED = 1;
  const FLAG = "ainwSpeedAttached";

  function buildStrip(audio) {
    const strip = document.createElement("div");
    strip.className = "ainw-speed";

    const label = document.createElement("span");
    label.className = "ainw-speed__label";
    label.textContent = "SPEED";
    strip.appendChild(label);

    const buttons = SPEEDS.map((speed) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ainw-speed__btn";
      btn.dataset.speed = String(speed);
      btn.textContent = `${speed}×`;
      if (speed === DEFAULT_SPEED) {
        btn.classList.add("is-active");
      }
      btn.addEventListener("click", () => {
        audio.playbackRate = speed;
        buttons.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
      });
      strip.appendChild(btn);
      return btn;
    });

    return strip;
  }

  function decorate(postElement) {
    postElement.querySelectorAll("audio").forEach((audio) => {
      if (audio.dataset[FLAG]) {
        return;
      }
      audio.dataset[FLAG] = "true";
      const strip = buildStrip(audio);
      audio.insertAdjacentElement("afterend", strip);
    });
  }

  api.decorateCookedElement(decorate, {
    onlyStream: true,
    id: "ainw-audio-speed",
  });
});

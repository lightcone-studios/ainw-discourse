import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.1", (api) => {
  const JUMP_SPEEDS = [0.75, 1, 1.25, 1.5, 2];
  const MIN_SPEED = 0.5;
  const MAX_SPEED = 2.0;
  const STEP = 0.1;
  const MAJOR_TICK_EVERY = 5; // every 0.5x
  const DEFAULT_SPEED = 1;
  const FLAG = "ainwSpeedAttached";

  function roundToStep(value) {
    const steps = Math.round((value - MIN_SPEED) / STEP);
    const snapped = MIN_SPEED + steps * STEP;
    return Math.round(snapped * 10) / 10;
  }

  function clampSpeed(value) {
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, value));
  }

  function fmtSpeed(value) {
    return `${value.toFixed(2).replace(/\.?0+$/, "")}×`;
  }

  function buildStrip(audio) {
    const strip = document.createElement("div");
    strip.className = "ainw-speed";

    // ── header row: label + live readout ────────────────────────────────
    const header = document.createElement("div");
    header.className = "ainw-speed__header";

    const label = document.createElement("span");
    label.className = "ainw-speed__label";
    label.textContent = "SPEED";
    header.appendChild(label);

    const readout = document.createElement("span");
    readout.className = "ainw-speed__readout";
    readout.textContent = fmtSpeed(DEFAULT_SPEED);
    header.appendChild(readout);

    strip.appendChild(header);

    // ── jump buttons ────────────────────────────────────────────────────
    const buttonRow = document.createElement("div");
    buttonRow.className = "ainw-speed__buttons";

    const jumpButtons = JUMP_SPEEDS.map((speed) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ainw-speed__btn";
      btn.dataset.speed = String(speed);
      btn.textContent = fmtSpeed(speed);
      btn.addEventListener("click", () => setSpeed(speed));
      buttonRow.appendChild(btn);
      return btn;
    });
    strip.appendChild(buttonRow);

    // ── tick-strip dial ────────────────────────────────────────────────
    const dial = document.createElement("div");
    dial.className = "ainw-speed__dial";
    dial.setAttribute("role", "slider");
    dial.setAttribute("aria-label", "Playback speed");
    dial.setAttribute("aria-valuemin", String(MIN_SPEED));
    dial.setAttribute("aria-valuemax", String(MAX_SPEED));
    dial.setAttribute("aria-valuenow", String(DEFAULT_SPEED));
    dial.tabIndex = 0;

    const track = document.createElement("div");
    track.className = "ainw-speed__track";
    dial.appendChild(track);

    const totalSteps = Math.round((MAX_SPEED - MIN_SPEED) / STEP);
    for (let i = 0; i <= totalSteps; i++) {
      const tick = document.createElement("span");
      const isMajor = i % MAJOR_TICK_EVERY === 0;
      tick.className = isMajor
        ? "ainw-speed__tick ainw-speed__tick--major"
        : "ainw-speed__tick";
      tick.style.left = `${(i / totalSteps) * 100}%`;
      tick.dataset.speed = String(
        Math.round((MIN_SPEED + i * STEP) * 10) / 10
      );
      if (isMajor) {
        const tickLabel = document.createElement("span");
        tickLabel.className = "ainw-speed__tick-label";
        tickLabel.textContent = (MIN_SPEED + i * STEP).toFixed(1);
        tick.appendChild(tickLabel);
      }
      track.appendChild(tick);
    }

    const thumb = document.createElement("div");
    thumb.className = "ainw-speed__thumb";
    track.appendChild(thumb);

    strip.appendChild(dial);

    // ── state syncing ──────────────────────────────────────────────────
    let currentSpeed = DEFAULT_SPEED;

    function positionThumb(speed) {
      const pct = ((speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100;
      thumb.style.left = `${pct}%`;
    }

    function setSpeed(rawSpeed) {
      const speed = roundToStep(clampSpeed(rawSpeed));
      currentSpeed = speed;
      audio.playbackRate = speed;
      readout.textContent = fmtSpeed(speed);
      positionThumb(speed);
      dial.setAttribute("aria-valuenow", String(speed));
      jumpButtons.forEach((b) => {
        const matches = Math.abs(parseFloat(b.dataset.speed) - speed) < 0.001;
        b.classList.toggle("is-active", matches);
      });
    }

    // ── drag/click on the track ────────────────────────────────────────
    function speedFromPointer(clientX) {
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, (clientX - rect.left) / rect.width)
      );
      return MIN_SPEED + ratio * (MAX_SPEED - MIN_SPEED);
    }

    let dragging = false;

    function onPointerMove(e) {
      if (!dragging) {
        return;
      }
      setSpeed(speedFromPointer(e.clientX));
    }

    function onPointerUp() {
      dragging = false;
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    }

    track.addEventListener("pointerdown", (e) => {
      dragging = true;
      setSpeed(speedFromPointer(e.clientX));
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    });

    // ── keyboard ───────────────────────────────────────────────────────
    dial.addEventListener("keydown", (e) => {
      let next = currentSpeed;
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowDown":
          next = currentSpeed - STEP;
          break;
        case "ArrowRight":
        case "ArrowUp":
          next = currentSpeed + STEP;
          break;
        case "Home":
          next = MIN_SPEED;
          break;
        case "End":
          next = MAX_SPEED;
          break;
        default:
          return;
      }
      e.preventDefault();
      setSpeed(next);
    });

    // initialize position
    setSpeed(DEFAULT_SPEED);

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

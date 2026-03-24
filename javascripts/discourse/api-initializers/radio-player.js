import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.1", (api) => {
  const STREAM_URL =
    "https://radio.ainorthwest.org/listen/ai_northwest_radio/radio.mp3";
  const API_URL = "https://radio.ainorthwest.org/api/nowplaying";
  const POLL_INTERVAL = 15000;
  const BAR_COLORS = ["#9EB83B", "#5dcaa5", "#38BDF8", "#c478ff", "#F59E0B"];

  let audio = null;
  let audioCtx = null;
  let analyser = null;
  let source = null;
  let isPlaying = false;
  let pollTimer = null;
  let animFrame = null;
  let canvas = null;
  let canvasCtx = null;
  let playerBar = null;

  function mk(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function insertPlayer(bar) {
    const catBar = document.querySelector(".ainw-cat-bar");
    if (catBar && catBar.parentNode) {
      catBar.parentNode.insertBefore(bar, catBar.nextSibling);
    }
  }

  function ensurePlayer() {
    // Already in the DOM in the right spot
    if (playerBar && document.body.contains(playerBar)) return;

    // Already built but Ember removed it — re-insert
    if (playerBar) {
      insertPlayer(playerBar);
      return;
    }

    // First time — build the element
    createPlayer();
  }

  function createPlayer() {
    const bar = mk("div");
    bar.id = "ainw-radio";

    // Play toggle
    const toggle = mk("button", "ainw-radio__toggle");
    toggle.setAttribute("aria-label", "Play radio");
    const icon = mk("span", "ainw-radio__icon", "\u25B6");
    toggle.appendChild(icon);

    // Visualizer canvas
    canvas = document.createElement("canvas");
    canvas.className = "ainw-radio__viz";
    canvas.height = 48;
    canvasCtx = canvas.getContext("2d");

    // Info overlay (sits on top of canvas)
    const info = mk("div", "ainw-radio__info");
    const label = mk("span", "ainw-radio__label", "AINW RADIO");
    const nowPlaying = mk("span", "ainw-radio__now-playing", "\u2014");
    info.appendChild(label);
    info.appendChild(nowPlaying);

    // Volume
    const controls = mk("div", "ainw-radio__controls");
    const volume = document.createElement("input");
    volume.type = "range";
    volume.className = "ainw-radio__volume";
    volume.min = "0";
    volume.max = "100";
    volume.value = "70";
    volume.setAttribute("aria-label", "Volume");
    controls.appendChild(volume);

    bar.appendChild(toggle);
    bar.appendChild(canvas);
    bar.appendChild(info);
    bar.appendChild(controls);

    insertPlayer(bar);
    playerBar = bar;

    // Size canvas to fill available space
    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * (window.devicePixelRatio || 1);
      canvas.height = rect.height * (window.devicePixelRatio || 1);
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    toggle.addEventListener("click", () => {
      if (isPlaying) {
        stopPlayback(icon, nowPlaying, bar);
      } else {
        startPlayback(icon, nowPlaying, bar, volume);
      }
    });

    volume.addEventListener("input", () => {
      if (audio) audio.volume = volume.value / 100;
    });

    fetchNowPlaying(nowPlaying);
  }

  function startPlayback(icon, nowPlaying, bar, volume) {
    audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.volume = volume.value / 100;

    audio.addEventListener("error", () => {
      nowPlaying.textContent = "offline";
      icon.textContent = "\u25B6";
      isPlaying = false;
      bar.classList.remove("ainw-radio--playing");
      stopViz();
    });

    audio.src = STREAM_URL;
    audio.play().then(() => {
      icon.textContent = "\u25A0";
      isPlaying = true;
      bar.classList.add("ainw-radio--playing");
      fetchNowPlaying(nowPlaying);
      pollTimer = setInterval(() => fetchNowPlaying(nowPlaying), POLL_INTERVAL);
      startViz();
    }).catch(() => {
      nowPlaying.textContent = "offline";
    });
  }

  function stopPlayback(icon, nowPlaying, bar) {
    if (audio) {
      audio.pause();
      audio.src = "";
      audio = null;
    }
    source = null;
    icon.textContent = "\u25B6";
    isPlaying = false;
    bar.classList.remove("ainw-radio--playing");
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    stopViz();
  }

  function startViz() {
    if (!audio) return;

    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (!source) {
        source = audioCtx.createMediaElementSource(audio);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
      }
      drawViz();
    } catch (e) {
      // CORS or browser restriction — draw idle animation instead
      drawIdleViz();
    }
  }

  function stopViz() {
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
    if (canvasCtx && canvas) {
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawViz() {
    if (!analyser || !canvasCtx || !canvas) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
      if (!isPlaying) return;
      animFrame = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      const w = canvas.width;
      const h = canvas.height;
      canvasCtx.clearRect(0, 0, w, h);

      const barCount = Math.min(bufferLength, Math.floor(w / 3));
      const barWidth = w / barCount;
      const gap = 1;

      for (let i = 0; i < barCount; i++) {
        const val = dataArray[i] / 255;
        const barH = val * h * 0.9;
        const x = i * barWidth;
        const color = BAR_COLORS[i % BAR_COLORS.length];

        canvasCtx.fillStyle = color;
        canvasCtx.globalAlpha = 0.3 + val * 0.7;
        canvasCtx.fillRect(x + gap, h - barH, barWidth - gap * 2, barH);
      }
      canvasCtx.globalAlpha = 1;
    }

    draw();
  }

  function drawIdleViz() {
    // Fallback when Web Audio can't connect (CORS)
    let tick = 0;

    function draw() {
      if (!isPlaying) return;
      animFrame = requestAnimationFrame(draw);

      const w = canvas.width;
      const h = canvas.height;
      canvasCtx.clearRect(0, 0, w, h);

      const barCount = Math.floor(w / 4);
      const barWidth = w / barCount;

      for (let i = 0; i < barCount; i++) {
        const val =
          0.15 +
          0.15 * Math.sin((tick + i * 8) * 0.04) +
          0.1 * Math.sin((tick + i * 3) * 0.07);
        const barH = val * h;
        const color = BAR_COLORS[i % BAR_COLORS.length];

        canvasCtx.fillStyle = color;
        canvasCtx.globalAlpha = 0.25 + val * 0.4;
        canvasCtx.fillRect(
          i * barWidth + 1,
          h - barH,
          barWidth - 2,
          barH
        );
      }
      canvasCtx.globalAlpha = 1;
      tick++;
    }

    draw();
  }

  function fetchNowPlaying(el) {
    fetch(API_URL)
      .then((r) => r.json())
      .then((data) => {
        const stations = Array.isArray(data) ? data : [data];
        const station = stations[0];
        if (!station) return;
        const song = station.now_playing && station.now_playing.song;
        if (song && song.title) {
          el.textContent = song.artist
            ? song.artist + " \u2014 " + song.title
            : song.title;
        } else {
          el.textContent = "\u2014";
        }
      })
      .catch(() => {
        el.textContent = "\u2014";
      });
  }

  // Wait a tick on each page change for Ember to finish rendering,
  // then ensure the player is in the DOM after .ainw-cat-bar
  api.onPageChange(() => {
    setTimeout(ensurePlayer, 150);
  });
});

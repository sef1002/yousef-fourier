// ===== Canvas + DOM setup =====
const canvas = document.getElementById('plot');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// Spectrum canvas
const spectrumCanvas = document.getElementById('spectrum');
let sctx = null;
let SWIDTH = 0;
let SHEIGHT = 0;
if (spectrumCanvas) {
  sctx = spectrumCanvas.getContext('2d');
  SWIDTH = spectrumCanvas.width;
  SHEIGHT = spectrumCanvas.height;
}

const waveformSelect = document.getElementById('waveform-select');
const termsSlider = document.getElementById('terms-slider');
const termsLabel = document.getElementById('terms-label');
const speedSlider = document.getElementById('speed-slider');
const speedLabel = document.getElementById('speed-label');
const spectrumToggle = document.getElementById('spectrum-toggle');
const playButton = document.getElementById('play-button');
const downloadBtn = document.getElementById('download-btn');

const harmonicCheckboxes = document.querySelectorAll('#harmonics-checkboxes input[type="checkbox"]');
const resetHarmonicsBtn = document.getElementById('reset-harmonics');

// animation state
let playing = false;
let playTimeoutId = null;

// harmonic control
const MAX_HARMONICS = 50;
const harmonicEnabled = [];
for (let n = 0; n <= MAX_HARMONICS; n++) {
  harmonicEnabled[n] = true; // 0 unused, 1..50 true by default
}

// initialise from checkboxes (first 10)
harmonicCheckboxes.forEach(cb => {
  const n = parseInt(cb.dataset.n, 10);
  harmonicEnabled[n] = cb.checked;
  cb.addEventListener('change', () => {
    harmonicEnabled[n] = cb.checked;
    draw();
  });
});

if (resetHarmonicsBtn) {
  resetHarmonicsBtn.addEventListener('click', () => {
    for (let n = 1; n <= MAX_HARMONICS; n++) {
      harmonicEnabled[n] = true;
    }
    harmonicCheckboxes.forEach(cb => {
      cb.checked = true;
    });
    draw();
  });
}

// ===== Sample points (x in [-π, π]) =====
const NUM_POINTS = 800;
const xs = [];
for (let i = 0; i < NUM_POINTS; i++) {
  const t = i / (NUM_POINTS - 1);
  xs.push(-Math.PI + t * 2 * Math.PI);
}

// ===== Ideal waveforms =====
function idealSquare(x) {
  return x >= 0 ? 1 : -1;
}

function idealSawtooth(x) {
  // target for f_N(x) = -2/π Σ sin(nx)/n, with jumps at 0
  if (x < 0) {
    return 1 + x / Math.PI;   // from 0 at -π to 1 at 0-
  } else if (x > 0) {
    return -1 + x / Math.PI;  // from -1 at 0+ to 0 at π
  } else {
    return 0;                 // midpoint of jump
  }
}

function idealTriangle(x) {
  // 2π-periodic odd triangle wave on (-π, π):
  // zeros at -π, 0, π and ±1 at ±π/2
  if (x < -Math.PI / 2) {
    const x1 = -Math.PI,     y1 = 0;
    const x2 = -Math.PI / 2, y2 = -1;
    return y1 + (y2 - y1) * (x - x1) / (x2 - x1);
  } else if (x < 0) {
    const x1 = -Math.PI / 2, y1 = -1;
    const x2 = 0,            y2 = 0;
    return y1 + (y2 - y1) * (x - x1) / (x2 - x1);
  } else if (x < Math.PI / 2) {
    const x1 = 0,            y1 = 0;
    const x2 = Math.PI / 2,  y2 = 1;
    return y1 + (y2 - y1) * (x - x1) / (x2 - x1);
  } else {
    const x1 = Math.PI / 2,  y1 = 1;
    const x2 = Math.PI,      y2 = 0;
    return y1 + (y2 - y1) * (x - x1) / (x2 - x1);
  }
}

// ===== Fourier coefficients (sin-only) =====
function fourierCoeff(waveform, n) {
  if (waveform === 'square') {
    // only odd harmonics
    if (n % 2 === 1) return 4 / (Math.PI * n);
    return 0;
  } else if (waveform === 'sawtooth') {
    // all harmonics
    return -2 / (Math.PI * n);
  } else if (waveform === 'triangle') {
    // odd harmonics, ~1/n^2 with alternating sign
    if (n % 2 === 1) {
      const k = (n - 1) / 2;
      const sign = (k % 2 === 0) ? 1 : -1;
      return sign * 8 / (Math.PI * Math.PI * n * n);
    }
    return 0;
  }
  return 0;
}

// Approximation using harmonicEnabled and coefficients
function fourierApprox(x, waveform, N) {
  let sum = 0;
  const maxN = Math.min(N, MAX_HARMONICS);
  for (let n = 1; n <= maxN; n++) {
    if (!harmonicEnabled[n]) continue;
    const c = fourierCoeff(waveform, n);
    if (c === 0) continue;
    sum += c * Math.sin(n * x);
  }
  return sum;
}

// ===== Coordinate transform =====
function toCanvas(x, y) {
  // x in [-π, π] → [0, WIDTH]
  const cx = (x + Math.PI) / (2 * Math.PI) * WIDTH;
  // y ~ [-1.5, 1.5] → [0, HEIGHT], flipped
  const cy = HEIGHT * (0.5 - y / 3);
  return { cx, cy };
}

// ===== Time-domain draw =====
function draw() {
  const waveform = waveformSelect.value;
  const N = parseInt(termsSlider.value, 10);
  termsLabel.textContent = N;

  const ideal = [];
  const approx = [];

  for (const x of xs) {
    let fi, fa;

    if (waveform === 'square') {
      fi = idealSquare(x);
    } else if (waveform === 'sawtooth') {
      fi = idealSawtooth(x);
    } else {
      fi = idealTriangle(x);
    }
    fa = fourierApprox(x, waveform, N);

    ideal.push({ x, y: fi });
    approx.push({ x, y: fa });
  }

  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // x-axis (y=0)
  ctx.strokeStyle = '#bbbbbb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  let { cx: ax0, cy: ay0 } = toCanvas(xs[0], 0);
  ctx.moveTo(ax0, ay0);
  for (const x of xs) {
    const { cx, cy } = toCanvas(x, 0);
    ctx.lineTo(cx, cy);
  }
  ctx.stroke();

  // Legend
  ctx.font = '14px Arial';
  ctx.fillStyle = '#cc0000';
  ctx.fillText('Ideal waveform (target)', 10, 20);
  ctx.fillStyle = '#0055ff';
  ctx.fillText('Fourier approximation', 10, 40);

  // Approximation curve
  ctx.strokeStyle = '#0055ff';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  let first = true;
  for (const p of approx) {
    const { cx, cy } = toCanvas(p.x, p.y);
    if (first) {
      ctx.moveTo(cx, cy);
      first = false;
    } else {
      ctx.lineTo(cx, cy);
    }
  }
  ctx.stroke();

  // Ideal waveform
  ctx.strokeStyle = '#cc0000';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  first = true;
  for (const p of ideal) {
    const { cx, cy } = toCanvas(p.x, p.y);
    if (first) {
      ctx.moveTo(cx, cy);
      first = false;
    } else {
      ctx.lineTo(cx, cy);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Spectrum
  if (sctx && spectrumToggle && spectrumToggle.checked) {
    drawSpectrum(waveform, N);
  } else {
    clearSpectrum();
  }
}

// ===== Spectrum drawing =====
function clearSpectrum() {
  if (!sctx) return;
  sctx.clearRect(0, 0, SWIDTH, SHEIGHT);
}

function drawSpectrum(waveform, N) {
  if (!sctx) return;

  clearSpectrum();

  const maxHarmonics = Math.min(N, 25);
  const amps = [];
  for (let n = 1; n <= maxHarmonics; n++) {
    if (!harmonicEnabled[n]) {
      amps.push(0);
      continue;
    }
    const c = fourierCoeff(waveform, n);
    amps.push(Math.abs(c));
  }

  const maxAmp = Math.max(...amps, 1e-6);

  // axes
  sctx.strokeStyle = '#bbbbbb';
  sctx.lineWidth = 1;
  sctx.beginPath();
  sctx.moveTo(40, SHEIGHT - 30);
  sctx.lineTo(SWIDTH - 10, SHEIGHT - 30);
  sctx.moveTo(40, 10);
  sctx.lineTo(40, SHEIGHT - 30);
  sctx.stroke();

  sctx.font = '12px Arial';
  sctx.fillStyle = '#333';
  sctx.fillText('Harmonic index n', SWIDTH / 2 - 50, SHEIGHT - 10);
  sctx.save();
  sctx.translate(10, SHEIGHT / 2 + 20);
  sctx.rotate(-Math.PI / 2);
  sctx.fillText('Amplitude |c_n|', 0, 0);
  sctx.restore();

  const plotWidth = SWIDTH - 60;
  const plotHeight = SHEIGHT - 50;
  const barWidth = plotWidth / (maxHarmonics + 1);

  for (let i = 0; i < maxHarmonics; i++) {
    const n = i + 1;
    const amp = amps[i];
    const normalized = amp / maxAmp;
    const barHeight = normalized * (plotHeight * 0.9);

    const x = 40 + (i + 0.5) * barWidth;
    const y = SHEIGHT - 30 - barHeight;

    sctx.fillStyle = harmonicEnabled[n] ? '#0055ff' : '#cccccc';
    sctx.fillRect(x - barWidth * 0.4, y, barWidth * 0.8, barHeight);

    if (n === 1 || n % 5 === 0) {
      sctx.fillStyle = '#333';
      sctx.fillText(String(n), x - 4, SHEIGHT - 15);
    }
  }
}

// ===== Play / Pause =====
function togglePlay() {
  playing = !playing;

  if (playing) {
    playButton.textContent = 'Pause';
    advanceFrame();
  } else {
    playButton.textContent = 'Play';
    if (playTimeoutId !== null) {
      clearTimeout(playTimeoutId);
      playTimeoutId = null;
    }
  }
}

function advanceFrame() {
  if (!playing) return;

  let N = parseInt(termsSlider.value, 10);
  const maxN = parseInt(termsSlider.max, 10);
  const speed = parseInt(speedSlider.value, 10);

  N = (N % maxN) + 1;
  termsSlider.value = N;
  draw();

  playTimeoutId = setTimeout(advanceFrame, speed);
}

// ===== Download =====
function downloadImage() {
  const link = document.createElement('a');
  link.download = 'fourier_visualization.png';
  link.href = canvas.toDataURL();
  link.click();
}

// ===== Events =====
waveformSelect.addEventListener('change', draw);
termsSlider.addEventListener('input', draw);
speedSlider.addEventListener('input', () => {
  speedLabel.textContent = speedSlider.value;
});
if (spectrumToggle) {
  spectrumToggle.addEventListener('change', draw);
}
playButton.addEventListener('click', togglePlay);
downloadBtn.addEventListener('click', downloadImage);

// Init
speedLabel.textContent = speedSlider.value;
draw();
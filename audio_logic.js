document.addEventListener('DOMContentLoaded', () => {

  const soundToggle = document.getElementById('soundToggle');
  const heroSection = document.querySelector('.hero');
  if (!soundToggle) { console.warn('soundToggle not found'); return; }

  let audioCtx;
  let isPlaying = false;

  // Each color profile maps to a frequency and the CSS class of its blobs
  const colorProfiles = {
    'dark-teal': { freq: 130.81, type: 'sine',     blobs: ['.blob-teal'],     pan: -0.5 },
    'orange':    { freq: 329.63, type: 'triangle',  blobs: ['.blob-orange'],   pan:  0.5 },
    'lavender':  { freq: 440.00, type: 'sine',      blobs: ['.blob-lavender'], pan:  0.8 },
    'yellow':    { freq: 659.25, type: 'square',    blobs: ['.blob-yellow'],   pan: -0.8 },
    'pink':      { freq: 220.00, type: 'sine',      blobs: ['.blob-pink'],     pan:  0.0 },
  };

  const synths = {};

  function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.connect(audioCtx.destination);

    const masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(compressor);

    for (const [key, profile] of Object.entries(colorProfiles)) {
      const osc    = audioCtx.createOscillator();
      const gain   = audioCtx.createGain();
      const panner = audioCtx.createStereoPanner();

      osc.type            = profile.type;
      osc.frequency.value = profile.freq;
      gain.gain.value     = 0;
      panner.pan.value    = profile.pan || 0;

      // For harsher waveforms, add a lowpass filter
      if (profile.type === 'square' || profile.type === 'triangle') {
        const filter = audioCtx.createBiquadFilter();
        filter.type            = 'lowpass';
        filter.frequency.value = profile.type === 'square' ? 800 : 1200;
        osc.connect(filter);
        filter.connect(gain);
      } else {
        osc.connect(gain);
      }
      gain.connect(panner);
      panner.connect(masterGain);
      osc.start();

      // Collect all DOM elements for this color (multiple paths per color)
      const blobEls = profile.blobs.flatMap(sel =>
        Array.from(document.querySelectorAll(sel))
      );

      synths[key] = { osc, gain, blobEls };
    }
  }

  function toggleSound() {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    isPlaying = !isPlaying;
    soundToggle.innerText         = isPlaying ? 'Sound: On'  : 'Sound: Off';
    soundToggle.style.background  = isPlaying ? '#06212C'    : 'none';
    soundToggle.style.color       = isPlaying ? '#FFFBF4'    : '#06212C';

    if (!isPlaying) {
      for (const key in synths) {
        synths[key].gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
      }
    }
  }

  soundToggle.addEventListener('click', e => {
    e.stopPropagation();
    toggleSound();
  });

  if (heroSection) {
    heroSection.addEventListener('click', e => {
      if (e.target.closest('nav') || e.target.closest('button') || e.target.closest('a')) return;
      toggleSound();
    });
  }

  // ── SOUND: proximity of mouse to each color group ──
  document.addEventListener('mousemove', e => {
    if (!isPlaying || !audioCtx) return;

    const maxDist = window.innerWidth * 0.35;

    for (const [key, synth] of Object.entries(synths)) {
      let minDist = Infinity;

      synth.blobEls.forEach(el => {
        const r  = el.getBoundingClientRect();
        const cx = r.left + r.width  / 2;
        const cy = r.top  + r.height / 2;
        const d  = Math.hypot(e.clientX - cx, e.clientY - cy);
        if (d < minDist) minDist = d;
      });

      // Fall off sharply — must be close to a shape to hear it
      let vol = Math.max(0, 1 - minDist / maxDist);
      vol = Math.pow(vol, 2.0) * 0.6;
      synth.gain.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.08);
    }
  });

  // ── TITLE COLOR: shifts toward nearest blob color on mousemove ──
  const titleH1 = document.querySelector('.hero h1');
  const allBlobEls = Array.from(document.querySelectorAll('.svg-blob, .hero-top-info'));

  const blobColorsMap = {
    'blob-teal':     '#063F42',
    'blob-orange':   '#F66A58',
    'blob-lavender': '#B668DC',
    'blob-yellow':   '#E4DC35',
    'blob-pink':     '#F06C78',
    'hero-top-info': '#F66A58',
  };

  let currentRGB = [255, 251, 244];
  let targetRGB  = [255, 251, 244];
  let animating  = false;

  function hexToRgb(hex) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
  }
  function rgbToHex(rgb) {
    return '#' + rgb.map(Math.round).map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function animateColor() {
    let diff = 0;
    for (let i = 0; i < 3; i++) {
      currentRGB[i] += (targetRGB[i] - currentRGB[i]) * 0.02;
      diff += Math.abs(targetRGB[i] - currentRGB[i]);
    }
    if (titleH1) titleH1.style.setProperty('--blob-color', rgbToHex(currentRGB));
    if (diff > 1) requestAnimationFrame(animateColor);
    else animating = false;
  }

  if (titleH1) {
    document.addEventListener('mousemove', e => {
      // Update CSS vars for gradient position
      const r = titleH1.getBoundingClientRect();
      const x = Math.max(-50, Math.min(150, ((e.clientX - r.left) / r.width)  * 100));
      const y = Math.max(-50, Math.min(150, ((e.clientY - r.top)  / r.height) * 100));
      titleH1.style.setProperty('--mouse-x', `${x}%`);
      titleH1.style.setProperty('--mouse-y', `${y}%`);

      // Find nearest blob color
      let minScore    = Infinity;
      let closestHex  = '#FFFBF4';

      allBlobEls.forEach(blob => {
        const br = blob.getBoundingClientRect();
        let cx = br.left + br.width  / 2;
        let cy = br.top  + br.height / 2;
        let radius = (br.width + br.height) / 4;

        if (blob.classList.contains('hero-top-info')) {
          cx     = br.left + br.width * 0.78;
          radius = br.width * 1.5;
        }

        const score = Math.hypot(e.clientX - cx, e.clientY - cy) / radius;
        if (score < minScore) {
          minScore = score;
          const cls = Array.from(blob.classList).find(c => blobColorsMap[c]);
          if (cls) closestHex = blobColorsMap[cls];
        }
      });

      const next = hexToRgb(closestHex);
      if (next.join() !== targetRGB.join()) {
        targetRGB = next;
        if (!animating) { animating = true; requestAnimationFrame(animateColor); }
      }
    });
  }

}); // end DOMContentLoaded

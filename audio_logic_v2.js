document.addEventListener('DOMContentLoaded', () => {

  const soundToggle = document.getElementById('soundToggle');
  const heroSection = document.querySelector('.hero');
  if (!soundToggle) { console.warn('soundToggle not found'); return; }

  let audioCtx;
  let isPlaying = false;
  const synths  = {};

  // ── FOREST SYNTH  →  teal blobs ──
  // Reference recording analysis: dominant energy 400–800 Hz, amplitude CV ~0.49
  // (overlapping bird songs, no strong periodicity) → continuous low-pitched bird chorus.
  function initForest(ctx, bus) {
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(bus);

    // Voiced bird note: sine carrier + fast FM warble + natural pitch glide
    function voicedNote(freq, startTime, dur, vol) {
      const osc    = ctx.createOscillator();
      const modOsc = ctx.createOscillator();
      const modDep = ctx.createGain();
      const g      = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 0.92, startTime);
      osc.frequency.linearRampToValueAtTime(freq * 1.06, startTime + dur * 0.45);
      osc.frequency.linearRampToValueAtTime(freq * 0.98, startTime + dur);

      // Warble (12–18 Hz) gives organic bird quality
      modOsc.frequency.value = 12 + Math.random() * 6;
      modDep.gain.value      = freq * 0.025;
      modOsc.connect(modDep);
      modDep.connect(osc.frequency);

      g.gain.setValueAtTime(0,   startTime);
      g.gain.linearRampToValueAtTime(vol,  startTime + Math.min(0.03, dur * 0.2));
      g.gain.setValueAtTime(vol,           startTime + dur - 0.04);
      g.gain.linearRampToValueAtTime(0,    startTime + dur);

      osc.connect(g);
      g.connect(gainNode);

      osc.start(startTime);    osc.stop(startTime + dur + 0.01);
      modOsc.start(startTime); modOsc.stop(startTime + dur + 0.01);
    }

    // Short melodic phrase — 2–5 notes in quick sequence (one bird sentence)
    function phrase() {
      const base     = 420 + Math.random() * 360;   // 420–780 Hz (matches reference)
      const numNotes = 2 + Math.floor(Math.random() * 4);
      const noteDur  = 0.07 + Math.random() * 0.13; // 70–200 ms per note
      const gap      = 0.015 + Math.random() * 0.04;
      const vol      = 0.13 + Math.random() * 0.07;

      for (let i = 0; i < numNotes; i++) {
        const t    = ctx.currentTime + i * (noteDur + gap);
        // Each note pitches up or down relative to previous (melodic contour)
        const step = (Math.random() - 0.45) * 0.18;
        const freq = base * Math.pow(1 + step, i);
        voicedNote(Math.max(350, Math.min(900, freq)), t, noteDur, vol);
      }
    }

    // Long warbling phrase — single note that glides and wobbles (thrush-like)
    function warble() {
      const base = 480 + Math.random() * 280;
      const dur  = 0.35 + Math.random() * 0.55;
      voicedNote(base, ctx.currentTime, dur, 0.12 + Math.random() * 0.06);
    }

    // Rapid trill between two pitches (wren-like, still 400–700 Hz)
    function trill() {
      const base  = 420 + Math.random() * 250;
      const step  = 1.08 + Math.random() * 0.08;
      const steps = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < steps; i++) {
        const t    = ctx.currentTime + i * 0.065;
        const freq = i % 2 === 0 ? base : base * step;
        voicedNote(freq, t, 0.055, 0.10 + Math.random() * 0.05);
      }
    }

    let birdTimer = null;

    function scheduleBird() {
      if (!isPlaying) return;
      // Short gaps (80–500 ms) → overlapping phrases, like a real bird chorus
      const wait = 80 + Math.random() * 420;
      birdTimer = setTimeout(() => {
        if (!isPlaying) return;
        const r = Math.random();
        if      (r < 0.45) phrase();
        else if (r < 0.75) warble();
        else               trill();
        scheduleBird();
      }, wait);
    }

    return {
      gain:       gainNode,
      startBirds() { if (!birdTimer) scheduleBird(); },
      stopBirds()  { clearTimeout(birdTimer); birdTimer = null; },
    };
  }

  // ── RECORDED CHAT AUDIO  →  yellow + lavender blobs ──
  // Loads people_chatting.m4a and loops it silently. Volume is controlled
  // entirely by the proximity system — no oscillators or synthesis involved.
  function initChatFile(ctx, bus) {
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(bus);

    fetch('people_chatting.m4a')
      .then(r => r.arrayBuffer())
      .then(ab => ctx.decodeAudioData(ab))
      .then(buffer => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop   = true;
        source.connect(gainNode);
        source.start();
      })
      .catch(e => console.warn('people_chatting.m4a failed to load:', e));

    return { gain: gainNode };
  }

  // ── CHATTER SYNTH  →  yellow blobs (kept for reference, replaced by initChatFile) ──
  // Reference recording: dominant energy 400–500 Hz, continuous (autocorr 0.91–0.94),
  // near-zero above 600 Hz. Six detuned voices, single formant at 390–480 Hz,
  // only very slow swells (0.06–0.13 Hz) — NO syllable-rate LFOs.
  function initChatter(ctx, bus) {
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(bus);

    // Distance lowpass — almost nothing above 600 Hz per recording
    const distLp = ctx.createBiquadFilter();
    distLp.type            = 'lowpass';
    distLp.frequency.value = 580;
    distLp.Q.value         = 0.5;
    distLp.connect(gainNode);

    // Room reverb: two-tap feedback delay
    const delay1 = ctx.createDelay(0.4);  delay1.delayTime.value = 0.09;
    const delay2 = ctx.createDelay(0.4);  delay2.delayTime.value = 0.17;
    const fb     = ctx.createGain();      fb.gain.value = 0.28;
    delay1.connect(delay2);
    delay2.connect(fb);
    fb.connect(delay1);

    const wetGain = ctx.createGain();  wetGain.gain.value = 0.35;
    delay1.connect(wetGain);
    wetGain.connect(distLp);

    const dryBus = ctx.createGain();  dryBus.gain.value = 0.65;
    dryBus.connect(distLp);

    // Six voices: [f0 Hz, formant Hz, slowLfo Hz, dc gain, lfo depth, offset s]
    // DC + slow swell only — no syllable LFO, continuous murmur matching recording
    const voices = [
      { f0: 115, f1: 395, slowHz: 0.062, dc: 0.11, depth: 0.044, offset: 0.0  },
      { f0: 148, f1: 435, slowHz: 0.091, dc: 0.10, depth: 0.040, offset: 1.3  },
      { f0: 172, f1: 470, slowHz: 0.078, dc: 0.12, depth: 0.048, offset: 2.7  },
      { f0: 128, f1: 415, slowHz: 0.110, dc: 0.09, depth: 0.036, offset: 4.1  },
      { f0: 158, f1: 455, slowHz: 0.068, dc: 0.11, depth: 0.044, offset: 5.6  },
      { f0: 138, f1: 390, slowHz: 0.125, dc: 0.10, depth: 0.040, offset: 7.2  },
    ];

    voices.forEach(({ f0, f1, slowHz, dc, depth, offset }) => {
      const t0 = ctx.currentTime + offset;

      // Sawtooth source — vocal cord model
      const srcOsc = ctx.createOscillator();
      srcOsc.type            = 'sawtooth';
      srcOsc.frequency.value = f0;

      // Slow pitch drift (0.18–0.32 Hz, ±2%) — natural intonation wandering
      const driftOsc   = ctx.createOscillator();
      driftOsc.frequency.value = 0.18 + Math.random() * 0.14;
      const driftDepth = ctx.createGain();
      driftDepth.gain.value = f0 * 0.02;
      driftOsc.connect(driftDepth);
      driftDepth.connect(srcOsc.frequency);
      driftOsc.start(t0);

      // Single formant bandpass — 400–480 Hz peak, Q=10
      const formant = ctx.createBiquadFilter();
      formant.type            = 'bandpass';
      formant.frequency.value = f1;
      formant.Q.value         = 10;
      srcOsc.connect(formant);

      // Amplitude: DC offset + very slow swell only
      const vGain = ctx.createGain();
      vGain.gain.value = dc;

      const slowLfo   = ctx.createOscillator();
      slowLfo.type = 'sine';
      slowLfo.frequency.value = slowHz;
      const slowDepth = ctx.createGain();
      slowDepth.gain.value = depth;
      slowLfo.connect(slowDepth);
      slowDepth.connect(vGain.gain);
      slowLfo.start(t0);

      formant.connect(vGain);
      vGain.connect(dryBus);
      vGain.connect(delay1);

      srcOsc.start(t0);
    });

    return { gain: gainNode };
  }

  // ── OUTDOOR CROWD SYNTH  →  lavender blobs ──
  // Outdoor crowd: overlapping voices in indistinguishable languages, women
  // laughing, kids. 10 voices (male 110-180 Hz + female 190-260 Hz) each with
  // independent syllable-rate AM (2.5-4.3 Hz at different phases) — at 10+
  // voices the individual rhythms merge into undifferentiated crowd babble.
  // Filtered noise adds consonant texture. Random laughter bursts every 5-12s.
  function initCrowd(ctx, bus) {
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(bus);

    // Outdoor air LPF — slightly more open than indoor crowd
    const airLp = ctx.createBiquadFilter();
    airLp.type            = 'lowpass';
    airLp.frequency.value = 750;
    airLp.Q.value         = 0.5;
    airLp.connect(gainNode);

    // Outdoor reverb: longer delays, less feedback (open space)
    const delay1 = ctx.createDelay(0.5);  delay1.delayTime.value = 0.13;
    const delay2 = ctx.createDelay(0.5);  delay2.delayTime.value = 0.24;
    const fb     = ctx.createGain();      fb.gain.value = 0.18;
    delay1.connect(delay2);
    delay2.connect(fb);
    fb.connect(delay1);

    const wetGain = ctx.createGain();  wetGain.gain.value = 0.28;
    delay1.connect(wetGain);
    wetGain.connect(airLp);

    const dryBus = ctx.createGain();  dryBus.gain.value = 0.72;
    dryBus.connect(airLp);

    // Consonant noise layer — "sh/s/ch" texture of overlapping speech
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop   = true;
    const noiseBp   = ctx.createBiquadFilter();
    noiseBp.type            = 'bandpass';
    noiseBp.frequency.value = 380;
    noiseBp.Q.value         = 1.2;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.03;
    noiseSrc.connect(noiseBp);
    noiseBp.connect(noiseGain);
    noiseGain.connect(dryBus);
    noiseSrc.start();

    // 10 voices: male (110-180 Hz) + female (190-260 Hz) mix
    // syllHz varies per voice so no two voices pulse in sync → babble texture
    const voices = [
      { f0: 115, f1: 320, syllHz: 2.7, slowHz: 0.11, offset: 0.0 },
      { f0: 180, f1: 420, syllHz: 3.6, slowHz: 0.07, offset: 0.6 },
      { f0: 142, f1: 370, syllHz: 3.1, slowHz: 0.16, offset: 1.3 },
      { f0: 225, f1: 480, syllHz: 4.1, slowHz: 0.09, offset: 2.0 },
      { f0: 128, f1: 345, syllHz: 2.5, slowHz: 0.14, offset: 2.7 },
      { f0: 200, f1: 440, syllHz: 3.8, slowHz: 0.10, offset: 3.5 },
      { f0: 158, f1: 395, syllHz: 3.3, slowHz: 0.19, offset: 4.2 },
      { f0: 248, f1: 510, syllHz: 4.3, slowHz: 0.06, offset: 4.9 },
      { f0: 122, f1: 355, syllHz: 2.9, slowHz: 0.13, offset: 5.6 },
      { f0: 210, f1: 460, syllHz: 3.5, slowHz: 0.17, offset: 6.3 },
    ];

    voices.forEach(({ f0, f1, syllHz, slowHz, offset }) => {
      const t0 = ctx.currentTime + offset;

      const osc = ctx.createOscillator();
      osc.type            = 'sawtooth';
      osc.frequency.value = f0;

      // Slow pitch wander — natural intonation drift
      const pitchLfo   = ctx.createOscillator();
      pitchLfo.frequency.value = 0.15 + Math.random() * 0.2;
      const pitchDepth = ctx.createGain();
      pitchDepth.gain.value = f0 * 0.025;
      pitchLfo.connect(pitchDepth);
      pitchDepth.connect(osc.frequency);
      pitchLfo.start(t0);

      // Formant bandpass (Q=7, wider than indoor for outdoor openness)
      const formant = ctx.createBiquadFilter();
      formant.type            = 'bandpass';
      formant.frequency.value = f1;
      formant.Q.value         = 7;
      osc.connect(formant);

      // Amplitude: DC + slow swell + syllable rate (the speech-texture layer)
      const vGain = ctx.createGain();
      vGain.gain.value = 0.07;

      const slowLfo   = ctx.createOscillator();
      slowLfo.frequency.value = slowHz;
      const slowDepth = ctx.createGain();
      slowDepth.gain.value    = 0.025;
      slowLfo.connect(slowDepth);
      slowDepth.connect(vGain.gain);
      slowLfo.start(t0);

      // Syllable rate — key: 10 voices at different rates/phases merge into babble
      const syllLfo   = ctx.createOscillator();
      syllLfo.frequency.value = syllHz;
      const syllDepth = ctx.createGain();
      syllDepth.gain.value    = 0.045;
      syllLfo.connect(syllDepth);
      syllDepth.connect(vGain.gain);
      syllLfo.start(t0);

      formant.connect(vGain);
      vGain.connect(dryBus);
      vGain.connect(delay1);

      osc.start(t0);
    });

    // ── Random laughter bursts ──
    let laughTimer = null;

    function laugh() {
      if (!isPlaying) return;
      const t    = ctx.currentTime;
      const reps = 3 + Math.floor(Math.random() * 3);
      const baseF = 380 + Math.random() * 180;
      for (let i = 0; i < reps; i++) {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.type = 'sine';
        const t1 = t + i * 0.14;
        osc.frequency.setValueAtTime(baseF, t1);
        osc.frequency.linearRampToValueAtTime(baseF * (1.4 + Math.random() * 0.3), t1 + 0.10);
        g.gain.setValueAtTime(0,    t1);
        g.gain.linearRampToValueAtTime(0.10, t1 + 0.03);
        g.gain.linearRampToValueAtTime(0,    t1 + 0.12);
        osc.connect(g);
        g.connect(airLp);
        osc.start(t1);
        osc.stop(t1 + 0.13);
      }
      laughTimer = setTimeout(laugh, 5000 + Math.random() * 7000);
    }

    return {
      gain:        gainNode,
      startCrowd() { if (!laughTimer) laugh(); },
      stopCrowd()  { clearTimeout(laughTimer); laughTimer = null; },
    };
  }

  // ── WIND WHISPER  →  lavender blobs ──
  // White noise → hp(280) → bandpass(1100, Q0.8) → lp(3000) → swellGain → proximityGain → bus
  // swellGain breathes slowly via a smoothed random LFO buffer (no oscillators).
  // proximityGain is what the proximity system fades in/out — the two never interfere.
  function initWind(ctx, bus) {
    // Outer gain — controlled by proximity system
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(bus);

    // Inner gain — natural wind breath swell (always running)
    const swellGain = ctx.createGain();
    swellGain.gain.value = 0.55;
    swellGain.connect(gainNode);

    // White noise buffer (4 s, looped)
    const bufLen = ctx.sampleRate * 4;
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) nd[i] = Math.random() * 2 - 1;
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop   = true;

    // Shape noise into a breathy whisper
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 280; hp.Q.value = 0.5;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.8;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3000; lp.Q.value = 0.5;

    noiseSrc.connect(hp); hp.connect(bp); bp.connect(lp); lp.connect(swellGain);
    noiseSrc.start();

    // Smooth random swell LFO: 30 s buffer, random targets every ~3 s, smoothstepped
    const lfoLen = Math.floor(ctx.sampleRate * 30);
    const lfoBuf = ctx.createBuffer(1, lfoLen, ctx.sampleRate);
    const ld = lfoBuf.getChannelData(0);
    const step = Math.floor(ctx.sampleRate * 3);
    let prev = 0.55, nxt = 0.3 + Math.random() * 0.5;
    for (let i = 0; i < lfoLen; i++) {
      if (i % step === 0 && i > 0) { prev = nxt; nxt = 0.3 + Math.random() * 0.5; }
      const t = (i % step) / step;
      ld[i] = prev + (nxt - prev) * (3*t*t - 2*t*t*t);
    }
    const lfoSrc = ctx.createBufferSource();
    lfoSrc.buffer = lfoBuf;
    lfoSrc.loop   = true;
    // Drive swellGain.gain directly (values 0.3–0.8 already in the buffer)
    lfoSrc.connect(swellGain.gain);
    lfoSrc.start();

    return { gain: gainNode };
  }

  // ── TECH BEEPS SYNTH  →  orange blobs ──
  // R2-D2-style: randomly scheduled chirps, sweeps, warbles, two-tone alerts.
  function initTechBeeps(ctx, bus) {
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(bus);

    let beepTimer = null;

    function note(freq, dur, vol = 0.28) {
      const t   = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'sine';
      osc.connect(g);  g.connect(gainNode);
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol,  t + 0.008);
      g.gain.setValueAtTime(vol,           t + dur - 0.018);
      g.gain.linearRampToValueAtTime(0,    t + dur);
      osc.start(t);  osc.stop(t + dur + 0.01);
    }

    function sweep(f0, f1, dur, vol = 0.24) {
      const t   = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'sine';
      osc.connect(g);  g.connect(gainNode);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.linearRampToValueAtTime(0,   t + dur);
      osc.start(t);  osc.stop(t + dur + 0.01);
    }

    // FM warble: carrier + modulator → classic droid wobble
    function warble() {
      const t      = ctx.currentTime;
      const carr   = 500 + Math.random() * 800;
      const modHz  = 25 + Math.random() * 35;
      const dur    = 0.25 + Math.random() * 0.30;
      const osc    = ctx.createOscillator();
      const modOsc = ctx.createOscillator();
      const modDep = ctx.createGain();
      const g      = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(carr, t);
      osc.frequency.linearRampToValueAtTime(carr * (1.3 + Math.random() * 0.5), t + dur);

      modOsc.frequency.value = modHz;
      modDep.gain.value      = 180 + Math.random() * 120;
      modOsc.connect(modDep);  modDep.connect(osc.frequency);

      osc.connect(g);  g.connect(gainNode);
      g.gain.setValueAtTime(0,    t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      g.gain.setValueAtTime(0.22, t + dur - 0.03);
      g.gain.linearRampToValueAtTime(0,    t + dur);

      modOsc.start(t);  modOsc.stop(t + dur + 0.01);
      osc.start(t);     osc.stop(t + dur + 0.01);
    }

    // Two alternating tones — droid "alert" chirp
    function twoTone() {
      const f0   = 700 + Math.random() * 600;
      const f1   = f0  * (1.25 + Math.random() * 0.3);
      const reps = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < reps; i++) {
        const t   = ctx.currentTime + i * 0.11;
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.type = 'sine';  osc.connect(g);  g.connect(gainNode);
        osc.frequency.value = i % 2 === 0 ? f0 : f1;
        g.gain.setValueAtTime(0,    t);
        g.gain.linearRampToValueAtTime(0.26, t + 0.008);
        g.gain.setValueAtTime(0.26, t + 0.085);
        g.gain.linearRampToValueAtTime(0,    t + 0.10);
        osc.start(t);  osc.stop(t + 0.11);
      }
    }

    function scheduleBeep() {
      if (!isPlaying) return;
      const wait = 280 + Math.random() * 1200;
      beepTimer = setTimeout(() => {
        if (!isPlaying) return;
        const r = Math.random();
        if      (r < 0.25) note(600  + Math.random() * 1400, 0.06 + Math.random() * 0.08);
        else if (r < 0.50) sweep(1800 + Math.random() * 800, 300  + Math.random() * 300, 0.20 + Math.random() * 0.15);
        else if (r < 0.75) warble();
        else               twoTone();
        scheduleBeep();
      }, wait);
    }

    return {
      gain:        gainNode,
      startBeeps() { if (!beepTimer) scheduleBeep(); },
      stopBeeps()  { clearTimeout(beepTimer); beepTimer = null; },
    };
  }

  function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const compressor = audioCtx.createDynamicsCompressor();
    compressor.connect(audioCtx.destination);

    const masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(compressor);

    // Pink — no sound

    // Chatter synth → yellow
    const chatter = initChatter(audioCtx, masterGain);
    synths['yellow'] = {
      gain:    chatter.gain,
      blobEls: Array.from(document.querySelectorAll('.blob-yellow')),
    };

    // people_chatting.m4a → lavender
    const chat = initChatFile(audioCtx, masterGain);
    synths['lavender'] = {
      gain:    chat.gain,
      blobEls: Array.from(document.querySelectorAll('.blob-lavender')),
    };

    // Forest → teal
    const forest = initForest(audioCtx, masterGain);
    synths['teal'] = {
      gain:       forest.gain,
      blobEls:    Array.from(document.querySelectorAll('.blob-teal')),
      startBirds: forest.startBirds,
      stopBirds:  forest.stopBirds,
    };

    // Tech beeps → orange
    const tech = initTechBeeps(audioCtx, masterGain);
    synths['orange'] = {
      gain:        tech.gain,
      blobEls:     Array.from(document.querySelectorAll('.blob-orange')),
      startBeeps:  tech.startBeeps,
      stopBeeps:   tech.stopBeeps,
    };
  }

  // ── TOGGLE ──
  function updateButtonUI(btn, on) {
    if (!btn) return;
    btn.innerText        = on ? 'Sound: On'  : 'Sound: Off';
    btn.style.background = on ? '#06212C'    : 'none';
    btn.style.color      = on ? '#FFFBF4'    : '#06212C';
  }

  function toggleSound() {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    isPlaying = !isPlaying;
    updateButtonUI(soundToggle, isPlaying);
    updateButtonUI(document.getElementById('soundToggleMobile'), isPlaying);

    if (isPlaying) {
      synths['teal']?.startBirds();
      synths['orange']?.startBeeps();
    } else {
      for (const key in synths) {
        synths[key].gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15);
      }
      synths['teal']?.stopBirds();
      synths['orange']?.stopBeeps();
    }
  }

  soundToggle.addEventListener('click', e => { e.stopPropagation(); toggleSound(); });

  if (heroSection) {
    heroSection.addEventListener('click', e => {
      if (e.target.closest('nav') || e.target.closest('button') || e.target.closest('a')) return;
      toggleSound();
    });
  }

  // ── PROXIMITY → volume (exclusive: only the nearest blob group plays) ──
  function updateProximity(clientX, clientY) {
    if (!isPlaying || !audioCtx) return;
    const maxDist = window.innerWidth * 0.22;

    // First pass: measure distance to every group
    const distances = {};
    for (const [key, synth] of Object.entries(synths)) {
      let minDist = Infinity;
      synth.blobEls.forEach(el => {
        const r  = el.getBoundingClientRect();
        const cx = r.left + r.width  / 2;
        const cy = r.top  + r.height / 2;
        const d  = Math.hypot(clientX - cx, clientY - cy);
        if (d < minDist) minDist = d;
      });
      distances[key] = minDist;
    }

    // Find the single closest group
    const closest = Object.entries(distances).reduce((a, b) => a[1] < b[1] ? a : b)[0];

    // Second pass: only the closest group gets volume, all others go silent
    for (const [key, synth] of Object.entries(synths)) {
      let vol = 0;
      if (key === closest && distances[key] < maxDist) {
        vol = Math.pow(Math.max(0, 1 - distances[key] / maxDist), 2.0) * 0.6;
      }
      synth.gain.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.10);
    }
  }

  function silenceAll() {
    if (!audioCtx) return;
    for (const key in synths) {
      synths[key].gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.10);
    }
  }

  document.addEventListener('mousemove', e => updateProximity(e.clientX, e.clientY));

  document.addEventListener('touchmove', e => {
    const t = e.touches[0];
    updateProximity(t.clientX, t.clientY);
  }, { passive: true });

  document.addEventListener('touchend', silenceAll);

  // ── TITLE COLOR: shifts toward nearest blob on mousemove (unchanged) ──
  const titleH1   = document.querySelector('.hero h1');
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
      const r = titleH1.getBoundingClientRect();
      const x = Math.max(-50, Math.min(150, ((e.clientX - r.left) / r.width)  * 100));
      const y = Math.max(-50, Math.min(150, ((e.clientY - r.top)  / r.height) * 100));
      titleH1.style.setProperty('--mouse-x', `${x}%`);
      titleH1.style.setProperty('--mouse-y', `${y}%`);

      let minScore   = Infinity;
      let closestHex = '#FFFBF4';

      allBlobEls.forEach(blob => {
        const br   = blob.getBoundingClientRect();
        let cx     = br.left + br.width  / 2;
        let cy     = br.top  + br.height / 2;
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

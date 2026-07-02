(function () {
  'use strict';

  var TRACKS = [
    { file: 'assets/music/chill.mod', title: 'Chill', format: 'MOD', type: 'tracker' },
    { file: 'assets/music/king.mod', title: 'King', format: 'MOD', type: 'tracker' },
    { file: 'assets/music/sundown.mod', title: 'Sundown', format: 'MOD', type: 'tracker' },
    { file: 'assets/music/ghosts.xm', title: 'Ghosts', format: 'XM', type: 'tracker' },
    { file: 'assets/music/pattern-loop.s3m', title: 'Pattern Loop', format: 'S3M', type: 'tracker' },
    { file: 'assets/music/retro-chiptune.mid', title: 'Retro Keys', format: 'MIDI', type: 'midi' }
  ];

  var trackerPlayer = null;
  var midiSynth = null;
  var midiPart = null;
  var currentIndex = 0;
  var isPlaying = false;
  var isPaused = false;
  var progressTimer = null;
  var openmptReady = false;
  var toneReady = false;
  var initialized = false;

  function pad(num) {
    return num < 10 ? '0' + num : String(num);
  }

  function getElements() {
    return {
      led: document.getElementById('playerLed'),
      trackName: document.getElementById('trackName'),
      formatBadge: document.getElementById('formatBadge'),
      trackPosition: document.getElementById('trackPosition'),
      playlist: document.getElementById('playlist'),
      progressFill: document.getElementById('progressFill'),
      progressBar: document.getElementById('progressBar'),
      visualizer: document.getElementById('visualizer'),
      btnPlay: document.getElementById('btnPlay'),
      btnPause: document.getElementById('btnPause'),
      btnStop: document.getElementById('btnStop'),
      btnPrev: document.getElementById('btnPrev'),
      btnNext: document.getElementById('btnNext')
    };
  }

  function setLed(text) {
    var el = document.getElementById('playerLed');
    if (el) el.textContent = text;
  }

  function setVisualizer(active) {
    var viz = document.getElementById('visualizer');
    if (!viz) return;
    viz.classList.toggle('is-paused', !active);
  }

  function updateProgressUI() {
    var els = getElements();
    var track = TRACKS[currentIndex];
    if (!track) return;

    els.trackName.textContent = track.title;
    els.formatBadge.textContent = track.format;
    els.trackPosition.textContent = pad(currentIndex + 1) + ' / ' + pad(TRACKS.length);

    if (track.type === 'tracker' && trackerPlayer && trackerPlayer.currentPlayingNode) {
      try {
        var current = trackerPlayer.getCurrentTime();
        var total = trackerPlayer.duration();
        if (total > 0) {
          els.progressFill.style.width = Math.min(100, (current / total) * 100) + '%';
        }
      } catch (e) { /* module not loaded yet */ }
    }
  }

  function startProgressLoop() {
    stopProgressLoop();
    progressTimer = setInterval(updateProgressUI, 250);
  }

  function stopProgressLoop() {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  }

  function renderPlaylist() {
    var list = document.getElementById('playlist');
    if (!list) return;
    list.innerHTML = '';

    TRACKS.forEach(function (track, i) {
      var li = document.createElement('li');
      li.className = 'playlist-item' + (i === currentIndex ? ' is-active' : '');
      li.innerHTML =
        '<span class="track-fmt">' + track.format + '</span>' +
        '<span class="track-title">' + track.title + '</span>';
      li.addEventListener('click', function () {
        currentIndex = i;
        renderPlaylist();
        playCurrent();
      });
      list.appendChild(li);
    });
  }

  function initTracker() {
    if (typeof ChiptuneJsPlayer === 'undefined') return;
    trackerPlayer = new ChiptuneJsPlayer(
      new ChiptuneJsConfig(-1, 100, 2, new AudioContext())
    );
    trackerPlayer.onEnded(function () {
      nextTrack();
    });
    trackerPlayer.onError(function () {
      setLed('✕ ERROR');
      isPlaying = false;
      setVisualizer(false);
    });
    openmptReady = true;
  }

  async function initTone() {
    if (typeof Tone === 'undefined') return;
    await Tone.start();
    midiSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.8 }
    }).toDestination();
    midiSynth.volume.value = -8;
    toneReady = true;
  }

  function stopAll() {
    if (trackerPlayer) trackerPlayer.stop();
    if (midiPart) {
      midiPart.stop();
      midiPart.dispose();
      midiPart = null;
    }
    Tone.Transport.stop();
    Tone.Transport.cancel();
    isPlaying = false;
    isPaused = false;
    setVisualizer(false);
    stopProgressLoop();
    var els = getElements();
    if (els.progressFill) els.progressFill.style.width = '0%';
    setLed('■ STOPPED');
  }

  function playTracker(track) {
    if (!openmptReady || !trackerPlayer) {
      setLed('… LOADING');
      return;
    }
    trackerPlayer.load(track.file, function (buffer) {
      trackerPlayer.play(buffer);
      isPlaying = true;
      isPaused = false;
      setLed('▶ ' + track.format);
      setVisualizer(true);
      startProgressLoop();
      renderPlaylist();
    });
  }

  async function playMidi(track) {
    if (!toneReady) await initTone();
    if (typeof Midi === 'undefined') {
      setLed('✕ NO MIDI');
      return;
    }

    var response = await fetch(track.file);
    var arrayBuffer = await response.arrayBuffer();
    var midi = new Midi(arrayBuffer);

    if (midiPart) {
      midiPart.stop();
      midiPart.dispose();
    }

    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.bpm.value = midi.header.tempos[0] ? midi.header.tempos[0].bpm : 120;

    var now = Tone.now();
    midi.tracks.forEach(function (midiTrack) {
      midiTrack.notes.forEach(function (note) {
        midiSynth.triggerAttackRelease(
          note.name,
          note.duration,
          now + note.time,
          note.velocity
        );
      });
    });

    var duration = midi.duration;
    Tone.Transport.schedule(function () {
      if (isPlaying) nextTrack();
    }, now + duration + 0.5);

    Tone.Transport.start();
    isPlaying = true;
    isPaused = false;
    setLed('▶ MIDI');
    setVisualizer(true);
    startProgressLoop();

    var startTime = Date.now();
    function midiProgress() {
      if (!isPlaying || TRACKS[currentIndex].type !== 'midi') return;
      var elapsed = (Date.now() - startTime) / 1000;
      var pct = Math.min(100, (elapsed / duration) * 100);
      var els = getElements();
      if (els.progressFill) els.progressFill.style.width = pct + '%';
      if (elapsed < duration && isPlaying && !isPaused) {
        requestAnimationFrame(midiProgress);
      }
    }
    midiProgress();
    renderPlaylist();
  }

  function playCurrent() {
    stopAll();
    var track = TRACKS[currentIndex];
    if (!track) return;

    if (track.type === 'tracker') {
      playTracker(track);
    } else {
      playMidi(track);
    }
  }

  function togglePause() {
    var track = TRACKS[currentIndex];
    if (!isPlaying) return;

    if (track.type === 'tracker' && trackerPlayer) {
      trackerPlayer.togglePause();
      isPaused = !isPaused;
      setLed(isPaused ? '⏸ PAUSED' : '▶ ' + track.format);
      setVisualizer(!isPaused);
    } else if (track.type === 'midi') {
      if (isPaused) {
        Tone.Transport.start();
        isPaused = false;
        setLed('▶ MIDI');
        setVisualizer(true);
      } else {
        Tone.Transport.pause();
        isPaused = true;
        setLed('⏸ PAUSED');
        setVisualizer(false);
      }
    }
  }

  function nextTrack() {
    currentIndex = (currentIndex + 1) % TRACKS.length;
    renderPlaylist();
    playCurrent();
  }

  function prevTrack() {
    currentIndex = (currentIndex - 1 + TRACKS.length) % TRACKS.length;
    renderPlaylist();
    playCurrent();
  }

  function bindControls() {
    var els = getElements();
    els.btnPlay.addEventListener('click', playCurrent);
    els.btnPause.addEventListener('click', togglePause);
    els.btnStop.addEventListener('click', stopAll);
    els.btnNext.addEventListener('click', nextTrack);
    els.btnPrev.addEventListener('click', prevTrack);

    if (els.progressBar) {
      els.progressBar.addEventListener('click', function () {
        /* seek not supported in chiptune2 — visual only */
      });
    }
  }

  window.SadPhoMusic = {
    init: function () {
      if (initialized) return;
      if (typeof libopenmpt !== 'undefined' && libopenmpt._openmpt_module_create_from_memory) {
        initialized = true;
        initTracker();
        renderPlaylist();
        bindControls();
        setLed('▶ READY');
      }
      initTone();
    },
    unlock: function () {
      if (trackerPlayer) trackerPlayer.unlock();
      if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
        Tone.start();
      }
    }
  };
})();

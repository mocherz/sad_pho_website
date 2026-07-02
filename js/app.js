(function () {
  'use strict';

  var musicPlayer = document.getElementById('musicPlayer');
  var musicIconBtn = document.getElementById('musicIconBtn');
  var playerClose = document.getElementById('playerClose');
  var playerOpen = false;

  function openPlayer() {
    playerOpen = true;
    musicPlayer.hidden = false;
    requestAnimationFrame(function () {
      musicPlayer.classList.add('is-open');
    });
    musicIconBtn.setAttribute('aria-expanded', 'true');
    if (window.SadPhoMusic) window.SadPhoMusic.unlock();
  }

  function closePlayer() {
    playerOpen = false;
    musicPlayer.classList.remove('is-open');
    musicIconBtn.setAttribute('aria-expanded', 'false');
    setTimeout(function () {
      if (!playerOpen) musicPlayer.hidden = true;
    }, 250);
  }

  function togglePlayer() {
    if (playerOpen) {
      closePlayer();
    } else {
      openPlayer();
    }
  }

  musicIconBtn.addEventListener('click', function (e) {
    e.preventDefault();
    togglePlayer();
  });

  playerClose.addEventListener('click', closePlayer);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && playerOpen) closePlayer();
  });

  if (typeof libopenmpt !== 'undefined' && libopenmpt._openmpt_module_create_from_memory) {
    if (window.SadPhoMusic) window.SadPhoMusic.init();
  }
})();
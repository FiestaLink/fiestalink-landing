const music = document.getElementById('bg-music');
const toggle = document.getElementById('music-toggle');
const main = document.querySelector('main');
const sections = document.querySelectorAll('section[data-music]');

let isPlaying = false;
let currentTrack = '';

music.volume = 0.3;

// Play / Pause manual
toggle.addEventListener('click', () => {
  if (!isPlaying) {
    music.play().catch(() => {});
    isPlaying = true;
    toggle.textContent = '🔊';
  } else {
    music.pause();
    isPlaying = false;
    toggle.textContent = '🔈';
  }
});

// Detectar sección visible al hacer scroll
main.addEventListener('scroll', () => {
  sections.forEach(section => {
    const rect = section.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();

    // Si la sección ocupa el centro de la pantalla
    const sectionCenter = rect.top + rect.height / 2;
    const mainCenter = mainRect.top + mainRect.height / 2;

    if (Math.abs(sectionCenter - mainCenter) < rect.height / 2) {
      const newTrack = section.dataset.music;

      if (newTrack && newTrack !== currentTrack) {
        currentTrack = newTrack;
        music.src = newTrack;
        music.load();

        if (isPlaying) {
          music.play().catch(() => {});
        }
      }
    }
  });
});

let startedOnce = false;

function startMusicOnFirstScroll() {
if (!startedOnce) {
  music.play().catch(() => {});
  isPlaying = true;
  toggle.textContent = '🔊';
  startedOnce = true;
  main.removeEventListener('scroll', startMusicOnFirstScroll);
}
}

main.addEventListener('scroll', startMusicOnFirstScroll);

// --- Rotación de imágenes con slide hacia la izquierda ---
const exampleBlocks = document.querySelectorAll('.example');

exampleBlocks.forEach(block => {
const wrap = block.querySelector('.image-wrap');
const imagesAttr = block.dataset.images;

if (!wrap || !imagesAttr) return;

const images = imagesAttr
  .split(',')
  .map(i => i.trim())
  .filter(Boolean);

if (images.length <= 1) return;

let index = 0;

let currentImg = wrap.querySelector('img');

if (!currentImg) return;

currentImg.src = images[0];
currentImg.classList.add('active');

setInterval(() => {
  const nextIndex = (index + 1) % images.length;
  const nextImg = document.createElement('img');
  nextImg.src = images[nextIndex];
  nextImg.classList.add('enter');

  wrap.appendChild(nextImg);

  // Forzar reflow para que la animación funcione
  nextImg.offsetWidth;

  currentImg.classList.add('exit');
  nextImg.classList.remove('enter');
  nextImg.classList.add('active');

  // Limpiar imagen anterior
  setTimeout(() => {
    currentImg.remove();
    currentImg = nextImg;
    index = nextIndex;
  }, 600);

}, 1800);
});

let unlocked = false;

function unlockAudio() {
if (unlocked) return;

music.play().then(() => {
  music.pause();
  unlocked = true;
  console.log('Audio desbloqueado');
}).catch(() => {});

document.removeEventListener('click', unlockAudio);
document.removeEventListener('touchstart', unlockAudio);
}

document.addEventListener('click', unlockAudio);
document.addEventListener('touchstart', unlockAudio);


const inviteBtn = document.querySelector('footer button');
const modal = document.getElementById('invite-modal');
const cancelBtn = modal.querySelector('.cancel');
const sendBtn = document.getElementById('send-whatsapp');
const select = document.getElementById('invite-type');

inviteBtn.addEventListener('click', () => {
modal.classList.remove('hidden');
});

cancelBtn.addEventListener('click', () => {
modal.classList.add('hidden');
});

sendBtn.addEventListener('click', () => {
const value = select.value;
if (!value) {
  alert('Selecciona un tipo de invitación');
  return;
}

// Apagar música antes de salir
music.pause();
music.currentTime = 0;
isPlaying = false;
toggle.textContent = '🔈';

const message = `FiestaLink, me interesa invitación web para ${value}`;
const url = `https://wa.me/5549250538?text=${encodeURIComponent(message)}`;

window.open(url, '_blank');
});

const swipeHint = document.getElementById('swipe-hint');
let swipeHidden = false;

main.addEventListener('scroll', () => {
  if (!swipeHidden && main.scrollTop > 150) {
    swipeHint.classList.add('hide');
    swipeHidden = true;
  }
});


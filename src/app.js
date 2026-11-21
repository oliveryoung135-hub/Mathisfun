// @ts-check

const CUSTOM_GAMES_KEY = 'arcadevault_custom_games_v1';
const FAVORITES_KEY = 'arcadevault_favorites_v1';

/**
 * @typedef {Object} GameEntry
 * @property {string} id
 * @property {string} title
 * @property {string} category
 * @property {string} controls
 * @property {string} description
 * @property {string} [thumbnail]
 * @property {string} iframe
 */

/** @type {GameEntry[]} */
let games = [];
let activeFilter = 'All';
let searchQuery = '';
/** @type {string | null} */
let activeGameId = null;

/** @type {Set<string>} */
let favorites = new Set(loadJsonStorage(FAVORITES_KEY, []));

const gamesGrid = /** @type {HTMLElement} */ (document.getElementById('gamesGrid'));
const catalogCount = /** @type {HTMLElement} */ (document.getElementById('catalogCount'));
const emptyState = /** @type {HTMLElement} */ (document.getElementById('emptyState'));
const emptyMessage = /** @type {HTMLElement} */ (document.getElementById('emptyMessage'));
const searchInput = /** @type {HTMLInputElement} */ (document.getElementById('searchInput'));
const heroSection = /** @type {HTMLElement} */ (document.getElementById('heroSection'));
const heroVisual = /** @type {HTMLElement} */ (document.getElementById('heroVisual'));
const playerSection = /** @type {HTMLElement} */ (document.getElementById('playerSection'));
const playerTitle = /** @type {HTMLElement} */ (document.getElementById('playerTitle'));
const playerMeta = /** @type {HTMLElement} */ (document.getElementById('playerMeta'));
const playerDesc = /** @type {HTMLElement} */ (document.getElementById('playerDesc'));
const iframeStage = /** @type {HTMLElement} */ (document.getElementById('iframeStage'));
const iframeMount = /** @type {HTMLElement} */ (document.getElementById('iframeMount'));
const favoriteActiveBtn = /** @type {HTMLButtonElement} */ (document.getElementById('favoriteActiveBtn'));
const reloadFrameBtn = /** @type {HTMLButtonElement} */ (document.getElementById('reloadFrameBtn'));
const fullscreenBtn = /** @type {HTMLButtonElement} */ (document.getElementById('fullscreenBtn'));
const closePlayerBtn = /** @type {HTMLButtonElement} */ (document.getElementById('closePlayerBtn'));
const playFeaturedBtn = /** @type {HTMLButtonElement} */ (document.getElementById('playFeaturedBtn'));
const resetFilterBtn = /** @type {HTMLButtonElement} */ (document.getElementById('resetFilterBtn'));

const addModal = /** @type {HTMLElement} */ (document.getElementById('addModal'));
const addGameForm = /** @type {HTMLFormElement} */ (document.getElementById('addGameForm'));
const jsonViewerPane = /** @type {HTMLElement} */ (document.getElementById('jsonViewerPane'));
const jsonPreview = /** @type {HTMLElement} */ (document.getElementById('jsonPreview'));
const formError = /** @type {HTMLElement} */ (document.getElementById('formError'));
const copyJsonBtn = /** @type {HTMLButtonElement} */ (document.getElementById('copyJsonBtn'));

/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
function loadJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Safely extracts an <iframe> element from a JSON entry's iframe HTML string or URL.
 * @param {string} rawIframe
 * @param {string} fallbackTitle
 * @returns {HTMLIFrameElement | null}
 */
function buildSafeIframe(rawIframe, fallbackTitle) {
  const trimmed = rawIframe.trim();
  let src = '';
  let title = fallbackTitle;
  let allow = 'fullscreen';

  if (trimmed.toLowerCase().startsWith('<iframe')) {
    const doc = new DOMParser().parseFromString(trimmed, 'text/html');
    const parsed = doc.querySelector('iframe');
    if (parsed) {
      src = parsed.getAttribute('src') || '';
      title = parsed.getAttribute('title') || fallbackTitle;
      allow = parsed.getAttribute('allow') || 'fullscreen';
    }
  } else {
    src = trimmed;
  }

  if (!src || (!src.startsWith('/') && !src.startsWith('https://') && !src.startsWith('http://'))) {
    return null;
  }

  const el = document.createElement('iframe');
  el.src = src;
  el.title = title;
  el.allow = allow;
  el.setAttribute('allowfullscreen', '');
  el.setAttribute('loading', 'eager');
  return el;
}

async function loadGames() {
  try {
    const res = await fetch('/games.json');
    if (!res.ok) throw new Error('Failed to load games.json');
    /** @type {GameEntry[]} */
    const baseGames = await res.json();
    /** @type {GameEntry[]} */
    const customGames = loadJsonStorage(CUSTOM_GAMES_KEY, []);
    games = [...baseGames, ...customGames];
  } catch (err) {
    console.error(err);
    games = loadJsonStorage(CUSTOM_GAMES_KEY, []);
    emptyMessage.textContent = 'Unable to load games.json catalog.';
  }
  renderCatalog();
}

function getFilteredGames() {
  const q = searchQuery.trim().toLowerCase();
  return games.filter((game) => {
    const matchesCategory =
      activeFilter === 'All'
        ? true
        : activeFilter === 'Favorites'
          ? favorites.has(game.id)
          : game.category.toLowerCase() === activeFilter.toLowerCase();

    const matchesQuery =
      !q ||
      game.title.toLowerCase().includes(q) ||
      game.category.toLowerCase().includes(q) ||
      game.controls.toLowerCase().includes(q) ||
      game.description.toLowerCase().includes(q);

    return matchesCategory && matchesQuery;
  });
}

function syncFilterUI() {
  document.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-filter') === activeFilter);
  });
  document.querySelectorAll('[data-nav-filter]').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('data-nav-filter') === activeFilter);
  });
}

function renderCatalog() {
  syncFilterUI();
  const filtered = getFilteredGames();
  catalogCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'game' : 'games'}`;
  gamesGrid.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    emptyMessage.textContent =
      activeFilter === 'Favorites' && favorites.size === 0
        ? 'No favorite games yet. Open any game and click Favorite to save it here.'
        : 'No games match your current search or category filter.';
    return;
  }

  emptyState.classList.add('hidden');

  filtered.forEach((game) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `game-card${game.id === activeGameId ? ' is-playing' : ''}`;
    card.addEventListener('click', () => launchGame(game.id));

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'card-thumb-wrap';

    if (game.thumbnail) {
      const img = document.createElement('img');
      img.className = 'card-thumb';
      img.src = game.thumbnail;
      img.alt = `${game.title} cover art`;
      img.setAttribute('referrerpolicy', 'no-referrer');
      img.addEventListener('error', () => {
        thumbWrap.innerHTML = '';
        thumbWrap.appendChild(createFallbackArt(game.title));
      });
      thumbWrap.appendChild(img);
    } else {
      thumbWrap.appendChild(createFallbackArt(game.title));
    }

    const body = document.createElement('div');
    body.className = 'card-body';

    const head = document.createElement('div');
    head.className = 'card-head';

    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = game.title;

    const cue = document.createElement('span');
    cue.className = 'card-play-cue';
    cue.textContent = game.id === activeGameId ? 'Playing' : 'Play';

    head.append(title, cue);

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.textContent = `${game.category} · ${game.controls}`;

    const desc = document.createElement('p');
    desc.className = 'card-desc';
    desc.textContent = game.description;

    body.append(head, meta, desc);
    card.append(thumbWrap, body);
    gamesGrid.appendChild(card);
  });
}

/**
 * @param {string} title
 */
function createFallbackArt(title) {
  const box = document.createElement('div');
  box.className = 'card-fallback';
  box.textContent = title;
  return box;
}

/**
 * @param {string} gameId
 */
function launchGame(gameId) {
  const game = games.find((g) => g.id === gameId);
  if (!game) return;

  const iframeEl = buildSafeIframe(game.iframe, game.title);
  if (!iframeEl) return;

  activeGameId = game.id;
  playerTitle.textContent = game.title;
  playerMeta.textContent = `${game.category} · ${game.controls}`;
  playerDesc.textContent = game.description;

  iframeMount.innerHTML = '';
  iframeMount.appendChild(iframeEl);

  heroSection.classList.add('hidden');
  playerSection.classList.remove('hidden');
  updateFavoriteButton();
  renderCatalog();
  playerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closePlayer() {
  activeGameId = null;
  iframeMount.innerHTML = '';
  playerSection.classList.add('hidden');
  heroSection.classList.remove('hidden');
  renderCatalog();
}

function updateFavoriteButton() {
  if (!activeGameId) return;
  const isFav = favorites.has(activeGameId);
  favoriteActiveBtn.textContent = isFav ? 'Favorited' : 'Favorite';
  favoriteActiveBtn.classList.toggle('is-favorited', isFav);
}

/**
 * @param {'form' | 'json'} tab
 */
function openModal(tab = 'form') {
  addModal.classList.remove('hidden');
  switchModalTab(tab);
}

function closeModal() {
  addModal.classList.add('hidden');
  formError.classList.add('hidden');
}

/**
 * @param {'form' | 'json'} tab
 */
function switchModalTab(tab) {
  document.querySelectorAll('[data-modal-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-modal-tab') === tab);
  });
  if (tab === 'json') {
    addGameForm.classList.add('hidden');
    jsonViewerPane.classList.remove('hidden');
    jsonPreview.textContent = JSON.stringify(games, null, 2);
  } else {
    jsonViewerPane.classList.add('hidden');
    addGameForm.classList.remove('hidden');
  }
}

// Event Wiring
document.querySelectorAll('[data-filter]').forEach((btn) => {
  btn.addEventListener('click', () => {
    activeFilter = btn.getAttribute('data-filter') || 'All';
    renderCatalog();
  });
});

document.querySelectorAll('[data-nav-filter]').forEach((link) => {
  link.addEventListener('click', () => {
    activeFilter = link.getAttribute('data-nav-filter') || 'All';
    renderCatalog();
  });
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  renderCatalog();
});

resetFilterBtn.addEventListener('click', () => {
  activeFilter = 'All';
  searchQuery = '';
  searchInput.value = '';
  renderCatalog();
});

playFeaturedBtn.addEventListener('click', () => {
  if (games.length > 0) launchGame(games[0].id);
});

heroVisual.addEventListener('click', () => {
  if (games.length > 0) launchGame(games[0].id);
});

closePlayerBtn.addEventListener('click', closePlayer);

reloadFrameBtn.addEventListener('click', () => {
  if (!activeGameId) return;
  const game = games.find((g) => g.id === activeGameId);
  if (!game) return;
  const fresh = buildSafeIframe(game.iframe, game.title);
  if (fresh) {
    iframeMount.innerHTML = '';
    iframeMount.appendChild(fresh);
  }
});

fullscreenBtn.addEventListener('click', () => {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else if (iframeStage.requestFullscreen) {
    iframeStage.requestFullscreen().catch(() => {});
  }
});

favoriteActiveBtn.addEventListener('click', () => {
  if (!activeGameId) return;
  if (favorites.has(activeGameId)) favorites.delete(activeGameId);
  else favorites.add(activeGameId);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
  updateFavoriteButton();
  if (activeFilter === 'Favorites') renderCatalog();
});

document.getElementById('openAddModalBtn')?.addEventListener('click', () => openModal('form'));
document.getElementById('viewJsonBtn')?.addEventListener('click', () => openModal('json'));
document.getElementById('footerJsonBtn')?.addEventListener('click', () => openModal('json'));
document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
document.getElementById('cancelModalBtn')?.addEventListener('click', closeModal);
document.getElementById('doneJsonBtn')?.addEventListener('click', closeModal);

addModal.addEventListener('click', (e) => {
  if (e.target === addModal) closeModal();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !addModal.classList.contains('hidden')) {
    closeModal();
  }
});

document.querySelectorAll('[data-modal-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.getAttribute('data-modal-tab') === 'json' ? 'json' : 'form';
    switchModalTab(tab);
  });
});

addGameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const titleEl = /** @type {HTMLInputElement} */ (document.getElementById('gameTitleInput'));
  const catEl = /** @type {HTMLSelectElement} */ (document.getElementById('gameCategoryInput'));
  const ctrlEl = /** @type {HTMLInputElement} */ (document.getElementById('gameControlsInput'));
  const iframeEl = /** @type {HTMLTextAreaElement} */ (document.getElementById('gameIframeInput'));
  const descEl = /** @type {HTMLInputElement} */ (document.getElementById('gameDescInput'));

  const title = titleEl.value.trim();
  const rawInput = iframeEl.value.trim();

  const iframeString = rawInput.toLowerCase().startsWith('<iframe')
    ? rawInput
    : `<iframe src="${rawInput.replace(/"/g, '&quot;')}" title="${title.replace(/"/g, '&quot;')}" allow="fullscreen" loading="lazy"></iframe>`;

  const validated = buildSafeIframe(iframeString, title);
  if (!validated) {
    formError.textContent = 'Enter a valid <iframe> tag or an http(s):// / relative /games/... URL.';
    formError.classList.remove('hidden');
    return;
  }

  /** @type {GameEntry} */
  const newEntry = {
    id: `custom-${Date.now()}`,
    title,
    category: catEl.value,
    controls: ctrlEl.value.trim() || 'Keyboard & Mouse',
    description: descEl.value.trim() || 'Custom iframe game added to your local catalog.',
    iframe: iframeString
  };

  /** @type {GameEntry[]} */
  const existingCustom = loadJsonStorage(CUSTOM_GAMES_KEY, []);
  existingCustom.push(newEntry);
  localStorage.setItem(CUSTOM_GAMES_KEY, JSON.stringify(existingCustom));

  games.push(newEntry);
  addGameForm.reset();
  closeModal();
  launchGame(newEntry.id);
});

copyJsonBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(games, null, 2));
    copyJsonBtn.textContent = 'Copied';
    setTimeout(() => {
      copyJsonBtn.textContent = 'Copy JSON';
    }, 1500);
  } catch {
    copyJsonBtn.textContent = 'Copy Failed';
  }
});

loadGames();

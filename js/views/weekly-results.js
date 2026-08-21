import { getPlayerSessionToken } from '../player-auth.js?v=20260816-1';
import { requestAction } from '../api.js?v=20260816-1';
import { navigateTo } from '../router.js?v=20260816-1';
import { createPlayerNav } from '../navigation.js?v=20260816-1';

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (options.text) element.textContent = options.text;
  if (options.attributes) Object.entries(options.attributes).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

function appendChildren(parent, children) {
  children.forEach((child) => parent.appendChild(child));
  return parent;
}

function createField(labelText, control) {
  const label = createElement('label', { className: 'form-field' });
  appendChildren(label, [createElement('span', { text: labelText }), control]);
  return label;
}

function weekIdFromHash() {
  const hash = window.location.hash || '';
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return new URLSearchParams(query).get('weekId') || '';
}

function seasonTypeLabel(value) {
  if (value === 'preseason') return 'Preseason';
  if (value === 'postseason') return 'Postseason';
  return 'Regular Season';
}

function weekLabel(week) {
  if (!week) return 'Selected Week';
  return `Season ${week.season} - ${seasonTypeLabel(week.seasonType)} Week ${week.nflWeek}`;
}

function selectorWeekLabel(week) {
  const label = `${seasonTypeLabel(week && week.seasonType)} Week ${week && week.nflWeek}`;
  if (week && week.current) return `Current - ${label}`;
  return `${week && week.season} - ${label}`;
}

function hasWeeklyResults(data) {
  const weeklyResults = data && data.weeklyResults;
  return Boolean(
    weeklyResults &&
    weeklyResults.available === true &&
    Array.isArray(weeklyResults.places) &&
    weeklyResults.places.length,
  );
}

function displayValue(value) {
  return value === '' || value === null || value === undefined ? '-' : String(value);
}

function formatMoney(cents) {
  const number = Number(cents);
  if (!Number.isFinite(number)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(number / 100);
}

function tiebreakerText(value) {
  return value === true ? 'Correct' : 'Incorrect';
}

function placeTitle(place) {
  if (place === 1) return 'WEEK CHAMPION';
  if (place === 2) return '2ND PLACE 🥈';
  if (place === 3) return '3RD PLACE 🥉';
  return `${place}TH PLACE`;
}

function renderBadges(codes) {
  const list = createElement('div', { className: 'weekly-results-badges' });
  (Array.isArray(codes) ? codes : []).forEach((code) => {
    list.appendChild(createElement('span', { className: 'status-pill', text: String(code).replace(/_/g, ' ') }));
  });
  return list;
}

function renderResultCard(place, rows, champion = false) {
  const card = createElement('article', { className: champion ? 'weekly-results-card weekly-results-champion' : 'weekly-results-card' });
  const title = place === 1 && rows.length > 1 ? 'WEEK CHAMPIONS' : placeTitle(place);
  const header = createElement('div', { className: 'weekly-results-card-header' });
  appendChildren(header, [
    createElement('p', { className: 'eyebrow', text: title }),
    place === 1 ? createElement('span', { className: 'weekly-results-trophy', text: '🏆' }) : null,
    place === 1 && rows.length > 1 ? createElement('span', { className: 'status-pill', text: 'SPLIT WINNERS' }) : null,
  ].filter(Boolean));
  card.appendChild(header);
  rows.forEach((row) => {
    const player = createElement('div', { className: 'weekly-results-player' });
    appendChildren(player, [
      createElement('h3', { text: row.playerName || 'Unknown player' }),
      createElement('p', { className: 'muted', text: row.entryLabel || row.entryId || 'Entry' }),
      createElement('p', {
        className: champion ? 'weekly-results-score weekly-results-score-large' : 'weekly-results-score',
        text: `${displayValue(row.correctPicks)} of ${displayValue(row.totalGames)} Correct`,
      }),
      createElement('p', { className: 'muted', text: `Tiebreaker Pick: ${tiebreakerText(row.tiebreakerCorrect)}` }),
      createElement('p', { className: 'muted', text: `${displayValue(row.pointsAway)} Points Away` }),
      renderBadges(row.badgeCodes),
    ]);
    card.appendChild(player);
  });
  return card;
}

function renderPrizePool(currentPot) {
  const card = createElement('section', { className: 'weekly-results-prize' });
  appendChildren(card, [
    createElement('p', { className: 'eyebrow', text: 'Prize Pool' }),
    createElement('p', { className: 'weekly-results-prize-amount', text: formatMoney(currentPot && currentPot.amountCents) }),
  ]);
  return card;
}

function renderResults(data) {
  const fragment = document.createDocumentFragment();
  const results = data.weeklyResults || {};
  if (!results.available) {
    fragment.appendChild(createElement('p', { className: 'muted', text: 'Weekly Results appear after this Week is graded.' }));
    return fragment;
  }
  const places = Array.isArray(results.places) ? results.places : [];
  const featured = [1, 2, 3]
    .map((place) => [place, places.filter((row) => Number(row.place) === place)])
    .filter(([, rows]) => rows.length);
  const champion = featured.find(([place]) => place === 1);
  if (champion) fragment.appendChild(renderResultCard(1, champion[1], true));
  fragment.appendChild(renderPrizePool(data.currentPot || {}));
  const podium = createElement('section', { className: 'weekly-results-podium' });
  featured
    .filter(([place]) => place !== 1)
    .forEach(([place, rows]) => podium.appendChild(renderResultCard(place, rows)));
  if (podium.children.length) fragment.appendChild(podium);
  return fragment;
}

function confettiKey(weekId) {
  return `3real_weekly_results_confetti_${weekId || 'default'}`;
}

function reducedMotionEnabled() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function fireWeeklyResultsConfetti(weekId) {
  if (reducedMotionEnabled()) return;
  const key = confettiKey(weekId);
  try {
    if (window.sessionStorage.getItem(key) === 'shown') return;
    window.sessionStorage.setItem(key, 'shown');
  } catch {
    return;
  }
  const overlay = createElement('div', { className: 'weekly-results-confetti', attributes: { 'aria-hidden': 'true' } });
  const colors = ['weekly-results-confetti-gold', 'weekly-results-confetti-soft', 'weekly-results-confetti-white'];
  Array.from({ length: 42 }, (_, index) => {
    const piece = createElement('span', {
      className: `weekly-results-confetti-piece ${colors[index % colors.length]}`,
    });
    piece.style.setProperty('--x', `${(index * 37) % 100}%`);
    piece.style.setProperty('--delay', `${(index % 9) * 0.08}s`);
    piece.style.setProperty('--drift', `${((index % 7) - 3) * 1.35}rem`);
    piece.style.setProperty('--spin', `${index % 2 === 0 ? '' : '-'}${220 + (index % 5) * 50}deg`);
    overlay.appendChild(piece);
    return piece;
  });
  document.body.appendChild(overlay);
  window.setTimeout(() => {
    overlay.remove();
  }, 2600);
}

export function createWeeklyResultsView() {
  const wrapper = createElement('main', { className: 'page-container' });
  const card = createElement('section', { className: 'state-card weekly-results-shell' });
  const status = createElement('p', { className: 'muted', text: 'Loading Weekly Results...', attributes: { role: 'status', 'aria-live': 'polite' } });
  const title = createElement('h1', { text: 'Weekly Results' });
  const subtitle = createElement('p', { className: 'muted' });
  const weekSelect = createElement('select', { attributes: { name: 'weekId', disabled: 'disabled' } });
  const results = createElement('section', { className: 'weekly-results-list' });
  const back = createElement('button', { className: 'secondary-button', text: 'Back to Player Dashboard', attributes: { type: 'button' } });
  const boardCache = new Map();
  let resultsWeeks = [];
  let availableWeekIds = [];
  let activeSelectedWeekId = '';
  back.addEventListener('click', () => navigateTo('player-dashboard'));
  appendChildren(card, [
    createElement('p', { className: 'eyebrow', text: 'Results' }),
    title,
    subtitle,
    createField('Week', weekSelect),
    status,
    results,
    createElement('div', { className: 'button-row' }),
  ]);
  card.lastChild.appendChild(back);
  wrapper.appendChild(createPlayerNav('player-weekly-results'));
  wrapper.appendChild(card);

  function cacheBoardData(data) {
    const weekId = data && (data.selectedWeekId || data.week && data.week.weekId);
    if (weekId) boardCache.set(weekId, data);
  }

  async function fetchBoardData(weekId = '') {
    if (weekId && boardCache.has(weekId)) return boardCache.get(weekId);
    const result = await requestAction('player.week.picksBoard', {
      sessionToken: getPlayerSessionToken(),
      ...(weekId ? { weekId } : {}),
    });
    const data = result.data || {};
    cacheBoardData(data);
    return data;
  }

  function renderWeekOptions(selectedWeekId = '') {
    weekSelect.replaceChildren();
    const orderedWeeks = [...resultsWeeks].sort((a, b) => {
      const aIndex = availableWeekIds.indexOf(a.weekId);
      const bIndex = availableWeekIds.indexOf(b.weekId);
      return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
    });
    orderedWeeks.forEach((week) => {
      const option = createElement('option', { text: selectorWeekLabel(week), attributes: { value: week.weekId } });
      if (week.weekId === selectedWeekId) option.selected = true;
      weekSelect.appendChild(option);
    });
    weekSelect.disabled = resultsWeeks.length < 2;
  }

  function rememberResultsWeek(week) {
    if (!week || !week.weekId || resultsWeeks.some((row) => row.weekId === week.weekId)) return;
    resultsWeeks = [...resultsWeeks, week];
  }

  async function discoverResultsWeeks(availableWeeks = []) {
    for (const week of availableWeeks) {
      if (!wrapper.isConnected) return;
      if (!week || !week.weekId || boardCache.has(`checked:${week.weekId}`)) continue;
      try {
        const data = await fetchBoardData(week.weekId);
        if (!wrapper.isConnected) return;
        boardCache.set(`checked:${week.weekId}`, true);
        if (hasWeeklyResults(data)) {
          rememberResultsWeek(data.week || week);
          renderWeekOptions(activeSelectedWeekId);
        }
      } catch {
        boardCache.set(`checked:${week.weekId}`, true);
      }
    }
  }

  async function findFirstResultsWeek(availableWeeks = []) {
    for (const week of availableWeeks) {
      if (!week || !week.weekId) continue;
      try {
        const data = await fetchBoardData(week.weekId);
        boardCache.set(`checked:${week.weekId}`, true);
        if (hasWeeklyResults(data)) {
          rememberResultsWeek(data.week || week);
          return data;
        }
      } catch {
        boardCache.set(`checked:${week.weekId}`, true);
      }
    }
    return null;
  }

  function renderSelectedResults(data, requestedWeekId = '') {
    const selectedWeekId = data.selectedWeekId || data.week && data.week.weekId || requestedWeekId;
    activeSelectedWeekId = selectedWeekId;
    if (hasWeeklyResults(data)) rememberResultsWeek(data.week);
    title.textContent = data.week ? 'Weekly Results' : 'Weekly Results';
    subtitle.textContent = weekLabel(data.week);
    status.textContent = '';
    results.replaceChildren(renderResults(data));
    renderWeekOptions(selectedWeekId);
    if (hasWeeklyResults(data)) {
      fireWeeklyResultsConfetti(selectedWeekId);
    }
  }

  async function loadResults() {
    status.classList.remove('error-text');
    status.textContent = 'Loading Weekly Results...';
    results.replaceChildren();
    weekSelect.disabled = true;
    try {
      const weekId = weekIdFromHash();
      let data = await fetchBoardData(weekId);
      availableWeekIds = (data.availableWeeks || []).map((week) => week.weekId);
      if (!weekId && !hasWeeklyResults(data)) {
        const fallback = await findFirstResultsWeek(data.availableWeeks || []);
        if (fallback) data = fallback;
      }
      renderSelectedResults(data, weekId);
      discoverResultsWeeks(data.availableWeeks || []);
    } catch (error) {
      status.textContent = error.message || 'Unable to load Weekly Results.';
      status.classList.add('error-text');
      weekSelect.disabled = true;
    }
  }

  weekSelect.addEventListener('change', () => {
    if (weekSelect.value) navigateTo(`player-weekly-results?weekId=${encodeURIComponent(weekSelect.value)}`);
  });

  loadResults();
  return wrapper;
}


import { requestAction } from '../api.js?v=20260814-6';
import { getManagerSessionToken } from '../auth.js?v=20260814-6';
import { navigateTo } from '../router.js?v=20260814-6';
import { createManagerNav } from '../navigation.js?v=20260814-6';

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

function managerAction(action, payload = {}) {
  return requestAction(action, { ...payload, sessionToken: getManagerSessionToken() });
}

function formatDateTime(value, fallback = 'Not configured') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Chicago',
  }).format(date);
}

function formatScoreRefreshTime(value) {
  if (!value) return 'Not yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not yet';
  const parts = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || '';
  return `${part('month')} ${part('day')}, ${part('year')} · ${part('hour')}:${part('minute')} ${part('dayPeriod')} CT`;
}

function formatWeekday(value, fallback = 'Not available') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'America/Chicago',
  }).format(date);
}

function parseGameScore(input) {
  const value = input.value.trim();
  if (!/^\d+$/.test(value)) return null;
  const score = Number(value);
  return Number.isSafeInteger(score) ? score : null;
}

function displayedGamesAreFinal(games) {
  return Array.isArray(games) && games.length > 0 && games.every((game) => game.status === 'final');
}

function seasonTypeLabel(value) {
  if (value === 'preseason') return 'Preseason';
  if (value === 'postseason') return 'Postseason';
  return 'Regular Season';
}

const MANAGER_WEEK_SELECTION_KEY = '3real_pickem_manager_week_selection';
const SEASON_TYPES = new Set(['preseason', 'regular', 'postseason']);

function validWeekSelection(selection) {
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) return null;
  const season = Number(selection.season);
  const seasonType = String(selection.seasonType || '').trim().toLowerCase();
  const nflWeek = Number(selection.nflWeek);
  if (!Number.isSafeInteger(season) || season < 2000 || season > 9999) return null;
  if (!SEASON_TYPES.has(seasonType)) return null;
  if (!Number.isSafeInteger(nflWeek) || nflWeek < 1 || nflWeek > 25) return null;
  return { season, seasonType, nflWeek };
}

function readRememberedWeekSelection() {
  try {
    const raw = window.sessionStorage.getItem(MANAGER_WEEK_SELECTION_KEY);
    if (!raw) return null;
    const selection = validWeekSelection(JSON.parse(raw));
    if (selection) return selection;
  } catch (error) {
    // Invalid or unavailable session storage should not block Week Management.
  }
  clearRememberedWeekSelection();
  return null;
}

function clearRememberedWeekSelection() {
  try {
    window.sessionStorage.removeItem(MANAGER_WEEK_SELECTION_KEY);
  } catch (error) {
    // Storage cleanup is best-effort.
  }
}

function rememberWeekSelection(week) {
  const selection = validWeekSelection(week);
  if (!selection) return;
  try {
    window.sessionStorage.setItem(MANAGER_WEEK_SELECTION_KEY, JSON.stringify(selection));
  } catch (error) {
    // Storage persistence must never affect Week Management behavior.
  }
}

export function createManagerWeekView() {
  let weekData = null;
  let inFlight = false;
  const wrapper = createElement('main', { className: 'page-container' });
  const controlsCard = createElement('section', { className: 'state-card manager-toolbar' });
  const detailCard = createElement('section', { className: 'state-card compact-card' });
  const form = createElement('form', { className: 'auth-form' });
  const controls = createElement('div', { className: 'manager-controls week-controls' });
  const seasonInput = createElement('input', {
    attributes: { name: 'season', type: 'number', min: '2000', max: '9999', step: '1', required: 'required' },
  });
  const seasonTypeSelect = createElement('select', { attributes: { name: 'seasonType' } });
  [
    ['preseason', 'Preseason'],
    ['regular', 'Regular Season'],
    ['postseason', 'Postseason'],
  ].forEach(([value, label]) => {
    seasonTypeSelect.appendChild(createElement('option', { text: label, attributes: { value } }));
  });
  seasonTypeSelect.value = 'regular';
  const weekInput = createElement('input', {
    attributes: { name: 'nflWeek', type: 'number', min: '1', max: '25', step: '1', required: 'required' },
  });
  const importButton = createElement('button', { className: 'primary-button', text: 'Import Schedule', attributes: { type: 'submit' } });
  const backButton = createElement('button', { className: 'secondary-button', text: 'Back to Dashboard', attributes: { type: 'button' } });
  const formButtons = createElement('div', { className: 'button-row' });
  const message = createElement('p', { className: 'muted', attributes: { role: 'status', 'aria-live': 'polite' } });

  function setInFlight(value) {
    inFlight = value;
    seasonInput.disabled = value;
    seasonTypeSelect.disabled = value;
    weekInput.disabled = value;
    importButton.disabled = value;
    backButton.disabled = value;
    detailCard.querySelectorAll('button, input').forEach((control) => {
      const resultReadOnly = control.hasAttribute('data-game-result-control') &&
        (!weekData || !weekData.week || weekData.week.status !== 'open');
      control.disabled = value || resultReadOnly;
    });
  }

  function render() {
    detailCard.replaceChildren();
    if (!weekData || !weekData.week) {
      appendChildren(detailCard, [
        createElement('p', { className: 'eyebrow', text: 'Current Week' }),
        createElement('h2', { text: 'No week configured' }),
        createElement('p', { className: 'muted', text: 'Enter a season and NFL week, then import the configured schedule.' }),
      ]);
      importButton.textContent = 'Import Schedule';
      return;
    }

    const week = weekData.week;
    seasonInput.value = String(week.season);
    seasonTypeSelect.value = week.seasonType || 'regular';
    weekInput.value = String(week.nflWeek);
    importButton.textContent = 'Refresh Schedule';
    const details = createElement('dl', { className: 'player-meta' });
    [
      ['Season', String(week.season)],
      ['Opens', formatDateTime(week.opensAt)],
      ['Total games', String(weekData.gameCount || 0)],
    ].forEach(([label, value]) => {
      details.appendChild(createElement('dt', { text: label }));
      details.appendChild(createElement('dd', { text: value }));
    });
    if (Number.isFinite(weekData.createdGames) && Number.isFinite(weekData.updatedGames)) {
      details.appendChild(createElement('dt', { text: 'Last import' }));
      details.appendChild(createElement('dd', { text: `${weekData.createdGames} created, ${weekData.updatedGames} updated` }));
    }

    const actions = createElement('div', { className: 'button-row' });
    if (week.status === 'draft') {
      const openButton = createElement('button', { className: 'primary-button', text: 'Open Week', attributes: { type: 'button' } });
      openButton.disabled = inFlight;
      openButton.addEventListener('click', () => openWeek(openButton));
      actions.appendChild(openButton);
    }
    if (week.status !== 'archived') {
      const archiveButton = createElement('button', { className: 'secondary-button', text: 'Archive Week', attributes: { type: 'button' } });
      archiveButton.disabled = inFlight;
      archiveButton.addEventListener('click', () => archiveWeek(archiveButton));
      actions.appendChild(archiveButton);
    }
    if (['highlightly', 'odds'].includes(week.provider || weekData.provider) && week.status !== 'archived') {
      const refreshScoresButton = createElement('button', { className: 'secondary-button', text: 'Refresh Scores', attributes: { type: 'button' } });
      refreshScoresButton.disabled = inFlight;
      refreshScoresButton.addEventListener('click', () => refreshScores());
      actions.appendChild(refreshScoresButton);
    }
    const scoreRefreshStatus = createElement('p', {
      className: 'muted',
      text: `Last refreshed: ${formatScoreRefreshTime(weekData.scoreLastRefreshedAt)}`,
    });
    const allGamesFinal = displayedGamesAreFinal(weekData.games || []);
    if (week.status === 'open') {
      const gradeButton = createElement('button', {
        className: 'primary-button',
        text: weekData.grading ? 'Regrade Week' : 'Grade Week',
        attributes: { type: 'button' },
      });
      gradeButton.disabled = inFlight || !allGamesFinal;
      gradeButton.addEventListener('click', () => gradeWeek());
      actions.appendChild(gradeButton);
    }

    const games = createElement('section', { className: 'player-list', attributes: { 'aria-label': 'Imported games' } });
    (weekData.games || []).forEach((game) => {
      const gameCard = createElement('article', { className: 'player-card compact-card' });
      const gameHeader = createElement('div', { className: 'player-card-header' });
      const gameDetails = createElement('dl', { className: 'player-meta' });
      [
        ['Day', formatWeekday(game.kickoffAt)],
        ['Kickoff', formatDateTime(game.kickoffAt)],
        ['Locks', formatDateTime(game.lockAt, 'Not available')],
      ].forEach(([label, value]) => {
        gameDetails.appendChild(createElement('dt', { text: label }));
        gameDetails.appendChild(createElement('dd', { text: value || 'Not available' }));
      });
      const awayScoreInput = createElement('input', {
        attributes: { name: 'awayScore', type: 'number', min: '0', step: '1', 'data-game-result-control': 'true' },
      });
      const homeScoreInput = createElement('input', {
        attributes: { name: 'homeScore', type: 'number', min: '0', step: '1', 'data-game-result-control': 'true' },
      });
      if (game.awayScore !== '' && game.awayScore !== null && game.awayScore !== undefined) {
        awayScoreInput.value = String(game.awayScore);
      }
      if (game.homeScore !== '' && game.homeScore !== null && game.homeScore !== undefined) {
        homeScoreInput.value = String(game.homeScore);
      }
      const resultForm = createElement('form', { className: 'week-score-form' });
      const resultButtons = createElement('div', { className: 'button-row' });
      const saveResultButton = createElement('button', {
        className: 'primary-button',
        text: 'Save Final Result',
        attributes: { type: 'submit', 'data-game-result-control': 'true' },
      });
      const resultStatus = createElement('p', { className: 'muted', attributes: { role: 'status', 'aria-live': 'polite' } });
      const resultReadOnly = week.status !== 'open' || inFlight;
      awayScoreInput.disabled = resultReadOnly;
      homeScoreInput.disabled = resultReadOnly;
      saveResultButton.disabled = resultReadOnly;
      resultForm.addEventListener('submit', (event) => {
        event.preventDefault();
        saveGameResult(game, awayScoreInput, homeScoreInput, resultStatus);
      });
      resultButtons.appendChild(saveResultButton);
      appendChildren(resultForm, [
        createField(`${game.awayTeam} score`, awayScoreInput),
        createField(`${game.homeTeam} score`, homeScoreInput),
        resultButtons,
        resultStatus,
      ]);
      appendChildren(gameHeader, [
        createElement('h3', { text: `${game.awayTeam} at ${game.homeTeam}` }),
        createElement('span', { className: `status-pill ${game.status === 'scheduled' ? '' : 'status-pill-muted'}`, text: game.status || 'Unknown' }),
      ]);
      appendChildren(gameCard, [
        gameHeader,
        gameDetails,
      ]);
      const hasSavedScores = game.status === 'final' && game.awayScore !== '' && game.homeScore !== '';
      if (hasSavedScores) {
        gameCard.appendChild(createElement('p', {
          className: 'muted',
          text: game.winnerTeam ? `Winner: ${game.winnerTeam}` : 'Result: Tie',
        }));
      }
      gameCard.appendChild(resultForm);
      games.appendChild(gameCard);
    });
    const standings = renderStandings();

    const weekHeader = createElement('div', { className: 'player-card-header' });
    appendChildren(weekHeader, [
      createElement('h2', { text: `${seasonTypeLabel(week.seasonType)} Week ${week.nflWeek}` }),
      createElement('span', { className: `status-pill ${week.status === 'open' ? '' : 'status-pill-muted'}`, text: week.status }),
    ]);
    appendChildren(detailCard, [
      createElement('p', { className: 'eyebrow', text: 'Current Week' }),
      weekHeader,
      details,
      actions,
      scoreRefreshStatus,
      ...(week.status === 'open' && !allGamesFinal ? [createElement('p', { className: 'muted', text: 'All Games must be final before grading.' })] : []),
      games,
      ...(standings ? [standings] : []),
    ]);
  }

  function renderStandings() {
    const grading = weekData && weekData.grading;
    if (!grading) return null;
    const section = createElement('section', { className: 'player-list', attributes: { 'aria-label': 'Weekly standings' } });
    appendChildren(section, [
      createElement('h3', { text: 'Weekly Standings' }),
      createElement('p', { className: 'muted', text: `Graded ${formatDateTime(grading.gradedAt)}` }),
    ]);
    (grading.standings || []).forEach((standing) => {
      const card = createElement('article', { className: 'player-card' });
      const details = createElement('dl', { className: 'player-meta' });
      [
        ['Rank', String(standing.rank)],
        ['Player', standing.playerName || 'Unknown player'],
        ['Entry', standing.entryLabel || standing.entryId],
        ['Correct picks', `${standing.regularPoints} of ${standing.totalGames}`],
      ].forEach(([label, value]) => {
        details.appendChild(createElement('dt', { text: label }));
        details.appendChild(createElement('dd', { text: value || 'Not available' }));
      });
      appendChildren(card, [
        createElement('h4', { text: `Rank ${standing.rank}` }),
        createElement('span', { className: 'status-pill', text: `${standing.regularPoints} of ${standing.totalGames}` }),
        details,
      ]);
      section.appendChild(card);
    });
    return section;
  }

  async function loadWeek(options = {}) {
    const rememberedSelection = options.restoreRemembered ? readRememberedWeekSelection() : null;
    try {
      const result = await managerAction('manager.week.get', rememberedSelection || {});
      weekData = result.data;
      if (rememberedSelection && (!weekData || !weekData.week)) {
        clearRememberedWeekSelection();
        const fallback = await managerAction('manager.week.get');
        weekData = fallback.data;
        rememberWeekSelection(weekData && weekData.week);
        message.textContent = '';
        message.classList.remove('error-text');
        render();
        return;
      }
      rememberWeekSelection(weekData && weekData.week);
      message.textContent = '';
      message.classList.remove('error-text');
      render();
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error-text');
    }
  }

  async function openWeek(button) {
    if (inFlight || !weekData || !window.confirm('Open this Week for player payments and picks?')) return;
    setInFlight(true);
    button.disabled = true;
    message.textContent = 'Opening Week...';
    message.classList.remove('error-text');
    try {
      const result = await managerAction('manager.week.open', { weekId: weekData.week.weekId });
      weekData = result.data;
      rememberWeekSelection(weekData && weekData.week);
      message.textContent = 'Week opened.';
      render();
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error-text');
    } finally {
      setInFlight(false);
      render();
    }
  }

  async function saveGameResult(game, awayScoreInput, homeScoreInput, resultStatus) {
    if (inFlight || !weekData || !weekData.week) return;
    const awayScore = parseGameScore(awayScoreInput), homeScore = parseGameScore(homeScoreInput);
    if (awayScore === null || homeScore === null) {
      resultStatus.textContent = 'Enter nonnegative whole-number scores for both teams.';
      resultStatus.classList.add('error-text');
      return;
    }
    const correction = game.status === 'final';
    if (!window.confirm(correction ? 'Correct this final game result?' : 'Save this game as final?')) return;
    setInFlight(true);
    resultStatus.textContent = correction ? 'Correcting final game result...' : 'Saving final game result...';
    resultStatus.classList.remove('error-text');
    message.textContent = resultStatus.textContent;
    message.classList.remove('error-text');
    try {
      const result = await managerAction('manager.week.saveGameResult', {
        weekId: weekData.week.weekId,
        gameId: game.gameId,
        awayScore,
        homeScore,
      });
      weekData = result.data;
      rememberWeekSelection(weekData && weekData.week);
      message.textContent = correction ? 'Final game result corrected.' : 'Final game result saved.';
      render();
    } catch (error) {
      resultStatus.textContent = error.message;
      resultStatus.classList.add('error-text');
      message.textContent = error.message;
      message.classList.add('error-text');
    } finally {
      setInFlight(false);
    }
  }
  async function archiveWeek(button) {
    if (inFlight || !weekData || !window.confirm('Archive this Week? Week and Game rows will be retained.')) return;
    setInFlight(true);
    button.disabled = true;
    message.textContent = 'Archiving Week...';
    message.classList.remove('error-text');
    try {
      const result = await managerAction('manager.week.archive', { weekId: weekData.week.weekId });
      weekData = result.data;
      rememberWeekSelection(weekData && weekData.week);
      message.textContent = result.data.archived ? 'Week archived.' : 'Week was already archived.';
      render();
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error-text');
    } finally {
      setInFlight(false);
      render();
    }
  }

  async function gradeWeek() {
    if (inFlight || !weekData || !weekData.week || weekData.week.status !== 'open' || !displayedGamesAreFinal(weekData.games || [])) return;
    const regrade = Boolean(weekData.grading);
    if (!window.confirm(regrade ? 'Regrade all active entries using the current final results?' : 'Grade all active entries for this Week?')) return;
    setInFlight(true);
    message.textContent = 'Grading Week...';
    message.classList.remove('error-text');
    try {
      const result = await managerAction('manager.week.grade', { weekId: weekData.week.weekId });
      weekData = { ...weekData, grading: result.data.grading };
      rememberWeekSelection(weekData && weekData.week);
      message.textContent = regrade ? 'Week regraded.' : 'Week graded.';
      render();
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error-text');
    } finally {
      setInFlight(false);
      render();
    }
  }

  async function refreshScores() {
    if (inFlight || !weekData || !weekData.week || !['highlightly', 'odds'].includes(weekData.week.provider || weekData.provider) || weekData.week.status === 'archived') return;
    setInFlight(true);
    message.textContent = 'Refreshing scores...';
    message.classList.remove('error-text');
    try {
      const result = await managerAction('manager.week.refreshScores', { weekId: weekData.week.weekId });
      weekData = result.data;
      rememberWeekSelection(weekData && weekData.week);
      const review = Number(result.data.reviewRequiredGames || 0);
      message.textContent = `Scores refreshed. ${result.data.updatedGames} games updated.${review ? ` ${review} need review.` : ''}`;
      render();
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error-text');
    } finally {
      setInFlight(false);
      render();
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (inFlight) return;
    setInFlight(true);
    message.textContent = 'Importing schedule...';
    message.classList.remove('error-text');
    try {
      const result = await managerAction('manager.week.importSchedule', {
        season: Number(seasonInput.value),
        seasonType: seasonTypeSelect.value,
        nflWeek: Number(weekInput.value),
      });
      weekData = result.data;
      rememberWeekSelection(weekData && weekData.week);
      message.textContent = `Schedule imported. ${result.data.createdGames} games created and ${result.data.updatedGames} games updated.`;
      render();
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error-text');
    } finally {
      setInFlight(false);
      render();
    }
  });
  backButton.addEventListener('click', () => navigateTo('manager-dashboard'));

  appendChildren(formButtons, [importButton, backButton]);
  appendChildren(controls, [createField('Season', seasonInput), createField('Season Type', seasonTypeSelect), createField('NFL week', weekInput), formButtons]);
  appendChildren(form, [controls, message]);
  appendChildren(controlsCard, [
    createElement('p', { className: 'eyebrow', text: 'League Manager' }),
    createElement('h1', { text: 'Week Management' }),
    createElement('p', { className: 'muted', text: 'Import the configured schedule, review Central Time deadlines, then open the Week.' }),
    form,
  ]);
  appendChildren(wrapper, [createManagerNav('manager-week'), controlsCard, detailCard]);
  render();
  loadWeek({ restoreRemembered: true });
  return wrapper;
}


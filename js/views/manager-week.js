import { requestAction } from '../api.js';
import { getManagerSessionToken } from '../auth.js';
import { navigateTo } from '../router.js';

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

function parseGameScore(input) {
  const value = input.value.trim();
  if (!/^\d+$/.test(value)) return null;
  const score = Number(value);
  return Number.isSafeInteger(score) ? score : null;
}

export function createManagerWeekView() {
  let weekData = null;
  let inFlight = false;
  const wrapper = createElement('main', { className: 'page-container' });
  const controlsCard = createElement('section', { className: 'state-card' });
  const detailCard = createElement('section', { className: 'state-card' });
  const form = createElement('form', { className: 'auth-form' });
  const seasonInput = createElement('input', {
    attributes: { name: 'season', type: 'number', min: '2000', max: '9999', step: '1', required: 'required' },
  });
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
    weekInput.value = String(week.nflWeek);
    importButton.textContent = 'Refresh Schedule';
    const details = createElement('dl', { className: 'player-meta' });
    [
      ['Season', String(week.season)],
      ['NFL week', String(week.nflWeek)],
      ['Opens', formatDateTime(week.opensAt)],
      ['Thursday lock', formatDateTime(week.thursdayLockAt, 'No Thursday lock')],
      ['Main lock', formatDateTime(week.mainLockAt)],
      ['Reveal', formatDateTime(week.revealAt)],
      ['Provider', week.provider || weekData.provider || 'Not available'],
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

    const games = createElement('section', { className: 'player-list', attributes: { 'aria-label': 'Imported games' } });
    (weekData.games || []).forEach((game) => {
      const gameCard = createElement('article', { className: 'player-card' });
      const gameDetails = createElement('dl', { className: 'player-meta' });
      [
        ['Kickoff', formatDateTime(game.kickoffAt)],
        ['Lock group', game.lockGroup],
        ['Source', game.sourceProvider],
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
      const resultForm = createElement('form', { className: 'auth-form' });
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
      appendChildren(gameCard, [
        createElement('h3', { text: `${game.awayTeam} at ${game.homeTeam}` }),
        createElement('span', { className: `status-pill ${game.status === 'scheduled' ? '' : 'status-pill-muted'}`, text: game.status || 'Unknown' }),
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

    appendChildren(detailCard, [
      createElement('p', { className: 'eyebrow', text: 'Current Week' }),
      createElement('h2', { text: `Season ${week.season} - Week ${week.nflWeek}` }),
      createElement('span', { className: `status-pill ${week.status === 'open' ? '' : 'status-pill-muted'}`, text: week.status }),
      details,
      actions,
      games,
    ]);
  }

  async function loadWeek() {
    try {
      const result = await managerAction('manager.week.get');
      weekData = result.data;
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

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (inFlight) return;
    setInFlight(true);
    message.textContent = 'Importing schedule...';
    message.classList.remove('error-text');
    try {
      const result = await managerAction('manager.week.importSchedule', {
        season: Number(seasonInput.value),
        nflWeek: Number(weekInput.value),
      });
      weekData = result.data;
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
  appendChildren(form, [createField('Season', seasonInput), createField('NFL week', weekInput), formButtons, message]);
  appendChildren(controlsCard, [
    createElement('p', { className: 'eyebrow', text: 'League Manager' }),
    createElement('h1', { text: 'Week Management' }),
    createElement('p', { className: 'muted', text: 'Import the configured schedule, review Central Time deadlines, then open the Week.' }),
    form,
  ]);
  appendChildren(wrapper, [controlsCard, detailCard]);
  render();
  loadWeek();
  return wrapper;
}

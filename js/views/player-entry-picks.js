import { getPlayerSessionToken } from '../player-auth.js?v=20260808-5';
import { requestAction } from '../api.js?v=20260808-5';
import { navigateTo } from '../router.js?v=20260808-5';

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (options.text) element.textContent = options.text;
  if (options.attributes) {
    Object.entries(options.attributes).forEach(([name, value]) => element.setAttribute(name, value));
  }
  return element;
}

function appendChildren(parent, children) {
  children.forEach((child) => parent.appendChild(child));
  return parent;
}

function playerAction(action, payload = {}) {
  return requestAction(action, { ...payload, sessionToken: getPlayerSessionToken() });
}

function entryIdFromHash() {
  const hash = window.location.hash || '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex < 0) return '';
  return new URLSearchParams(hash.slice(queryIndex + 1)).get('entryId') || '';
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

const RECONCILED_CONFLICT_CODES = new Set(['PICK_LOCKED']);

export function createPlayerEntryPicksView() {
  const entryId = entryIdFromHash();
  let state = null;
  let currentSelections = {};
  let currentPredictedTotal = '';
  let saving = false;
  let saveBlocked = false;
  let entryAvailable = Boolean(entryId);

  const wrapper = createElement('main', { className: 'page-container pick-sheet-page' });
  const header = createElement('section', { className: 'state-card' });
  const content = createElement('section', { className: 'pick-game-list', attributes: { 'aria-label': 'Weekly games' } });
  const message = createElement('p', {
    className: 'muted',
    text: entryId ? 'Loading entry picks...' : 'A valid entry is required.',
    attributes: { role: 'status', 'aria-live': 'polite' },
  });
  const back = createElement('button', { className: 'secondary-button', text: 'Player Dashboard', attributes: { type: 'button' } });
  const topSave = createElement('button', { className: 'primary-button', text: 'Save Picks', attributes: { type: 'button', disabled: 'disabled' } });
  const bottomSave = createElement('button', { className: 'primary-button full-width-button', text: 'Save Picks', attributes: { type: 'button', disabled: 'disabled' } });
  const saveButtons = [topSave, bottomSave];
  const bottomButtons = createElement('div', { className: 'button-row' });
  const weekBadge = createElement('span', {
    className: 'status-pill',
    text: 'WEEK',
  });
  const buttons = createElement('div', { className: 'button-row' });
  appendChildren(buttons, [topSave, back, weekBadge]);
  bottomButtons.appendChild(bottomSave);
  appendChildren(header, [
    createElement('p', { className: 'eyebrow', text: 'Player Picks' }),
    createElement('h1', { text: 'Weekly Pick Sheet' }),
    message,
    buttons,
  ]);
  appendChildren(wrapper, [header, content]);

  back.addEventListener('click', () => navigateTo('player-dashboard'));

  function selectedByGameId() {
    const selected = {};
    (state && state.picks || []).forEach((pick) => { selected[pick.gameId] = pick.selectedTeam; });
    return selected;
  }

  function dirtySelections() {
    if (!state || !entryAvailable || saveBlocked) return [];
    const authoritative = selectedByGameId();
    return (state.games || []).filter((game) => game.editable && currentSelections[game.gameId] && currentSelections[game.gameId] !== authoritative[game.gameId])
      .map((game) => ({ gameId: game.gameId, selectedTeam: currentSelections[game.gameId] }));
  }

  function authoritativePredictedTotal() {
    const value = state && state.tiebreaker ? state.tiebreaker.predictedTotal : '';
    return value === '' || value === null || value === undefined ? '' : String(value);
  }

  function dirtyPredictedTotal() {
    if (!state || !state.tiebreaker || !state.tiebreaker.editable || !entryAvailable || saveBlocked) return false;
    return String(currentPredictedTotal).trim() !== authoritativePredictedTotal();
  }

  function updateAvailability() {
    const dirty = dirtySelections();
    const tiebreakerDirty = dirtyPredictedTotal();
    const hasAuthoritativePicks = Boolean(state && state.picks && state.picks.length);
    const hasEditableGames = Boolean(state && (state.games || []).some((game) => game.editable));
    const saveDisabled = !state || saving || saveBlocked || !entryAvailable || (dirty.length === 0 && !tiebreakerDirty);
    const saveText = saving
      ? 'Saving Picks...'
      : saveBlocked || !entryAvailable
        ? 'Save Unavailable'
        : state && hasEditableGames && hasAuthoritativePicks && dirty.length === 0
          ? 'Picks Saved'
          : 'Save Picks';
    saveButtons.forEach((saveButton) => {
      saveButton.disabled = saveDisabled;
      saveButton.textContent = saveText;
    });
    content.querySelectorAll('input[type="radio"]').forEach((control) => {
      const game = (state.games || []).find((item) => item.gameId === control.dataset.gameId);
      control.disabled = saving || saveBlocked || !entryAvailable || !game || !game.editable;
    });
    content.querySelectorAll('input[data-tiebreaker-total="true"]').forEach((control) => {
      control.disabled = saving || saveBlocked || !entryAvailable || !state || !state.tiebreaker || !state.tiebreaker.editable;
    });
  }

  function gamePickResult(game, savedPick) {
    if (!savedPick) return 'No pick';
    if (!game.winnerTeam) return 'Tie';
    return savedPick === game.winnerTeam ? 'Correct' : 'Incorrect';
  }

  function createPickControls(game, selected) {
    const fieldset = createElement('fieldset', { className: 'pick-team-fieldset' });
    const legend = createElement('legend', { text: `${game.awayTeam} at ${game.homeTeam}` });
    fieldset.appendChild(legend);
    const choices = createElement('div', { className: 'pick-team-options' });
    [game.awayTeam, game.homeTeam].forEach((team) => {
      const controlId = `pick-${game.gameId}-${team}`.replace(/[^A-Za-z0-9_-]/g, '-');
      const input = createElement('input', {
        attributes: {
          type: 'radio',
          id: controlId,
          name: `pick-${game.gameId}`,
          value: team,
        },
      });
      input.dataset.gameId = game.gameId;
      if (selected[game.gameId] === team) input.checked = true;
      input.addEventListener('change', () => {
        currentSelections[game.gameId] = team;
        updateAvailability();
      });
      const label = createElement('label', { className: 'pick-team-choice', attributes: { for: controlId } });
      appendChildren(label, [input, createElement('span', { text: team })]);
      choices.appendChild(label);
    });
    fieldset.appendChild(choices);
    return fieldset;
  }

  function gameStatusPill(game) {
    return createElement('span', {
      className: `status-pill ${game.editable ? '' : 'status-pill-muted'}`,
      text: game.editable ? 'Editable' : 'Locked',
    });
  }

  function gameMetaLines(game, selected) {
    const savedPick = selected[game.gameId] || '';
    const finalResultLines = game.status === 'final'
      ? [
          createElement('p', { className: 'muted', text: `Your pick: ${savedPick || 'No pick'}` }),
          createElement('span', { className: 'status-pill', text: gamePickResult(game, savedPick) }),
        ]
      : [];
    return [
      createElement('p', { className: 'muted', text: `Kickoff: ${formatDateTime(game.kickoffAt)}` }),
      createElement('p', { className: 'muted', text: `Locks: ${formatDateTime(game.lockAt)}` }),
      ...(game.awayScore !== '' && game.homeScore !== '' ? [createElement('p', {
        className: 'muted',
        text: `${game.awayTeam} ${game.awayScore}, ${game.homeTeam} ${game.homeScore}${game.winnerTeam ? ` - Winner: ${game.winnerTeam}` : ' - Tie'}`,
      })] : []),
      ...finalResultLines,
    ];
  }

  function createGameCard(game, selected) {
    const card = createElement('article', { className: 'player-card pick-game-card' });
    const header = createElement('div', { className: 'pick-game-card-header' });
    const meta = createElement('div', { className: 'pick-game-meta' });
    header.appendChild(gameStatusPill(game));
    appendChildren(meta, gameMetaLines(game, selected));
    appendChildren(card, [
      header,
      meta,
      createPickControls(game, selected),
    ]);
    return card;
  }

  function createTiebreakerCard(game, selected) {
    const card = createElement('article', { className: 'player-card pick-game-card tiebreaker-panel' });
    const tiebreakerField = createElement('label', { className: 'form-field tiebreaker-total-field' });
    const input = createElement('input', {
      attributes: {
        type: 'number',
        min: '0',
        max: '200',
        step: '1',
        value: currentPredictedTotal,
        'data-tiebreaker-total': 'true',
      },
    });
    input.addEventListener('input', () => {
      currentPredictedTotal = input.value;
      updateAvailability();
    });
    appendChildren(tiebreakerField, [
      createElement('span', { text: 'Predicted Total Points' }),
      input,
      createElement('small', { className: 'muted', text: 'Enter the combined final score for the tiebreaker game.' }),
    ]);
    appendChildren(card, [
      createElement('p', { className: 'eyebrow', text: 'Tiebreaker' }),
      createElement('h3', { className: 'tiebreaker-matchup', text: `${game.awayTeam} at ${game.homeTeam}` }),
      gameStatusPill(game),
      appendChildren(createElement('div', { className: 'pick-game-meta' }), gameMetaLines(game, selected)),
      createPickControls(game, selected),
      tiebreakerField,
    ]);
    return card;
  }

  function renderState() {
    content.replaceChildren();
    if (!state) {
      updateAvailability();
      return;
    }
    const progress = state.progress || { completed: 0, total: 0 };
    weekBadge.textContent = `WEEK ${state.week.nflWeek}`;
    const selected = selectedByGameId();
    currentSelections = { ...selected };
    currentPredictedTotal = authoritativePredictedTotal();
    const summary = createElement('section', { className: 'state-card compact-card' });
    const details = createElement('dl', { className: 'player-meta' });
    [
      ['Entry', state.entry.entryLabel || 'Entry'],
      ['Week', `Season ${state.week.season} - Week ${state.week.nflWeek}`],
      ['Progress', `${progress.completed} of ${progress.total} picks completed`],
    ].forEach(([label, value]) => {
      details.appendChild(createElement('dt', { text: label }));
      details.appendChild(createElement('dd', { text: value }));
    });
    appendChildren(summary, [
      createElement('h2', { text: state.entry.entryLabel || 'Entry' }),
      createElement('span', { className: `status-pill ${progress.complete ? '' : 'status-pill-muted'}`, text: progress.complete ? 'Complete' : 'In progress' }),
      details,
    ]);
    if (state.result) {
      const resultDetails = createElement('dl', { className: 'player-meta' });
      [
        ['Correct picks', `${state.result.regularPoints} of ${state.result.totalGames}`],
        ['Rank', String(state.result.rank)],
        ['Graded', formatDateTime(state.result.gradedAt)],
      ].forEach(([label, value]) => {
        resultDetails.appendChild(createElement('dt', { text: label }));
        resultDetails.appendChild(createElement('dd', { text: value }));
      });
      appendChildren(summary, [
        createElement('h3', { text: 'Results' }),
        createElement('span', { className: 'status-pill', text: `${state.result.regularPoints} of ${state.result.totalGames}` }),
        resultDetails,
      ]);
    }
    content.appendChild(summary);

    const tiebreakerGameId = state.tiebreaker ? state.tiebreaker.gameId : '';
    const tiebreakerGame = (state.games || []).find((game) => game.gameId === tiebreakerGameId);
    if (tiebreakerGameId && !tiebreakerGame) {
      saveBlocked = true;
      message.textContent = 'Tiebreaker game is unavailable. Return to the dashboard before trying again.';
      message.classList.add('error-text');
      updateAvailability();
      return;
    }
    (state.games || [])
      .filter((game) => game.gameId !== tiebreakerGameId)
      .forEach((game) => content.appendChild(createGameCard(game, selected)));
    if (tiebreakerGame) content.appendChild(createTiebreakerCard(tiebreakerGame, selected));
    content.appendChild(bottomButtons);
    updateAvailability();
  }

  async function loadEntryPicks(options = {}) {
    const result = await playerAction('player.entry.picks.get', { entryId });
    state = result.data;
    entryAvailable = true;
    saveBlocked = false;
    renderState();
    if (!options.preserveMessage) {
      message.textContent = '';
      message.classList.remove('error-text');
    }
  }

  async function savePicks() {
    if (saving || saveBlocked || !state || !entryAvailable) return;
    const selections = dirtySelections();
    const tiebreakerDirty = dirtyPredictedTotal();
    if (!selections.length && !tiebreakerDirty) return;

    saving = true;
    message.textContent = 'Saving picks...';
    message.classList.remove('error-text');
    updateAvailability();
    try {
      const result = await playerAction('player.entry.picks.save', { entryId, selections, predictedTotal: currentPredictedTotal });
      state = result.data;
      renderState();
      message.textContent = `Picks saved. ${state.progress.completed} of ${state.progress.total} completed.`;
    } catch (error) {
      if (error.code === 'ENTRY_NOT_AVAILABLE') {
        entryAvailable = false;
        saveBlocked = true;
        message.textContent = error.message;
        message.classList.add('error-text');
      } else if (error.code === 'NETWORK_ERROR' || error.code === 'PARSE_ERROR') {
        message.textContent = 'The save result was unclear. Checking the authoritative saved picks...';
        message.classList.add('error-text');
        try {
          await loadEntryPicks({ preserveMessage: true });
          message.textContent = 'The save result was unclear. Authoritative picks were reloaded; review them before saving again.';
        } catch (refreshError) {
          saveBlocked = true;
          message.textContent = `The save result was unclear and picks could not be reloaded. Return to the dashboard before trying again. ${refreshError.message}`;
        }
      } else if (RECONCILED_CONFLICT_CODES.has(error.code)) {
        const conflictMessage = error.message;
        message.textContent = conflictMessage;
        message.classList.add('error-text');
        try {
          await loadEntryPicks({ preserveMessage: true });
          message.textContent = `${conflictMessage} Authoritative picks and lock state were reloaded.`;
        } catch (refreshError) {
          saveBlocked = true;
          message.textContent = `${conflictMessage} Authoritative lock state could not be confirmed. Return to the dashboard before trying again.`;
        }
      } else {
        message.textContent = error.message;
        message.classList.add('error-text');
      }
    } finally {
      saving = false;
      updateAvailability();
    }
  }

  topSave.addEventListener('click', savePicks);
  bottomSave.addEventListener('click', savePicks);

  if (entryId) {
    loadEntryPicks().catch((error) => {
      if (error.code === 'ENTRY_NOT_AVAILABLE') entryAvailable = false;
      message.textContent = error.message;
      message.classList.add('error-text');
      saveBlocked = true;
      updateAvailability();
    });
  } else {
    entryAvailable = false;
    saveBlocked = true;
    message.classList.add('error-text');
  }
  return wrapper;
}

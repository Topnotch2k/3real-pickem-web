import { getPlayerSessionToken } from '../player-auth.js';
import { requestAction } from '../api.js';
import { navigateTo } from '../router.js';

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
  let saving = false;
  let saveBlocked = false;
  let entryAvailable = Boolean(entryId);

  const wrapper = createElement('main', { className: 'page-container narrow-page' });
  const header = createElement('section', { className: 'state-card' });
  const content = createElement('section', { className: 'pick-game-list', attributes: { 'aria-label': 'Weekly games' } });
  const message = createElement('p', {
    className: 'muted',
    text: entryId ? 'Loading entry picks...' : 'A valid entry is required.',
    attributes: { role: 'status', 'aria-live': 'polite' },
  });
  const back = createElement('button', { className: 'secondary-button', text: 'Player Dashboard', attributes: { type: 'button' } });
  const save = createElement('button', { className: 'primary-button', text: 'Save Picks', attributes: { type: 'button', disabled: 'disabled' } });
  const buttons = createElement('div', { className: 'button-row' });
  appendChildren(buttons, [save, back]);
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

  function updateAvailability() {
    const dirty = dirtySelections();
    const hasAuthoritativePicks = Boolean(state && state.picks && state.picks.length);
    const hasEditableGames = Boolean(state && (state.games || []).some((game) => game.editable));
    save.disabled = !state || saving || saveBlocked || !entryAvailable || dirty.length === 0;
    save.textContent = saving
      ? 'Saving Picks...'
      : saveBlocked || !entryAvailable
        ? 'Save Unavailable'
        : state && hasEditableGames && hasAuthoritativePicks && dirty.length === 0
          ? 'Picks Saved'
          : 'Save Picks';
    content.querySelectorAll('input[type="radio"]').forEach((control) => {
      const game = (state.games || []).find((item) => item.gameId === control.dataset.gameId);
      control.disabled = saving || saveBlocked || !entryAvailable || !game || !game.editable;
    });
  }

  function renderState() {
    content.replaceChildren();
    if (!state) {
      updateAvailability();
      return;
    }
    const progress = state.progress || { completed: 0, total: 0 };
    const selected = selectedByGameId();
    currentSelections = { ...selected };
    const summary = createElement('section', { className: 'state-card compact-card' });
    const details = createElement('dl', { className: 'player-meta' });
    [
      ['Entry', state.entry.entryLabel || 'Entry'],
      ['Week', `Season ${state.week.season} - Week ${state.week.nflWeek}`],
      ['Progress', `${progress.completed} of ${progress.total} picks completed`],
      ['Thursday lock', formatDateTime(state.week.thursdayLockAt)],
      ['Main lock', formatDateTime(state.week.mainLockAt)],
    ].forEach(([label, value]) => {
      details.appendChild(createElement('dt', { text: label }));
      details.appendChild(createElement('dd', { text: value }));
    });
    appendChildren(summary, [
      createElement('h2', { text: state.entry.entryLabel || 'Entry' }),
      createElement('span', { className: `status-pill ${progress.complete ? '' : 'status-pill-muted'}`, text: progress.complete ? 'Complete' : 'In progress' }),
      details,
    ]);
    content.appendChild(summary);

    (state.games || []).forEach((game) => {
      const card = createElement('article', { className: 'player-card pick-game-card' });
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
      appendChildren(card, [
        createElement('span', { className: `status-pill ${game.editable ? '' : 'status-pill-muted'}`, text: game.editable ? 'Editable' : 'Locked' }),
        createElement('p', { className: 'muted', text: `Kickoff: ${formatDateTime(game.kickoffAt)}` }),
        createElement('p', { className: 'muted', text: `Locks: ${formatDateTime(game.lockAt)}` }),
        fieldset,
      ]);
      content.appendChild(card);
    });
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

  save.addEventListener('click', async () => {
    if (saving || saveBlocked || !state || !entryAvailable) return;
    const selections = dirtySelections();
    if (!selections.length) return;

    saving = true;
    message.textContent = 'Saving picks...';
    message.classList.remove('error-text');
    updateAvailability();
    try {
      const result = await playerAction('player.entry.picks.save', { entryId, selections });
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
  });

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

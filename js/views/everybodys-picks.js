import { getManagerSessionToken } from '../auth.js';
import { getPlayerSessionToken } from '../player-auth.js';
import { requestAction } from '../api.js';
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

function actorConfig(actor) {
  return actor === 'manager'
    ? {
        action: 'manager.week.picksBoard',
        token: getManagerSessionToken,
        backRoute: 'manager-dashboard',
        backText: 'Back to Manager Dashboard',
      }
    : {
        action: 'player.week.picksBoard',
        token: getPlayerSessionToken,
        backRoute: 'player-dashboard',
        backText: 'Back to Player Dashboard',
      };
}

function weekLabel(week) {
  if (week.current) return `Current - Week ${week.nflWeek}`;
  return `${week.season} - Week ${week.nflWeek}`;
}

function displayValue(value) {
  return value === '' || value === null || value === undefined ? '-' : String(value);
}

function gameIsFinal(game) {
  return String(game && game.status || '').toLowerCase() === 'final';
}

function scoreLine(game) {
  if (!game || game.awayScore === '' || game.homeScore === '' || game.awayScore === null || game.homeScore === null) return '';
  return `${game.awayTeam} ${game.awayScore} - ${game.homeTeam} ${game.homeScore}`;
}

function pickClass(game, selectedTeam) {
  if (!gameIsFinal(game) || !game.winnerTeam || !selectedTeam) return 'picks-board-pick';
  return selectedTeam === game.winnerTeam ? 'picks-board-pick picks-board-correct' : 'picks-board-pick picks-board-incorrect';
}

function renderPickCell(game, pick) {
  const cell = createElement('td');
  if (!pick || pick.revealed === false) {
    cell.appendChild(createElement('span', { className: 'picks-board-pick status-pill status-pill-muted', text: 'LOCKED' }));
    return cell;
  }
  const selectedTeam = String(pick.selectedTeam || '');
  cell.appendChild(createElement('span', { className: pickClass(game, selectedTeam), text: selectedTeam || '-' }));
  return cell;
}

function renderHeaderCell(game, label) {
  const cell = createElement('th', { attributes: { scope: 'col' } });
  appendChildren(cell, [
    createElement('span', { text: label || game.awayTeam }),
    createElement('span', { className: 'muted', text: label ? '' : `@ ${game.homeTeam}` }),
  ]);
  const score = scoreLine(game);
  if (score) cell.appendChild(createElement('small', { className: 'muted', text: score }));
  return cell;
}

function renderPlayerCell(row) {
  const cell = createElement('th', { className: 'picks-board-sticky picks-board-player', attributes: { scope: 'row' } });
  appendChildren(cell, [
    createElement('span', { text: row.playerName || 'Unknown player' }),
    createElement('span', { className: 'muted', text: row.entryLabel || row.entryId || 'Entry' }),
  ]);
  if (row.isWeeklyWinner === true) {
    cell.appendChild(createElement('span', { className: 'status-pill', text: 'Winner' }));
  }
  return cell;
}

function renderBoard(data) {
  const boardCard = createElement('section', { className: 'state-card' });
  if (!data.availableWeeks || !data.availableWeeks.length) {
    boardCard.appendChild(createElement('p', { className: 'muted', text: 'No Weeks are available yet.' }));
    return boardCard;
  }
  if (!data.week) {
    boardCard.appendChild(createElement('p', { className: 'muted', text: 'No Week is currently available.' }));
    return boardCard;
  }
  if (!data.rows || !data.rows.length) {
    boardCard.appendChild(createElement('p', { className: 'muted', text: 'No entries for this Week.' }));
    return boardCard;
  }

  const scroll = createElement('div', { className: 'picks-board-scroll' });
  const table = createElement('table', { className: 'picks-board-table' });
  const thead = createElement('thead');
  const headerRow = createElement('tr');
  headerRow.appendChild(createElement('th', { className: 'picks-board-sticky', text: 'Player / Entry', attributes: { scope: 'col' } }));
  (data.matchups || []).forEach((game) => headerRow.appendChild(renderHeaderCell(game)));
  headerRow.appendChild(renderHeaderCell(data.tiebreakerGame || {}, 'Tiebreaker Pick'));
  ['Predicted Total', 'Correct Picks', 'Points Away'].forEach((label) => {
    headerRow.appendChild(createElement('th', { text: label, attributes: { scope: 'col' } }));
  });
  thead.appendChild(headerRow);

  const tbody = createElement('tbody');
  data.rows.forEach((row) => {
    const tr = createElement('tr');
    tr.appendChild(renderPlayerCell(row));
    (data.matchups || []).forEach((game) => {
      tr.appendChild(renderPickCell(game, row.picks ? row.picks[game.gameId] : null));
    });
    tr.appendChild(renderPickCell(data.tiebreakerGame || {}, row.tiebreaker));
    const predicted = row.tiebreaker && row.tiebreaker.revealed === false
      ? 'LOCKED'
      : displayValue(row.tiebreaker && row.tiebreaker.predictedTotal);
    tr.appendChild(createElement('td', { text: predicted }));
    tr.appendChild(createElement('td', { text: displayValue(row.correctPicks) }));
    tr.appendChild(createElement('td', { text: displayValue(row.pointsAway) }));
    tbody.appendChild(tr);
  });
  appendChildren(table, [thead, tbody]);
  scroll.appendChild(table);
  boardCard.appendChild(scroll);
  return boardCard;
}

function renderBoardNotice(text) {
  const boardCard = createElement('section', { className: 'state-card' });
  boardCard.appendChild(createElement('p', { className: 'muted', text }));
  return boardCard;
}

export function createEverybodysPicksView({ actor = 'player' } = {}) {
  const config = actorConfig(actor);
  let boardData = null;
  let loadVersion = 0;
  const wrapper = createElement('main', { className: 'page-container' });
  const header = createElement('section', { className: 'state-card manager-toolbar' });
  const controls = createElement('div', { className: 'manager-controls' });
  const weekSelect = createElement('select', { attributes: { name: 'weekId' } });
  const back = createElement('button', { className: 'secondary-button', text: config.backText, attributes: { type: 'button' } });
  const message = createElement('p', {
    className: 'muted',
    text: 'Loading Everybody\'s Picks...',
    attributes: { role: 'status', 'aria-live': 'polite' },
  });
  const boardRegion = createElement('section');

  function actionPayload(weekId = '') {
    return weekId ? { sessionToken: config.token(), weekId } : { sessionToken: config.token() };
  }

  function renderWeekOptions() {
    weekSelect.replaceChildren();
    const weeks = boardData && Array.isArray(boardData.availableWeeks) ? boardData.availableWeeks : [];
    weeks.forEach((week) => {
      const option = createElement('option', { text: weekLabel(week), attributes: { value: week.weekId } });
      if (week.weekId === boardData.selectedWeekId) option.selected = true;
      weekSelect.appendChild(option);
    });
    weekSelect.disabled = !weeks.length;
  }

  function render() {
    renderWeekOptions();
    boardRegion.replaceChildren(renderBoard(boardData || { availableWeeks: [], week: null, rows: [] }));
  }

  async function loadBoard(weekId = '') {
    const currentVersion = ++loadVersion;
    message.textContent = 'Loading Everybody\'s Picks...';
    message.classList.remove('error-text');
    weekSelect.disabled = true;
    boardRegion.replaceChildren(renderBoardNotice('Loading Everybody\'s Picks...'));
    try {
      const result = await requestAction(config.action, actionPayload(weekId));
      if (currentVersion !== loadVersion || !wrapper.isConnected) return;
      boardData = result.data || {};
      message.textContent = '';
      message.classList.remove('error-text');
      render();
    } catch (error) {
      if (currentVersion !== loadVersion || !wrapper.isConnected) return;
      renderWeekOptions();
      boardRegion.replaceChildren(renderBoardNotice('Unable to load Everybody\'s Picks.'));
      message.textContent = error.message;
      message.classList.add('error-text');
    }
  }

  weekSelect.addEventListener('change', () => {
    loadBoard(weekSelect.value);
  });
  back.addEventListener('click', () => navigateTo(config.backRoute));

  appendChildren(controls, [
    createField('Week', weekSelect),
    back,
  ]);
  appendChildren(header, [
    createElement('p', { className: 'eyebrow', text: 'Picks' }),
    createElement('h1', { text: 'Everybody\'s Picks' }),
    controls,
    message,
  ]);
  appendChildren(wrapper, [header, boardRegion]);
  loadBoard();
  return wrapper;
}

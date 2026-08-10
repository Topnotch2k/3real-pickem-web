import { getManagerSessionToken } from '../auth.js?v=20260809-2';
import { getPlayerSessionToken } from '../player-auth.js?v=20260809-2';
import { requestAction } from '../api.js?v=20260809-2';
import { navigateTo } from '../router.js?v=20260809-2';

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
        resultsRoute: '',
      }
    : {
        action: 'player.week.picksBoard',
        token: getPlayerSessionToken,
        backRoute: 'player-dashboard',
        backText: 'Back to Player Dashboard',
        resultsRoute: 'player-weekly-results',
      };
}

function seasonTypeLabel(value) {
  if (value === 'preseason') return 'Preseason';
  if (value === 'postseason') return 'Postseason';
  return 'Regular Season';
}

function weekLabel(week) {
  const label = `${seasonTypeLabel(week.seasonType)} Week ${week.nflWeek}`;
  if (week.current) return `Current - ${label}`;
  return `${week.season} - ${label}`;
}

function displayValue(value) {
  return value === '' || value === null || value === undefined ? '-' : String(value);
}

function plural(value, singular, pluralText) {
  return Number(value) === 1 ? singular : pluralText;
}

function formatPercent(value) {
  if (value === '' || value === null || value === undefined) return '-';
  const number = Number(value);
  if (!Number.isFinite(number)) return displayValue(value);
  return `${Number.isInteger(number) ? number : Number(number.toFixed(2))}%`;
}

function formatMoney(cents) {
  const number = Number(cents);
  if (!Number.isFinite(number)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(number / 100);
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

function renderLeaderCategory(title, rows, value) {
  const card = createElement('article', { className: 'league-leader-card' });
  card.appendChild(createElement('h3', { text: title }));
  const list = createElement('ol', { className: 'league-leader-list' });
  (Array.isArray(rows) ? rows.slice(0, 3) : []).forEach((leader, index) => {
    const item = createElement('li');
    appendChildren(item, [
      createElement('span', { text: `${index + 1}. ${leader.playerName || 'Unknown player'}` }),
      createElement('span', { className: 'muted', text: value(leader) }),
    ]);
    list.appendChild(item);
  });
  if (!list.children.length) list.appendChild(createElement('li', { className: 'muted', text: 'No leader yet' }));
  card.appendChild(list);
  return card;
}

function renderLeagueLeaders(data) {
  const section = createElement('section', { className: 'league-leaders-grid' });
  const leaders = data && data.leaders ? data.leaders : {};
  appendChildren(section, [
    renderLeaderCategory('\uD83D\uDC51 Most Wins', leaders.mostWins, (leader) => `${displayValue(leader.weeklyWins)} ${plural(leader.weeklyWins, 'win', 'wins')}`),
    renderLeaderCategory('\uD83C\uDFAF Best Accuracy', leaders.bestAccuracy, (leader) => formatPercent(leader.accuracy)),
    renderLeaderCategory('\uD83D\uDD25 Best Streak', leaders.bestStreak, (leader) => `${displayValue(leader.longestStreak)} ${plural(leader.longestStreak, 'week', 'weeks')}`),
    renderLeaderCategory('\uD83E\uDD1D Top Recruiter', leaders.topRecruiter, (leader) => `${displayValue(leader.qualifiedReferralCount)} ${plural(leader.qualifiedReferralCount, 'recruit', 'recruits')}`),
  ]);
  return section;
}

function renderWinnerPill(standing) {
  return standing.isWeeklyWinner === true ? createElement('span', { className: 'status-pill', text: 'Winner' }) : null;
}

function renderLeaderboardTable(columns, rows, cellRenderers) {
  const scroll = createElement('div', { className: 'leaderboard-scroll' });
  const table = createElement('table', { className: 'leaderboard-table' });
  const thead = createElement('thead');
  const headRow = createElement('tr');
  columns.forEach((column) => headRow.appendChild(createElement('th', { text: column, attributes: { scope: 'col' } })));
  thead.appendChild(headRow);
  const tbody = createElement('tbody');
  rows.forEach((row) => {
    const tr = createElement('tr');
    cellRenderers.forEach((renderCell, index) => {
      const cell = createElement(index === 0 ? 'th' : 'td', { attributes: index === 0 ? { scope: 'row' } : {} });
      const content = renderCell(row);
      if (Array.isArray(content)) appendChildren(cell, content.filter(Boolean));
      else cell.textContent = content;
      tr.appendChild(cell);
    });
    tbody.appendChild(tr);
  });
  appendChildren(table, [thead, tbody]);
  scroll.appendChild(table);
  return scroll;
}

function renderWeeklyLeaderboard(weekly) {
  if (!weekly || weekly.graded === false) return createElement('p', { className: 'muted', text: 'Leaderboard appears after the Week is graded.' });
  const standings = Array.isArray(weekly.standings) ? weekly.standings : [];
  if (!standings.length) return createElement('p', { className: 'muted', text: 'No graded entries for this Week.' });
  return renderLeaderboardTable(
    ['#', 'Player / Entry', 'Correct', 'Points Away'],
    standings,
    [
      (standing) => displayValue(standing.position),
      (standing) => [
        createElement('span', { text: standing.playerName || 'Unknown player' }),
        createElement('small', { className: 'muted', text: standing.entryLabel || standing.entryId || 'Entry' }),
        renderWinnerPill(standing),
      ],
      (standing) => displayValue(standing.correctPicks),
      (standing) => displayValue(standing.pointsAway),
    ],
  );
}

function renderSeasonLeaderboard(season) {
  const standings = season && Array.isArray(season.standings) ? season.standings : [];
  const fragment = document.createDocumentFragment();
  if (season && season.season) fragment.appendChild(createElement('p', { className: 'muted', text: `Season ${season.season}` }));
  if (!standings.length) {
    fragment.appendChild(createElement('p', { className: 'muted', text: 'No season results yet.' }));
    return fragment;
  }
  fragment.appendChild(renderLeaderboardTable(
    ['#', 'Player', 'Correct', 'Accuracy', 'Wins', 'Best Week', 'Weeks Played'],
    standings,
    [
      (standing) => displayValue(standing.position),
      (standing) => displayValue(standing.playerName),
      (standing) => displayValue(standing.totalCorrect),
      (standing) => formatPercent(standing.accuracy),
      (standing) => displayValue(standing.weeklyWins),
      (standing) => displayValue(standing.bestWeek),
      (standing) => displayValue(standing.gradedWeeksPlayed),
    ],
  ));
  return fragment;
}

function renderAllTimeLeaderboard(allTime) {
  const standings = allTime && Array.isArray(allTime.standings) ? allTime.standings : [];
  if (!standings.length) return createElement('p', { className: 'muted', text: 'No all-time results yet.' });
  return renderLeaderboardTable(
    ['#', 'Player', 'Wins', 'Accuracy', 'Correct', 'Best Week', 'Weeks Played'],
    standings,
    [
      (standing) => displayValue(standing.position),
      (standing) => displayValue(standing.playerName),
      (standing) => displayValue(standing.weeklyWins),
      (standing) => formatPercent(standing.accuracy),
      (standing) => displayValue(standing.totalCorrect),
      (standing) => displayValue(standing.bestWeek),
      (standing) => displayValue(standing.gradedWeeksPlayed),
    ],
  );
}

function renderLeaderboard(data, activeTab, setActiveTab) {
  const section = createElement('section', { className: 'state-card leaderboard-section' });
  appendChildren(section, [createElement('h2', { text: 'Leaderboard' })]);
  const tabs = createElement('div', { className: 'button-row leaderboard-tabs' });
  [
    ['weekly', 'This Week'],
    ['season', 'Season'],
    ['allTime', 'All-Time'],
  ].forEach(([tab, label]) => {
    const button = createElement('button', {
      className: activeTab === tab ? 'primary-button' : 'secondary-button',
      text: label,
      attributes: { type: 'button' },
    });
    button.addEventListener('click', () => setActiveTab(tab));
    tabs.appendChild(button);
  });
  section.appendChild(tabs);
  const leaderboards = data && data.leaderboards ? data.leaderboards : {};
  if (activeTab === 'season') section.appendChild(renderSeasonLeaderboard(leaderboards.season));
  else if (activeTab === 'allTime') section.appendChild(renderAllTimeLeaderboard(leaderboards.allTime));
  else section.appendChild(renderWeeklyLeaderboard(leaderboards.weekly));
  return section;
}

function renderCurrentPot(data) {
  const pot = data && data.currentPot;
  if (!pot || pot.visible !== true) return null;
  const panel = createElement('div', { className: 'picks-board-pot' });
  appendChildren(panel, [
    createElement('span', { className: 'eyebrow', text: 'Current Pot' }),
    createElement('span', { className: 'picks-board-pot-amount', text: formatMoney(pot.amountCents) }),
    createElement('span', { className: 'picks-board-pot-caption', text: 'Prize Pool' }),
  ]);
  return panel;
}

function renderWeeklyResultsBanner(data, config) {
  const weekId = data && data.selectedWeekId;
  if (
    !config.resultsRoute ||
    !weekId ||
    data.grading?.graded !== true ||
    data.weeklyResults?.available !== true
  ) {
    return null;
  }
  const button = createElement('button', {
    className: 'weekly-results-banner',
    attributes: { type: 'button' },
  });
  appendChildren(button, [
    createElement('span', { className: 'weekly-results-banner-title', text: 'WEEKLY RESULTS ARE IN \u{1F3C6}' }),
    createElement('span', { className: 'weekly-results-banner-copy', text: 'See Champion & Podium' }),
  ]);
  button.addEventListener('click', () => {
    navigateTo(`${config.resultsRoute}?weekId=${encodeURIComponent(weekId)}`);
  });
  return button;
}

export function createEverybodysPicksView({ actor = 'player' } = {}) {
  const config = actorConfig(actor);
  let boardData = null;
  let loadVersion = 0;
  let activeLeaderboardTab = 'weekly';
  const wrapper = createElement('main', { className: 'page-container' });
  const header = createElement('section', { className: 'state-card manager-toolbar' });
  const controls = createElement('div', { className: 'manager-controls picks-board-controls' });
  const weekSelect = createElement('select', { attributes: { name: 'weekId' } });
  const actions = createElement('div', { className: 'picks-board-actions' });
  const back = createElement('button', { className: 'secondary-button', text: config.backText, attributes: { type: 'button' } });
  const message = createElement('p', {
    className: 'muted',
    text: 'Loading Everybody\'s Picks...',
    attributes: { role: 'status', 'aria-live': 'polite' },
  });
  const leadersRegion = createElement('section');
  const leaderboardRegion = createElement('section');
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
    actions.replaceChildren();
    const resultsBanner = renderWeeklyResultsBanner(boardData || {}, config);
    if (resultsBanner) actions.appendChild(resultsBanner);
    const currentPot = renderCurrentPot(boardData || {});
    if (currentPot) actions.appendChild(currentPot);
    actions.appendChild(back);
    leadersRegion.replaceChildren(renderLeagueLeaders(boardData || {}));
    leaderboardRegion.replaceChildren(renderLeaderboard(boardData || {}, activeLeaderboardTab, (tab) => {
      activeLeaderboardTab = tab;
      if (wrapper.isConnected) render();
    }));
    boardRegion.replaceChildren(renderBoard(boardData || { availableWeeks: [], week: null, rows: [] }));
  }

  async function loadBoard(weekId = '') {
    const currentVersion = ++loadVersion;
    message.textContent = 'Loading Everybody\'s Picks...';
    message.classList.remove('error-text');
    weekSelect.disabled = true;
    leadersRegion.replaceChildren(renderBoardNotice('Loading Everybody\'s Picks...'));
    leaderboardRegion.replaceChildren();
    boardRegion.replaceChildren(renderBoardNotice('Loading Everybody\'s Picks...'));
    try {
      const result = await requestAction(config.action, actionPayload(weekId));
      if (currentVersion !== loadVersion || !wrapper.isConnected) return;
      boardData = result.data || {};
      activeLeaderboardTab = 'weekly';
      message.textContent = '';
      message.classList.remove('error-text');
      render();
    } catch (error) {
      if (currentVersion !== loadVersion || !wrapper.isConnected) return;
      renderWeekOptions();
      leadersRegion.replaceChildren(renderBoardNotice('Unable to load Everybody\'s Picks.'));
      leaderboardRegion.replaceChildren();
      boardRegion.replaceChildren(renderBoardNotice('Unable to load Everybody\'s Picks.'));
      message.textContent = error.message;
      message.classList.add('error-text');
    }
  }

  weekSelect.addEventListener('change', () => {
    loadBoard(weekSelect.value);
  });
  back.addEventListener('click', () => navigateTo(config.backRoute));
  actions.appendChild(back);

  appendChildren(controls, [
    createField('Week', weekSelect),
    actions,
  ]);
  appendChildren(header, [
    createElement('p', { className: 'eyebrow', text: 'Picks' }),
    createElement('h1', { text: 'Everybody\'s Picks' }),
    controls,
    message,
  ]);
  appendChildren(wrapper, [leadersRegion, header, boardRegion, leaderboardRegion]);
  loadBoard();
  return wrapper;
}

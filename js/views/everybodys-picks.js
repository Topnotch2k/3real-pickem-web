import { getManagerSessionToken } from '../auth.js?v=20260816-1';
import { getPlayerSessionToken } from '../player-auth.js?v=20260816-1';
import { requestAction } from '../api.js?v=20260816-1';
import { navigateTo } from '../router.js?v=20260816-1';
import { createManagerNav, createPlayerNav } from '../navigation.js?v=20260919-6';

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

const BADGE_PRIORITY = [
  'goat',
  'perfect_week',
  'weekly_champ',
  'multi_champ',
  'hot_streak',
  'exact_tiebreaker',
  'referral_milestone',
  'recruiter',
];

const BADGE_EMOJI = {
  goat: '🐐',
  perfect_week: '💯',
  weekly_champ: '👑',
  multi_champ: '🏆',
  hot_streak: '🔥',
  exact_tiebreaker: '🎯',
  referral_milestone: '💎',
  recruiter: '🤝',
};

function renderBadgeEmojis(badgeCodes) {
  const codes = Array.isArray(badgeCodes) ? badgeCodes : [];
  const badges = BADGE_PRIORITY
    .filter((code) => codes.includes(code))
    .slice(0, 3)
    .map((code) => createElement('span', {
      className: `player-badge player-badge-${code.replace(/_/g, '-')}`,
      text: BADGE_EMOJI[code],
      attributes: {
        'data-badge-code': code,
        'aria-label': code.replace(/_/g, ' '),
        title: code.replace(/_/g, ' '),
      },
    }));
  if (!badges.length) return null;
  const container = createElement('span', {
    className: 'player-name-badges',
    attributes: { 'aria-label': 'Earned badges' },
  });
  return appendChildren(container, badges);
}

function renderPlayerName(name, badgeCodes) {
  const nameWithBadges = createElement('span', { className: 'player-name-with-badges' });
  appendChildren(nameWithBadges, [
    createElement('span', { text: name || 'Unknown player' }),
    renderBadgeEmojis(badgeCodes),
  ].filter(Boolean));
  return nameWithBadges;
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

function correctPicksLabel(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number} Correct` : '';
}

function renderPlayerCell(row, badgesByPlayer = {}) {
  const cell = createElement('th', { className: 'picks-board-sticky picks-board-player', attributes: { scope: 'row' } });
  const correctLabel = correctPicksLabel(row.correctPicks);
  appendChildren(cell, [
    renderPlayerName(row.playerName, Array.isArray(row.badgeCodes) ? row.badgeCodes : badgesByPlayer[row.playerId]),
    createElement('span', { className: 'muted', text: row.entryLabel || row.entryId || 'Entry' }),
    correctLabel ? createElement('span', { className: 'muted', text: correctLabel }) : null,
  ].filter(Boolean));
  if (row.isWeeklyWinner === true) {
    cell.appendChild(createElement('span', { className: 'status-pill', text: 'Winner' }));
  } else if (row.isClinchedWeeklyWinner === true) {
    cell.appendChild(createElement('span', { className: 'status-pill', text: 'Week Champion 🏆' }));
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
  ['Predicted Total', 'Points Away', 'Correct Picks'].forEach((label) => {
    headerRow.appendChild(createElement('th', { text: label, attributes: { scope: 'col' } }));
  });
  thead.appendChild(headerRow);

  const tbody = createElement('tbody');
  data.rows.forEach((row) => {
    const tr = createElement('tr');
    tr.appendChild(renderPlayerCell(row, data.badgesByPlayer));
    (data.matchups || []).forEach((game) => {
      tr.appendChild(renderPickCell(game, row.picks ? row.picks[game.gameId] : null));
    });
    tr.appendChild(renderPickCell(data.tiebreakerGame || {}, row.tiebreaker));
    const predicted = row.tiebreaker && row.tiebreaker.revealed === false
      ? 'LOCKED'
      : displayValue(row.tiebreaker && row.tiebreaker.predictedTotal);
    tr.appendChild(createElement('td', { text: predicted }));
    tr.appendChild(createElement('td', { text: displayValue(row.pointsAway) }));
    tr.appendChild(createElement('td', { text: displayValue(row.correctPicks) }));
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
      renderPlayerName(`${index + 1}. ${leader.playerName || 'Unknown player'}`, leader.badgeCodes),
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
    renderLeaderCategory('\u2764\uFE0F Most Loyal', leaders.mostLoyal, (leader) => `${displayValue(leader.paidEntryCount)} ${plural(leader.paidEntryCount, 'entry', 'entries')}`),
    renderLeaderCategory('\uD83D\uDCB0 BIGGEST POT', leaders.biggestPotWinners, (leader) => formatMoney(leader.totalPrizeWonCents)),
    renderLeaderCategory('\uD83E\uDD1D Top Recruiter', leaders.topRecruiter, (leader) => `${displayValue(leader.registeredRecruitCount)} ${plural(leader.registeredRecruitCount, 'recruit', 'recruits')}`),
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
      else if (content instanceof HTMLElement) cell.appendChild(content);
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
        renderPlayerName(standing.playerName, standing.badgeCodes),
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
      (standing) => renderPlayerName(standing.playerName, standing.badgeCodes),
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
      (standing) => renderPlayerName(standing.playerName, standing.badgeCodes),
      (standing) => displayValue(standing.weeklyWins),
      (standing) => formatPercent(standing.accuracy),
      (standing) => displayValue(standing.totalCorrect),
      (standing) => displayValue(standing.bestWeek),
      (standing) => displayValue(standing.gradedWeeksPlayed),
    ],
  );
}

const GOAT_CATEGORY_LABELS = {
  weeklyWins: 'WEEKLY WINS',
  accuracy: 'ACCURACY',
  totalCorrect: 'TOTAL CORRECT',
  bestWeek: 'BEST WEEK',
  gradedWeeksPlayed: 'GRADED WEEKS',
};

function renderGoatLeaderboard(goatSummary) {
  const section = createElement('div', { className: 'goat-leaderboard' });
  if (!goatSummary) {
    section.appendChild(createElement('p', { className: 'muted', text: 'The GOAT race begins after 3 graded Weeks.' }));
    return section;
  }
  appendChildren(section, [
    createElement('p', { className: 'eyebrow', text: 'CURRENT GOAT' }),
    createElement('h3', { text: `🐐 ${goatSummary.playerName || 'Unknown player'}` }),
    createElement('p', { className: 'muted', text: `${displayValue(goatSummary.goatPoints)} Core 5 category wins` }),
  ]);
  const categories = createElement('div', { className: 'goat-category-list' });
  Object.entries(GOAT_CATEGORY_LABELS).forEach(([key, label]) => {
    const category = goatSummary.categories && goatSummary.categories[key];
    if (!category) return;
    const value = key === 'accuracy' ? formatPercent(category.value) : displayValue(category.value);
    const leaders = Array.isArray(category.leaders) ? category.leaders.map((leader) => leader.playerName || 'Unknown player').join(', ') : '';
    const item = createElement('section', { className: 'goat-category' });
    appendChildren(item, [
      createElement('h4', { text: label }),
      createElement('strong', { text: value }),
      createElement('p', { className: 'muted', text: leaders }),
    ]);
    categories.appendChild(item);
  });
  section.appendChild(categories);
  return section;
}

function renderLeaderboard(data, activeTab, setActiveTab) {
  const section = createElement('section', { className: 'state-card leaderboard-section' });
  appendChildren(section, [createElement('h2', { text: 'Leaderboard' })]);
  const tabs = createElement('div', { className: 'button-row leaderboard-tabs' });
  [
    ['weekly', 'This Week'],
    ['season', 'Season'],
    ['allTime', 'All-Time'],
    ['goat', 'GOAT'],
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
  else if (activeTab === 'goat') section.appendChild(renderGoatLeaderboard(data.goatSummary));
  else section.appendChild(renderWeeklyLeaderboard(leaderboards.weekly));
  return section;
}

function renderCurrentPot(data) {
  const pot = data && data.currentPot;
  if (!pot || pot.visible !== true) return null;
  const isPreseason = data.week?.seasonType === 'preseason';
  const panel = createElement('div', { className: 'picks-board-pot' });
  appendChildren(panel, [
    createElement('span', { className: 'eyebrow', text: isPreseason ? 'Pot Preview' : 'Current Pot' }),
    createElement('span', { className: 'picks-board-pot-amount', text: formatMoney(pot.amountCents) }),
    createElement('span', {
      className: 'picks-board-pot-caption',
      text: isPreseason
        ? 'If this were a regular-season week, this would be the current prize pool.'
        : 'Prize Pool',
    }),
  ]);
  return panel;
}

function renderWeeklyResultsBanner(data, config) {
  const weekId = data && data.selectedWeekId;
  const hasFinalResults = data.weeklyResults?.available === true,
    hasClinchedChampion = Boolean(data.clinchedChampion);
  if (
    !config.resultsRoute ||
    !weekId ||
    (!hasFinalResults && !hasClinchedChampion)
  ) {
    return null;
  }
  const button = createElement('button', {
    className: 'weekly-results-banner',
    attributes: { type: 'button' },
  });
  appendChildren(button, [
    createElement('span', { className: 'weekly-results-banner-title', text: hasFinalResults ? 'WEEKLY RESULTS ARE IN \u{1F3C6}' : 'WEEK CHAMPION CLINCHED \u{1F3C6}' }),
    createElement('span', { className: 'weekly-results-banner-copy', text: hasFinalResults ? 'CLICK HERE TO SEE CHAMPION & PODIUM \u2192' : 'CLICK HERE TO SEE CHAMPION \u2192' }),
  ]);
  button.addEventListener('click', () => {
    navigateTo(`${config.resultsRoute}?weekId=${encodeURIComponent(weekId)}`);
  });
  return button;
}

export function createEverybodysPicksView({ actor = 'player', initialTab = 'weekly' } = {}) {
  const config = actorConfig(actor);
  let boardData = null;
  let loadVersion = 0;
  let activeLeaderboardTab = ['weekly', 'season', 'allTime', 'goat'].includes(initialTab) ? initialTab : 'weekly';
  let hasLoadedBoard = false;
  const initialGoatDeepLink = initialTab === 'goat';
  let didInitialGoatScroll = false;
  const wrapper = createElement('main', { className: actor === 'player' ? 'page-container player-page competitive-page' : 'page-container' });
  const header = createElement('section', { className: 'state-card manager-toolbar' });
  const identityRow = createElement('div', { className: 'everybodys-picks-identity' });
  const logo = createElement('img', {
    className: 'everybodys-picks-logo',
    attributes: {
      src: './assets/brand/3real-pickem-logo.png',
      alt: '3 Real Pick’em',
      width: '140',
      height: '140',
      decoding: 'async',
    },
  });
  const goatIdentity = createElement('div', { className: 'everybodys-picks-goat', attributes: { hidden: 'hidden' } });
  const controls = createElement('div', { className: 'manager-controls picks-board-controls' });
  const weekSelect = createElement('select', { attributes: { name: 'weekId' } });
  const actions = createElement('div', { className: 'picks-board-actions' });
  const back = createElement('button', { className: 'secondary-button', text: config.backText, attributes: { type: 'button' } });
  const message = createElement('p', {
    className: 'muted',
    text: 'Loading Everybody\'s Picks...',
    attributes: { role: 'status', 'aria-live': 'polite' },
  });
  const scoreRefreshNote = createElement('p', {
    className: 'muted',
    text: 'Scores are refreshed at scheduled checkpoints on game days and may not update immediately after every play or game.',
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
    const goatRow = boardData && boardData.leaderboards && boardData.leaderboards.allTime && boardData.leaderboards.allTime.standings
      ? boardData.leaderboards.allTime.standings.find((row) => Array.isArray(row.badgeCodes) && row.badgeCodes.includes('goat'))
      : null;
    goatIdentity.replaceChildren();
    if (goatRow) {
      goatIdentity.hidden = false;
      identityRow.classList.add('has-goat');
      appendChildren(goatIdentity, [
        createElement('img', {
          className: 'everybodys-picks-goat-image',
          attributes: {
            src: './assets/3real-goat.png',
            alt: 'Current GOAT',
            decoding: 'async',
          },
        }),
        createElement('span', { className: 'everybodys-picks-goat-name', text: goatRow.playerName || 'Unknown player' }),
      ]);
    } else {
      goatIdentity.hidden = true;
      identityRow.classList.remove('has-goat');
    }
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
    if (initialGoatDeepLink && !didInitialGoatScroll && leaderboardRegion.isConnected) {
      didInitialGoatScroll = true;
      window.requestAnimationFrame(() => {
        try {
          leaderboardRegion.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
        } catch {
          // Scrolling is an enhancement and must not interrupt the board.
        }
      });
    }
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
      activeLeaderboardTab = hasLoadedBoard ? 'weekly' : activeLeaderboardTab;
      hasLoadedBoard = true;
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
  appendChildren(identityRow, [logo, goatIdentity]);
  appendChildren(header, [
    createElement('p', { className: 'eyebrow', text: 'Picks' }),
    identityRow,
    createElement('h1', { text: 'Everybody\'s Picks' }),
    controls,
    message,
    ...(actor === 'player' ? [scoreRefreshNote] : []),
  ]);
  appendChildren(wrapper, [
    actor === 'manager' ? createManagerNav('manager-everybodys-picks') : createPlayerNav('player-everybodys-picks'),
    leadersRegion,
    header,
    boardRegion,
    leaderboardRegion,
  ]);
  loadBoard();
  return wrapper;
}


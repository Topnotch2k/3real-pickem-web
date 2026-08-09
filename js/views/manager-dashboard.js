import { getManagerSessionToken, logoutManager } from '../auth.js?v=20260808-5';
import { requestAction } from '../api.js?v=20260808-5';
import { buildInviteLink, copyInviteLink, shareInviteLink } from '../invite.js?v=20260808-5';
import { navigateTo } from '../router.js?v=20260808-5';

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) {
    element.className = options.className;
  }
  if (options.text) {
    element.textContent = options.text;
  }
  if (options.attributes) {
    Object.entries(options.attributes).forEach(([name, value]) => {
      element.setAttribute(name, value);
    });
  }
  return element;
}

function appendChildren(parent, children) {
  children.forEach((child) => parent.appendChild(child));
  return parent;
}

function managerAction(action, payload = {}) {
  return requestAction(action, { ...payload, sessionToken: getManagerSessionToken() });
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unavailable';
  }
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unavailable';
  }
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
}

function referralStatusLabel(status) {
  return {
    registered: 'Registered',
    qualified: 'Qualified',
  }[status] || 'Registered';
}

function referralBadgeLabel(badge) {
  return {
    football: 'Football',
    crown: 'Crown',
  }[badge] || 'None';
}

function createInviteCard() {
  let inviteData = null;
  const card = createElement('section', { className: 'state-card invite-card' });
  const status = createElement('p', { className: 'muted', attributes: { role: 'status', 'aria-live': 'polite' } });
  const controls = createElement('div', { className: 'button-row' });

  async function loadInvite() {
    status.classList.remove('error-text');
    status.textContent = 'Loading invite controls...';
    try {
      const result = await managerAction('manager.invite.get');
      inviteData = result.data.invite;
      status.textContent = '';
      status.classList.remove('error-text');
      render();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add('error-text');
    }
  }

  function inviteLink() {
    return inviteData ? buildInviteLink(inviteData.inviteToken) : '';
  }

  async function copyLink() {
    try {
      await copyInviteLink(inviteLink());
      status.textContent = 'Invite link copied.';
    } catch (error) {
      status.textContent = 'Copy failed. Select and copy the link manually.';
      status.classList.add('error-text');
    }
  }

  async function shareLink() {
    try {
      const result = await shareInviteLink(inviteLink());
      status.textContent = result === 'shared' ? 'Share sheet opened.' : 'Invite link copied.';
    } catch (error) {
      status.textContent = 'Share failed. Try copying the link instead.';
      status.classList.add('error-text');
    }
  }

  async function regenerate() {
    if (!window.confirm('Regenerating immediately disables the old invite link. Continue?')) {
      return;
    }
    status.textContent = 'Regenerating invite link...';
    try {
      const result = await managerAction('manager.invite.regenerate', { confirmRegenerate: true });
      inviteData = result.data.invite;
      status.textContent = '';
      status.classList.remove('error-text');
      render();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add('error-text');
    }
  }

  async function setOpen(open) {
    status.textContent = open ? 'Opening registration...' : 'Closing registration...';
    try {
      const result = await managerAction('manager.registration.setOpen', { registrationOpen: open });
      inviteData = result.data.invite;
      status.textContent = '';
      status.classList.remove('error-text');
      render();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add('error-text');
    }
  }

  function render() {
    card.replaceChildren();
    controls.replaceChildren();
    const link = inviteLink();
    const canShare = Boolean(inviteData && inviteData.canShare && link);
    appendChildren(card, [
      createElement('p', { className: 'eyebrow', text: 'Invite Players' }),
      createElement('h2', { text: 'Invite Players' }),
      createElement('p', { className: `status-pill ${inviteData && inviteData.registrationOpen ? '' : 'status-pill-muted'}`, text: inviteData && inviteData.registrationOpen ? 'Registration: Open' : 'Registration: Closed' }),
      createElement('p', { className: 'muted', text: 'Regenerating immediately disables the old link. Existing players are unaffected.' }),
    ]);

    if (!inviteData || !inviteData.configured || !inviteData.inviteToken) {
      card.appendChild(createElement('p', { className: 'muted error-text', text: 'League invite has not been initialized in Apps Script yet.' }));
    } else {
      const linkText = createElement('p', { className: 'invite-link-text', text: link });
      card.appendChild(linkText);
      const copy = createElement('button', { className: 'primary-button', text: 'Copy Invite Link', attributes: { type: 'button' } });
      const share = createElement('button', { className: 'secondary-button', text: 'Share Invite Link', attributes: { type: 'button' } });
      copy.disabled = !canShare;
      share.disabled = !canShare;
      const toggle = createElement('button', { className: 'secondary-button', text: inviteData.registrationOpen ? 'Close Registration' : 'Open Registration', attributes: { type: 'button' } });
      const regen = createElement('button', { className: 'secondary-button', text: 'Regenerate Link', attributes: { type: 'button' } });
      copy.addEventListener('click', copyLink);
      share.addEventListener('click', shareLink);
      toggle.addEventListener('click', () => setOpen(!inviteData.registrationOpen));
      regen.addEventListener('click', regenerate);
      appendChildren(controls, [copy, share, toggle, regen]);
      card.appendChild(controls);
    }
    card.appendChild(status);
  }

  render();
  loadInvite();
  return card;
}

function createRegisteredPlayersCard() {
  let players = [];
  const card = createElement('section', { className: 'state-card registered-players-card' });
  const status = createElement('p', {
    className: 'muted',
    text: 'Loading registered players...',
    attributes: { role: 'status', 'aria-live': 'polite' },
  });
  const total = createElement('p', { className: 'status-pill', text: 'Total: 0' });
  const list = createElement('section', {
    className: 'player-list registered-players-list',
    attributes: { 'aria-label': 'Registered Players' },
  });

  function render() {
    total.textContent = `Total: ${players.length}`;
    list.replaceChildren();
    if (!players.length) {
      list.appendChild(createElement('p', { className: 'muted', text: 'No registered players yet.' }));
      return;
    }
    players.forEach((player) => {
      const playerCard = createElement('article', { className: 'player-card registered-player-card' });
      const header = createElement('div', { className: 'player-card-header' });
      const title = createElement('div', { className: 'registered-player-title' });
      const playerStatus = String(player.status || 'active').toLowerCase();
      const pill = createElement('span', {
        className: `status-pill ${playerStatus === 'inactive' ? 'status-pill-muted' : ''}`,
        text: playerStatus === 'inactive' ? 'Inactive' : 'Active',
      });
      appendChildren(title, [createElement('h3', { text: player.displayName || 'Unnamed player' }), pill]);
      appendChildren(header, [
        createElement('span', { className: 'player-avatar', text: player.avatar || 'football' }),
        title,
      ]);
      const currentWeek = player.currentWeek || null;
      const entryCount = currentWeek ? Number(currentWeek.entryCount || 0) : 0;
      const meta = createElement('dl', { className: 'player-meta' });
      [
        ['Joined', formatDate(player.profileCreatedAt || player.createdAt)],
        ['Referred By', player.referredBy && player.referredBy.displayName ? player.referredBy.displayName : 'Not referred'],
        ['Active Entry', currentWeek && currentWeek.hasActiveEntry ? 'Yes' : 'No'],
        ['Entries This Week', String(entryCount)],
      ].forEach(([label, value]) => {
        meta.appendChild(createElement('dt', { text: label }));
        meta.appendChild(createElement('dd', { text: value }));
      });
      appendChildren(playerCard, [header, meta]);
      list.appendChild(playerCard);
    });
  }

  async function loadPlayers() {
    try {
      const result = await managerAction('manager.players.list', { status: 'all', search: '' });
      if (!card.isConnected) {
        return;
      }
      players = result.data.players || [];
      status.textContent = '';
      status.classList.remove('error-text');
      render();
    } catch (error) {
      status.textContent = error.message || 'Registered players could not be loaded.';
      status.classList.add('error-text');
    }
  }

  appendChildren(card, [
    createElement('p', { className: 'eyebrow', text: 'Registered Players' }),
    createElement('h2', { text: 'Registered Players' }),
    total,
    status,
    list,
  ]);
  render();
  loadPlayers();
  return card;
}

function createReferralsCard() {
  let referrals = [];
  let rewardSummaries = [];
  const card = createElement('section', { className: 'state-card' });
  const status = createElement('p', {
    className: 'muted',
    text: 'Loading referrals...',
    attributes: { role: 'status', 'aria-live': 'polite' },
  });
  const list = createElement('section', { className: 'player-list', attributes: { 'aria-label': 'Referrals' } });

  function render() {
    list.replaceChildren();
    if (rewardSummaries.length) {
      list.appendChild(createElement('h3', { text: 'Referral Reward Progress' }));
      rewardSummaries.forEach((item) => {
        const referrer = item.referrer || {};
        const summary = item.rewardSummary || {};
        const summaryCard = createElement('article', { className: 'player-card' });
        const details = createElement('dl', { className: 'player-meta' });
        [
          ['Qualified referrals', String(summary.qualifiedReferralCount || 0)],
          ['Free entries earned', String(summary.earnedFreeEntries || 0)],
          ['Unused free-entry balance', String(summary.unusedFreeEntries || 0)],
          ['Current badge', referralBadgeLabel(summary.currentBadge)],
          ['Next milestone', summary.nextMilestone ? `${summary.nextMilestone} qualified referrals` : 'All milestones earned'],
        ].forEach(([label, value]) => {
          details.appendChild(createElement('dt', { text: label }));
          details.appendChild(createElement('dd', { text: value }));
        });
        appendChildren(summaryCard, [
          createElement('h3', { text: referrer.displayName || 'Referring player' }),
          details,
        ]);
        list.appendChild(summaryCard);
      });
      list.appendChild(createElement('h3', { text: 'Referral Activity' }));
    }
    if (!referrals.length) {
      list.appendChild(createElement('p', { className: 'muted', text: 'No referrals yet.' }));
      return;
    }
    referrals.forEach((referral) => {
      const referrer = referral.referrer || {};
      const invitee = referral.referredPlayer || {};
      const referralCard = createElement('article', { className: 'player-card' });
      const header = createElement('div', { className: 'player-card-header' });
      const avatar = createElement('span', { className: 'player-avatar', text: invitee.avatar || 'football' });
      const title = createElement('div');
      const pill = createElement('span', {
        className: `status-pill ${referral.status === 'qualified' ? '' : 'status-pill-muted'}`,
        text: referralStatusLabel(referral.status),
      });
      appendChildren(title, [createElement('h3', { text: invitee.displayName || 'Invited player' }), pill]);
      appendChildren(header, [avatar, title]);
      const details = createElement('dl', { className: 'player-meta' });
      [
        ['Invited by', referrer.displayName || 'Unknown player'],
        ['Registered', formatDateTime(referral.registeredAt)],
      ].forEach(([label, value]) => {
        details.appendChild(createElement('dt', { text: label }));
        details.appendChild(createElement('dd', { text: value }));
      });
      if (referral.status === 'qualified' && referral.qualification) {
        const q = referral.qualification;
        [
          ['Qualified', formatDateTime(referral.qualifiedAt)],
          ['Week', q.weekId ? `Season ${q.season || 'Unknown'} · Week ${q.nflWeek || 'Unknown'}` : 'Unavailable'],
          ['Entry', q.entryLabel || q.entryId || 'Unavailable'],
        ].forEach(([label, value]) => {
          details.appendChild(createElement('dt', { text: label }));
          details.appendChild(createElement('dd', { text: value }));
        });
      }
      appendChildren(referralCard, [header, details]);
      list.appendChild(referralCard);
    });
  }

  async function loadReferrals() {
    try {
      const result = await managerAction('manager.referrals.list');
      if (!card.isConnected) {
        return;
      }
      referrals = result.data.referrals || [];
      rewardSummaries = result.data.rewardSummaries || [];
      status.textContent = referrals.length ? `${referrals.length} referral${referrals.length === 1 ? '' : 's'} found.` : '';
      status.classList.remove('error-text');
      render();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add('error-text');
    }
  }

  appendChildren(card, [
    createElement('p', { className: 'eyebrow', text: 'Referrals' }),
    createElement('h2', { text: 'Referrals' }),
    createElement('p', { className: 'muted', text: 'See who invited whom and whether each referral has qualified.' }),
    status,
    list,
  ]);
  render();
  loadReferrals();
  return card;
}

export function createManagerDashboardView(context = {}) {
  const manager = context.manager || {};
  const wrapper = createElement('main', { className: 'page-container' });
  const card = createElement('section', { className: 'state-card' });
  const buttonRow = createElement('div', { className: 'button-row' });
  const playersButton = createElement('button', {
    className: 'primary-button',
    text: 'Manage Players',
    attributes: { type: 'button' },
  });
  const paymentsButton = createElement('button', {
    className: 'secondary-button',
    text: 'Review Payments',
    attributes: { type: 'button' },
  });
  const weekButton = createElement('button', {
    className: 'secondary-button',
    text: 'Manage Week',
    attributes: { type: 'button' },
  });
  const everybodyPicksButton = createElement('button', {
    className: 'secondary-button',
    text: 'Everybody\'s Picks',
    attributes: { type: 'button' },
  });
  const pendingPayments = createElement('p', {
    className: 'status-pill',
    text: 'Pending Payments: 0',
  });
  const pendingPaymentsStatus = createElement('p', {
    className: 'muted',
    attributes: { role: 'status', 'aria-live': 'polite' },
  });
  const logoutButton = createElement('button', {
    className: 'secondary-button',
    text: 'Logout',
    attributes: { type: 'button' },
  });

  playersButton.addEventListener('click', () => {
    navigateTo('manager-players');
  });

  paymentsButton.addEventListener('click', () => {
    navigateTo('manager-payments');
  });
  weekButton.addEventListener('click', () => {
    navigateTo('manager-week');
  });
  everybodyPicksButton.addEventListener('click', () => {
    navigateTo('manager-everybodys-picks');
  });

  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    await logoutManager();
    navigateTo('manager-login');
  });

  let previousPendingCount = null;

  async function loadPendingPayments() {
    try {
      const result = await managerAction('manager.payments.list', { status: 'pending' });
      if (!wrapper.isConnected) {
        return;
      }
      const payments = result.data.payments || [];
      const pendingCount = payments.length;
      pendingPayments.textContent = `Pending Payments: ${pendingCount}`;
      paymentsButton.textContent = pendingCount > 0 ? `Review Payments (${pendingCount})` : 'Review Payments';
      if (previousPendingCount !== null && pendingCount > previousPendingCount) {
        pendingPaymentsStatus.textContent = 'New payment request received.';
      }
      previousPendingCount = pendingCount;
    } catch (error) {
      // Preserve the last successful count and keep the dashboard usable.
    }
  }

  async function pollPendingPayments() {
    if (!wrapper.isConnected) {
      return;
    }
    await loadPendingPayments();
    if (wrapper.isConnected) {
      window.setTimeout(pollPendingPayments, 60000);
    }
  }

  appendChildren(buttonRow, [playersButton, paymentsButton, weekButton, everybodyPicksButton, logoutButton]);
  appendChildren(card, [
    createElement('p', { className: 'eyebrow', text: 'League Manager' }),
    createElement('h1', { text: 'Manager Dashboard' }),
    createElement('p', { text: `Signed in as ${manager.username || 'owner'}.` }),
    createElement('p', { className: 'status-pill', text: `Role: ${manager.role || 'owner'}` }),
    pendingPayments,
    pendingPaymentsStatus,
    createElement('p', { className: 'muted', text: 'Week, player, and payment management are active. Grading and standings remain out of scope.' }),
    buttonRow,
  ]);
  wrapper.appendChild(card);
  wrapper.appendChild(createRegisteredPlayersCard());
  wrapper.appendChild(createInviteCard());
  wrapper.appendChild(createReferralsCard());
  window.setTimeout(pollPendingPayments, 0);
  return wrapper;
}

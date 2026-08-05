import { getManagerSessionToken, logoutManager } from '../auth.js';
import { requestAction } from '../api.js';
import { buildInviteLink, copyInviteLink, shareInviteLink } from '../invite.js';
import { navigateTo } from '../router.js';

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

  appendChildren(buttonRow, [playersButton, paymentsButton, weekButton, logoutButton]);
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
  wrapper.appendChild(createInviteCard());
  window.setTimeout(pollPendingPayments, 0);
  return wrapper;
}

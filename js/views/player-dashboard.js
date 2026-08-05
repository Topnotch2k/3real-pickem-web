import { getPlayerSessionToken, logoutPlayer } from '../player-auth.js';
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

function playerAction(action, payload = {}) {
  return requestAction(action, { ...payload, sessionToken: getPlayerSessionToken() });
}

async function playerDashboardBootstrapSection(bootstrapRequest, sectionName) {
  const result = await bootstrapRequest;
  const section = result.data && result.data[sectionName];
  if (
    !section ||
    section.ok !== true ||
    !section.data ||
    typeof section.data !== 'object' ||
    Array.isArray(section.data)
  ) {
    const error = new Error(section && section.error && section.error.message || 'Dashboard data could not be loaded.');
    error.code = section && section.error && section.error.code || 'DASHBOARD_SECTION_UNAVAILABLE';
    throw error;
  }
  return section.data;
}

function createField(labelText, control) {
  const label = createElement('label', { className: 'form-field' });
  label.appendChild(createElement('span', { text: labelText }));
  label.appendChild(control);
  return label;
}

function formatMoney(cents, fallback = '') {
  const amount = Number(cents);
  if (Number.isFinite(amount)) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100);
  }
  return fallback ? `$${fallback}` : '';
}

function formatSubmittedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function paymentMethodLabel(method) {
  return {
    cash: 'Cash',
    cash_app: 'Cash App',
    apple_pay: 'Apple Pay',
  }[method] || String(method || 'Unknown');
}

function paymentStatusLabel(status) {
  return {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
  }[status] || String(status || 'Unknown');
}

function createClientRequestId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `payment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function createInviteFriendsCard(player, bootstrapRequest) {
  let inviteData = null;
  const card = createElement('section', { className: 'state-card invite-card' });
  const status = createElement('p', { className: 'muted', attributes: { role: 'status', 'aria-live': 'polite' } });
  const controls = createElement('div', { className: 'button-row' });

  async function loadInvite() {
    try {
      const data = await playerDashboardBootstrapSection(bootstrapRequest, 'invite');
      inviteData = data.invite;
      render();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add('error-text');
    }
  }

  function inviteLink() {
    return inviteData ? buildInviteLink(inviteData.inviteToken, inviteData.referralCode || player.referralCode || '') : '';
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

  function render() {
    card.replaceChildren();
    controls.replaceChildren();
    appendChildren(card, [
      createElement('p', { className: 'eyebrow', text: 'Invite Friends' }),
      createElement('h2', { text: 'Invite Friends' }),
    ]);
    if (!inviteData || !inviteData.canShare || !inviteData.inviteToken) {
      card.appendChild(createElement('p', { className: 'muted', text: 'Invites are currently closed.' }));
      card.appendChild(status);
      return;
    }
    const link = inviteLink();
    card.appendChild(createElement('p', { className: 'muted', text: 'Share your invite link. Copy/share actions are not confirmed invitations sent.' }));
    card.appendChild(createElement('p', { className: 'invite-link-text', text: link }));
    const share = createElement('button', { className: 'primary-button', text: 'Share Invite Link', attributes: { type: 'button' } });
    const copy = createElement('button', { className: 'secondary-button', text: 'Copy Invite Link', attributes: { type: 'button' } });
    share.addEventListener('click', shareLink);
    copy.addEventListener('click', copyLink);
    appendChildren(controls, [share, copy]);
    card.appendChild(controls);
    card.appendChild(status);
  }

  render();
  loadInvite();
  return card;
}

function createPaymentWorkspace(bootstrapRequest) {
  let paymentOptions = null;
  let payments = [];
  let paymentsLoaded = false;
  let submitting = false;
  let activeClientRequest = null;

  const requestCard = createElement('section', { className: 'state-card' });
  const form = createElement('form', { className: 'auth-form' });
  const methodSelect = createElement('select', { attributes: { name: 'method', disabled: 'disabled' } });
  const quantitySelect = createElement('select', { attributes: { name: 'entriesPaid', disabled: 'disabled' } });
  const price = createElement('p', { className: 'muted', text: 'Loading current entry price...' });
  const total = createElement('p', { className: 'status-pill', text: 'Total unavailable' });
  const pendingNotice = createElement('p', { className: 'muted', attributes: { role: 'status', 'aria-live': 'polite' } });
  const message = createElement('p', { className: 'muted', attributes: { role: 'status', 'aria-live': 'polite' } });
  const submit = createElement('button', {
    className: 'primary-button',
    text: 'Submit Payment Request',
    attributes: { type: 'submit', disabled: 'disabled' },
  });
  const buttons = createElement('div', { className: 'button-row' });
  buttons.appendChild(submit);

  const historyCard = createElement('section', { className: 'state-card' });
  const historyStatus = createElement('p', {
    className: 'muted',
    text: 'Loading payment requests...',
    attributes: { role: 'status', 'aria-live': 'polite' },
  });
  const historyList = createElement('section', { className: 'player-list', attributes: { 'aria-label': 'Payment requests' } });

  function pendingForCurrentWeek() {
    if (!paymentOptions || !paymentOptions.week) {
      return null;
    }
    return payments.find((payment) => payment.status === 'pending' && payment.weekId === paymentOptions.week.weekId) || null;
  }

  function updateTotal() {
    if (!paymentOptions || !paymentOptions.pricing) {
      total.textContent = 'Total unavailable';
      return;
    }
    const quantity = Number(quantitySelect.value || 0);
    const entryFeeCents = Number(paymentOptions.pricing.entryFeeCents || 0);
    const noun = quantity === 1 ? 'entry' : 'entries';
    total.textContent = `${quantity} ${noun} × ${formatMoney(entryFeeCents)} = ${formatMoney(entryFeeCents * quantity)}`;
  }

  function updateFormAvailability() {
    const pending = pendingForCurrentWeek();
    const disabled = !paymentOptions || !paymentsLoaded || submitting || Boolean(pending);
    methodSelect.disabled = disabled;
    quantitySelect.disabled = disabled;
    submit.disabled = disabled;
    pendingNotice.textContent = pending
      ? 'You already have a pending payment request for this week. Wait for the manager to approve or reject it before submitting another one.'
      : '';
  }

  function populateOptions() {
    methodSelect.replaceChildren();
    quantitySelect.replaceChildren();
    (paymentOptions.methods || []).forEach((method) => {
      methodSelect.appendChild(createElement('option', { text: method.label, attributes: { value: method.value } }));
    });
    const min = Number(paymentOptions.entryQuantity && paymentOptions.entryQuantity.min);
    const max = Number(paymentOptions.entryQuantity && paymentOptions.entryQuantity.max);
    for (let quantity = min; quantity <= max; quantity += 1) {
      quantitySelect.appendChild(createElement('option', { text: String(quantity), attributes: { value: String(quantity) } }));
    }
    price.textContent = `Entry price: ${formatMoney(paymentOptions.pricing.entryFeeCents, paymentOptions.pricing.entryFee)}`;
    updateTotal();
    updateFormAvailability();
  }

  function renderHistory() {
    historyList.replaceChildren();
    if (!payments.length) {
      historyStatus.textContent = 'No payment requests yet.';
      return;
    }
    historyStatus.textContent = '';
    payments.forEach((payment) => {
      const card = createElement('article', { className: 'player-card' });
      const details = createElement('dl', { className: 'player-meta' });
      [
        ['Payment method', paymentMethodLabel(payment.method)],
        ['Entry quantity', String(payment.entriesPaid || 0)],
        ['Amount due', formatMoney(payment.amountDueCents, payment.amountDue)],
        ['Submitted', formatSubmittedAt(payment.createdAt)],
      ].forEach(([label, value]) => {
        details.appendChild(createElement('dt', { text: label }));
        details.appendChild(createElement('dd', { text: value }));
      });
      if (payment.status === 'rejected' && payment.rejectionReason) {
        details.appendChild(createElement('dt', { text: 'Rejection reason' }));
        details.appendChild(createElement('dd', { text: payment.rejectionReason }));
      }
      appendChildren(card, [
        createElement('span', {
          className: `status-pill ${payment.status === 'approved' ? '' : 'status-pill-muted'}`,
          text: paymentStatusLabel(payment.status),
        }),
        details,
      ]);
      historyList.appendChild(card);
    });
  }

  async function loadOptions() {
    try {
      paymentOptions = await playerDashboardBootstrapSection(bootstrapRequest, 'paymentOptions');
      message.textContent = '';
      message.classList.remove('error-text');
      populateOptions();
    } catch (error) {
      paymentOptions = null;
      price.textContent = 'Entry price unavailable.';
      total.textContent = 'Total unavailable';
      message.textContent = error.message;
      message.classList.add('error-text');
      updateFormAvailability();
    }
  }

  async function loadPayments(initialBootstrapRequest) {
    historyStatus.classList.remove('error-text');
    try {
      const data = initialBootstrapRequest
        ? await playerDashboardBootstrapSection(initialBootstrapRequest, 'payments')
        : (await playerAction('player.payments.list')).data;
      payments = data.payments || [];
      paymentsLoaded = true;
      renderHistory();
      updateFormAvailability();
    } catch (error) {
      paymentsLoaded = false;
      historyStatus.textContent = error.message;
      historyStatus.classList.add('error-text');
      updateFormAvailability();
    }
  }

  function clearLogicalRequest() {
    activeClientRequest = null;
  }

  methodSelect.addEventListener('change', () => {
    clearLogicalRequest();
    updateTotal();
  });
  quantitySelect.addEventListener('change', () => {
    clearLogicalRequest();
    updateTotal();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || !paymentOptions || pendingForCurrentWeek()) {
      return;
    }
    const method = methodSelect.value;
    const entriesPaid = Number(quantitySelect.value);
    if (!activeClientRequest || activeClientRequest.method !== method || activeClientRequest.entriesPaid !== entriesPaid) {
      activeClientRequest = { id: createClientRequestId(), method, entriesPaid };
    }

    submitting = true;
    message.classList.remove('error-text');
    message.textContent = 'Submitting payment request...';
    updateFormAvailability();
    try {
      const result = await playerAction('player.payment.submit', {
        clientRequestId: activeClientRequest.id,
        method,
        entriesPaid,
      });
      const submittedPayment = result.data.payment;
      if (submittedPayment) {
        payments = [submittedPayment].concat(payments.filter((payment) => payment.paymentId !== submittedPayment.paymentId));
        renderHistory();
      }
      clearLogicalRequest();
      message.textContent = 'Payment request submitted. The manager must verify and approve it before your entries are created.';
      await loadPayments();
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error-text');
      if (error.code === 'PAYMENT_PENDING_EXISTS') {
        clearLogicalRequest();
        await loadPayments();
      }
    } finally {
      submitting = false;
      updateFormAvailability();
    }
  });

  appendChildren(form, [
    createField('Payment method', methodSelect),
    createField('Entry quantity', quantitySelect),
    price,
    total,
    buttons,
    pendingNotice,
    message,
  ]);
  appendChildren(requestCard, [
    createElement('p', { className: 'eyebrow', text: 'Entries' }),
    createElement('h2', { text: 'Payment Request' }),
    createElement('p', {
      className: 'muted',
      text: 'Choose how you will pay the manager. Cash, Cash App, and Apple Pay are verified outside the app. Your entries are created only after the manager approves the payment.',
    }),
    form,
  ]);
  appendChildren(historyCard, [
    createElement('p', { className: 'eyebrow', text: 'Payments' }),
    createElement('h2', { text: 'My Payment Requests' }),
    historyStatus,
    historyList,
  ]);

  loadOptions();
  loadPayments(bootstrapRequest);
  return { requestCard, historyCard };
}

function createEntrySheetsCard(bootstrapRequest) {
  const card = createElement('section', { className: 'state-card' });
  const status = createElement('p', {
    className: 'muted',
    text: 'Loading entry sheets...',
    attributes: { role: 'status', 'aria-live': 'polite' },
  });
  const list = createElement('section', { className: 'player-list', attributes: { 'aria-label': 'Entry sheets' } });

  appendChildren(card, [
    createElement('p', { className: 'eyebrow', text: 'Picks' }),
    createElement('h2', { text: 'My Entry Sheets' }),
    createElement('p', { className: 'muted', text: 'Each approved entry has its own weekly pick sheet.' }),
    status,
    list,
  ]);

  async function loadEntrySheets() {
    status.classList.remove('error-text');
    try {
      const data = await playerDashboardBootstrapSection(bootstrapRequest, 'entrySheets') || {};
      const entries = data.entries || [];
      list.replaceChildren();
      if (!data.week) {
        status.textContent = 'No Week is currently open for picks.';
        return;
      }
      if (!entries.length) {
        status.textContent = 'No active entry sheets are available for the current Week.';
        return;
      }
      status.textContent = '';
      entries.forEach((entry) => {
        const entryCard = createElement('article', { className: 'player-card' });
        const details = createElement('dl', { className: 'player-meta' });
        [
          ['Week', `Season ${data.week.season} · Week ${data.week.nflWeek}`],
          ['Progress', `${entry.completedPicks} of ${entry.totalGames} picks completed`],
        ].forEach(([label, value]) => {
          details.appendChild(createElement('dt', { text: label }));
          details.appendChild(createElement('dd', { text: value }));
        });
        const open = createElement('button', {
          className: 'primary-button',
          text: entry.completedPicks > 0 ? 'Edit Picks' : 'Make Picks',
          attributes: { type: 'button' },
        });
        open.addEventListener('click', () => {
          navigateTo(`player-entry-picks?entryId=${encodeURIComponent(entry.entryId)}`);
        });
        const buttons = createElement('div', { className: 'button-row' });
        buttons.appendChild(open);
        appendChildren(entryCard, [
          createElement('h3', { text: entry.entryLabel || 'Entry' }),
          createElement('span', {
            className: `status-pill ${entry.status === 'active' ? '' : 'status-pill-muted'}`,
            text: entry.status === 'active' ? 'Active' : 'Unknown',
          }),
          createElement('span', {
            className: `status-pill ${entry.complete ? '' : 'status-pill-muted'}`,
            text: entry.complete ? 'Complete' : 'In progress',
          }),
          details,
          buttons,
        ]);
        list.appendChild(entryCard);
      });
    } catch (error) {
      status.textContent = error.message;
      status.classList.add('error-text');
      list.replaceChildren();
    }
  }

  loadEntrySheets();
  return card;
}

export function createPlayerDashboardView(context = {}) {
  const player = context.player || {};
  const wrapper = createElement('main', { className: 'page-container' });
  const card = createElement('section', { className: 'state-card player-dashboard-card' });
  const avatar = createElement('span', { className: 'player-avatar large-avatar', text: player.avatar || 'football' });
  const status = createElement('span', { className: 'status-pill', text: player.status || 'active' });
  const logout = createElement('button', { className: 'secondary-button', text: 'Logout', attributes: { type: 'button' } });
  const details = createElement('dl', { className: 'player-meta' });
  const bootstrapRequest = playerAction('player.dashboard.bootstrap');
  const paymentWorkspace = createPaymentWorkspace(bootstrapRequest);

  [
    ['Profile', 'Active'],
    ['Payment requests', 'View and submit below'],
    ['Payment methods', 'Cash, Cash App, or Apple Pay through the manager'],
    ['Entry sheets', 'Make and edit weekly picks below'],
  ].forEach(([label, value]) => {
    details.appendChild(createElement('dt', { text: label }));
    details.appendChild(createElement('dd', { text: value }));
  });

  logout.addEventListener('click', async () => {
    logout.disabled = true;
    await logoutPlayer();
    navigateTo('player-login');
  });

  appendChildren(card, [
    createElement('p', { className: 'eyebrow', text: 'Player Dashboard' }),
    avatar,
    createElement('h1', { text: `Welcome, ${player.displayName || 'Player'}` }),
    status,
    createElement('p', { className: 'muted', text: 'Submit payment requests, manage approved entry sheets, and make weekly picks below.' }),
    details,
    logout,
  ]);
  appendChildren(wrapper, [
    card,
    paymentWorkspace.requestCard,
    paymentWorkspace.historyCard,
    createEntrySheetsCard(bootstrapRequest),
    createInviteFriendsCard(player, bootstrapRequest),
  ]);
  return wrapper;
}

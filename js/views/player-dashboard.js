import { getPlayerSessionToken, logoutPlayer } from '../player-auth.js?v=20260812-1';
import { requestAction } from '../api.js?v=20260812-1';
import { buildInviteLink, copyInviteLink, shareInviteLink } from '../invite.js?v=20260812-1';
import { navigateTo } from '../router.js?v=20260812-1';

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

function formatCentralTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unavailable';
  }
  const formatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  }).format(date);
  const parts = formatted.split(', ');
  if (parts.length >= 3) {
    return `${parts[0]}, ${parts[1]} · ${parts.slice(2).join(', ')} CT`;
  }
  return `${formatted} CT`;
}

function seasonTypeLabel(value) {
  if (value === 'preseason') return 'Preseason';
  if (value === 'postseason') return 'Postseason';
  return 'Regular Season';
}

function thisWeekLabel(week) {
  if (!week) return '';
  const prefix = week.seasonType === 'regular' ? '' : `${seasonTypeLabel(week.seasonType)} `;
  return `${prefix}Week ${week.nflWeek}`;
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

function paymentMethodLabel(method) {
  return {
    cash: 'Cash',
    cash_app: 'Cash App',
    apple_pay: 'Apple Pay',
    zelle: 'Zelle',
  }[method] || String(method || 'Unknown');
}

function paymentStatusLabel(status) {
  return {
    pending: 'Pending Review',
    approved: 'Awaiting Payment',
    paid: 'Paid',
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
  let referrals = [];
  let rewardSummary = {
    qualifiedReferralCount: 0,
    earnedFreeEntries: 0,
    usedFreeEntries: 0,
    unusedFreeEntries: 0,
    currentBadge: '',
    nextMilestone: 10,
  };
  const card = createElement('section', { className: 'state-card compact-card invite-card' });
  const status = createElement('p', { className: 'muted', attributes: { role: 'status', 'aria-live': 'polite' } });
  const controls = createElement('div', { className: 'button-row' });
  const referralList = createElement('section', { className: 'player-list', attributes: { 'aria-label': 'People you invited' } });

  async function loadInvite(request = bootstrapRequest) {
    try {
      const data = await playerDashboardBootstrapSection(request, 'invite');
      inviteData = data.invite;
      const referralData = await playerDashboardBootstrapSection(request, 'referrals');
      referrals = referralData.referrals || [];
      rewardSummary = referralData.rewardSummary || rewardSummary;
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

  function renderReferrals() {
    referralList.replaceChildren();
    referralList.appendChild(createElement('h3', { text: 'People You Invited' }));
    if (!referrals.length) {
      referralList.appendChild(createElement('p', { className: 'muted', text: 'Nobody has registered from your invite link yet.' }));
      return referralList;
    }
    referrals.forEach((referral) => {
      const invitee = referral.referredPlayer || {};
      const card = createElement('article', { className: 'player-card compact-card' });
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
      appendChildren(card, [header, details]);
      referralList.appendChild(card);
    });
    return referralList;
  }

  function renderRewardSummary() {
    const section = createElement('section', { className: 'player-list', attributes: { 'aria-label': 'Referral reward progress' } });
    const summaryCard = createElement('article', { className: 'player-card compact-card' });
    const milestones = createElement('ul', { className: 'muted referral-reward-list' });
    const details = createElement('dl', { className: 'player-meta referral-reward-meta' });
    [
      '10 referrals — 1 free entry',
      '20 referrals — 2 more free entries',
      '25 referrals — football badge',
      '50 referrals — 3 more free entries and crown badge',
    ].forEach((item) => milestones.appendChild(createElement('li', { text: item })));
    [
      ['Qualified referrals', String(rewardSummary.qualifiedReferralCount || 0)],
      ['Free entries earned', String(rewardSummary.earnedFreeEntries || 0)],
      ['Unused free-entry balance', String(rewardSummary.unusedFreeEntries || 0)],
      ['Current badge', referralBadgeLabel(rewardSummary.currentBadge)],
      ['Next milestone', rewardSummary.nextMilestone ? `${rewardSummary.nextMilestone} qualified referrals` : 'All milestones earned'],
    ].forEach(([label, value]) => {
      details.appendChild(createElement('dt', { text: label }));
      details.appendChild(createElement('dd', { text: value }));
    });
    appendChildren(summaryCard, [
      createElement('h3', { text: 'EARN UP TO 6 FREE ENTRIES' }),
      milestones,
      details,
    ]);
    section.appendChild(summaryCard);
    return section;
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
      card.appendChild(renderRewardSummary());
      card.appendChild(status);
      card.appendChild(renderReferrals());
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
    card.appendChild(renderRewardSummary());
    card.appendChild(status);
    card.appendChild(renderReferrals());
  }

  render();
  loadInvite();
  return {
    card,
    refresh: () => loadInvite(playerAction('player.dashboard.bootstrap')),
  };
}

function createPaymentWorkspace(bootstrapRequest, entrySheets, inviteFriends) {
  const PAYMENT_REFRESH_INTERVAL_MS = 60000;
  const PAYMENT_SUCCESS_MESSAGE_MS = 5000;
  let paymentOptions = null;
  let payments = [];
  let rewardSummary = {
    unusedFreeEntries: 0,
  };
  let paymentHistoryFilter = 'current';
  let paymentsLoaded = false;
  let submitting = false;
  let activeClientRequest = null;
  let activeFreeEntryRequest = null;
  let paymentsRequest = null;
  let paymentRefreshTimeout = null;
  let paymentSuccessTimeout = null;
  let paymentRefreshStarted = false;
  let paymentInstructions = null;
  let paymentInstructionsUnavailable = false;

  const requestCard = createElement('section', { className: 'state-card compact-card' });
  const form = createElement('form', { className: 'auth-form dashboard-payment-form' });
  const methodSelect = createElement('select', { attributes: { name: 'method', disabled: 'disabled' } });
  const quantitySelect = createElement('select', { attributes: { name: 'entriesPaid', disabled: 'disabled' } });
  const price = createElement('p', { className: 'muted', text: 'Loading current entry price...' });
  const total = createElement('p', { className: 'status-pill', text: 'Total unavailable' });
  const freeEntryBalance = createElement('p', { className: 'status-pill status-pill-muted', text: 'Free entries available: 0' });
  const pendingNotice = createElement('p', { className: 'muted', attributes: { role: 'status', 'aria-live': 'polite' } });
  const message = createElement('p', { className: 'muted', attributes: { role: 'status', 'aria-live': 'polite' } });
  const submit = createElement('button', {
    className: 'primary-button',
    text: 'Submit Payment Request',
    attributes: { type: 'submit', disabled: 'disabled' },
  });
  const redeemFreeEntry = createElement('button', {
    className: 'secondary-button',
    text: 'Redeem Free Entry',
    attributes: { type: 'button', disabled: 'disabled' },
  });
  const buttons = createElement('div', { className: 'button-row' });
  buttons.appendChild(submit);
  buttons.appendChild(redeemFreeEntry);
  const instructionRegion = createElement('section', {
    className: 'payment-instructions',
    attributes: { hidden: 'hidden', 'aria-live': 'polite' },
  });

  const historyCard = createElement('section', { className: 'state-card compact-card' });
  const historyStatus = createElement('p', {
    className: 'muted',
    text: 'Loading payment requests...',
    attributes: { role: 'status', 'aria-live': 'polite' },
  });
  const historyFilter = createElement('select', { attributes: { name: 'paymentHistoryFilter' } });
  [
    ['current', 'Current Week'],
    ['previous', 'Previous Weeks'],
    ['all', 'All Payments'],
  ].forEach(([value, label]) => {
    historyFilter.appendChild(createElement('option', { text: label, attributes: { value } }));
  });
  const historyList = createElement('section', { className: 'player-list', attributes: { 'aria-label': 'Payment requests' } });

  function activeRequestForCurrentWeek() {
    if (!paymentOptions || !paymentOptions.week) {
      return null;
    }
    return payments.find((payment) => ['pending', 'approved'].indexOf(payment.status) !== -1 && payment.weekId === paymentOptions.week.weekId) || null;
  }

  function currentWeekPaymentFrom(list, statuses) {
    if (!paymentOptions || !paymentOptions.week) {
      return null;
    }
    return list.find((payment) => statuses.indexOf(payment.status) !== -1 && payment.weekId === paymentOptions.week.weekId) || null;
  }

  function clearPaymentSuccessTimeout() {
    if (paymentSuccessTimeout !== null) {
      window.clearTimeout(paymentSuccessTimeout);
      paymentSuccessTimeout = null;
    }
  }

  function showTemporaryPaymentSuccess() {
    clearPaymentSuccessTimeout();
    message.classList.remove('error-text');
    message.textContent = 'Payment received. Your entry sheet is ready.';
    paymentSuccessTimeout = window.setTimeout(() => {
      if (message.textContent === 'Payment received. Your entry sheet is ready.') {
        message.textContent = '';
      }
      paymentSuccessTimeout = null;
    }, PAYMENT_SUCCESS_MESSAGE_MS);
  }

  function isPaymentStatusMessage(value) {
    if (value.startsWith('Payment request submitted. The manager must approve it')) {
      return true;
    }
    return [
      'Payment request submitted. Waiting for manager approval.',
      'Payment approved. Complete payment using the instructions shown.',
    ].includes(value);
  }

  function reconcilePaymentMessage(previousPayments, nextPayments) {
    const activeRequest = currentWeekPaymentFrom(nextPayments, ['pending', 'approved']);
    if (activeRequest) {
      clearPaymentSuccessTimeout();
      message.classList.remove('error-text');
      message.textContent = activeRequest.status === 'approved'
        ? 'Payment approved. Complete payment using the instructions shown.'
        : 'Payment request submitted. Waiting for manager approval.';
    }

    const previousActiveRequest = currentWeekPaymentFrom(previousPayments, ['pending', 'approved']);
    if (!activeRequest && isPaymentStatusMessage(message.textContent)) {
      clearPaymentSuccessTimeout();
      message.classList.remove('error-text');
      message.textContent = '';
    }
    if (previousActiveRequest) {
      const resolvedPayment = nextPayments.find((payment) => payment.paymentId === previousActiveRequest.paymentId);
      if (resolvedPayment && resolvedPayment.status === 'paid') {
        showTemporaryPaymentSuccess();
        entrySheets.refresh();
      }
    }
  }

  function renderPaymentInstructions(created = false) {
    instructionRegion.replaceChildren();
    if (paymentInstructionsUnavailable) {
      instructionRegion.hidden = false;
      appendChildren(instructionRegion, [
        createElement('p', { className: 'eyebrow', text: 'Payment Pending' }),
        createElement('p', {
          className: 'payment-instructions-unavailable',
          text: 'Payment destination is temporarily unavailable.',
        }),
        createElement('p', { className: 'muted', text: 'Contact the League Manager.' }),
      ]);
      return;
    }
    if (!paymentInstructions || !paymentInstructions.destinationValue) {
      instructionRegion.hidden = true;
      return;
    }
    const destinationValue = String(paymentInstructions.destinationValue);
    const copyStatus = createElement('span', {
      className: 'muted payment-instructions-copy-status',
      attributes: { role: 'status', 'aria-live': 'polite' },
    });
    const copy = createElement('button', {
      className: 'secondary-button payment-instructions-copy',
      text: 'Copy',
      attributes: { type: 'button' },
    });
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(destinationValue);
        copyStatus.textContent = 'Copied';
      } catch (error) {
        copyStatus.textContent = 'Copy failed. Select and copy the destination.';
      }
    });
    instructionRegion.hidden = false;
    appendChildren(instructionRegion, [
      createElement('p', {
        className: 'eyebrow',
        text: created ? 'Payment Request Created' : 'Payment Pending',
      }),
      createElement('p', {
        className: 'payment-instructions-amount',
        text: `Send ${formatMoney(paymentInstructions.amountDueCents)} to`,
      }),
      createElement('p', {
        className: 'payment-instructions-label',
        text: paymentInstructions.destinationLabel || paymentMethodLabel(paymentInstructions.method),
      }),
      createElement('p', {
        className: 'payment-instructions-destination',
        text: destinationValue,
      }),
      createElement('div', { className: 'button-row payment-instructions-actions' }),
      createElement('p', { className: 'status-pill status-pill-muted', text: 'Payment pending verification.' }),
      createElement('p', { className: 'muted', text: 'Send your payment outside the app. The manager will mark it Paid after verifying it.' }),
    ]);
    const actions = instructionRegion.querySelector('.payment-instructions-actions');
    appendChildren(actions, [copy, copyStatus]);
  }

  function applyPaymentInstructionResponse(data, created = false) {
    paymentInstructions = data && data.paymentInstructions || null;
    paymentInstructionsUnavailable = Boolean(data && data.paymentInstructionsUnavailable);
    renderPaymentInstructions(created);
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
    const activeRequest = activeRequestForCurrentWeek();
    const freeEntryAvailable = Number(rewardSummary.unusedFreeEntries || 0) > 0;
    const disabled = !paymentOptions || !paymentsLoaded || submitting || Boolean(activeRequest);
    methodSelect.disabled = disabled;
    quantitySelect.disabled = disabled;
    submit.disabled = disabled;
    redeemFreeEntry.disabled = !paymentOptions || !paymentsLoaded || submitting || !freeEntryAvailable;
    freeEntryBalance.textContent = `Free entries available: ${Number(rewardSummary.unusedFreeEntries || 0)}`;
    freeEntryBalance.className = `status-pill ${freeEntryAvailable ? '' : 'status-pill-muted'}`;
    pendingNotice.textContent = activeRequest
      ? 'You already have a payment request for this week. Wait for the manager to reject it before submitting another one.'
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
    const currentWeekId = paymentOptions && paymentOptions.week && paymentOptions.week.weekId || '';
    const visiblePayments = payments.filter((payment) => {
      if (paymentHistoryFilter === 'all') {
        return true;
      }
      if (paymentHistoryFilter === 'previous') {
        return payment.weekId !== currentWeekId;
      }
      return Boolean(currentWeekId) && payment.weekId === currentWeekId;
    });
    if (!visiblePayments.length) {
      historyStatus.textContent = paymentHistoryFilter === 'current'
        ? 'No payment requests for the current Week.'
        : paymentHistoryFilter === 'previous'
          ? 'No payment requests from previous Weeks.'
          : 'No payment requests yet.';
      return;
    }
    historyStatus.textContent = '';
    visiblePayments.forEach((payment) => {
      const card = createElement('article', { className: 'player-card compact-card' });
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
          className: `status-pill ${payment.status === 'paid' ? '' : 'status-pill-muted'}`,
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
      try {
        const referralData = await playerDashboardBootstrapSection(bootstrapRequest, 'referrals');
        rewardSummary = referralData.rewardSummary || rewardSummary;
      } catch (error) {
        rewardSummary = { unusedFreeEntries: 0 };
      }
      if (!activeRequestForCurrentWeek()) {
        message.textContent = '';
      }
      message.classList.remove('error-text');
      populateOptions();
      renderHistory();
    } catch (error) {
      paymentOptions = null;
      price.textContent = 'Entry price unavailable.';
      total.textContent = 'Total unavailable';
      message.textContent = error.message;
      message.classList.add('error-text');
      updateFormAvailability();
    }
  }

  async function loadPayments(initialBootstrapRequest, background = false, preserveCreated = false) {
    if (paymentsRequest) {
      if (background || initialBootstrapRequest) {
        return paymentsRequest;
      }
      await paymentsRequest;
      return loadPayments(initialBootstrapRequest, background);
    }

    if (!background) {
      historyStatus.classList.remove('error-text');
    }
    const request = (async () => {
      try {
        const data = initialBootstrapRequest
          ? await playerDashboardBootstrapSection(initialBootstrapRequest, 'payments')
          : (await playerAction('player.payments.list')).data;
        const previousPayments = payments;
        const nextPayments = data.payments || [];
        payments = nextPayments;
        applyPaymentInstructionResponse(data, preserveCreated);
        paymentsLoaded = true;
        historyStatus.classList.remove('error-text');
        renderHistory();
        updateFormAvailability();
        reconcilePaymentMessage(previousPayments, nextPayments);
        updatePaymentHistoryRefresh();
      } catch (error) {
        if (!background) {
          paymentsLoaded = false;
          historyStatus.textContent = error.message;
          historyStatus.classList.add('error-text');
          updateFormAvailability();
        }
      }
    })();
    paymentsRequest = request;
    try {
      await request;
    } finally {
      if (paymentsRequest === request) {
        paymentsRequest = null;
      }
    }
  }

  function paymentCardsConnected() {
    return requestCard.isConnected || historyCard.isConnected;
  }

  function dashboardRefreshConnected() {
    return paymentCardsConnected() || entrySheets.isConnected();
  }

  function stopPaymentHistoryRefresh() {
    if (paymentRefreshTimeout !== null) {
      window.clearTimeout(paymentRefreshTimeout);
      paymentRefreshTimeout = null;
    }
    document.removeEventListener('visibilitychange', handlePaymentVisibilityChange);
    window.removeEventListener('focus', handlePaymentFocus);
    paymentRefreshStarted = false;
  }

  function clearPaymentHistoryRefreshTimer() {
    if (paymentRefreshTimeout !== null) {
      window.clearTimeout(paymentRefreshTimeout);
      paymentRefreshTimeout = null;
    }
  }

  function schedulePaymentHistoryRefresh() {
    if (paymentRefreshTimeout !== null || !dashboardRefreshConnected() || !activeRequestForCurrentWeek()) {
      return;
    }
    paymentRefreshTimeout = window.setTimeout(async () => {
      paymentRefreshTimeout = null;
      if (!dashboardRefreshConnected()) {
        stopPaymentHistoryRefresh();
        return;
      }
      if (paymentCardsConnected() && activeRequestForCurrentWeek()) {
        await loadPayments(null, true);
      }
      if (dashboardRefreshConnected() && activeRequestForCurrentWeek()) {
        schedulePaymentHistoryRefresh();
      } else {
        clearPaymentHistoryRefreshTimer();
      }
    }, PAYMENT_REFRESH_INTERVAL_MS);
  }

  function updatePaymentHistoryRefresh() {
    if (!dashboardRefreshConnected()) {
      stopPaymentHistoryRefresh();
      return;
    }
    if (activeRequestForCurrentWeek()) {
      schedulePaymentHistoryRefresh();
      return;
    }
    clearPaymentHistoryRefreshTimer();
  }

  function refreshPaymentsWhenUnresolved() {
    if (!dashboardRefreshConnected()) {
      stopPaymentHistoryRefresh();
      return;
    }
    if (paymentCardsConnected() && activeRequestForCurrentWeek()) {
      loadPayments(null, true);
    }
  }

  function handlePaymentVisibilityChange() {
    if (!dashboardRefreshConnected()) {
      stopPaymentHistoryRefresh();
      return;
    }
    if (document.visibilityState === 'visible') {
      refreshPaymentsWhenUnresolved();
    }
  }

  function handlePaymentFocus() {
    refreshPaymentsWhenUnresolved();
  }

  function startPaymentHistoryRefresh() {
    if (paymentRefreshStarted) {
      updatePaymentHistoryRefresh();
      return;
    }
    paymentRefreshStarted = true;
    document.addEventListener('visibilitychange', handlePaymentVisibilityChange);
    window.addEventListener('focus', handlePaymentFocus);
    window.setTimeout(() => {
      if (dashboardRefreshConnected() && activeRequestForCurrentWeek()) {
        schedulePaymentHistoryRefresh();
      } else {
        clearPaymentHistoryRefreshTimer();
      }
    }, 0);
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
  redeemFreeEntry.addEventListener('click', async () => {
    if (submitting || !paymentOptions || Number(rewardSummary.unusedFreeEntries || 0) < 1) {
      return;
    }
    if (!activeFreeEntryRequest) {
      activeFreeEntryRequest = createClientRequestId();
    }
    submitting = true;
    message.classList.remove('error-text');
    message.textContent = 'Redeeming free entry...';
    updateFormAvailability();
    try {
      const result = await playerAction('player.freeEntry.redeem', {
        weekId: paymentOptions.week.weekId,
        clientRequestId: activeFreeEntryRequest,
      });
      const previousUnused = Number(rewardSummary.unusedFreeEntries || 0);
      rewardSummary = result.data.rewardSummary || rewardSummary;
      if (Number(rewardSummary.unusedFreeEntries || 0) >= previousUnused && previousUnused > 0) {
        rewardSummary = {
          ...rewardSummary,
          unusedFreeEntries: previousUnused - 1,
          usedFreeEntries: Number(rewardSummary.usedFreeEntries || 0) + 1,
        };
      }
      activeFreeEntryRequest = null;
      message.textContent = 'Free entry redeemed. Your new entry sheet is ready.';
      updateFormAvailability();
      await Promise.all([
        entrySheets.refresh(),
        inviteFriends.refresh(),
      ]);
      updateFormAvailability();
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error-text');
    } finally {
      submitting = false;
      updateFormAvailability();
    }
  });
  historyFilter.addEventListener('change', () => {
    paymentHistoryFilter = historyFilter.value;
    renderHistory();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || !paymentOptions || activeRequestForCurrentWeek()) {
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
      applyPaymentInstructionResponse(result.data, true);
      clearLogicalRequest();
      message.textContent = 'Payment request submitted. Waiting for manager approval.';
      await loadPayments(null, false, true);
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error-text');
      if (error.code === 'PAYMENT_PENDING_EXISTS') {
        clearLogicalRequest();
        await loadPayments();
      } else {
        applyPaymentInstructionResponse(null);
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
    freeEntryBalance,
    buttons,
    pendingNotice,
    message,
  ]);
  appendChildren(requestCard, [
    createElement('p', { className: 'eyebrow', text: 'Entries' }),
    createElement('h2', { text: 'Payment Request' }),
    createElement('p', {
      className: 'muted',
      text: 'Choose how you will pay the manager. Cash, Cash App, Apple Pay, and Zelle are verified outside the app. Your entries are created only after the manager marks the approved payment paid.',
    }),
    form,
    instructionRegion,
  ]);
  appendChildren(historyCard, [
    createElement('p', { className: 'eyebrow', text: 'Payments' }),
    createElement('h2', { text: 'My Payment Requests' }),
    createField('Payment history', historyFilter),
    historyStatus,
    historyList,
  ]);

  loadOptions();
  loadPayments(bootstrapRequest);
  startPaymentHistoryRefresh();
  return { requestCard, historyCard };
}

function createEntrySheetsCard(bootstrapRequest) {
  let entrySheetsRequest = null;
  let entrySheetsRefreshQueued = false;
  let entrySheetFilter = 'current';
  let latestEntrySheetsData = null;
  const card = createElement('section', { className: 'state-card compact-card' });
  card.tabIndex = -1;
  const status = createElement('p', {
    className: 'muted',
    text: 'Loading entry sheets...',
    attributes: { role: 'status', 'aria-live': 'polite' },
  });
  const filterSelect = createElement('select', { attributes: { name: 'entrySheetFilter' } });
  const everybodyPicks = createElement('button', {
    className: 'secondary-button',
    text: 'Everybody\'s Picks',
    attributes: { type: 'button' },
  });
  const entryActions = createElement('div', { className: 'button-row' });
  [
    ['current', 'Current Week'],
    ['past', 'Past Weeks'],
    ['all', 'All Weeks'],
  ].forEach(([value, label]) => {
    filterSelect.appendChild(createElement('option', { text: label, attributes: { value } }));
  });
  const list = createElement('section', { className: 'player-list', attributes: { 'aria-label': 'Entry sheets' } });

  everybodyPicks.addEventListener('click', () => {
    navigateTo('player-everybodys-picks');
  });
  entryActions.appendChild(everybodyPicks);

  appendChildren(card, [
    createElement('p', { className: 'eyebrow', text: 'Picks' }),
    createElement('h2', { text: 'My Entry Sheets' }),
    createElement('p', { className: 'muted', text: 'Each approved entry has its own weekly pick sheet.' }),
    entryActions,
    createField('Entry sheet filter', filterSelect),
    status,
    list,
  ]);

  function renderCurrentEntries(data, entries) {
    if (data.week && entries.length) entries.forEach((entry) => {
      const entryCard = createElement('article', { className: 'player-card compact-card' });
      const header = createElement('div', { className: 'player-card-header' });
      const details = createElement('dl', { className: 'player-meta' });
      [
        ['Week', `Season ${data.week.season} - ${seasonTypeLabel(data.week.seasonType)} Week ${data.week.nflWeek}`],
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
      appendChildren(header, [
        createElement('h3', { text: entry.entryLabel || 'Entry' }),
        createElement('span', {
          className: `status-pill ${entry.status === 'active' ? '' : 'status-pill-muted'}`,
          text: entry.status === 'active' ? 'Active' : 'Unknown',
        }),
        createElement('span', {
          className: `status-pill ${entry.complete ? '' : 'status-pill-muted'}`,
          text: entry.complete ? 'Complete' : 'In progress',
        }),
      ]);
      appendChildren(entryCard, [
        header,
        details,
        buttons,
      ]);
      list.appendChild(entryCard);
    });
  }

  function renderCompletedEntries(completedEntries) {
    if (completedEntries.length) {
      list.appendChild(createElement('h3', { text: 'Completed Results' }));
      completedEntries.forEach((entry) => {
        const entryCard = createElement('article', { className: 'player-card compact-card' });
        const header = createElement('div', { className: 'player-card-header' });
        const details = createElement('dl', { className: 'player-meta' });
        [
          ['Week', `Season ${entry.week.season} - ${seasonTypeLabel(entry.week.seasonType)} Week ${entry.week.nflWeek}`],
          ['Score', `${entry.result.regularPoints} of ${entry.result.totalGames}`],
          ['Rank', String(entry.result.rank)],
          ['Graded', formatDateTime(entry.result.gradedAt)],
        ].forEach(([label, value]) => {
          details.appendChild(createElement('dt', { text: label }));
          details.appendChild(createElement('dd', { text: value }));
        });
        const open = createElement('button', {
          className: 'primary-button',
          text: 'View Results',
          attributes: { type: 'button' },
        });
        const weeklyResults = createElement('button', {
          className: 'secondary-button',
          text: 'Weekly Results',
          attributes: { type: 'button' },
        });
        open.addEventListener('click', () => {
          navigateTo(`player-entry-picks?entryId=${encodeURIComponent(entry.entryId)}`);
        });
        weeklyResults.addEventListener('click', () => {
          navigateTo(`player-weekly-results?weekId=${encodeURIComponent(entry.week.weekId)}`);
        });
        const buttons = createElement('div', { className: 'button-row' });
        appendChildren(buttons, [open, weeklyResults]);
        appendChildren(header, [
          createElement('h3', { text: entry.entryLabel || 'Entry' }),
          createElement('span', { className: 'status-pill', text: `${entry.result.regularPoints} of ${entry.result.totalGames}` }),
        ]);
        appendChildren(entryCard, [
          header,
          details,
          buttons,
        ]);
        list.appendChild(entryCard);
      });
    }
  }

  function renderEntrySheets() {
    if (!latestEntrySheetsData) {
      return;
    }
    const data = latestEntrySheetsData;
    const entries = data.entries || [];
    const completedEntries = data.completedEntries || [];
    list.replaceChildren();
    if (entrySheetFilter === 'current') {
      if (!data.week) {
        status.textContent = 'No Week is currently open for picks.';
      } else if (!entries.length) {
        status.textContent = 'No current Week entries.';
      } else {
        status.textContent = '';
      }
      renderCurrentEntries(data, entries);
      return;
    }
    if (entrySheetFilter === 'past') {
      status.textContent = completedEntries.length ? '' : 'No past Week entries.';
      renderCompletedEntries(completedEntries);
      return;
    }
    if (!entries.length && !completedEntries.length) {
      status.textContent = 'No entry sheets yet.';
      return;
    }
    status.textContent = '';
    renderCurrentEntries(data, entries);
    renderCompletedEntries(completedEntries);
  }

  filterSelect.addEventListener('change', () => {
    entrySheetFilter = filterSelect.value;
    renderEntrySheets();
  });

  async function loadEntrySheets(initialBootstrapRequest = null, background = false) {
    if (entrySheetsRequest) {
      if (!background) {
        return entrySheetsRequest;
      }
      entrySheetsRefreshQueued = true;
      await entrySheetsRequest;
      if (!entrySheetsRefreshQueued || !card.isConnected) {
        return;
      }
      entrySheetsRefreshQueued = false;
      return loadEntrySheets(null, true);
    }
    if (!background) {
      status.classList.remove('error-text');
    }
    const request = (async () => {
      try {
        const data = initialBootstrapRequest
          ? await playerDashboardBootstrapSection(initialBootstrapRequest, 'entrySheets')
          : (await playerAction('player.week.entrySheets')).data;
        status.classList.remove('error-text');
        latestEntrySheetsData = data;
        renderEntrySheets();
        return;
      } catch (error) {
        if (!background) {
          status.textContent = error.message;
          status.classList.add('error-text');
          list.replaceChildren();
        }
      }
    })();
    entrySheetsRequest = request;
    try {
      await request;
    } finally {
      if (entrySheetsRequest === request) {
        entrySheetsRequest = null;
      }
    }
  }

  loadEntrySheets(bootstrapRequest);
  return {
    card,
    isConnected: () => card.isConnected,
    refresh: () => loadEntrySheets(null, true),
  };
}

function createThisWeekHelper(bootstrapRequest, entrySheets) {
  const card = createElement('section', { className: 'state-card compact-card this-week-helper' });
  const body = createElement('div');
  card.hidden = true;

  function openEntrySheets() {
    if (!entrySheets.card.isConnected) return;
    entrySheets.card.scrollIntoView({ block: 'start' });
    entrySheets.card.focus({ preventScroll: true });
  }

  function render(thisWeek) {
    body.replaceChildren();
    if (!thisWeek) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    const label = thisWeekLabel(thisWeek);
    if (thisWeek.firstLockPassed) {
      const header = createElement('div', { className: 'this-week-helper-header' });
      const open = createElement('button', {
        className: 'secondary-button',
        text: 'Open My Entry Sheets',
        attributes: { type: 'button' },
      });
      open.addEventListener('click', openEntrySheets);
      appendChildren(header, [
        createElement('p', { className: 'eyebrow', text: 'Games have started' }),
        createElement('h2', { text: label }),
      ]);
      appendChildren(body, [
        header,
        createElement('p', { className: 'muted', text: 'Some picks are now locked.' }),
        createElement('p', { className: 'muted', text: 'All times Central Time.' }),
        appendChildren(createElement('div', { className: 'this-week-helper-action' }), [open]),
      ]);
      return;
    }
    const header = createElement('div', { className: 'this-week-helper-header' });
    const times = createElement('dl', { className: 'player-meta this-week-helper-times' });
    [
      ['First game', formatCentralTime(thisWeek.firstKickoffAt)],
      ['First pick locks', formatCentralTime(thisWeek.firstLockAt)],
    ].forEach(([term, value]) => {
      times.appendChild(createElement('dt', { text: term }));
      times.appendChild(createElement('dd', { text: value }));
    });
    appendChildren(header, [
      createElement('p', { className: 'eyebrow', text: 'This Week 🏈' }),
      createElement('h2', { text: label }),
    ]);
    appendChildren(body, [
      header,
      times,
      createElement('p', { className: 'muted', text: 'All times Central Time.' }),
      createElement('p', { className: 'muted', text: 'Make your picks before the lock.' }),
    ]);
  }

  card.appendChild(body);
  playerDashboardBootstrapSection(bootstrapRequest, 'entrySheets')
    .then((data) => render(data.thisWeek))
    .catch(() => {
      card.hidden = true;
    });
  return card;
}

function createDashboardMoraleCard(bootstrapRequest) {
  const card = createElement('section', { className: 'state-card compact-card this-week-helper' });
  const body = createElement('div');
  card.hidden = true;

  function playerCountLabel(count) {
    return `${count} Registered ${count === 1 ? 'Player' : 'Players'}`;
  }

  function render(data) {
    const registeredPlayerCount = Number(data.leagueSummary && data.leagueSummary.registeredPlayerCount);
    const thisWeek = data.entrySheets && data.entrySheets.thisWeek;
    const showCount = Number.isSafeInteger(registeredPlayerCount) && registeredPlayerCount >= 0;
    const showPreseason = thisWeek && thisWeek.seasonType === 'preseason';
    body.replaceChildren();
    if (!showCount && !showPreseason) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    if (showCount) {
      body.appendChild(createElement('p', { className: 'status-pill status-pill-muted', text: `👥 ${playerCountLabel(registeredPlayerCount)}` }));
    }
    if (showPreseason) {
      body.appendChild(createElement('p', { className: 'eyebrow', text: 'PRESEASON IS FREE 🏈' }));
      body.appendChild(createElement('p', { className: 'muted', text: 'Preseason is free to play. Real-money prize pots begin with the regular season.' }));
    }
  }

  card.appendChild(body);
  bootstrapRequest
    .then((result) => {
      const sections = result.data || {};
      const leagueSummary = sections.leagueSummary && sections.leagueSummary.ok === true ? sections.leagueSummary.data : null;
      const entrySheets = sections.entrySheets && sections.entrySheets.ok === true ? sections.entrySheets.data : null;
      render({ leagueSummary, entrySheets });
    })
    .catch(() => {
      card.hidden = true;
    });
  return card;
}

export function createPlayerDashboardView(context = {}) {
  const player = context.player || {};
  const wrapper = createElement('main', { className: 'page-container' });
  const card = createElement('section', { className: 'state-card compact-card player-dashboard-card' });
  const summary = createElement('div', { className: 'player-dashboard-summary' });
  const summaryIntro = createElement('div', { className: 'player-dashboard-summary-intro' });
  const identity = createElement('div', { className: 'player-dashboard-summary-identity' });
  const actions = createElement('div', { className: 'player-dashboard-summary-actions' });
  const avatar = createElement('span', { className: 'player-avatar large-avatar', text: player.avatar || 'football' });
  const status = createElement('span', { className: 'status-pill', text: player.status || 'active' });
  const accent = createElement('span', { className: 'player-dashboard-accent', text: '🏈' });
  const logout = createElement('button', { className: 'secondary-button', text: 'Logout', attributes: { type: 'button' } });
  const dashboardGrid = createElement('section', { className: 'player-dashboard-grid' });
  const bootstrapRequest = playerAction('player.dashboard.bootstrap');
  const entrySheets = createEntrySheetsCard(bootstrapRequest);
  const moraleCard = createDashboardMoraleCard(bootstrapRequest);
  const thisWeekHelper = createThisWeekHelper(bootstrapRequest, entrySheets);
  const inviteFriends = createInviteFriendsCard(player, bootstrapRequest);
  const paymentWorkspace = createPaymentWorkspace(bootstrapRequest, entrySheets, inviteFriends);

  logout.addEventListener('click', async () => {
    logout.disabled = true;
    await logoutPlayer();
    navigateTo('player-login');
  });

  appendChildren(summaryIntro, [
    createElement('p', { className: 'eyebrow', text: 'Player Dashboard' }),
    avatar,
  ]);
  appendChildren(identity, [
    createElement('h2', { text: `Welcome back, ${player.displayName || 'Player'}` }),
    status,
  ]);
  appendChildren(actions, [accent, logout]);
  appendChildren(summary, [summaryIntro, identity, actions]);
  appendChildren(dashboardGrid, [
    paymentWorkspace.requestCard,
    paymentWorkspace.historyCard,
    entrySheets.card,
    inviteFriends.card,
  ]);
  appendChildren(card, [
    summary,
  ]);
  appendChildren(wrapper, [
    card,
    moraleCard,
    thisWeekHelper,
    dashboardGrid,
  ]);
  return wrapper;
}

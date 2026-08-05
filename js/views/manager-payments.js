import { requestAction } from '../api.js';
import { getManagerSessionToken } from '../auth.js';
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
  return fallback ? `$${fallback}` : 'Unavailable';
}

function formatDate(value) {
  if (!value) {
    return 'Not yet';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not yet';
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
  }[status] || 'Unknown';
}

function emptyMessageForStatus(status) {
  return {
    pending: 'No pending payment requests.',
    approved: 'No approved payment requests.',
    rejected: 'No rejected payment requests.',
    all: 'No payment requests yet.',
  }[status] || 'No payment requests yet.';
}

function shouldRefreshAfterMutationError(error) {
  return [
    'NETWORK_ERROR',
    'PARSE_ERROR',
    'APPROVAL_RESPONSE_INCOMPLETE',
    'REJECTION_RESPONSE_INCOMPLETE',
    'PAYMENT_ALREADY_APPROVED',
    'PAYMENT_ALREADY_REJECTED',
    'PAYMENT_STATUS_INVALID',
    'PAYMENT_STATUS_REVIEW_REQUIRED',
  ].indexOf(error && error.code) !== -1;
}

function incompleteApprovalResponseError() {
  const error = new Error('Payment approval may have completed, but the response was incomplete.');
  error.code = 'APPROVAL_RESPONSE_INCOMPLETE';
  error.reconciledMessage = 'Payment approval may have completed, but the response was incomplete. The payment list was refreshed to confirm its status.';
  error.refreshFailedMessage = 'Payment approval may have completed, but the response was incomplete and the payment list could not refresh.';
  return error;
}

function incompleteRejectionResponseError() {
  const error = new Error('Payment rejection may have completed, but the response was incomplete.');
  error.code = 'REJECTION_RESPONSE_INCOMPLETE';
  error.reconciledMessage = 'Payment rejection may have completed, but the response was incomplete. The payment list was refreshed to confirm its status.';
  error.refreshFailedMessage = 'Payment rejection may have completed, but the response was incomplete and the payment list could not refresh.';
  return error;
}

function validateMutationPayment(result, currentPayment, expectedStatus, errorFactory) {
  const returnedPayment = result && result.data && result.data.payment;
  const player = currentPayment && currentPayment.player;
  const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';
  const isNonNegativeInteger = (value) => Number.isFinite(value) && Number.isInteger(value) && value >= 0;
  if (
    !returnedPayment
    || typeof returnedPayment !== 'object'
    || Array.isArray(returnedPayment)
    || !isNonEmptyString(returnedPayment.paymentId)
    || returnedPayment.paymentId !== currentPayment.paymentId
    || !isNonEmptyString(returnedPayment.playerId)
    || returnedPayment.playerId !== currentPayment.playerId
    || !isNonEmptyString(returnedPayment.weekId)
    || !isNonEmptyString(returnedPayment.method)
    || !Number.isFinite(returnedPayment.entriesPaid)
    || !Number.isInteger(returnedPayment.entriesPaid)
    || returnedPayment.entriesPaid <= 0
    || !isNonNegativeInteger(returnedPayment.amountDueCents)
    || !isNonNegativeInteger(returnedPayment.amountCollectedCents)
    || !isNonEmptyString(returnedPayment.status)
    || returnedPayment.status !== expectedStatus
    || typeof returnedPayment.createdAt !== 'string'
    || typeof returnedPayment.updatedAt !== 'string'
    || (expectedStatus === 'approved' && (
      typeof returnedPayment.approvedAt !== 'string'
      || !isNonNegativeInteger(returnedPayment.entriesCreatedCount)
    ))
    || (expectedStatus === 'rejected' && typeof returnedPayment.rejectedAt !== 'string')
    || !player
    || typeof player !== 'object'
    || Array.isArray(player)
    || !isNonEmptyString(player.playerId)
    || player.playerId !== returnedPayment.playerId
    || !isNonEmptyString(player.displayName)
    || typeof player.avatar !== 'string'
    || typeof player.status !== 'string'
  ) {
    throw errorFactory();
  }
  return { ...returnedPayment, player };
}

function sortNewestPaymentsFirst(left, right) {
  return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
}

function reconcileMutationPayments(currentPayments, currentPayment, returnedPayment, status) {
  const reconciled = currentPayments.filter((payment) => payment.paymentId !== currentPayment.paymentId);
  if (status === 'all' || returnedPayment.status === status) {
    reconciled.push(returnedPayment);
    reconciled.sort(sortNewestPaymentsFirst);
  }
  return reconciled;
}

export function createManagerPaymentsView() {
  let payments = [];
  let selectedStatus = 'pending';
  let loadVersion = 0;
  let lastAppliedLoadVersion = 0;
  let rejectingPaymentId = '';
  const inFlightPaymentIds = new Set();
  const blockedPaymentIds = new Set();
  const blockedAfterLoadVersions = new Map();
  const reconciliationMessages = new Map();
  const publishedReconciliationNotices = new Set();

  function publishReconciliationNotice(notice) {
    const normalizedNotice = String(notice || '').trim();
    if (!normalizedNotice) {
      return false;
    }
    publishedReconciliationNotices.add(normalizedNotice);
    message.textContent = Array.from(publishedReconciliationNotices).join(' ');
    message.classList.add('error-text');
    return true;
  }

  function publishReconciliationNotices(notices) {
    let published = false;
    (Array.isArray(notices) ? notices : []).forEach((notice) => {
      published = publishReconciliationNotice(notice) || published;
    });
    return published;
  }

  function blockPayment(paymentId, error) {
    blockedPaymentIds.add(paymentId);
    blockedAfterLoadVersions.set(paymentId, lastAppliedLoadVersion);
    if (error) {
      reconciliationMessages.set(paymentId, error.reconciledMessage || error.message);
    }
  }

  function reconcileBlockedPayments() {
    let changed = false;
    const notices = [];
    blockedPaymentIds.forEach((paymentId) => {
      const blockedAfterVersion = blockedAfterLoadVersions.get(paymentId) || 0;
      if (!inFlightPaymentIds.has(paymentId) && lastAppliedLoadVersion > blockedAfterVersion) {
        blockedPaymentIds.delete(paymentId);
        blockedAfterLoadVersions.delete(paymentId);
        if (reconciliationMessages.has(paymentId)) {
          notices.push(reconciliationMessages.get(paymentId));
          reconciliationMessages.delete(paymentId);
        }
        changed = true;
      }
    });
    return { changed, notices };
  }

  const wrapper = createElement('main', { className: 'page-container' });
  const header = createElement('section', { className: 'state-card manager-toolbar' });
  const controls = createElement('div', { className: 'manager-controls' });
  const statusSelect = createElement('select', { attributes: { 'aria-label': 'Payment status' } });
  [
    ['pending', 'Pending'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
    ['all', 'All'],
  ].forEach(([value, label]) => {
    statusSelect.appendChild(createElement('option', { text: label, attributes: { value } }));
  });
  const back = createElement('button', { className: 'secondary-button', text: 'Manager Dashboard', attributes: { type: 'button' } });
  const message = createElement('p', {
    className: 'muted',
    text: 'Loading payment requests...',
    attributes: { role: 'status', 'aria-live': 'polite' },
  });
  const list = createElement('section', { className: 'player-list', attributes: { 'aria-label': 'Payment requests' } });

  back.addEventListener('click', () => navigateTo('manager-dashboard'));
  statusSelect.addEventListener('change', () => {
    selectedStatus = statusSelect.value;
    rejectingPaymentId = '';
    loadPayments();
  });

  appendChildren(controls, [createField('Payment status', statusSelect), back]);
  appendChildren(header, [
    createElement('p', { className: 'eyebrow', text: 'League Manager' }),
    createElement('h1', { text: 'Payment Requests' }),
    createElement('p', {
      className: 'muted',
      text: 'Review player payment requests after confirming payment outside the app. Approving a request creates the player\'s entry sheets.',
    }),
    controls,
    message,
  ]);
  appendChildren(wrapper, [header, list]);

  async function loadPayments(options = {}) {
    const currentVersion = ++loadVersion;
    if (!options.preserveMessage) {
      publishedReconciliationNotices.clear();
      message.classList.remove('error-text');
      message.textContent = 'Loading payment requests...';
    }
    try {
      const result = await managerAction('manager.payments.list', { status: selectedStatus });
      if (currentVersion !== loadVersion) {
        return { status: 'stale' };
      }
      payments = result.data.payments || [];
      lastAppliedLoadVersion = currentVersion;
      const reconciliation = reconcileBlockedPayments();
      rejectingPaymentId = '';
      renderPayments();
      if (!publishReconciliationNotices(reconciliation.notices) && publishedReconciliationNotices.size === 0) {
        message.classList.remove('error-text');
        message.textContent = options.successMessage || '';
      }
      return { status: 'applied' };
    } catch (error) {
      if (currentVersion !== loadVersion) {
        return { status: 'stale' };
      }
      const failureMessage = options.successMessage
        ? `${options.successMessage} Payment list could not refresh: ${error.message}`
        : error.message;
      publishReconciliationNotice(failureMessage);
      return { status: 'failed' };
    }
  }

  function renderPayments() {
    list.replaceChildren();
    if (!payments.length) {
      list.appendChild(createElement('p', { className: 'muted', text: emptyMessageForStatus(selectedStatus) }));
      return;
    }
    payments.forEach((payment) => list.appendChild(createPaymentCard(payment)));
  }

  function applyMutationPayment(currentPayment, returnedPayment, successMessage) {
    payments = reconcileMutationPayments(payments, currentPayment, returnedPayment, selectedStatus);
    rejectingPaymentId = '';
    renderPayments();
    if (publishedReconciliationNotices.size === 0) {
      message.classList.remove('error-text');
      message.textContent = successMessage;
    }
  }

  function createPaymentCard(payment) {
    const card = createElement('article', { className: 'player-card' });
    const headerRow = createElement('div', { className: 'player-card-header' });
    const player = payment.player || {};
    const avatar = createElement('span', { className: 'player-avatar', text: player.avatar || 'football' });
    const title = createElement('div');
    const status = createElement('span', {
      className: `status-pill ${payment.status === 'approved' ? '' : 'status-pill-muted'}`,
      text: paymentStatusLabel(payment.status),
    });
    appendChildren(title, [createElement('h3', { text: player.displayName || 'Unknown player' }), status]);
    appendChildren(headerRow, [avatar, title]);

    const meta = createElement('dl', { className: 'player-meta' });
    const rows = [
      ['Payment method', paymentMethodLabel(payment.method)],
      ['Entry quantity', String(payment.entriesPaid || 0)],
      ['Amount due', formatMoney(payment.amountDueCents, payment.amountDue)],
      ['Week', String(payment.weekId || 'Unknown')],
      ['Submitted', formatDate(payment.createdAt)],
    ];
    if (payment.status === 'approved') {
      rows.push(['Approved', formatDate(payment.approvedAt)]);
      rows.push(['Entries created', String(payment.entriesCreatedCount || 0)]);
    }
    if (payment.status === 'rejected') {
      rows.push(['Rejected', formatDate(payment.rejectedAt)]);
    }
    rows.forEach(([label, value]) => {
      meta.appendChild(createElement('dt', { text: label }));
      meta.appendChild(createElement('dd', { text: value }));
    });

    appendChildren(card, [headerRow, meta]);
    if (payment.status === 'rejected' && payment.rejectionReason) {
      card.appendChild(createElement('p', { className: 'muted invite-link-text', text: `Rejection reason: ${payment.rejectionReason}` }));
    }
    if (payment.status === 'pending') {
      card.appendChild(createPendingControls(payment));
    }
    return card;
  }

  function createPendingControls(payment) {
    if (rejectingPaymentId === payment.paymentId) {
      return createRejectionForm(payment);
    }

    const region = createElement('section');
    const actions = createElement('div', { className: 'button-row' });
    const approve = createElement('button', { className: 'primary-button', text: 'Approve', attributes: { type: 'button' } });
    const reject = createElement('button', { className: 'secondary-button', text: 'Reject', attributes: { type: 'button' } });
    const mutationStatus = createElement('p', { className: 'muted', attributes: { role: 'status', 'aria-live': 'polite' } });
    const setDisabled = (disabled) => {
      approve.disabled = disabled;
      reject.disabled = disabled;
    };
    setDisabled(inFlightPaymentIds.has(payment.paymentId) || blockedPaymentIds.has(payment.paymentId));
    approve.addEventListener('click', () => approvePayment(payment, mutationStatus, setDisabled));
    reject.addEventListener('click', () => {
      if (inFlightPaymentIds.has(payment.paymentId) || blockedPaymentIds.has(payment.paymentId)) {
        return;
      }
      rejectingPaymentId = payment.paymentId;
      renderPayments();
    });
    appendChildren(actions, [approve, reject]);
    appendChildren(region, [actions, mutationStatus]);
    return region;
  }

  function createRejectionForm(payment) {
    const form = createElement('form', { className: 'auth-form' });
    const reason = createElement('textarea', {
      attributes: { name: 'rejectionReason', maxlength: '250', rows: '3' },
    });
    const buttons = createElement('div', { className: 'button-row' });
    const confirm = createElement('button', { className: 'primary-button', text: 'Confirm Rejection', attributes: { type: 'submit' } });
    const cancel = createElement('button', { className: 'secondary-button', text: 'Cancel', attributes: { type: 'button' } });
    const mutationStatus = createElement('p', { className: 'muted', attributes: { role: 'status', 'aria-live': 'polite' } });
    const setDisabled = (disabled) => {
      reason.disabled = disabled;
      confirm.disabled = disabled;
      cancel.disabled = disabled;
    };
    setDisabled(inFlightPaymentIds.has(payment.paymentId) || blockedPaymentIds.has(payment.paymentId));
    cancel.addEventListener('click', () => {
      if (inFlightPaymentIds.has(payment.paymentId) || blockedPaymentIds.has(payment.paymentId)) {
        return;
      }
      rejectingPaymentId = '';
      renderPayments();
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await rejectPayment(payment, reason.value.trim(), mutationStatus, setDisabled);
    });
    appendChildren(buttons, [confirm, cancel]);
    appendChildren(form, [
      createField('Rejection reason (optional)', reason),
      buttons,
      mutationStatus,
    ]);
    return form;
  }

  async function approvePayment(payment, mutationStatus, setDisabled) {
    if (inFlightPaymentIds.has(payment.paymentId) || blockedPaymentIds.has(payment.paymentId)) {
      return;
    }
    const amount = formatMoney(payment.amountDueCents, payment.amountDue);
    const playerName = payment.player && payment.player.displayName ? payment.player.displayName : 'this player';
    const entryLabel = Number(payment.entriesPaid) === 1 ? 'entry' : 'entries';
    if (!window.confirm(`Approve ${amount} from ${playerName} for ${payment.entriesPaid} ${entryLabel}?`)) {
      return;
    }

    inFlightPaymentIds.add(payment.paymentId);
    statusSelect.disabled = true;
    setDisabled(true);
    mutationStatus.classList.remove('error-text');
    mutationStatus.textContent = 'Approving payment...';
    try {
      const result = await managerAction('manager.payment.approve', { paymentId: payment.paymentId });
      if (!result || !result.data || !Array.isArray(result.data.entries)) {
        throw incompleteApprovalResponseError();
      }
      const returnedPayment = validateMutationPayment(result, payment, 'approved', incompleteApprovalResponseError);
      const entryCount = result.data.entries.length;
      const noun = entryCount === 1 ? 'entry was' : 'entries were';
      const successMessage = `Payment approved. ${entryCount} ${noun} created or confirmed.`;
      mutationStatus.textContent = successMessage;
      applyMutationPayment(payment, returnedPayment, successMessage);
    } catch (error) {
      mutationStatus.textContent = error.message;
      mutationStatus.classList.add('error-text');
      if (shouldRefreshAfterMutationError(error)) {
        blockPayment(payment.paymentId, error);
        const refreshOutcome = await loadPayments({ preserveMessage: true });
        if (refreshOutcome.status === 'applied') {
          publishReconciliationNotice(error.reconciledMessage || error.message);
        } else if (refreshOutcome.status === 'failed') {
          const refreshFailedMessage = error.refreshFailedMessage || `${error.message} Payment list could not refresh.`;
          mutationStatus.textContent = refreshFailedMessage;
          publishReconciliationNotice(refreshFailedMessage);
        }
      }
    } finally {
      inFlightPaymentIds.delete(payment.paymentId);
      statusSelect.disabled = inFlightPaymentIds.size > 0;
      const reconciliation = reconcileBlockedPayments();
      if (reconciliation.changed) {
        renderPayments();
      }
      publishReconciliationNotices(reconciliation.notices);
      if (!blockedPaymentIds.has(payment.paymentId)) {
        setDisabled(false);
      }
    }
  }

  async function rejectPayment(payment, rejectionReason, mutationStatus, setDisabled) {
    if (inFlightPaymentIds.has(payment.paymentId) || blockedPaymentIds.has(payment.paymentId)) {
      return;
    }
    inFlightPaymentIds.add(payment.paymentId);
    statusSelect.disabled = true;
    setDisabled(true);
    mutationStatus.classList.remove('error-text');
    mutationStatus.textContent = 'Rejecting payment...';
    try {
      const result = await managerAction('manager.payment.reject', {
        paymentId: payment.paymentId,
        rejectionReason,
      });
      const returnedPayment = validateMutationPayment(result, payment, 'rejected', incompleteRejectionResponseError);
      const successMessage = 'Payment request rejected.';
      mutationStatus.textContent = successMessage;
      applyMutationPayment(payment, returnedPayment, successMessage);
    } catch (error) {
      mutationStatus.textContent = error.message;
      mutationStatus.classList.add('error-text');
      if (shouldRefreshAfterMutationError(error)) {
        blockPayment(payment.paymentId, error);
        const refreshOutcome = await loadPayments({ preserveMessage: true });
        if (refreshOutcome.status === 'applied') {
          publishReconciliationNotice(error.message);
        } else if (refreshOutcome.status === 'failed') {
          const refreshFailedMessage = `${error.message} Payment list could not refresh.`;
          mutationStatus.textContent = refreshFailedMessage;
          publishReconciliationNotice(refreshFailedMessage);
        }
      }
    } finally {
      inFlightPaymentIds.delete(payment.paymentId);
      statusSelect.disabled = inFlightPaymentIds.size > 0;
      const reconciliation = reconcileBlockedPayments();
      if (reconciliation.changed) {
        renderPayments();
      }
      publishReconciliationNotices(reconciliation.notices);
      if (!blockedPaymentIds.has(payment.paymentId)) {
        setDisabled(false);
      }
    }
  }

  loadPayments();
  return wrapper;
}

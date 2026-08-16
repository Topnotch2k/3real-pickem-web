import { requestAction } from '../api.js?v=20260815-1';
import { getManagerSessionToken } from '../auth.js?v=20260815-1';
import { navigateTo } from '../router.js?v=20260815-1';
import { createManagerNav } from '../navigation.js?v=20260815-1';

const AVATARS = [
  { value: 'football', label: 'Football' },
  { value: 'eagle', label: 'Eagle' },
  { value: 'bear', label: 'Bear' },
  { value: 'wolf', label: 'Wolf' },
  { value: 'star', label: 'Star' },
  { value: 'flame', label: 'Flame' },
  { value: 'lightning', label: 'Lightning' },
];

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

function createField(labelText, control) {
  const label = createElement('label', { className: 'form-field' });
  label.appendChild(createElement('span', { text: labelText }));
  label.appendChild(control);
  return label;
}

function createAvatarSelect(selected = 'football') {
  const select = createElement('select', { attributes: { name: 'avatar' } });
  AVATARS.forEach((avatar) => {
    const option = createElement('option', { text: avatar.label, attributes: { value: avatar.value } });
    if (avatar.value === selected) {
      option.selected = true;
    }
    select.appendChild(option);
  });
  return select;
}

function requestPlayerAction(action, payload = {}) {
  return requestAction(action, { ...payload, sessionToken: getManagerSessionToken() });
}

function createOneTimePinPanel(pin, onClose) {
  const panel = createElement('section', { className: 'pin-panel', attributes: { role: 'status', 'aria-live': 'polite' } });
  const pinValue = createElement('p', { className: 'pin-value', text: pin });
  const copyStatus = createElement('p', { className: 'muted', text: 'This PIN is shown once. Give it to the player now.' });
  const buttonRow = createElement('div', { className: 'button-row' });
  const copyButton = createElement('button', { className: 'primary-button', text: 'Copy PIN', attributes: { type: 'button' } });
  const closeButton = createElement('button', { className: 'secondary-button', text: 'Close', attributes: { type: 'button' } });

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pin);
      copyStatus.textContent = 'PIN copied. It will disappear when this panel closes.';
    } catch (error) {
      copyStatus.textContent = 'Copy failed. Select the PIN above and copy it manually.';
    }
  });

  closeButton.addEventListener('click', onClose);
  appendChildren(buttonRow, [copyButton, closeButton]);
  appendChildren(panel, [
    createElement('p', { className: 'eyebrow', text: 'One-Time PIN' }),
    createElement('h2', { text: 'Give this PIN to the player now' }),
    pinValue,
    copyStatus,
    buttonRow,
  ]);
  return panel;
}

function createPlayerForm({ mode, player, onSubmit, onCancel }) {
  const form = createElement('form', { className: 'auth-form player-form' });
  const nameInput = createElement('input', {
    attributes: {
      name: 'displayName',
      type: 'text',
      autocomplete: 'off',
      maxlength: '40',
      required: 'required',
      value: player ? player.displayName : '',
    },
  });
  const notesInput = createElement('textarea', {
    attributes: {
      name: 'notes',
      maxlength: '240',
      rows: '4',
    },
  });
  notesInput.value = player ? player.notes || '' : '';
  const avatarSelect = createAvatarSelect(player ? player.avatar : 'football');
  const error = createElement('p', { className: 'muted', attributes: { role: 'status', 'aria-live': 'polite' } });
  const submit = createElement('button', { className: 'primary-button', text: mode === 'edit' ? 'Save Player' : 'Create Player', attributes: { type: 'submit' } });
  const cancel = createElement('button', { className: 'secondary-button', text: 'Cancel', attributes: { type: 'button' } });
  const buttons = createElement('div', { className: 'button-row' });

  cancel.addEventListener('click', onCancel);
  appendChildren(buttons, [submit, cancel]);
  appendChildren(form, [
    createField('Display name', nameInput),
    createField('Preset avatar', avatarSelect),
    createField('Notes', notesInput),
    buttons,
    error,
  ]);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.classList.remove('error-text');
    error.textContent = mode === 'edit' ? 'Saving player...' : 'Creating player...';
    submit.disabled = true;
    cancel.disabled = true;
    try {
      await onSubmit({
        displayName: nameInput.value,
        avatar: avatarSelect.value,
        notes: notesInput.value,
      });
      error.textContent = '';
    } catch (submitError) {
      error.textContent = submitError.message;
      error.classList.add('error-text');
    } finally {
      submit.disabled = false;
      cancel.disabled = false;
    }
  });

  return form;
}

function createPlayerCard(player, handlers) {
  const card = createElement('article', { className: 'player-card' });
  const header = createElement('div', { className: 'player-card-header' });
  const avatar = createElement('span', { className: 'player-avatar', text: player.avatar || 'football' });
  const titleBlock = createElement('div');
  const status = createElement('span', { className: `status-pill ${player.status === 'inactive' ? 'status-pill-muted' : ''}`, text: player.status });
  appendChildren(titleBlock, [createElement('h3', { text: player.displayName }), status]);
  appendChildren(header, [avatar, titleBlock]);

  const meta = createElement('dl', { className: 'player-meta' });
  [
    ['Created', formatDate(player.createdAt)],
    ['Last login', formatDate(player.lastLoginAt)],
    ['Updated', formatDate(player.updatedAt)],
  ].forEach(([label, value]) => {
    meta.appendChild(createElement('dt', { text: label }));
    meta.appendChild(createElement('dd', { text: value }));
  });

  const notes = createElement('p', { className: 'muted', text: player.notes || 'No notes yet.' });
  const actions = createElement('div', { className: 'button-row' });
  const edit = createElement('button', { className: 'secondary-button', text: 'Edit', attributes: { type: 'button' } });
  const statusButton = createElement('button', {
    className: 'secondary-button',
    text: player.status === 'inactive' ? 'Activate' : 'Deactivate',
    attributes: { type: 'button' },
  });
  const resetPin = createElement('button', { className: 'secondary-button', text: 'Reset PIN', attributes: { type: 'button' } });
  edit.addEventListener('click', () => handlers.edit(player));
  statusButton.addEventListener('click', () => handlers.setStatus(player, player.status === 'inactive' ? 'active' : 'inactive'));
  resetPin.addEventListener('click', () => handlers.resetPin(player));
  appendChildren(actions, [edit, statusButton, resetPin]);
  appendChildren(card, [header, meta, notes, actions]);
  return card;
}

export function createManagerPlayersView() {
  let players = [];
  let statusFilter = 'all';
  let searchText = '';
  let oneTimePin = '';
  let editingPlayer = null;

  const wrapper = createElement('main', { className: 'page-container' });
  const header = createElement('section', { className: 'state-card manager-toolbar' });
  const controls = createElement('div', { className: 'manager-controls' });
  const search = createElement('input', { attributes: { type: 'search', placeholder: 'Search players', 'aria-label': 'Search players' } });
  const status = createElement('select', { attributes: { 'aria-label': 'Filter by status' } });
  [['all', 'All players'], ['active', 'Active'], ['inactive', 'Inactive']].forEach(([value, label]) => {
    status.appendChild(createElement('option', { text: label, attributes: { value } }));
  });
  const back = createElement('button', { className: 'secondary-button', text: 'Manager Dashboard', attributes: { type: 'button' } });
  const message = createElement('p', { className: 'muted', attributes: { role: 'status', 'aria-live': 'polite' } });
  const dynamicRegion = createElement('section', { className: 'player-workspace' });
  const list = createElement('section', { className: 'player-list', attributes: { 'aria-label': 'Players' } });

  back.addEventListener('click', () => navigateTo('manager-dashboard'));
  search.addEventListener('input', () => {
    searchText = search.value;
    loadPlayers();
  });
  status.addEventListener('change', () => {
    statusFilter = status.value;
    loadPlayers();
  });

  appendChildren(controls, [search, status, back]);
  appendChildren(header, [
    createElement('p', { className: 'eyebrow', text: 'League Manager' }),
    createElement('h1', { text: 'Players' }),
    createElement('p', { className: 'muted', text: 'Players create their own profiles from league invite links. Manage status, avatar, notes, and PIN resets here.' }),
    controls,
    message,
  ]);
  appendChildren(wrapper, [createManagerNav('manager-players'), header, dynamicRegion, list]);

  async function loadPlayers(options = {}) {
    message.classList.remove('error-text');
    message.textContent = 'Loading players...';
    try {
      const result = await requestPlayerAction('manager.players.list', { search: searchText, status: statusFilter });
      players = result.data.players || [];
      message.textContent = players.length ? `${players.length} player${players.length === 1 ? '' : 's'} found.` : 'No players yet.';
      render();
    } catch (error) {
      message.textContent = options.preservePin ? options.warning : error.message;
      message.classList.add('error-text');
    }
  }

  async function updatePlayer(values) {
    await requestPlayerAction('manager.players.update', { ...values, playerId: editingPlayer.playerId });
    editingPlayer = null;
    await loadPlayers();
  }

  async function setPlayerStatus(player, nextStatus) {
    const verb = nextStatus === 'inactive' ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${verb} ${player.displayName}?`)) {
      return;
    }
    message.textContent = `${verb === 'deactivate' ? 'Deactivating' : 'Activating'} player...`;
    try {
      await requestPlayerAction('manager.players.setStatus', { playerId: player.playerId, status: nextStatus });
      await loadPlayers();
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error-text');
    }
  }

  async function resetPin(player) {
    if (!window.confirm(`Reset PIN for ${player.displayName}? The old PIN will stop working immediately.`)) {
      return;
    }
    message.textContent = 'Resetting PIN...';
    try {
      const result = await requestPlayerAction('manager.players.resetPin', { playerId: player.playerId });
      oneTimePin = result.data.oneTimePin || '';
      render();
      await loadPlayers({
        preservePin: true,
        warning: 'PIN was reset, but the list could not refresh. Copy the PIN before closing this panel.',
      });
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error-text');
    }
  }

  function clearPinAndForms() {
    oneTimePin = '';
    editingPlayer = null;
    render();
  }

  function render() {
    dynamicRegion.replaceChildren();
    list.replaceChildren();

    if (oneTimePin) {
      dynamicRegion.appendChild(createOneTimePinPanel(oneTimePin, clearPinAndForms));
    }

    if (editingPlayer) {
      const card = createElement('section', { className: 'state-card compact-card' });
      appendChildren(card, [
        createElement('h2', { text: 'Edit Player' }),
        createPlayerForm({ mode: 'edit', player: editingPlayer, onSubmit: updatePlayer, onCancel: clearPinAndForms }),
      ]);
      dynamicRegion.appendChild(card);
    }

    if (!players.length) {
      list.appendChild(createElement('p', { className: 'muted', text: 'No players have created profiles yet.' }));
      return;
    }

    players.forEach((player) => {
      list.appendChild(createPlayerCard(player, {
        edit: (selected) => {
          oneTimePin = '';
          editingPlayer = selected;
          render();
        },
        setStatus: setPlayerStatus,
        resetPin,
      }));
    });
  }

  loadPlayers();
  return wrapper;
}


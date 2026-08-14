import { getManagerSessionToken } from '../auth.js?v=20260814-1';
import { requestAction } from '../api.js?v=20260814-1';
import { createManagerNav } from '../navigation.js?v=20260814-1';
import { createManagerMessagePanel } from './manager-dashboard.js?v=20260814-1';

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

function managerAction(action, payload = {}) {
  return requestAction(action, { ...payload, sessionToken: getManagerSessionToken() });
}

export function createManagerMessagesView() {
  let players = [];
  let conversations = [];
  let selectedPlayer = null;
  const wrapper = createElement('main', { className: 'page-container' });
  const header = createElement('section', { className: 'state-card compact-card' });
  const status = createElement('p', { className: 'muted', text: 'Loading messages...', attributes: { role: 'status', 'aria-live': 'polite' } });
  const workspace = createElement('section');
  const list = createElement('section', { className: 'player-list', attributes: { 'aria-label': 'Message conversations' } });

  function unreadForPlayer(playerId) {
    const conversation = conversations.find((row) => row.playerId === playerId);
    return conversation ? Number(conversation.unreadPlayerReplyCount || 0) : 0;
  }

  function render() {
    workspace.replaceChildren();
    list.replaceChildren();
    workspace.appendChild(createManagerMessagePanel(selectedPlayer, players, () => {
      selectedPlayer = null;
      render();
    }, loadData, selectedPlayer ? unreadForPlayer(selectedPlayer.playerId) > 0 : false, unreadForPlayer));

    const rows = conversations.length ? conversations : players.map((player) => ({ playerId: player.playerId, unreadPlayerReplyCount: 0 }));
    rows.forEach((conversation) => {
      const player = players.find((row) => row.playerId === conversation.playerId);
      if (!player) return;
      const unread = Number(conversation.unreadPlayerReplyCount || 0);
      const row = createElement('article', { className: 'player-card compact-card' });
      const open = createElement('button', { className: unread > 0 ? 'primary-button' : 'secondary-button', text: 'Open Thread', attributes: { type: 'button' } });
      open.addEventListener('click', () => {
        selectedPlayer = player;
        render();
        workspace.scrollIntoView({ block: 'start' });
      });
      appendChildren(row, [
        createElement('h3', { text: player.displayName || 'Unnamed player' }),
        createElement('span', { className: unread > 0 ? 'status-pill' : 'status-pill status-pill-muted', text: unread > 0 ? `${unread} unread` : 'No unread replies' }),
        open,
      ]);
      list.appendChild(row);
    });
    if (!list.children.length) list.appendChild(createElement('p', { className: 'muted', text: 'No player conversations yet.' }));
  }

  async function loadData() {
    try {
      const [playerResult, messageResult] = await Promise.all([
        managerAction('manager.players.list', { status: 'all', search: '' }),
        managerAction('manager.messages.list'),
      ]);
      if (!wrapper.isConnected) return;
      players = playerResult.data.players || [];
      conversations = messageResult.data.conversations || [];
      status.textContent = '';
      status.classList.remove('error-text');
      render();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add('error-text');
    }
  }

  appendChildren(header, [
    createElement('p', { className: 'eyebrow', text: 'Messages' }),
    createElement('h1', { text: 'Manager Messages' }),
    createElement('p', { className: 'muted', text: 'Send individual messages, review unread replies, or deliberately choose All Active Players for a broadcast.' }),
    status,
  ]);
  appendChildren(wrapper, [
    createManagerNav('manager-messages'),
    header,
    workspace,
    list,
  ]);
  loadData();
  return wrapper;
}

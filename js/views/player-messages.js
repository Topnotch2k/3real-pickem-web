import { createPlayerNav } from '../navigation.js?v=20260814-1';
import { createNotificationSettingsCard, createPlayerMessagesCard } from './player-dashboard.js?v=20260814-1';

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

export function createPlayerMessagesView(context = {}) {
  const wrapper = createElement('main', { className: 'page-container' });
  const messagesCard = createPlayerMessagesCard(() => {}, { open: true });
  const notificationSettings = createNotificationSettingsCard(context.player || {});

  function refreshMessagesOnFocus() {
    if (!wrapper.isConnected) {
      document.removeEventListener('visibilitychange', handleMessageVisibilityChange);
      window.removeEventListener('focus', refreshMessagesOnFocus);
      return;
    }
    messagesCard.refreshMessages();
  }

  function handleMessageVisibilityChange() {
    if (document.visibilityState === 'visible') refreshMessagesOnFocus();
  }

  appendChildren(wrapper, [
    createPlayerNav('player-messages'),
    messagesCard,
    notificationSettings,
  ]);
  document.addEventListener('visibilitychange', handleMessageVisibilityChange);
  window.addEventListener('focus', refreshMessagesOnFocus);
  return wrapper;
}

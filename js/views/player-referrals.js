import { requestAction } from '../api.js?v=20260814-6';
import { getPlayerSessionToken } from '../player-auth.js?v=20260814-6';
import { createPlayerNav } from '../navigation.js?v=20260814-6';
import { createInviteFriendsCard } from './player-dashboard.js?v=20260814-6';

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  return element;
}

function playerAction(action, payload = {}) {
  return requestAction(action, { ...payload, sessionToken: getPlayerSessionToken() });
}

export function createPlayerReferralsView(context = {}) {
  const wrapper = createElement('main', { className: 'page-container' });
  const bootstrapRequest = playerAction('player.dashboard.bootstrap');
  const inviteFriends = createInviteFriendsCard(context.player || {}, bootstrapRequest);
  wrapper.appendChild(createPlayerNav('player-referrals'));
  wrapper.appendChild(inviteFriends.card);
  return wrapper;
}

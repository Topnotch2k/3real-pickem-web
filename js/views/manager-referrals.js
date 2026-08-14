import { createManagerNav } from '../navigation.js?v=20260813-7';
import { createReferralsCard } from './manager-dashboard.js?v=20260813-7';

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  return element;
}

export function createManagerReferralsView() {
  const wrapper = createElement('main', { className: 'page-container' });
  wrapper.appendChild(createManagerNav('manager-referrals'));
  wrapper.appendChild(createReferralsCard());
  return wrapper;
}

import { requestAction } from '../api.js?v=20260807-1';
import { captureInviteParamsFromHash, clearInviteParamsFromHash } from '../invite.js?v=20260807-1';
import { navigateTo } from '../router.js?v=20260807-1';

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

function createField(labelText, control) {
  const label = createElement('label', { className: 'form-field' });
  label.appendChild(createElement('span', { text: labelText }));
  label.appendChild(control);
  return label;
}

function createAvatarSelect() {
  const select = createElement('select', { attributes: { name: 'avatar' } });
  AVATARS.forEach((avatar) => {
    const option = createElement('option', { text: avatar.label, attributes: { value: avatar.value } });
    select.appendChild(option);
  });
  return select;
}

function createPinResult(pin, displayName) {
  const panel = createElement('section', { className: 'pin-panel', attributes: { role: 'status', 'aria-live': 'polite' } });
  const copyStatus = createElement('p', { className: 'muted', text: 'Save this PIN. It will not be shown again.' });
  const pinValue = createElement('p', { className: 'pin-value', text: pin });
  const buttons = createElement('div', { className: 'button-row' });
  const copyButton = createElement('button', { className: 'primary-button', text: 'Copy PIN', attributes: { type: 'button' } });
  const loginButton = createElement('button', { className: 'secondary-button', text: 'Continue to Login', attributes: { type: 'button' } });

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pin);
      copyStatus.textContent = 'PIN copied. Keep it somewhere safe.';
    } catch (error) {
      copyStatus.textContent = 'Copy failed. Select the PIN above and copy it manually.';
    }
  });

  loginButton.addEventListener('click', () => {
    navigateTo('player-login');
  });

  appendChildren(buttons, [copyButton, loginButton]);
  appendChildren(panel, [
    createElement('p', { className: 'eyebrow', text: 'Profile Created' }),
    createElement('h1', { text: `Welcome, ${displayName}` }),
    createElement('p', { text: 'Your one-time player PIN is ready.' }),
    pinValue,
    copyStatus,
    buttons,
  ]);
  return panel;
}

export function createPlayerRegisterView() {
  const inviteParams = captureInviteParamsFromHash();
  let oneTimePin = '';
  let registeredName = '';

  const wrapper = createElement('main', { className: 'page-container narrow-page' });
  const card = createElement('section', { className: 'state-card' });
  const form = createElement('form', { className: 'auth-form' });
  const nameInput = createElement('input', {
    attributes: {
      name: 'displayName',
      type: 'text',
      autocomplete: 'nickname',
      maxlength: '40',
      required: 'required',
    },
  });
  const avatarSelect = createAvatarSelect();
  const message = createElement('p', { className: 'muted', attributes: { role: 'status', 'aria-live': 'polite' } });
  const buttons = createElement('div', { className: 'button-row' });
  const submit = createElement('button', { className: 'primary-button', text: 'Create Profile', attributes: { type: 'submit' } });
  const login = createElement('button', { className: 'secondary-button', text: 'Player Login', attributes: { type: 'button' } });

  login.addEventListener('click', () => {
    clearInviteParamsFromHash();
    navigateTo('player-login');
  });
  appendChildren(buttons, [submit, login]);
  appendChildren(form, [
    createField('Display name', nameInput),
    createField('Preset avatar', avatarSelect),
    buttons,
    message,
  ]);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.classList.remove('error-text');
    message.textContent = 'Creating profile...';
    submit.disabled = true;
    login.disabled = true;
    try {
      const result = await requestAction('player.register', {
        inviteToken: inviteParams.inviteToken,
        referralCode: inviteParams.referralCode,
        displayName: nameInput.value,
        avatar: avatarSelect.value,
      });
      oneTimePin = result.data.oneTimePin || '';
      registeredName = result.data.player ? result.data.player.displayName : nameInput.value.trim();
      clearInviteParamsFromHash();
      render();
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error-text');
    } finally {
      submit.disabled = false;
      login.disabled = false;
    }
  });

  function render() {
    card.replaceChildren();
    if (oneTimePin) {
      card.appendChild(createPinResult(oneTimePin, registeredName));
      return;
    }
    if (!inviteParams.inviteToken) {
      appendChildren(card, [
        createElement('p', { className: 'eyebrow', text: 'Players' }),
        createElement('h1', { text: 'Invite Link Required' }),
        createElement('p', { className: 'muted error-text', text: 'This invite link is invalid or has expired. Ask the League Manager for a new link.' }),
        login,
      ]);
      return;
    }
    appendChildren(card, [
      createElement('p', { className: 'eyebrow', text: 'Players' }),
      createElement('h1', { text: 'Create Your Profile' }),
      createElement('p', { className: 'muted', text: 'Choose your display name and avatar. Your PIN is shown once after signup.' }),
      form,
    ]);
  }

  render();
  wrapper.appendChild(card);
  return wrapper;
}

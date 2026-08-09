import { loginPlayer } from '../player-auth.js?v=20260809-1';
import { navigateTo } from '../router.js?v=20260809-1';

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

function createVisibilityToggle(input, labelText) {
  const button = createElement('button', {
    className: 'secondary-button password-toggle-button',
    text: 'Show',
    attributes: {
      type: 'button',
      'aria-label': `Show ${labelText}`,
    },
  });
  button.addEventListener('click', () => {
    const visible = input.getAttribute('type') === 'text';
    input.setAttribute('type', visible ? 'password' : 'text');
    button.textContent = visible ? 'Show' : 'Hide';
    button.setAttribute('aria-label', `${visible ? 'Show' : 'Hide'} ${labelText}`);
  });
  return button;
}

export function createPlayerLoginView() {
  const wrapper = createElement('main', { className: 'page-container narrow-page' });
  const card = createElement('section', { className: 'state-card' });
  const form = createElement('form', { className: 'auth-form' });
  const nameInput = createElement('input', {
    attributes: {
      name: 'displayName',
      type: 'text',
      autocomplete: 'nickname',
      required: 'required',
    },
  });
  const pinInput = createElement('input', {
    attributes: {
      name: 'pin',
      type: 'password',
      inputmode: 'numeric',
      pattern: '\\d{4}',
      maxlength: '4',
      autocomplete: 'current-password',
      required: 'required',
    },
  });
  const pinRow = createElement('div', { className: 'password-input-row' });
  appendChildren(pinRow, [pinInput, createVisibilityToggle(pinInput, 'PIN')]);
  const message = createElement('p', { className: 'muted', attributes: { role: 'status', 'aria-live': 'polite' } });
  const buttons = createElement('div', { className: 'button-row' });
  const submit = createElement('button', { className: 'primary-button', text: 'Player Login', attributes: { type: 'submit' } });
  const register = createElement('button', { className: 'secondary-button', text: 'Create Profile', attributes: { type: 'button' } });

  register.addEventListener('click', () => navigateTo('player-register'));
  appendChildren(buttons, [submit, register]);
  appendChildren(form, [
    createField('Display name', nameInput),
    createField('4-digit PIN', pinRow),
    buttons,
    message,
  ]);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.classList.remove('error-text');
    message.textContent = 'Signing in...';
    submit.disabled = true;
    register.disabled = true;
    try {
      await loginPlayer(nameInput.value, pinInput.value);
      navigateTo('player-dashboard');
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error-text');
    } finally {
      submit.disabled = false;
      register.disabled = false;
    }
  });

  appendChildren(card, [
    createElement('p', { className: 'eyebrow', text: 'Players' }),
    createElement('h1', { text: 'Player Login' }),
    createElement('p', { className: 'muted', text: 'Enter your display name and 4-digit PIN.' }),
    form,
  ]);
  wrapper.appendChild(card);
  return wrapper;
}

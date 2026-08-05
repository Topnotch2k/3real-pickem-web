import { loginManager } from '../auth.js';
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

function createField(labelText, input) {
  const label = createElement('label', { className: 'form-field' });
  label.appendChild(createElement('span', { text: labelText }));
  label.appendChild(input);
  return label;
}

export function createManagerLoginView() {
  const wrapper = createElement('main', { className: 'page-container auth-page' });
  const card = createElement('section', { className: 'state-card auth-card' });
  const form = createElement('form', { className: 'auth-form' });
  const identifierInput = createElement('input', {
    attributes: {
      id: 'manager-identifier',
      name: 'identifier',
      type: 'text',
      autocomplete: 'username',
      required: 'required',
    },
  });
  const passwordInput = createElement('input', {
    attributes: {
      id: 'manager-password',
      name: 'password',
      type: 'password',
      autocomplete: 'current-password',
      required: 'required',
    },
  });
  const submit = createElement('button', {
    className: 'primary-button full-width-button',
    text: 'Log In',
    attributes: { type: 'submit' },
  });
  const error = createElement('p', {
    className: 'muted',
    attributes: { role: 'status', 'aria-live': 'polite' },
  });

  appendChildren(form, [
    createField('Username or email', identifierInput),
    createField('Password', passwordInput),
    submit,
    error,
  ]);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.classList.remove('error-text');
    error.textContent = 'Checking manager access...';
    submit.disabled = true;
    try {
      await loginManager(identifierInput.value, passwordInput.value);
      passwordInput.value = '';
      navigateTo('manager-dashboard');
    } catch (loginError) {
      error.textContent = 'Invalid username/email or password.';
      error.classList.add('error-text');
    } finally {
      submit.disabled = false;
    }
  });

  appendChildren(card, [
    createElement('p', { className: 'eyebrow', text: 'League Manager' }),
    createElement('h1', { text: 'Manager Login' }),
    createElement('p', { className: 'muted', text: 'Sign in to manage league setup, payments, weeks, and results when those tools are added.' }),
    form,
  ]);
  wrapper.appendChild(card);
  return wrapper;
}

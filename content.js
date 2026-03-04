function isVisible(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
}

function scoreEmailField(input) {
  const hints = [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute('aria-label'),
    input.autocomplete
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let score = 0;
  if (input.type === 'email') score += 5;
  if (hints.includes('email')) score += 4;
  if (hints.includes('user')) score += 2;
  if (hints.includes('login')) score += 2;
  if (hints.includes('confirm')) score += 1;
  return score;
}

function getCandidateInputs() {
  return [...document.querySelectorAll('input')].filter((input) => {
    if (input.disabled || input.readOnly || !isVisible(input)) {
      return false;
    }

    return ['email', 'password', 'text', 'search', 'tel', 'url', ''].includes(input.type);
  });
}

function fillInput(input, value) {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function autofillSignupCredentials({ email, password }) {
  const inputs = getCandidateInputs();
  const passwordInputs = inputs.filter((input) => input.type === 'password');
  const emailInputs = inputs
    .filter((input) => input.type === 'email' || scoreEmailField(input) >= 4)
    .sort((a, b) => scoreEmailField(b) - scoreEmailField(a));

  const uniqueEmailInputs = [...new Set(emailInputs)].slice(0, 2);

  uniqueEmailInputs.forEach((input) => fillInput(input, email));
  passwordInputs.slice(0, 2).forEach((input) => fillInput(input, password));

  if (uniqueEmailInputs.length === 0 && passwordInputs.length === 0) {
    throw new Error('No signup email/password fields were found on this page.');
  }
}

function setButtonMessage(button, text, isError = false) {
  button.textContent = text;
  button.style.background = isError ? '#b91c1c' : '#2563eb';
}

function createFloatingFillButton() {
  if (document.getElementById('signup-autofill-floating-button')) {
    return;
  }

  const button = document.createElement('button');
  button.id = 'signup-autofill-floating-button';
  button.type = 'button';
  button.textContent = 'Autofill Signup';
  button.style.position = 'fixed';
  button.style.top = '12px';
  button.style.right = '12px';
  button.style.zIndex = '2147483647';
  button.style.padding = '8px 12px';
  button.style.border = '0';
  button.style.borderRadius = '999px';
  button.style.background = '#2563eb';
  button.style.color = '#fff';
  button.style.fontSize = '12px';
  button.style.fontWeight = '600';
  button.style.cursor = 'pointer';
  button.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';

  button.addEventListener('click', async () => {
    setButtonMessage(button, 'Filling...');
    button.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SAVED_CREDENTIALS' });
      if (!response?.ok) {
        throw new Error(response?.error || 'No saved credentials available.');
      }

      autofillSignupCredentials(response.credentials);
      setButtonMessage(button, 'Filled ✓');
    } catch (error) {
      setButtonMessage(button, `Error: ${error.message}`, true);
    }

    setTimeout(() => {
      setButtonMessage(button, 'Autofill Signup');
      button.disabled = false;
    }, 1800);
  });

  document.documentElement.appendChild(button);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'AUTOFILL_SIGNUP_CREDENTIALS') {
    return false;
  }

  try {
    autofillSignupCredentials(message.payload);
    sendResponse({ ok: true });
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }

  return true;
});

createFloatingFillButton();

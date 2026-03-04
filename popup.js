import { decryptValue, encryptValue, hashValue, createRandomBase64 } from './crypto.js';

const STORAGE_KEY = 'credentials';
const EXTENSION_SECRET_KEY = 'extensionSecret';

const form = document.getElementById('credentials-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const savedState = document.getElementById('saved-state');
const message = document.getElementById('message');
const revealOnceButton = document.getElementById('reveal-once');
const fillNowButton = document.getElementById('fill-now');

function setMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? '#b91c1c' : '#065f46';
}

async function getExtensionSecret() {
  const fromStorage = await chrome.storage.local.get(EXTENSION_SECRET_KEY);
  if (fromStorage[EXTENSION_SECRET_KEY]) {
    return fromStorage[EXTENSION_SECRET_KEY];
  }

  const response = await chrome.runtime.sendMessage({ type: 'GET_EXTENSION_SECRET' });
  if (!response?.ok) {
    throw new Error(response?.error || 'Could not prepare extension encryption key.');
  }

  return response.secret;
}

async function loadSavedCredentials() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || null;
}

function maskedHash(hash) {
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

function renderSavedState(record) {
  if (!record) {
    savedState.textContent = 'No saved credentials yet.';
    revealOnceButton.disabled = true;
    return;
  }

  savedState.innerHTML = `
    <div><strong>Saved email:</strong> ${record.email}</div>
    <div><strong>Password hash (SHA-256):</strong> ${maskedHash(record.passwordHash)}</div>
    <div><strong>Reveal used:</strong> ${record.revealUsed ? 'Yes' : 'No'}</div>
  `;

  revealOnceButton.disabled = Boolean(record.revealUsed);
}

async function refreshView() {
  const record = await loadSavedCredentials();
  renderSavedState(record);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('Saving...');

  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const extensionSecret = await getExtensionSecret();
    const passwordSalt = createRandomBase64(16);
    const encryptedPassword = await encryptValue(password, extensionSecret, passwordSalt);
    const passwordHash = await hashValue(password);

    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        email,
        passwordCipherText: encryptedPassword.cipherText,
        passwordIv: encryptedPassword.iv,
        passwordSalt,
        passwordHash,
        revealUsed: false,
        savedAt: Date.now()
      }
    });

    passwordInput.value = '';
    setMessage('Credentials saved. Use the floating Autofill Signup button on signup pages.');
    await refreshView();
  } catch (error) {
    setMessage(error.message, true);
  }
});

revealOnceButton.addEventListener('click', async () => {
  setMessage('Preparing one-time reveal...');

  try {
    const record = await loadSavedCredentials();

    if (!record) {
      throw new Error('No credentials saved yet.');
    }
    if (record.revealUsed) {
      throw new Error('Reveal already used for this saved password. Save again to reveal once more.');
    }

    const extensionSecret = await getExtensionSecret();
    const plainPassword = await decryptValue(
      record.passwordCipherText,
      record.passwordIv,
      extensionSecret,
      record.passwordSalt
    );

    setMessage(`One-time check → Email: ${record.email} | Password: ${plainPassword}`);

    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        ...record,
        revealUsed: true
      }
    });

    await refreshView();
  } catch (error) {
    setMessage(error.message, true);
  }
});

fillNowButton.addEventListener('click', async () => {
  setMessage('Sending fill command...');

  try {
    const response = await chrome.runtime.sendMessage({ type: 'FILL_FROM_POPUP' });
    if (!response?.ok) {
      throw new Error(response?.error || 'Could not fill current page.');
    }

    setMessage('Fill command sent to active tab.');
  } catch (error) {
    setMessage(error.message, true);
  }
});

refreshView().catch((error) => setMessage(error.message, true));

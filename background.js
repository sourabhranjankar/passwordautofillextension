import { createRandomBase64, decryptValue } from './crypto.js';

const STORAGE_KEY = 'credentials';
const EXTENSION_SECRET_KEY = 'extensionSecret';

async function getOrCreateExtensionSecret() {
  const stored = await chrome.storage.local.get(EXTENSION_SECRET_KEY);
  if (stored[EXTENSION_SECRET_KEY]) {
    return stored[EXTENSION_SECRET_KEY];
  }

  const secret = createRandomBase64(32);
  await chrome.storage.local.set({ [EXTENSION_SECRET_KEY]: secret });
  return secret;
}

async function getSavedCredentials() {
  const [storage, extensionSecret] = await Promise.all([
    chrome.storage.local.get(STORAGE_KEY),
    getOrCreateExtensionSecret()
  ]);
  const record = storage[STORAGE_KEY];

  if (!record) {
    throw new Error('No credentials saved. Open the extension popup to add them.');
  }

  const password = await decryptValue(
    record.passwordCipherText,
    record.passwordIv,
    extensionSecret,
    record.passwordSalt
  );

  return {
    email: record.email,
    password
  };
}

async function sendFillCommandToActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error('No active tab found.');
  }

  const credentials = await getSavedCredentials();
  await chrome.tabs.sendMessage(tab.id, {
    type: 'AUTOFILL_SIGNUP_CREDENTIALS',
    payload: credentials
  });
}

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'fill-signup-form') {
    return;
  }

  sendFillCommandToActiveTab().catch((error) => {
    console.error('Autofill command failed:', error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'FILL_FROM_POPUP') {
    sendFillCommandToActiveTab()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'GET_EXTENSION_SECRET') {
    getOrCreateExtensionSecret()
      .then((secret) => sendResponse({ ok: true, secret }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

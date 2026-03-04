# Signup Autofill Helper (Chrome Extension)

This extension stores one email + password and fills signup forms (including confirmation fields) with:

- **Keyboard shortcut:** `Ctrl+Alt+F` (or `Command+Option+F` on macOS)
- **Popup button:** "Fill active tab now"

## Features

- Save email + password from extension popup.
- Password is encrypted at rest (AES-GCM) and hashed (SHA-256) for verification display.
- One-time password reveal for cross-checking (`Reveal saved credentials once`).
- Autofills up to:
  - first and second email-like fields
  - first and second password fields

## Install locally

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder (`passwordautofillextension`).

## Use

1. Open extension popup.
2. Enter email/password and click **Save credentials**.
3. Navigate to a signup page (Workday, Dayforce, etc.).
4. Press **Ctrl+Alt+F** to autofill.

## Notes

- If a page doesn't expose standard input fields, autofill may miss them.
- One-time reveal resets only when you save credentials again.

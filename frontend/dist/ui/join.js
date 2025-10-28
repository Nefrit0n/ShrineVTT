function ensureElement(selector, root = document) {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found for selector: ${selector}`);
  }
  return element;
}

export function createJoinModal({ onSubmit } = {}) {
  const modalEl = ensureElement('#modal-join');
  const formEl = ensureElement('#join-form', modalEl);
  const usernameInput = ensureElement('#join-username', modalEl);
  const codeInput = ensureElement('#join-code', modalEl);
  const submitBtn = ensureElement('#join-submit', modalEl);
  const errorEl = modalEl.querySelector('[data-join-error]');

  const modal = {
    open() {
      modalEl.setAttribute('data-open', 'true');
      window.requestAnimationFrame(() => {
        usernameInput.focus();
        usernameInput.select();
      });
    },
    close() {
      modalEl.removeAttribute('data-open');
    },
  };

  function setBusy(isBusy) {
    submitBtn.toggleAttribute('disabled', Boolean(isBusy));
    formEl.classList.toggle('is-loading', Boolean(isBusy));
  }

  function showError(message) {
    if (!errorEl) return;
    if (!message) {
      errorEl.setAttribute('hidden', '');
      errorEl.textContent = '';
      return;
    }
    errorEl.textContent = message;
    errorEl.removeAttribute('hidden');
  }

  function reset() {
    formEl.reset();
    showError(null);
  }

  function setValues(values = {}) {
    if (typeof values.username === 'string') {
      usernameInput.value = values.username;
    }
    if (typeof values.code === 'string') {
      codeInput.value = values.code.toUpperCase();
    }
  }

  formEl.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (typeof onSubmit !== 'function') {
      return;
    }

    showError(null);
    const payload = {
      username: usernameInput.value.trim(),
      code: codeInput.value.trim().toUpperCase(),
    };

    const helpers = {
      close: modal.close,
      reset,
      setBusy,
      showError,
      setValues,
    };

    setBusy(true);
    try {
      await onSubmit(payload, helpers);
    } finally {
      setBusy(false);
    }
  });

  return {
    open: modal.open,
    close: modal.close,
    reset,
    setValues,
    showError,
  };
}

export default { createJoinModal };

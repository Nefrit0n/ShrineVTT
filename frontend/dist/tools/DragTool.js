export default class DragTool {
  constructor({ button, onChange } = {}) {
    this.button = button ?? null;
    this.onChange = typeof onChange === 'function' ? onChange : () => {};
    this.active = false;
    this.disabled = false;
    this.labelOn = this.button?.dataset?.labelOn || 'Режим перетаскивания: вкл.';
    this.labelOff = this.button?.dataset?.labelOff || 'Режим перетаскивания: выкл.';

    this.handleClick = this.handleClick.bind(this);

    if (this.button) {
      this.button.addEventListener('click', this.handleClick);
      this.updateButton();
    }
  }

  destroy() {
    if (this.button) {
      this.button.removeEventListener('click', this.handleClick);
    }
  }

  handleClick(event) {
    event?.preventDefault?.();
    if (this.disabled) {
      return;
    }
    this.toggle();
  }

  toggle({ silent = false } = {}) {
    this.setActive(!this.active, { silent });
  }

  setActive(value, { silent = false } = {}) {
    const next = Boolean(value);
    if (this.active === next) {
      return;
    }
    this.active = next;
    this.updateButton();
    if (!silent) {
      this.onChange(this.active);
    }
  }

  setDisabled(value) {
    const next = Boolean(value);
    if (this.disabled === next) {
      return;
    }
    this.disabled = next;
    if (this.disabled) {
      this.active = false;
    }
    this.updateButton();
  }

  updateButton() {
    if (!this.button) {
      return;
    }

    if (this.disabled) {
      this.button.setAttribute('disabled', '');
    } else {
      this.button.removeAttribute('disabled');
    }

    this.button.setAttribute('aria-pressed', this.active ? 'true' : 'false');
    this.button.classList.toggle('is-active', this.active);
    this.button.textContent = this.active ? this.labelOn : this.labelOff;
  }
}

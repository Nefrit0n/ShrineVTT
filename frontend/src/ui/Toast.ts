export type ToastType = "info" | "warn" | "error";

type ToastOptions = {
  type: ToastType;
  message: string;
};

const ICONS: Record<ToastType, string> = {
  info: "ℹ️",
  warn: "⚠️",
  error: "⛔",
};

class ToastManager {
  private readonly maxVisible = 3;
  private container: HTMLElement | null = null;

  private ensureContainer(): HTMLElement {
    if (this.container && document.body.contains(this.container)) {
      return this.container;
    }

    const element = document.createElement("div");
    element.className = "toast-stack";
    document.body.append(element);
    this.container = element;
    return element;
  }

  private createToast({ type, message }: ToastOptions): HTMLElement {
    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;

    const icon = document.createElement("span");
    icon.className = "toast__icon";
    icon.textContent = ICONS[type];

    const text = document.createElement("span");
    text.textContent = message;

    toast.append(icon, text);
    return toast;
  }

  private scheduleHide(toast: HTMLElement, duration = 2500): void {
    window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => {
        toast.remove();
      }, 250);
    }, duration);
  }

  private show(options: ToastOptions): void {
    const container = this.ensureContainer();
    const toast = this.createToast(options);

    if (container.children.length >= this.maxVisible) {
      container.removeChild(container.firstElementChild as HTMLElement);
    }

    container.append(toast);

    requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });

    this.scheduleHide(toast);
  }

  public info(message: string): void {
    this.show({ type: "info", message });
  }

  public warn(message: string): void {
    this.show({ type: "warn", message });
  }

  public error(message: string): void {
    this.show({ type: "error", message });
  }
}

export const toast = new ToastManager();

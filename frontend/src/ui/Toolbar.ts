import { PixiStage } from "../canvas/PixiStage";

type ToolbarButtons =
  | "zoom-out"
  | "zoom-reset"
  | "zoom-in"
  | "fit"
  | "grid"
  | "snap";

type ToolbarState = {
  zoomPercent: number;
  gridEnabled: boolean;
  snapEnabled: boolean;
};

type ToolbarOptions = {
  stage: PixiStage;
  container: HTMLElement;
  overlay: HTMLElement;
  initialState: ToolbarState;
  onStateChange?: (state: ToolbarState) => void;
};

export class CanvasToolbar {
  private readonly stage: PixiStage;
  private readonly container: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly onStateChange?: (state: ToolbarState) => void;
  private state: ToolbarState;
  private hidden = false;
  private overlayTimer: number | null = null;

  constructor(options: ToolbarOptions) {
    this.stage = options.stage;
    this.container = options.container;
    this.overlay = options.overlay;
    this.onStateChange = options.onStateChange;
    this.state = options.initialState;

    this.render();
    this.syncButtons();
    this.registerKeyboardShortcuts();
  }

  private render(): void {
    const buttons: { action: ToolbarButtons; label: string; wide?: boolean }[] = [
      { action: "zoom-out", label: "−" },
      { action: "zoom-reset", label: "100%", wide: true },
      { action: "zoom-in", label: "+" },
      { action: "fit", label: "⛶ Fit", wide: true },
      { action: "grid", label: "# Сетка", wide: true },
      { action: "snap", label: "⌘ Привязка", wide: true },
    ];

    this.container.replaceChildren();

    for (const { action, label, wide } of buttons) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = action;
      button.className = "canvas-toolbar__btn";
      if (wide) {
        button.classList.add("canvas-toolbar__btn--wide");
      }
      button.innerHTML = `<span>${label}</span>`;
      button.addEventListener("click", () => this.handleAction(action));
      this.container.append(button);
    }
  }

  private handleAction(action: ToolbarButtons): void {
    switch (action) {
      case "zoom-out":
        this.stage.zoomOut();
        break;
      case "zoom-in":
        this.stage.zoomIn();
        break;
      case "zoom-reset":
        this.stage.setZoom(100);
        break;
      case "fit":
        this.stage.fitToView();
        break;
      case "grid": {
        const enabled = this.stage.toggleGrid();
        this.state.gridEnabled = enabled;
        break;
      }
      case "snap": {
        const enabled = this.stage.toggleSnap();
        this.state.snapEnabled = enabled;
        break;
      }
      default:
        break;
    }

    this.updateState({
      zoomPercent: Math.round(this.stage.getScale() * 100),
      gridEnabled: this.stage.isGridVisible(),
      snapEnabled: this.stage.isSnapEnabled(),
    });
  }

  private registerKeyboardShortcuts(): void {
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.hide();
        return;
      }

      if (event.key === "?" && event.shiftKey) {
        this.show();
        return;
      }
    });
  }

  private syncButtons(): void {
    const buttons = this.container.querySelectorAll<HTMLButtonElement>(".canvas-toolbar__btn");
    buttons.forEach((button) => {
      const action = button.dataset.action as ToolbarButtons | undefined;
      if (action === "grid") {
        button.classList.toggle("is-active", this.state.gridEnabled);
      }
      if (action === "snap") {
        button.classList.toggle("is-active", this.state.snapEnabled);
      }
      if (action === "zoom-reset") {
        button.querySelector("span")?.replaceChildren(document.createTextNode(`${this.state.zoomPercent}%`));
      }
    });
  }

  public updateState(next: ToolbarState): void {
    this.state = next;
    this.syncButtons();
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  public showZoomOverlay(percent: number): void {
    this.overlay.textContent = `${percent}%`;
    this.overlay.classList.add("is-visible");
    if (this.overlayTimer !== null) {
      window.clearTimeout(this.overlayTimer);
    }
    this.overlayTimer = window.setTimeout(() => {
      this.overlay.classList.remove("is-visible");
      this.overlayTimer = null;
    }, 1500);
  }

  public setZoom(percent: number): void {
    this.updateState({
      zoomPercent: percent,
      gridEnabled: this.stage.isGridVisible(),
      snapEnabled: this.stage.isSnapEnabled(),
    });
  }

  public hide(): void {
    if (this.hidden) {
      return;
    }
    this.hidden = true;
    this.container.classList.add("is-hidden");
  }

  public show(): void {
    if (!this.hidden) {
      return;
    }
    this.hidden = false;
    this.container.classList.remove("is-hidden");
  }
}

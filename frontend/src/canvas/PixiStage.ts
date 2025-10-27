import { Application, Container, FederatedPointerEvent, Point } from "pixi.js";
import { GridLayer } from "./GridLayer";
import { MapDescriptor, MapLayer } from "./MapLayer";
import { TokensLayer } from "./TokensLayer";

type PixiStageOptions = {
  canvas: HTMLCanvasElement;
  gridSize: number;
  map?: MapDescriptor;
  showGrid?: boolean;
  minScale?: number;
  maxScale?: number;
  onScaleChange?: (scale: number) => void;
};

type GridUpdateState = {
  scale: number;
  position: { x: number; y: number };
  viewportWidth: number;
  viewportHeight: number;
};

export class PixiStage {
  private readonly app: Application;
  private readonly world: Container;
  private readonly gridLayer: GridLayer;
  private readonly mapLayer: MapLayer;
  private readonly tokensLayer: TokensLayer;
  private readonly gridSize: number;
  private readonly onScaleChange?: (scale: number) => void;
  private readonly minScale: number;
  private readonly maxScale: number;
  private isPanning = false;
  private panStart: Point = new Point(0, 0);
  private worldStart: Point = new Point(0, 0);
  private _scale = 1;
  private pendingGridUpdate = true;

  private constructor(app: Application, options: PixiStageOptions) {
    this.app = app;
    this.gridSize = options.gridSize;
    this.minScale = options.minScale ?? 0.25;
    this.maxScale = options.maxScale ?? 3.5;
    this.onScaleChange = options.onScaleChange;

    this.world = new Container();
    this.world.sortableChildren = true;
    this.app.stage.addChild(this.world);

    this.mapLayer = new MapLayer();
    this.gridLayer = new GridLayer(this.gridSize);
    this.tokensLayer = new TokensLayer();

    this.world.addChild(this.mapLayer);
    this.world.addChild(this.gridLayer);
    this.world.addChild(this.tokensLayer);

    this.gridLayer.visible = options.showGrid ?? true;

    this.attachInteractionHandlers(options.canvas);

    this.app.ticker.add(() => this.update());
  }

  public static async create(options: PixiStageOptions): Promise<PixiStage> {
    const app = new Application();
    await app.init({
      view: options.canvas,
      resizeTo: options.canvas.parentElement ?? window,
      backgroundAlpha: 0,
      antialias: true,
    });

    const stage = new PixiStage(app, options);
    await stage.mapLayer.setBackground(
      options.map ?? { fallbackColor: 0x1b1b1b, fallbackSize: { width: 2048, height: 2048 } }
    );
    stage.centerOnMap();
    stage.requestGridUpdate();
    stage.notifyScaleChange();
    return stage;
  }

  public setGridVisible(isVisible: boolean): void {
    this.gridLayer.visible = isVisible;
    this.requestGridUpdate();
  }

  public getScale(): number {
    return this._scale;
  }

  public async setMap(descriptor: MapDescriptor): Promise<void> {
    await this.mapLayer.setBackground(descriptor);
    this.centerOnMap();
    this.requestGridUpdate();
  }

  private attachInteractionHandlers(canvas: HTMLCanvasElement): void {
    canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        this.handleWheel(event);
      },
      { passive: false }
    );

    canvas.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
    canvas.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    canvas.addEventListener("pointerup", () => this.endPan());
    canvas.addEventListener("pointerleave", () => this.endPan());
    canvas.addEventListener("pointercancel", () => this.endPan());
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    window.addEventListener("resize", () => {
      this.requestGridUpdate();
    });
  }

  private handlePointerDown(event: PointerEvent | FederatedPointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    this.isPanning = true;
    this.panStart.set(event.clientX, event.clientY);
    this.worldStart.set(this.world.position.x, this.world.position.y);
    this.app.canvas?.classList.add("is-panning");
  }

  private handlePointerMove(event: PointerEvent | FederatedPointerEvent): void {
    if (!this.isPanning) {
      return;
    }

    const dx = event.clientX - this.panStart.x;
    const dy = event.clientY - this.panStart.y;
    this.world.position.set(this.worldStart.x + dx, this.worldStart.y + dy);
    this.requestGridUpdate();
  }

  private endPan(): void {
    if (!this.isPanning) {
      return;
    }

    this.isPanning = false;
    this.app.canvas?.classList.remove("is-panning");
    this.requestGridUpdate();
  }

  private handleWheel(event: WheelEvent): void {
    const zoomIntensity = -event.deltaY * 0.0015;
    if (zoomIntensity === 0) {
      return;
    }

    const newScale = this.clampScale(this._scale * (1 + zoomIntensity));
    this.zoomAt(event.clientX, event.clientY, newScale);
  }

  private zoomAt(clientX: number, clientY: number, newScale: number): void {
    const canvas = this.app.canvas;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    const worldBefore = this.screenToWorld(screenX, screenY);
    this.setScale(newScale);
    const screenAfter = this.worldToScreen(worldBefore);

    this.world.position.x += screenX - screenAfter.x;
    this.world.position.y += screenY - screenAfter.y;
    this.requestGridUpdate();
  }

  private setScale(scale: number): void {
    this._scale = this.clampScale(scale);
    this.world.scale.set(this._scale);
    this.notifyScaleChange();
  }

  private notifyScaleChange(): void {
    if (this.onScaleChange) {
      this.onScaleChange(this._scale);
    }
  }

  private clampScale(scale: number): number {
    return Math.min(this.maxScale, Math.max(this.minScale, scale));
  }

  private screenToWorld(x: number, y: number): Point {
    return new Point(
      (x - this.world.position.x) / this.world.scale.x,
      (y - this.world.position.y) / this.world.scale.y
    );
  }

  private worldToScreen(point: Point): Point {
    return new Point(
      point.x * this.world.scale.x + this.world.position.x,
      point.y * this.world.scale.y + this.world.position.y
    );
  }

  private centerOnMap(): void {
    const { width, height } = this.mapLayer.getContentBounds();
    const renderer = this.app.renderer;
    const viewWidth = renderer.width;
    const viewHeight = renderer.height;

    const centeredX = (viewWidth - width * this._scale) / 2;
    const centeredY = (viewHeight - height * this._scale) / 2;
    this.world.position.set(centeredX, centeredY);
    this.requestGridUpdate();
  }

  private update(): void {
    if (!this.pendingGridUpdate) {
      return;
    }

    const renderer = this.app.renderer;
    const state: GridUpdateState = {
      scale: this._scale,
      position: this.world.position,
      viewportWidth: renderer.width,
      viewportHeight: renderer.height,
    };

    this.gridLayer.update(state);
    this.pendingGridUpdate = false;
  }

  private requestGridUpdate(): void {
    this.pendingGridUpdate = true;
  }
}

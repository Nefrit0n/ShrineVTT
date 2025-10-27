import { Application, Container, FederatedPointerEvent, Point } from "pixi.js";

import { GridLayer } from "./layers/GridLayer";
import { MapLayer, type MapDescriptor } from "./layers/MapLayer";
import {
  TokensLayer,
  type TokenMoveDebugInfo,
  type TokenRenderData,
} from "./layers/TokensLayer";
import { HoverCellLayer } from "./HoverCellLayer";

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
  private readonly hoverLayer: HoverCellLayer;
  private gridSize: number;
  private readonly onScaleChange?: (scale: number) => void;
  private readonly minScale: number;
  private readonly maxScale: number;
  private isPanning = false;
  private panStart: Point = new Point(0, 0);
  private worldStart: Point = new Point(0, 0);
  private _scale = 1;
  private pendingGridUpdate = true;
  private gridVisible: boolean;
  private snapEnabled = true;
  private spacePressed = false;
  private mapWidth = 2048;
  private mapHeight = 2048;

  private constructor(app: Application, options: PixiStageOptions) {
    this.app = app;
    this.gridSize = options.gridSize;
    this.minScale = options.minScale ?? 0.25;
    this.maxScale = options.maxScale ?? 3.5;
    this.onScaleChange = options.onScaleChange;
    this.gridVisible = options.showGrid ?? true;

    this.world = new Container();
    this.world.sortableChildren = true;
    this.app.stage.addChild(this.world);

    this.mapLayer = new MapLayer();
    this.gridLayer = new GridLayer(this.gridSize);
    this.tokensLayer = new TokensLayer(this.gridSize);
    this.hoverLayer = new HoverCellLayer(this.gridSize);

    this.mapLayer.attach(this.world);
    this.gridLayer.attach(this.world);
    this.hoverLayer.attach(this.world);
    this.tokensLayer.attach(this.world);

    this.gridLayer.setVisible(this.gridVisible);
    this.hoverLayer.setGridSize(this.gridSize);
    this.tokensLayer.setHoverLayer(this.hoverLayer);
    this.tokensLayer.setCanvasElement(options.canvas);
    this.setSnapEnabled(this.snapEnabled);

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
    const bounds = stage.mapLayer.getContentBounds();
    stage.syncSceneBounds(bounds.width, bounds.height);
    stage.centerOnMap();
    stage.requestGridUpdate();
    stage.notifyScaleChange();
    return stage;
  }

  public setGridVisible(isVisible: boolean): void {
    this.gridVisible = isVisible;
    this.gridLayer.setVisible(isVisible);
    this.requestGridUpdate();
  }

  public isGridVisible(): boolean {
    return this.gridVisible;
  }

  public toggleGrid(): boolean {
    this.setGridVisible(!this.gridVisible);
    return this.gridVisible;
  }

  public getZoomPercent(): number {
    return Math.round(this._scale * 100);
  }

  public getScale(): number {
    return this._scale;
  }

  public isSnapEnabled(): boolean {
    return this.snapEnabled;
  }

  public toggleSnap(): boolean {
    this.setSnapEnabled(!this.snapEnabled);
    return this.snapEnabled;
  }

  public setHighContrastGrid(enabled: boolean): void {
    this.gridLayer.setHighContrast(enabled);
    this.requestGridUpdate();
  }

  public zoomIn(): void {
    this.zoomByFactor(1.2);
  }

  public zoomOut(): void {
    this.zoomByFactor(1 / 1.2);
  }

  public setZoom(percent: number): void {
    if (!Number.isFinite(percent)) {
      return;
    }
    const scale = this.clampScale(percent / 100);
    this.zoomAroundCenter(scale);
  }

  public fitToView(): void {
    const renderer = this.app.renderer;
    const width = this.mapWidth;
    const height = this.mapHeight;

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return;
    }

    const scaleX = renderer.width / width;
    const scaleY = renderer.height / height;
    const margin = 0.92;
    const targetScale = this.clampScale(Math.min(scaleX, scaleY) * margin);

    this.setScale(targetScale);
    this.centerOnMap();
    this.requestGridUpdate();
  }

  public setGridSize(gridSize: number): void {
    if (!Number.isFinite(gridSize) || gridSize <= 0 || gridSize === this.gridSize) {
      return;
    }

    this.gridSize = gridSize;
    this.gridLayer.setGridSize(gridSize);
    this.tokensLayer.setGridSize(gridSize);
    this.hoverLayer.setGridSize(gridSize);
    this.requestGridUpdate();
  }

  public async setMap(descriptor: MapDescriptor): Promise<void> {
    await this.mapLayer.setBackground(descriptor);
    const bounds = this.mapLayer.getContentBounds();
    this.syncSceneBounds(bounds.width, bounds.height);
    this.centerOnMap();
    this.requestGridUpdate();
  }

  public upsertToken(token: TokenRenderData): void {
    this.tokensLayer.upsert(token);
  }

  public setTokens(tokens: TokenRenderData[]): void {
    this.tokensLayer.replaceAll(tokens);
  }

  public async applyScene(scene: {
    gridSize: number;
    widthPx: number;
    heightPx: number;
    mapImage: string | null;
  }): Promise<void> {
    this.setGridSize(scene.gridSize);
    await this.mapLayer.setBackground({
      url: scene.mapImage ?? undefined,
      fallbackColor: 0x1b1b1b,
      fallbackSize: { width: scene.widthPx, height: scene.heightPx },
    });
    this.syncSceneBounds(scene.widthPx, scene.heightPx);
    this.centerOnMap();
    this.requestGridUpdate();
  }

  public setTokenMovePermission(
    checker: (token: TokenRenderData) => boolean
  ): void {
    this.tokensLayer.setMovePermission(checker);
  }

  public setTokenMoveHandler(
    handler: (
      tokenId: string,
      target: { xCell: number; yCell: number },
      revert: () => void,
      debug?: TokenMoveDebugInfo
    ) => void
  ): void {
    this.tokensLayer.setMoveHandler(handler);
  }

  public setTokenSelectionHandler(
    handler: ((token: TokenRenderData | null) => void) | null
  ): void {
    this.tokensLayer.setSelectionHandler(handler);
  }

  public setTokenActivateHandler(
    handler: ((token: TokenRenderData) => void) | null
  ): void {
    this.tokensLayer.setActivateHandler(handler);
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
    window.addEventListener("keydown", (event) => this.handleKeyDown(event));
    window.addEventListener("keyup", (event) => this.handleKeyUp(event));
    window.addEventListener("blur", () => this.resetPanKey());
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === "Space") {
      if (this.spacePressed || this.shouldIgnoreKey(event)) {
        return;
      }

      this.spacePressed = true;
      this.app.canvas?.classList.add("can-pan");
      event.preventDefault();
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (event.code === "Space") {
      this.resetPanKey();
    }
  }

  private resetPanKey(): void {
    if (!this.spacePressed && !this.isPanning) {
      return;
    }

    this.spacePressed = false;
    const canvas = this.app.canvas;
    if (canvas) {
      canvas.classList.remove("can-pan");
    }

    if (this.isPanning) {
      this.endPan();
    }
  }

  private shouldIgnoreKey(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return false;
    }

    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      return true;
    }

    return Boolean(target.isContentEditable);
  }

  private handlePointerDown(event: PointerEvent | FederatedPointerEvent): void {
    const isMiddleButton = event.button === 1;
    const isLeftWithSpace = event.button === 0 && this.spacePressed;
    if (!isMiddleButton && !isLeftWithSpace) {
      return;
    }

    event.preventDefault();
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
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

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

  private setSnapEnabled(enabled: boolean): void {
    this.snapEnabled = enabled;
    this.tokensLayer.setSnapToGrid(enabled);
  }

  private zoomByFactor(factor: number): void {
    this.zoomAroundCenter(this._scale * factor);
  }

  private zoomAroundCenter(newScale: number): void {
    const canvas = this.app.canvas;
    if (!canvas) {
      this.setScale(newScale);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    this.zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, newScale);
  }

  private syncSceneBounds(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return;
    }

    this.mapWidth = Math.max(1, width);
    this.mapHeight = Math.max(1, height);

    this.tokensLayer.setSceneBounds({
      widthPx: this.mapWidth,
      heightPx: this.mapHeight,
    });
    this.hoverLayer.setSceneBounds({
      widthPx: this.mapWidth,
      heightPx: this.mapHeight,
    });
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
    const renderer = this.app.renderer;
    const viewWidth = renderer.width;
    const viewHeight = renderer.height;
    const width = this.mapWidth;
    const height = this.mapHeight;

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

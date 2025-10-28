import { Application, Container } from 'https://cdn.jsdelivr.net/npm/pixi.js@7.4.0/+esm';
import GridLayer from './GridLayer.js';
import MapLayer from './MapLayer.js';
import TokensLayer from './TokensLayer.js';
import { clampZoom, getSceneDimensions, sceneToViewScale } from './coords.js';

const DEFAULT_BACKGROUND = 0x070b11;
const DRAG_BUTTON = 0;

export default class PixiStage {
  static async create({ canvas, background = DEFAULT_BACKGROUND } = {}) {
    if (!canvas) {
      throw new Error('Canvas element is required to initialise PixiStage');
    }

    const app = new Application({
      view: canvas,
      background,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      eventMode: 'passive',
    });

    app.resizeTo = canvas.parentElement ?? window;

    return new PixiStage({ app, canvas });
  }

  constructor({ app, canvas }) {
    this.app = app;
    this.canvas = canvas || app.view || app.renderer.view;
    this.container = new Container();
    this.container.eventMode = 'static';
    this.container.cursor = 'grab';
    this.container.sortableChildren = true;

    this.gridLayer = new GridLayer();
    this.mapLayer = new MapLayer({ fallbackColor: 0x0d1119 });
    this.tokensLayer = new TokensLayer();

    this.container.addChild(this.mapLayer.container);
    this.container.addChild(this.gridLayer.container);
    this.container.addChild(this.tokensLayer.container);

    this.app.stage.addChild(this.container);

    this.sceneWidth = 0;
    this.sceneHeight = 0;
    this.scale = 1;
    this.minZoom = 0.25;
    this.maxZoom = 4;

    this.dragState = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0,
    };

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleResize = this.handleResize.bind(this);

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
    window.addEventListener('pointerleave', this.handlePointerUp);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('resize', this.handleResize);
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
    window.removeEventListener('pointerleave', this.handlePointerUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('resize', this.handleResize);
    if (this.app) {
      this.app.resizeTo = null;
    }
    this.app.destroy();
  }

  async loadSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.scene) {
      this.clear();
      return;
    }

    const { scene, tokens = [] } = snapshot;
    const { width, height } = getSceneDimensions(scene);

    this.sceneWidth = width;
    this.sceneHeight = height;

    this.mapLayer.setScene(scene);
    this.gridLayer.draw({
      widthPx: scene.widthPx,
      heightPx: scene.heightPx,
      gridSize: scene.gridSize,
    });
    this.tokensLayer.setTokens(tokens, { gridSize: scene.gridSize });

    this.fitToView();
  }

  clear() {
    this.sceneWidth = 0;
    this.sceneHeight = 0;
    this.mapLayer.clear();
    this.gridLayer.clear();
    this.tokensLayer.clear();
    this.resetView();
  }

  resetView() {
    this.scale = 1;
    this.container.scale.set(1);
    const { width, height } = this.app.renderer.screen ?? { width: 0, height: 0 };
    this.container.position.set(width / 2, height / 2);
  }

  fitToView() {
    const screen = this.app.renderer.screen ?? { width: 0, height: 0 };
    const scale = sceneToViewScale({
      sceneWidth: this.sceneWidth,
      sceneHeight: this.sceneHeight,
      viewWidth: screen.width,
      viewHeight: screen.height,
    });

    this.scale = clampZoom(scale, this.minZoom, this.maxZoom);
    this.container.scale.set(this.scale);

    const centeredX = (screen.width - this.sceneWidth * this.scale) / 2;
    const centeredY = (screen.height - this.sceneHeight * this.scale) / 2;
    this.container.position.set(centeredX, centeredY);
  }

  handlePointerDown(event) {
    if (event.button !== DRAG_BUTTON) {
      return;
    }

    this.dragState = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: this.container.position.x,
      originY: this.container.position.y,
    };

    this.canvas.setPointerCapture?.(event.pointerId);
    this.canvas.style.cursor = 'grabbing';
  }

  handlePointerMove(event) {
    if (!this.dragState.active || this.dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - this.dragState.startX;
    const deltaY = event.clientY - this.dragState.startY;

    this.container.position.set(this.dragState.originX + deltaX, this.dragState.originY + deltaY);
  }

  handlePointerUp(event) {
    if (!this.dragState.active || this.dragState.pointerId !== event.pointerId) {
      return;
    }

    this.dragState.active = false;
    this.canvas.releasePointerCapture?.(event.pointerId);
    this.canvas.style.cursor = 'grab';
  }

  handleWheel(event) {
    if (!this.sceneWidth || !this.sceneHeight) {
      return;
    }

    event.preventDefault();

    const direction = event.deltaY < 0 ? 1 : -1;
    const factor = direction > 0 ? 1.1 : 0.9;
    const nextScale = clampZoom(this.scale * factor, this.minZoom, this.maxZoom);

    if (nextScale === this.scale) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;

    const worldX = (pointerX - this.container.position.x) / this.scale;
    const worldY = (pointerY - this.container.position.y) / this.scale;

    this.scale = nextScale;
    this.container.scale.set(this.scale);

    const nextX = pointerX - worldX * this.scale;
    const nextY = pointerY - worldY * this.scale;

    this.container.position.set(nextX, nextY);
  }

  handleResize() {
    if (!this.sceneWidth || !this.sceneHeight) {
      return;
    }

    this.fitToView();
  }
}

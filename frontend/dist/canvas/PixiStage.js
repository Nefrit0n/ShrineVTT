import { Application, Container } from 'https://cdn.jsdelivr.net/npm/pixi.js@7.4.0/+esm';
import 'https://cdn.jsdelivr.net/npm/@pixi/unsafe-eval@7.4.0/+esm';
import GridLayer from './GridLayer.js';
import MapLayer from './MapLayer.js';
import TokensLayer from './TokensLayer.js';
import { clampZoom, getSceneDimensions, sceneToViewScale, worldFromCell } from './coords.js';

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

    app.stage.sortableChildren = true;
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
    this.tokensLayer = new TokensLayer({ app: this.app });
    this.tokensLayer.container.zIndex = 100;

    this.container.addChild(this.mapLayer.container);
    this.container.addChild(this.gridLayer.container);
    this.container.addChild(this.tokensLayer.container);

    this.app.stage.addChild(this.container);

    this.sceneWidth = 0;
    this.sceneHeight = 0;
    this.gridSize = this.tokensLayer.getGridSize();
    this.tokens = new Map();
    this.activeSceneId = null;
    this.scale = 1;
    this.minZoom = 0.25;
    this.maxZoom = 4;
    this.canControlToken = () => false;
    this.tokenMoveRequestHandler = null;
    this.userContext = { isGM: false, userId: null };

    this.dragState = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0,
    };

    this.tokensLayer.setInteractionOptions({
      canMoveToken: (token) => this.canControlToken(token),
      onMoveRequest: (move) => this.handleTokenMoveRequest(move),
      throttleMs: 50,
      userContext: this.userContext,
    });

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
    this.activeSceneId = scene?.id ?? null;

    this.mapLayer.setScene(scene);
    this.gridLayer.draw({
      widthPx: scene.widthPx,
      heightPx: scene.heightPx,
      gridSize: scene.gridSize,
    });
    const columns = scene.gridSize ? Math.floor(scene.widthPx / scene.gridSize) : 0;
    const rows = scene.gridSize ? Math.floor(scene.heightPx / scene.gridSize) : 0;
    this.tokensLayer.setSceneBounds({
      gridSize: scene.gridSize,
      columns: Number.isFinite(columns) && columns > 0 ? columns : 0,
      rows: Number.isFinite(rows) && rows > 0 ? rows : 0,
      widthPx: scene.widthPx,
      heightPx: scene.heightPx,
    });
    this.tokensLayer.setTokens(tokens, { gridSize: scene.gridSize });
    this.gridSize = this.tokensLayer.getGridSize();
    this.tokens.clear();
    tokens.forEach((token) => {
      if (token?.id) {
        this.tokens.set(token.id, token);
        this.tokensLayer.updateToken(token);
      }
    });

    this.fitToView();
  }

  clear() {
    this.sceneWidth = 0;
    this.sceneHeight = 0;
    this.gridSize = this.tokensLayer.getGridSize();
    this.tokens.clear();
    this.activeSceneId = null;
    this.mapLayer.clear();
    this.gridLayer.clear();
    this.tokensLayer.clear();
    this.resetView();
  }

  addToken(token, { highlight = false } = {}) {
    if (!token || typeof token !== 'object') {
      return false;
    }

    if (!this.activeSceneId) {
      return false;
    }

    if (token.sceneId && token.sceneId !== this.activeSceneId) {
      return false;
    }

    const mergedToken = token?.id && this.tokens.has(token.id) ? { ...this.tokens.get(token.id), ...token } : token;

    const sprite = this.tokensLayer.addSprite(mergedToken, {
      gridSize: this.gridSize,
      highlight,
    });

    if (!sprite) {
      return false;
    }

    this.gridSize = this.tokensLayer.getGridSize();

    if (token.id) {
      this.tokens.set(token.id, mergedToken);
    }

    if (highlight) {
      this.highlightToken(mergedToken);
    }

    return true;
  }

  setTokenMoveHandler({ canMoveToken, requestMove, userContext } = {}) {
    this.userContext = {
      isGM: Boolean(userContext?.isGM),
      userId: userContext?.userId ?? null,
    };

    if (typeof canMoveToken === 'function') {
      this.canControlToken = canMoveToken;
    } else {
      this.canControlToken = (token) => {
        if (!token) {
          return false;
        }
        if (this.userContext.isGM) {
          return true;
        }
        if (!this.userContext.userId) {
          return false;
        }
        return token.ownerUserId === this.userContext.userId;
      };
    }

    this.tokenMoveRequestHandler = typeof requestMove === 'function' ? requestMove : null;
    this.tokensLayer.setInteractionOptions({
      canMoveToken: (token) => this.canControlToken(token),
      onMoveRequest: (move) => this.handleTokenMoveRequest(move),
      throttleMs: 50,
      userContext: this.userContext,
    });
  }

  handleTokenMoveRequest(move) {
    if (!move || !move.tokenId || !this.tokenMoveRequestHandler) {
      return;
    }

    const token = this.tokens.get(move.tokenId);
    if (!token) {
      return;
    }

    const version = Number.isInteger(move.version) ? move.version : token.version ?? 0;

    this.tokenMoveRequestHandler({
      tokenId: move.tokenId,
      xCell: move.xCell,
      yCell: move.yCell,
      version,
    });
  }

  applyTokenMove({ tokenId, xCell, yCell, version, updatedAt }) {
    if (!tokenId || xCell === undefined || yCell === undefined) {
      return false;
    }

    const token = this.tokens.get(tokenId);
    if (!token) {
      return false;
    }

    const nextToken = {
      ...token,
      xCell,
      yCell,
      version: Number.isInteger(version) ? version : token.version,
      updatedAt: updatedAt ?? token.updatedAt ?? null,
    };

    this.tokens.set(tokenId, nextToken);
    this.tokensLayer.updateToken(nextToken);
    return true;
  }

  revertTokenMove(tokenId) {
    if (!tokenId) {
      return false;
    }

    const token = this.tokens.get(tokenId);
    if (!token) {
      return false;
    }

    this.tokensLayer.updateToken(token);
    return true;
  }

  getTokenScreenRect(token) {
    const gridSize = this.tokensLayer.getGridSize();
    if (!gridSize) {
      return { x: 0, y: 0, size: 0 };
    }

    const scale = this.container.scale?.x ?? 1;
    const size = gridSize * scale;
    const center = worldFromCell({ xCell: token?.xCell ?? 0, yCell: token?.yCell ?? 0 }, gridSize);
    const offsetX = this.container.position?.x ?? 0;
    const offsetY = this.container.position?.y ?? 0;

    return {
      x: offsetX + center.x * scale - size / 2,
      y: offsetY + center.y * scale - size / 2,
      size,
    };
  }

  highlightToken(token) {
    if (!this.canvas) {
      return;
    }

    const frame = this.canvas.parentElement;
    if (!frame) {
      return;
    }

    const { x, y, size } = this.getTokenScreenRect(token);
    if (!Number.isFinite(x) || !Number.isFinite(y) || size <= 0) {
      return;
    }

    const marker = document.createElement('span');
    marker.className = 'board__token-highlight';
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    marker.style.width = `${size}px`;
    marker.style.height = `${size}px`;

    frame.appendChild(marker);

    const remove = () => {
      marker.remove();
    };

    marker.addEventListener('animationend', remove, { once: true });
    window.setTimeout(remove, 2000);
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

  isPointerOverToken(event) {
    if (!this.tokensLayer || !this.tokensLayer.tokenSprites?.size) {
      return false;
    }

    const rect = this.canvas.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const scale = this.container.scale?.x ?? 1;
    const offsetX = this.container.position?.x ?? 0;
    const offsetY = this.container.position?.y ?? 0;

    const worldX = (pointerX - offsetX) / scale;
    const worldY = (pointerY - offsetY) / scale;

    return this.tokensLayer.hasTokenAt(worldX, worldY);
  }

  handlePointerDown(event) {
    if (event.button !== DRAG_BUTTON) {
      return;
    }

    if (this.isPointerOverToken(event)) {
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

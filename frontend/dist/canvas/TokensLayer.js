import { Container, Graphics, Sprite, Texture } from 'https://cdn.jsdelivr.net/npm/pixi.js@7.4.0/+esm';
import { cellToCanvas, normalizeGridSize, cellFromWorld, clampCell } from './coords.js';

const DEFAULT_GRID_SIZE = 50;
const HOVER_IN_FILL_ALPHA = 0.18;
const HOVER_OUT_FILL_ALPHA = 0.08;
const HOVER_IN_COLOR = 0x4ab49b;
const HOVER_OUT_COLOR = 0xd9443f;

export default class TokensLayer {
  constructor() {
    this.container = new Container();
    this.container.eventMode = 'static';
    this.container.sortableChildren = true;
    this.gridSize = DEFAULT_GRID_SIZE;
    this.sceneBounds = { columns: 0, rows: 0 };
    this.tokenSprites = new Map();
    this.tokenMetadata = new Map();
    this.moveOptions = {
      canMoveToken: () => false,
      onMoveRequest: null,
      throttleMs: 50,
    };
    this.dragState = this.createEmptyDragState();

    this.hoverCell = new Graphics();
    this.hoverCell.visible = false;
    this.hoverCell.eventMode = 'none';
    this.hoverCell.zIndex = 9999;
    this.container.addChild(this.hoverCell);
  }

  createEmptyDragState() {
    return {
      active: false,
      tokenId: null,
      pointerId: null,
      container: null,
      startCell: null,
      previewCell: null,
      lastSentCell: null,
      lastSentAt: 0,
      isOutOfBounds: false,
      listeners: null,
    };
  }

  setSceneBounds({ gridSize = this.gridSize, columns = this.sceneBounds.columns, rows = this.sceneBounds.rows } = {}) {
    this.gridSize = normalizeGridSize(gridSize, this.gridSize);
    this.sceneBounds = {
      columns: Number.isInteger(columns) && columns > 0 ? columns : 0,
      rows: Number.isInteger(rows) && rows > 0 ? rows : 0,
    };
    this.hideHoverCell();
  }

  setInteractionOptions({ canMoveToken, onMoveRequest, throttleMs = 50 } = {}) {
    this.moveOptions.canMoveToken = typeof canMoveToken === 'function' ? canMoveToken : () => false;
    this.moveOptions.onMoveRequest = typeof onMoveRequest === 'function' ? onMoveRequest : null;
    this.moveOptions.throttleMs = Number.isFinite(throttleMs) && throttleMs >= 0 ? throttleMs : 50;

    this.tokenSprites.forEach((container, tokenId) => {
      const metadata = this.tokenMetadata.get(tokenId) ?? null;
      this.updateContainerInteractivity(container, metadata);
    });
  }

  clear() {
    this.resetDragState();
    this.tokenSprites.forEach((container) => this.detachTokenContainer(container));
    this.container.removeChildren();
    this.container.addChild(this.hoverCell);
    this.tokenSprites.clear();
    this.tokenMetadata.clear();
    this.gridSize = DEFAULT_GRID_SIZE;
    this.sceneBounds = { columns: 0, rows: 0 };
  }

  setTokens(tokens = [], { gridSize = this.gridSize } = {}) {
    this.clear();
    this.gridSize = normalizeGridSize(gridSize, this.gridSize);

    if (!Array.isArray(tokens) || !tokens.length) {
      return;
    }

    tokens.forEach((token) => {
      this.addSprite(token, { gridSize: this.gridSize });
    });
  }

  getGridSize() {
    return this.gridSize;
  }

  addSprite(token, { gridSize, highlight = false } = {}) {
    if (!token || typeof token !== 'object') {
      return null;
    }

    const size = normalizeGridSize(gridSize ?? this.gridSize, this.gridSize);
    this.gridSize = size;

    const tokenId = token?.id ?? null;
    if (tokenId && this.tokenSprites.has(tokenId)) {
      const existing = this.tokenSprites.get(tokenId);
      this.detachTokenContainer(existing);
      if (existing?.parent) {
        existing.parent.removeChild(existing);
      }
      this.tokenSprites.delete(tokenId);
    }

    const tokenContainer = new Container();
    tokenContainer.eventMode = 'static';
    tokenContainer.cursor = 'grab';

    const display = this.createTokenDisplay(token, size);
    tokenContainer.addChild(display);

    const x = cellToCanvas(token?.xCell ?? 0, size);
    const y = cellToCanvas(token?.yCell ?? 0, size);
    tokenContainer.position.set(x, y);
    tokenContainer.zIndex = 1;

    this.container.addChild(tokenContainer);
    this.container.addChild(this.hoverCell);

    if (tokenId) {
      const metadata = {
        id: tokenId,
        sceneId: token.sceneId ?? null,
        ownerUserId: token.ownerUserId ?? null,
        name: token.name ?? '',
        xCell: token.xCell ?? 0,
        yCell: token.yCell ?? 0,
        sprite: token.sprite ?? null,
        version: Number.isInteger(token.version) ? token.version : 0,
        updatedAt: token.updatedAt ?? null,
      };
      this.tokenMetadata.set(tokenId, metadata);
      tokenContainer.__tokenData = metadata;
      this.tokenSprites.set(tokenId, tokenContainer);
      this.updateContainerInteractivity(tokenContainer, metadata);
    }

    if (highlight) {
      this.animateSpriteAppearance(tokenContainer);
    }

    return tokenContainer;
  }

  updateToken(token) {
    if (!token || typeof token !== 'object' || !token.id) {
      return false;
    }

    const metadata = this.tokenMetadata.get(token.id) ?? {};
    const nextMetadata = {
      ...metadata,
      ...token,
      version: Number.isInteger(token.version) ? token.version : metadata.version ?? 0,
    };
    this.tokenMetadata.set(token.id, nextMetadata);

    const container = this.tokenSprites.get(token.id);
    if (!container) {
      this.addSprite(nextMetadata, { gridSize: this.gridSize });
      return true;
    }

    container.__tokenData = nextMetadata;
    const x = cellToCanvas(nextMetadata.xCell ?? 0, this.gridSize);
    const y = cellToCanvas(nextMetadata.yCell ?? 0, this.gridSize);
    container.position.set(x, y);
    this.updateContainerInteractivity(container, nextMetadata);
    return true;
  }

  syncTokenPosition(tokenId) {
    const metadata = this.tokenMetadata.get(tokenId);
    const container = this.tokenSprites.get(tokenId);
    if (!metadata || !container) {
      return;
    }
    const x = cellToCanvas(metadata.xCell ?? 0, this.gridSize);
    const y = cellToCanvas(metadata.yCell ?? 0, this.gridSize);
    container.position.set(x, y);
  }

  hasTokenAt(worldX, worldY) {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
      return false;
    }
    const size = this.gridSize;
    for (const container of this.tokenSprites.values()) {
      const x = container?.position?.x ?? 0;
      const y = container?.position?.y ?? 0;
      if (worldX >= x && worldX <= x + size && worldY >= y && worldY <= y + size) {
        return true;
      }
    }
    return false;
  }

  animateSpriteAppearance(container) {
    if (!container) {
      return;
    }

    container.alpha = 0;
    const duration = 220;
    const start = performance.now();

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      container.alpha = progress;
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }

  createTokenDisplay(token, gridSize) {
    if (token?.sprite && typeof token.sprite === 'string') {
      const texture = Texture.from(token.sprite);
      texture.baseTexture.scaleMode = 'linear';
      const sprite = new Sprite(texture);
      sprite.width = gridSize;
      sprite.height = gridSize;
      sprite.anchor.set(0);
      sprite.position.set(0, 0);
      sprite.eventMode = 'none';
      return sprite;
    }

    const radius = Math.max(gridSize * 0.38, 12);
    const graphics = new Graphics();
    graphics.lineStyle({ width: Math.max(2, gridSize * 0.06), color: 0x2d1b0d, alpha: 0.8 });
    graphics.beginFill(0xd9b98c, 0.9);
    graphics.drawCircle(gridSize / 2, gridSize / 2, radius);
    graphics.endFill();
    graphics.eventMode = 'none';
    return graphics;
  }

  updateContainerInteractivity(container, metadata) {
    if (!container) {
      return;
    }

    if (container.__pointerDown) {
      container.off('pointerdown', container.__pointerDown);
      container.__pointerDown = null;
    }

    const canMove = metadata && this.moveOptions.canMoveToken(metadata);
    container.cursor = canMove ? 'grab' : 'not-allowed';

    if (canMove && metadata?.id) {
      const handler = (event) => this.startDraggingToken(event, metadata.id);
      container.on('pointerdown', handler);
      container.__pointerDown = handler;
    }
  }

  detachTokenContainer(container) {
    if (!container) {
      return;
    }
    if (this.dragState.container === container) {
      this.resetDragState();
    }
    if (container.__pointerDown) {
      container.off('pointerdown', container.__pointerDown);
      container.__pointerDown = null;
    }
  }

  resetDragState() {
    if (this.dragState.active && this.dragState.container && this.dragState.listeners) {
      const { container, listeners } = this.dragState;
      container.off('pointermove', listeners.move);
      container.off('pointerup', listeners.up);
      container.off('pointerupoutside', listeners.up);
      container.off('pointercancel', listeners.up);
      if (this.dragState.pointerId !== null) {
        container.releasePointerCapture?.(this.dragState.pointerId);
      }
    }
    this.dragState = this.createEmptyDragState();
    this.hideHoverCell();
  }

  startDraggingToken(event, tokenId) {
    if (!this.moveOptions.onMoveRequest) {
      return;
    }

    const metadata = this.tokenMetadata.get(tokenId);
    if (!metadata || !this.moveOptions.canMoveToken(metadata)) {
      return;
    }

    const container = this.tokenSprites.get(tokenId);
    if (!container) {
      return;
    }

    event.stopPropagation?.();
    event.preventDefault?.();

    const pointerId = event?.pointerId ?? null;

    const listeners = {
      move: (evt) => this.continueDraggingToken(evt, tokenId),
      up: (evt) => this.finishDraggingToken(evt, tokenId),
    };

    container.on('pointermove', listeners.move);
    container.on('pointerup', listeners.up);
    container.on('pointerupoutside', listeners.up);
    container.on('pointercancel', listeners.up);
    if (pointerId !== null) {
      event?.currentTarget?.capturePointer?.(pointerId);
    }

    container.zIndex = 100;
    container.alpha = 1;
    container.cursor = 'grabbing';

    this.dragState = {
      active: true,
      tokenId,
      pointerId,
      container,
      startCell: { xCell: metadata.xCell, yCell: metadata.yCell },
      previewCell: { xCell: metadata.xCell, yCell: metadata.yCell },
      lastSentCell: null,
      lastSentAt: 0,
      isOutOfBounds: false,
      listeners,
    };

    this.showHoverCell(metadata.xCell, metadata.yCell, { outOfBounds: false });
  }

  continueDraggingToken(event, tokenId) {
    if (!this.dragState.active || this.dragState.tokenId !== tokenId) {
      return;
    }

    if (this.dragState.pointerId !== null && event?.pointerId !== undefined && event.pointerId !== this.dragState.pointerId) {
      return;
    }

    const localPoint = this.container.toLocal(event.global);
    const rawCell = cellFromWorld(localPoint, this.gridSize);
    const clamped = clampCell(rawCell, this.sceneBounds);

    this.dragState.previewCell = { xCell: clamped.xCell, yCell: clamped.yCell };
    this.dragState.isOutOfBounds = clamped.outOfBounds;
    this.showHoverCell(clamped.xCell, clamped.yCell, { outOfBounds: clamped.outOfBounds });

    if (clamped.outOfBounds) {
      return;
    }

    const x = cellToCanvas(clamped.xCell, this.gridSize);
    const y = cellToCanvas(clamped.yCell, this.gridSize);
    this.dragState.container.position.set(x, y);

    const lastSentCell = this.dragState.lastSentCell;
    const now = performance.now();
    if (!lastSentCell || lastSentCell.xCell !== clamped.xCell || lastSentCell.yCell !== clamped.yCell) {
      if (now - this.dragState.lastSentAt >= this.moveOptions.throttleMs) {
        this.emitMoveRequest({ tokenId, xCell: clamped.xCell, yCell: clamped.yCell });
        this.dragState.lastSentCell = { xCell: clamped.xCell, yCell: clamped.yCell };
        this.dragState.lastSentAt = now;
      }
    }
  }

  finishDraggingToken(event, tokenId) {
    if (!this.dragState.active || this.dragState.tokenId !== tokenId) {
      return;
    }

    if (this.dragState.pointerId !== null && event?.pointerId !== undefined && event.pointerId !== this.dragState.pointerId) {
      return;
    }

    const { container, listeners } = this.dragState;
    container.off('pointermove', listeners.move);
    container.off('pointerup', listeners.up);
    container.off('pointerupoutside', listeners.up);
    container.off('pointercancel', listeners.up);
    if (this.dragState.pointerId !== null) {
      container.releasePointerCapture?.(this.dragState.pointerId);
    }

    const metadata = this.tokenMetadata.get(tokenId);
    const canMove = metadata && this.moveOptions.canMoveToken(metadata);
    container.cursor = canMove ? 'grab' : 'not-allowed';
    container.zIndex = 1;

    const previewCell = this.dragState.previewCell;
    const wasOutOfBounds = this.dragState.isOutOfBounds;
    const lastSentCell = this.dragState.lastSentCell;
    const lastSentAt = this.dragState.lastSentAt;

    this.hideHoverCell();

    if (wasOutOfBounds || !previewCell) {
      this.restoreTokenPosition(tokenId);
      this.dragState = this.createEmptyDragState();
      return;
    }

    const now = performance.now();
    const needsFinalEmit =
      !lastSentCell ||
      lastSentCell.xCell !== previewCell.xCell ||
      lastSentCell.yCell !== previewCell.yCell ||
      now - lastSentAt > this.moveOptions.throttleMs;

    if (needsFinalEmit) {
      this.emitMoveRequest({ tokenId, xCell: previewCell.xCell, yCell: previewCell.yCell });
    }

    this.dragState = this.createEmptyDragState();
  }

  showHoverCell(xCell, yCell, { outOfBounds = false } = {}) {
    const size = this.gridSize;
    const x = cellToCanvas(xCell ?? 0, size);
    const y = cellToCanvas(yCell ?? 0, size);
    const strokeColor = outOfBounds ? HOVER_OUT_COLOR : HOVER_IN_COLOR;
    const fillColor = strokeColor;
    const fillAlpha = outOfBounds ? HOVER_OUT_FILL_ALPHA : HOVER_IN_FILL_ALPHA;

    this.hoverCell.clear();
    this.hoverCell.lineStyle({ width: Math.max(2, size * 0.08), color: strokeColor, alpha: 0.95, alignment: 0.5 });
    this.hoverCell.beginFill(fillColor, fillAlpha);
    this.hoverCell.drawRect(x, y, size, size);
    this.hoverCell.endFill();
    this.hoverCell.visible = true;
  }

  hideHoverCell() {
    this.hoverCell.visible = false;
    this.hoverCell.clear();
  }

  restoreTokenPosition(tokenId) {
    const metadata = this.tokenMetadata.get(tokenId);
    if (!metadata) {
      return;
    }
    this.syncTokenPosition(tokenId);
  }

  emitMoveRequest({ tokenId, xCell, yCell }) {
    if (!this.moveOptions.onMoveRequest) {
      return;
    }
    const metadata = this.tokenMetadata.get(tokenId);
    if (!metadata) {
      return;
    }
    if (metadata.xCell === xCell && metadata.yCell === yCell) {
      return;
    }
    const version = Number.isInteger(metadata.version) ? metadata.version : 0;
    this.moveOptions.onMoveRequest({ tokenId, xCell, yCell, version });
  }
}

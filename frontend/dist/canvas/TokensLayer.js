import { Container, Graphics, Sprite, Texture } from 'https://cdn.jsdelivr.net/npm/pixi.js@7.4.0/+esm';
import { normalizeGridSize, cellFromWorld, clampCell, worldFromCell, gridColsRows } from './coords.js';

const DEFAULT_GRID_SIZE = 50;
const DEFAULT_THROTTLE_MS = 50;

function ensureInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function ensureNonNegativeNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

export default class TokensLayer {
  constructor({ app } = {}) {
    this.app = app ?? null;
    this.container = new Container();
    this.container.sortableChildren = true;
    this.container.eventMode = 'none';

    this.tokensContainer = new Container();
    this.tokensContainer.zIndex = 100;
    this.tokensContainer.sortableChildren = false;
    this.tokensContainer.eventMode = 'static';
    this.container.addChild(this.tokensContainer);

    this.gridSize = DEFAULT_GRID_SIZE;
    this.scene = {
      gridSize: DEFAULT_GRID_SIZE,
      widthPx: 0,
      heightPx: 0,
      cols: 0,
      rows: 0,
    };

    this.tokenSprites = new Map();
    this.tokenMetadata = new Map();

    this.moveOptions = {
      canMoveToken: () => false,
      onMoveRequest: null,
      throttleMs: DEFAULT_THROTTLE_MS,
    };

    this.userContext = { isGM: false, userId: null, canDragTokens: false };
    this.drag = this.createEmptyDragState();
    this.boundOnDragMove = (event) => this.onDragMove(event);
  }

  createEmptyDragState() {
    return {
      sprite: null,
      lastSentAt: 0,
      lastSentCell: null,
      currentCell: null,
      originCell: null,
    };
  }

  setUserContext({ isGM = false, userId = null, canDragTokens } = {}) {
    const normalizedCanDrag =
      canDragTokens === undefined ? !isGM : Boolean(canDragTokens);
    this.userContext = {
      isGM: Boolean(isGM),
      userId: userId ?? null,
      canDragTokens: normalizedCanDrag,
    };
    this.tokenSprites.forEach((sprite) => {
      this.updateSpriteCursor(sprite);
    });
  }

  setInteractionOptions({ canMoveToken, onMoveRequest, throttleMs = DEFAULT_THROTTLE_MS, userContext } = {}) {
    this.moveOptions.canMoveToken = typeof canMoveToken === 'function' ? canMoveToken : () => false;
    this.moveOptions.onMoveRequest = typeof onMoveRequest === 'function' ? onMoveRequest : null;
    this.moveOptions.throttleMs = Number.isFinite(throttleMs) && throttleMs >= 0 ? throttleMs : DEFAULT_THROTTLE_MS;

    if (userContext) {
      this.setUserContext(userContext);
    } else {
      this.tokenSprites.forEach((sprite) => this.updateSpriteCursor(sprite));
    }
  }

  setSceneBounds(scene = {}) {
    const gridSize = normalizeGridSize(scene.gridSize ?? this.scene.gridSize ?? this.gridSize, this.gridSize);
    const widthPx = ensureNonNegativeNumber(scene.widthPx, ensureNonNegativeNumber(this.scene.widthPx, 0));
    const heightPx = ensureNonNegativeNumber(scene.heightPx, ensureNonNegativeNumber(this.scene.heightPx, 0));
    const hasExplicitColumns = Number.isInteger(scene.columns) && scene.columns > 0;
    const hasExplicitRows = Number.isInteger(scene.rows) && scene.rows > 0;
    let cols = hasExplicitColumns ? scene.columns : 0;
    let rows = hasExplicitRows ? scene.rows : 0;

    if (!hasExplicitColumns || !hasExplicitRows) {
      const gridMetrics = gridColsRows({ gridSize, widthPx, heightPx });
      if (!hasExplicitColumns) cols = gridMetrics.cols;
      if (!hasExplicitRows) rows = gridMetrics.rows;
    }

    this.gridSize = gridSize;
    this.scene = { gridSize, widthPx, heightPx, cols, rows };
  }

  getGridSize() {
    return this.gridSize;
  }

  clear({ preserveScene = false } = {}) {
    this.stopDragging();
    this.tokenSprites.forEach((sprite) => this.detachSprite(sprite));
    this.tokensContainer.removeChildren();
    this.tokenSprites.clear();
    this.tokenMetadata.clear();

    if (preserveScene) {
      const nextScene = {
        gridSize: normalizeGridSize(this.scene.gridSize ?? this.gridSize, this.gridSize),
        widthPx: ensureNonNegativeNumber(this.scene.widthPx, 0),
        heightPx: ensureNonNegativeNumber(this.scene.heightPx, 0),
        cols: Number.isInteger(this.scene.cols) ? this.scene.cols : 0,
        rows: Number.isInteger(this.scene.rows) ? this.scene.rows : 0,
      };
      this.gridSize = nextScene.gridSize;
      this.scene = nextScene;
    } else {
      this.gridSize = DEFAULT_GRID_SIZE;
      this.scene = {
        gridSize: DEFAULT_GRID_SIZE,
        widthPx: 0,
        heightPx: 0,
        cols: 0,
        rows: 0,
      };
    }
  }

  setTokens(tokens = [], { gridSize = this.gridSize } = {}) {
    this.clear({ preserveScene: true });
    this.gridSize = normalizeGridSize(gridSize, this.scene.gridSize ?? this.gridSize);
    const derivedGrid = gridColsRows({
      gridSize: this.gridSize,
      widthPx: this.scene.widthPx,
      heightPx: this.scene.heightPx,
    });

    this.scene = {
      ...this.scene,
      gridSize: this.gridSize,
      cols: Number.isInteger(this.scene.cols) && this.scene.cols > 0 ? this.scene.cols : derivedGrid.cols,
      rows: Number.isInteger(this.scene.rows) && this.scene.rows > 0 ? this.scene.rows : derivedGrid.rows,
    };

    if (!Array.isArray(tokens) || !tokens.length) {
      return;
    }

    tokens.forEach((token) => this.addSprite(token, { gridSize: this.gridSize }));
  }

  addSprite(token, { gridSize = this.gridSize, highlight = false } = {}) {
    if (!token || typeof token !== 'object') {
      return null;
    }

    const tokenId = token.id ?? null;
    const size = normalizeGridSize(gridSize, this.gridSize);
    this.gridSize = size;

    if (tokenId && this.tokenSprites.has(tokenId)) {
      const existingSprite = this.tokenSprites.get(tokenId);
      this.detachSprite(existingSprite);
      this.tokenSprites.delete(tokenId);
      this.tokenMetadata.delete(tokenId);
    }

    const sprite = this.createInteractiveSprite(token, size);
    const metadata = {
      id: tokenId,
      sceneId: token.sceneId ?? null,
      ownerUserId: token.ownerUserId ?? null,
      name: token.name ?? '',
      sprite: token.sprite ?? null,
      xCell: ensureInteger(token.xCell, 0),
      yCell: ensureInteger(token.yCell, 0),
      version: ensureInteger(token.version, 0),
      updatedAt: token.updatedAt ?? null,
    };

    if (tokenId) {
      sprite.tokenId = tokenId;
    }

    sprite.meta = {
      sceneId: metadata.sceneId,
      version: metadata.version,
      ownerUserId: metadata.ownerUserId,
    };

    const world = worldFromCell({ xCell: metadata.xCell, yCell: metadata.yCell }, size);
    sprite.position.set(world.x, world.y);

    this.attachSpriteHandlers(sprite);

    this.tokensContainer.addChild(sprite);

    if (tokenId) {
      this.tokenSprites.set(tokenId, sprite);
      this.tokenMetadata.set(tokenId, metadata);
    }

    this.updateSpriteCursor(sprite);

    if (highlight) {
      this.animateSpriteAppearance(sprite);
    }

    return sprite;
  }

  updateToken(token) {
    if (!token || typeof token !== 'object' || !token.id) {
      return false;
    }

    const existingMetadata = this.tokenMetadata.get(token.id) ?? {};
    const nextMetadata = {
      ...existingMetadata,
      ...token,
      xCell: ensureInteger(token.xCell, existingMetadata.xCell ?? 0),
      yCell: ensureInteger(token.yCell, existingMetadata.yCell ?? 0),
      version: ensureInteger(token.version, existingMetadata.version ?? 0),
    };

    this.tokenMetadata.set(token.id, nextMetadata);

    const sprite = this.tokenSprites.get(token.id);
    if (!sprite) {
      this.addSprite(nextMetadata, { gridSize: this.gridSize });
      return true;
    }

    sprite.meta = {
      sceneId: nextMetadata.sceneId ?? sprite.meta?.sceneId ?? null,
      version: nextMetadata.version,
      ownerUserId: nextMetadata.ownerUserId ?? sprite.meta?.ownerUserId ?? null,
    };

    const world = worldFromCell({ xCell: nextMetadata.xCell, yCell: nextMetadata.yCell }, this.gridSize);
    sprite.position.set(world.x, world.y);
    this.updateSpriteCursor(sprite);
    return true;
  }

  applyMove({ tokenId, xCell, yCell, version }) {
    if (!tokenId) {
      return false;
    }

    const sprite = this.tokenSprites.get(tokenId);
    const metadata = this.tokenMetadata.get(tokenId);
    if (!sprite || !metadata) {
      return false;
    }

    const nextX = ensureInteger(xCell, metadata.xCell ?? 0);
    const nextY = ensureInteger(yCell, metadata.yCell ?? 0);
    metadata.xCell = nextX;
    metadata.yCell = nextY;

    if (Number.isInteger(version)) {
      metadata.version = version;
      sprite.meta.version = version;
    }

    const world = worldFromCell({ xCell: nextX, yCell: nextY }, this.gridSize);
    sprite.position.set(world.x, world.y);
    return true;
  }

  revertTokenPosition(tokenId) {
    const metadata = this.tokenMetadata.get(tokenId);
    const sprite = this.tokenSprites.get(tokenId);
    if (!metadata || !sprite) {
      return;
    }

    const world = worldFromCell({ xCell: metadata.xCell ?? 0, yCell: metadata.yCell ?? 0 }, this.gridSize);
    sprite.position.set(world.x, world.y);
  }

  hasTokenAt(worldX, worldY) {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
      return false;
    }

    for (const sprite of this.tokenSprites.values()) {
      if (!sprite) continue;
      const width = (sprite.width ?? this.gridSize) * (sprite.scale?.x ?? 1);
      const height = (sprite.height ?? this.gridSize) * (sprite.scale?.y ?? 1);
      const left = sprite.position.x - width / 2;
      const top = sprite.position.y - height / 2;
      const right = left + width;
      const bottom = top + height;
      if (worldX >= left && worldX <= right && worldY >= top && worldY <= bottom) {
        return true;
      }
    }

    return false;
  }

  attachSpriteHandlers(sprite) {
    if (!sprite) {
      return;
    }

    const handlePointerDown = (event) => this.onDragStart(event);
    const handlePointerUp = (event) => this.onDragEnd(event);

    sprite.on('pointerdown', handlePointerDown);
    sprite.on('pointerup', handlePointerUp);
    sprite.on('pointerupoutside', handlePointerUp);
    sprite.on('pointercancel', handlePointerUp);

    sprite.__dragHandlers = { handlePointerDown, handlePointerUp };
  }

  detachSprite(sprite) {
    if (!sprite) {
      return;
    }

    if (sprite.__dragHandlers) {
      const { handlePointerDown, handlePointerUp } = sprite.__dragHandlers;
      if (handlePointerDown) {
        sprite.off('pointerdown', handlePointerDown);
      }
      if (handlePointerUp) {
        sprite.off('pointerup', handlePointerUp);
        sprite.off('pointerupoutside', handlePointerUp);
        sprite.off('pointercancel', handlePointerUp);
      }
      sprite.__dragHandlers = null;
    }

    sprite.destroy({ children: true });
  }

  updateSpriteCursor(sprite) {
    if (!sprite) {
      return;
    }

    sprite.cursor = this.canControl(sprite) ? 'grab' : 'not-allowed';
  }

  canControl(sprite) {
    if (!sprite) {
      return false;
    }

    if (!this.userContext.canDragTokens) {
      return false;
    }

    if (this.userContext.isGM) {
      return true;
    }

    const ownerUserId = sprite.meta?.ownerUserId ?? null;
    if (ownerUserId !== null && this.userContext.userId) {
      return ownerUserId === this.userContext.userId;
    }

    if (typeof this.moveOptions.canMoveToken === 'function' && sprite.tokenId) {
      const metadata = this.tokenMetadata.get(sprite.tokenId);
      if (metadata) {
        return Boolean(this.moveOptions.canMoveToken(metadata));
      }
    }

    return false;
  }

  onDragStart(event) {
    const sprite = event?.currentTarget ?? null;
    if (!sprite || !sprite.tokenId) {
      return;
    }

    event?.stopPropagation?.();

    if (!this.canControl(sprite)) {
      return;
    }

    const metadata = this.tokenMetadata.get(sprite.tokenId);
    const originCell = metadata
      ? { xCell: ensureInteger(metadata.xCell, 0), yCell: ensureInteger(metadata.yCell, 0) }
      : { xCell: 0, yCell: 0 };

    sprite.cursor = 'grabbing';

    this.drag = {
      sprite,
      lastSentAt: 0,
      lastSentCell: null,
      currentCell: originCell,
      originCell,
    };

    if (this.app?.stage) {
      this.app.stage.on('globalpointermove', this.boundOnDragMove);
    }
  }

  onDragMove(event) {
    const sprite = this.drag.sprite;
    if (!sprite || !event?.global) {
      return;
    }

    const local = this.tokensContainer.toLocal(event.global);
    const rawCell = cellFromWorld(local.x, local.y, this.gridSize);
    const clamped = clampCell(rawCell, this.scene);
    const world = worldFromCell(clamped, this.gridSize);

    sprite.position.set(world.x, world.y);

    if (sprite.tokenId && this.tokenMetadata.has(sprite.tokenId)) {
      const metadata = this.tokenMetadata.get(sprite.tokenId);
      metadata.xCell = clamped.xCell;
      metadata.yCell = clamped.yCell;
    }

    this.drag.currentCell = clamped;

    if (!this.canControl(sprite)) {
      return;
    }

    const now = Date.now();
    const lastCell = this.drag.lastSentCell;
    const sameCell = lastCell && lastCell.xCell === clamped.xCell && lastCell.yCell === clamped.yCell;
    if (sameCell) {
      return;
    }

    if (now - this.drag.lastSentAt < this.moveOptions.throttleMs) {
      return;
    }

    if (this.emitMoveRequest(sprite, clamped)) {
      this.drag.lastSentAt = now;
      this.drag.lastSentCell = clamped;
    }
  }

  onDragEnd(event) {
    const sprite = this.drag.sprite;
    if (!sprite) {
      return;
    }

    if (this.app?.stage) {
      this.app.stage.off('globalpointermove', this.boundOnDragMove);
    }

    sprite.cursor = this.canControl(sprite) ? 'grab' : 'not-allowed';

    const metadata = sprite.tokenId ? this.tokenMetadata.get(sprite.tokenId) : null;
    let finalCell = this.drag.currentCell ?? this.drag.originCell;

    if (event?.global) {
      const local = this.tokensContainer.toLocal(event.global);
      const rawCell = cellFromWorld(local.x, local.y, this.gridSize);
      finalCell = clampCell(rawCell, this.scene);
      const world = worldFromCell(finalCell, this.gridSize);
      sprite.position.set(world.x, world.y);
      if (metadata) {
        metadata.xCell = finalCell.xCell;
        metadata.yCell = finalCell.yCell;
      }
    }

    const now = Date.now();
    const lastCell = this.drag.lastSentCell;
    const sameCell = lastCell && finalCell && lastCell.xCell === finalCell.xCell && lastCell.yCell === finalCell.yCell;

    if (finalCell && this.canControl(sprite) && (!sameCell || now - this.drag.lastSentAt >= this.moveOptions.throttleMs)) {
      this.emitMoveRequest(sprite, finalCell);
      this.drag.lastSentAt = now;
      this.drag.lastSentCell = finalCell;
    }

    this.drag = this.createEmptyDragState();
  }

  stopDragging() {
    if (this.app?.stage) {
      this.app.stage.off('globalpointermove', this.boundOnDragMove);
    }
    this.drag = this.createEmptyDragState();
  }

  emitMoveRequest(sprite, cell) {
    if (!sprite || !sprite.tokenId || !this.moveOptions.onMoveRequest) {
      return false;
    }

    const metadata = this.tokenMetadata.get(sprite.tokenId);
    const version = metadata && Number.isInteger(metadata.version) ? metadata.version : sprite.meta?.version ?? 0;

    this.moveOptions.onMoveRequest({
      tokenId: sprite.tokenId,
      xCell: cell.xCell,
      yCell: cell.yCell,
      version,
    });

    return true;
  }

  animateSpriteAppearance(sprite) {
    if (!sprite) {
      return;
    }

    sprite.alpha = 0;
    const duration = 220;
    const start = performance.now();

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      sprite.alpha = progress;
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }

  createInteractiveSprite(token, gridSize) {
    let sprite;

    if (token?.sprite && typeof token.sprite === 'string') {
      const texture = Texture.from(token.sprite);
      texture.baseTexture.scaleMode = 'linear';
      sprite = new Sprite(texture);
    } else {
      const graphics = new Graphics();
      const radius = Math.max(gridSize * 0.38, 12);
      graphics.lineStyle({ width: Math.max(2, gridSize * 0.06), color: 0x2d1b0d, alpha: 0.8 });
      graphics.beginFill(0xd9b98c, 0.9);
      graphics.drawCircle(0, 0, radius);
      graphics.endFill();

      const texture = this.app?.renderer?.generateTexture?.(graphics, {
        resolution: window.devicePixelRatio || 1,
      });

      sprite = texture ? new Sprite(texture) : new Sprite(Texture.WHITE);
      if (!texture) {
        sprite.tint = 0xd9b98c;
      }
    }

    sprite.eventMode = 'static';
    sprite.interactive = true;
    sprite.cursor = 'grab';
    sprite.anchor.set(0.5);
    sprite.width = gridSize;
    sprite.height = gridSize;
    return sprite;
  }
}

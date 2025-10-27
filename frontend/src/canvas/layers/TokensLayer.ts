import {
  Container,
  FederatedPointerEvent,
  Graphics,
  Point,
  Sprite,
  Text,
  Texture,
} from "pixi.js";

import { BaseCanvasLayer } from "./CanvasLayer";
import { cellCenterToPixel } from "../utils/gridMath";
import {
  cellFromWorld,
  clampCell,
  gridColsRows,
  worldFromPointer,
} from "../coords";

export type TokenRenderData = {
  id: string;
  name: string;
  xCell: number;
  yCell: number;
  ownerUserId?: string | null;
  sprite?: string | null;
};

export type TokenMoveTarget = { xCell: number; yCell: number };

export type TokenMoveDebugInfo = {
  worldX: number;
  worldY: number;
  nx: number;
  ny: number;
  cols: number;
  rows: number;
};

type TokenDisplay = {
  container: Container;
  placeholder: Graphics;
  label: Text;
  sprite: Sprite | null;
  handlersAttached: boolean;
};

type TokenMoveHandler = (
  tokenId: string,
  target: TokenMoveTarget,
  revert: () => void,
  debug?: TokenMoveDebugInfo
) => void;

type DragState = {
  tokenId: string;
  display: TokenDisplay;
  pointerId: number;
  offset: Point;
  startCell: TokenMoveTarget;
  startZIndex: number;
  targetCell: TokenMoveTarget;
  moveListener: (event: FederatedPointerEvent) => void;
  endListener: (event: FederatedPointerEvent) => void;
  debugInfo: TokenMoveDebugInfo;
};

export class TokensLayer extends BaseCanvasLayer {
  private gridSize: number;
  private readonly tokens = new Map<string, TokenDisplay>();
  private readonly tokenData = new Map<string, TokenRenderData>();
  private readonly dragPreview: Graphics;
  private canMoveToken: (token: TokenRenderData) => boolean = () => false;
  private onMoveRequest: TokenMoveHandler | null = null;
  private dragState: DragState | null = null;
  private sceneWidth = 2048;
  private sceneHeight = 2048;
  private originX = 0;
  private originY = 0;

  constructor(gridSize: number) {
    super({ sortableChildren: true, eventMode: "static" });
    this.gridSize = gridSize;

    this.dragPreview = new Graphics();
    this.dragPreview.eventMode = "none";
    this.dragPreview.visible = false;
    this.dragPreview.zIndex = Number.MAX_SAFE_INTEGER;
    this.container.addChild(this.dragPreview);
  }

  public upsert(token: TokenRenderData): void {
    let display = this.tokens.get(token.id);

    if (!display) {
      display = this.createDisplay(token.name);
      this.tokens.set(token.id, display);
      this.container.addChild(display.container);
      this.attachDragHandlers(token.id, display);
    }

    this.tokenData.set(token.id, token);
    this.updateDisplay(display, token);
    this.applyInteractivity(display, token);
  }

  public setGridSize(size: number): void {
    if (!Number.isFinite(size) || size <= 0 || size === this.gridSize) {
      return;
    }

    this.gridSize = size;

    for (const [tokenId, display] of this.tokens.entries()) {
      const token = this.tokenData.get(tokenId);
      if (token) {
        this.updateDisplay(display, token);
        this.applyInteractivity(display, token);
      }
    }

    this.hidePreview();
  }

  public replaceAll(nextTokens: TokenRenderData[]): void {
    const nextIds = new Set(nextTokens.map((token) => token.id));

    for (const existingId of Array.from(this.tokens.keys())) {
      if (!nextIds.has(existingId)) {
        this.removeTokenDisplay(existingId);
      }
    }

    for (const token of nextTokens) {
      this.upsert(token);
    }
  }

  public setMovePermission(checker: (token: TokenRenderData) => boolean): void {
    this.canMoveToken = checker;
    for (const [tokenId, display] of this.tokens.entries()) {
      const data = this.tokenData.get(tokenId);
      if (data) {
        this.applyInteractivity(display, data);
      }
    }
  }

  public setMoveHandler(handler: TokenMoveHandler | null): void {
    this.onMoveRequest = handler;
  }

  public setSceneBounds({
    widthPx,
    heightPx,
    originX = 0,
    originY = 0,
  }: {
    widthPx: number;
    heightPx: number;
    originX?: number;
    originY?: number;
  }): void {
    if (Number.isFinite(widthPx) && widthPx > 0) {
      this.sceneWidth = widthPx;
    }
    if (Number.isFinite(heightPx) && heightPx > 0) {
      this.sceneHeight = heightPx;
    }
    if (Number.isFinite(originX)) {
      this.originX = originX;
    }
    if (Number.isFinite(originY)) {
      this.originY = originY;
    }
  }

  private createDisplay(initialName: string): TokenDisplay {
    const container = new Container();
    container.eventMode = "static";
    container.cursor = "pointer";
    container.sortableChildren = false;

    const placeholder = new Graphics();
    container.addChild(placeholder);

    const label = new Text({
      text: initialName,
      style: {
        fill: 0xffffff,
        fontSize: 16,
        stroke: { color: 0x000000, width: 3, alpha: 0.6 },
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(0, 0);
    container.addChild(label);

    const display: TokenDisplay = {
      container,
      placeholder,
      label,
      sprite: null,
      handlersAttached: false,
    };

    this.configureTokenAppearance(display);
    return display;
  }

  private updateDisplay(display: TokenDisplay, token: TokenRenderData): void {
    const { container, placeholder, label } = display;
    const centerX = cellCenterToPixel(token.xCell, this.gridSize);
    const centerY = cellCenterToPixel(token.yCell, this.gridSize);

    container.position.set(centerX, centerY);
    container.zIndex = token.yCell;

    label.text = token.name;
    this.configureTokenAppearance(display);

    const spriteUrl = typeof token.sprite === "string" ? token.sprite.trim() : "";

    if (spriteUrl) {
      const texture = Texture.from(spriteUrl);
      if (!display.sprite) {
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        display.sprite = sprite;
        container.addChildAt(sprite, 0);
      } else {
        display.sprite.texture = texture;
        display.sprite.visible = true;
      }

      const size = this.gridSize * 0.9;
      display.sprite.width = size;
      display.sprite.height = size;
      placeholder.visible = false;
    } else {
      if (display.sprite) {
        container.removeChild(display.sprite);
        display.sprite.destroy({ texture: false, baseTexture: false });
        display.sprite = null;
      }
      placeholder.visible = true;
    }
  }

  private configureTokenAppearance(display: TokenDisplay): void {
    const { placeholder, label } = display;
    const radius = Math.max(16, this.gridSize * 0.35);

    placeholder.clear();
    placeholder.circle(0, 0, radius);
    placeholder.fill({ color: 0x4b5fff, alpha: 0.85 });
    placeholder.stroke({
      color: 0xffffff,
      alpha: 0.9,
      width: Math.max(2, this.gridSize * 0.08),
    });

    label.style.fontSize = Math.max(12, this.gridSize * 0.3);
    label.position.set(0, -(radius + 6));
  }

  private attachDragHandlers(tokenId: string, display: TokenDisplay): void {
    if (display.handlersAttached) {
      return;
    }

    display.container.on("pointerdown", (event: FederatedPointerEvent) => {
      this.handleDragStart(tokenId, display, event);
    });

    display.handlersAttached = true;
  }

  private removeTokenDisplay(tokenId: string): void {
    const display = this.tokens.get(tokenId);
    if (!display) {
      return;
    }

    if (this.dragState?.tokenId === tokenId) {
      const { moveListener, endListener, display: dragDisplay } = this.dragState;
      dragDisplay.container.off("globalpointermove", moveListener);
      dragDisplay.container.off("globalpointerup", endListener);
      dragDisplay.container.off("pointerupoutside", endListener);
      dragDisplay.container.off("pointercancel", endListener);
      this.dragState = null;
      this.hidePreview();
    }

    this.tokenData.delete(tokenId);
    this.tokens.delete(tokenId);
    this.container.removeChild(display.container);
    display.container.destroy({ children: true, texture: false, baseTexture: false });
  }

  private handleDragStart(
    tokenId: string,
    display: TokenDisplay,
    event: FederatedPointerEvent
  ): void {
    const token = this.tokenData.get(tokenId);
    if (!token) {
      return;
    }

    if (!this.canMoveToken(token) || this.dragState) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
    if (event.nativeEvent && "stopPropagation" in event.nativeEvent) {
      event.nativeEvent.stopPropagation();
    }

    const local = event.getLocalPosition(this.container);
    const offset = new Point(
      local.x - display.container.position.x,
      local.y - display.container.position.y
    );

    const startCell = { xCell: token.xCell, yCell: token.yCell };

    const moveListener = (moveEvent: FederatedPointerEvent) => {
      this.handleDragMove(moveEvent);
    };
    const endListener = (endEvent: FederatedPointerEvent) => {
      this.handleDragEnd(endEvent);
    };

    display.container.on("globalpointermove", moveListener);
    display.container.on("globalpointerup", endListener);
    display.container.on("pointerupoutside", endListener);
    display.container.on("pointercancel", endListener);

    display.container.cursor = "grabbing";
    display.container.alpha = 0.9;

    const targetCell = { ...startCell };
    const { cols, rows } = gridColsRows(this.sceneWidth, this.sceneHeight, this.gridSize);
    const debugInfo: TokenMoveDebugInfo = {
      worldX: display.container.position.x,
      worldY: display.container.position.y,
      nx: startCell.xCell,
      ny: startCell.yCell,
      cols,
      rows,
    };

    this.dragState = {
      tokenId,
      display,
      pointerId: event.pointerId,
      offset,
      startCell,
      startZIndex: display.container.zIndex,
      targetCell,
      moveListener,
      endListener,
      debugInfo,
    };

    this.updatePreview(targetCell);
  }

  private handleDragMove(event: FederatedPointerEvent): void {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }

    event.preventDefault();

    const world = worldFromPointer(this.container, event.global);
    const centerX = world.x - this.dragState.offset.x;
    const centerY = world.y - this.dragState.offset.y;

    this.dragState.display.container.position.set(centerX, centerY);

    const { nx, ny } = cellFromWorld(
      centerX,
      centerY,
      this.gridSize,
      this.originX,
      this.originY
    );
    const { cols, rows } = gridColsRows(this.sceneWidth, this.sceneHeight, this.gridSize);
    const { xCell, yCell } = clampCell(nx, ny, cols, rows);

    this.dragState.debugInfo = {
      worldX: centerX,
      worldY: centerY,
      nx,
      ny,
      cols,
      rows,
    };

    if (
      xCell !== this.dragState.targetCell.xCell ||
      yCell !== this.dragState.targetCell.yCell
    ) {
      this.dragState.targetCell = { xCell, yCell };
      this.updatePreview(this.dragState.targetCell);
    }
  }

  private handleDragEnd(event: FederatedPointerEvent): void {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }

    event.preventDefault();

    const {
      tokenId,
      display,
      startCell,
      startZIndex,
      moveListener,
      endListener,
      targetCell,
      debugInfo,
    } = this.dragState;

    display.container.off("globalpointermove", moveListener);
    display.container.off("globalpointerup", endListener);
    display.container.off("pointerupoutside", endListener);
    display.container.off("pointercancel", endListener);

    this.dragState = null;

    this.hidePreview();

    display.container.alpha = 1;

    const token = this.tokenData.get(tokenId);
    const canMove = token ? this.canMoveToken(token) : false;
    display.container.cursor = canMove ? "grab" : "default";

    const revert = () => {
      const revertCenterX = cellCenterToPixel(startCell.xCell, this.gridSize);
      const revertCenterY = cellCenterToPixel(startCell.yCell, this.gridSize);
      display.container.position.set(revertCenterX, revertCenterY);
      display.container.zIndex = startCell.yCell;
    };

    revert();
    display.container.zIndex = startZIndex;

    if (
      targetCell.xCell === startCell.xCell &&
      targetCell.yCell === startCell.yCell
    ) {
      return;
    }

    if (this.onMoveRequest) {
      this.onMoveRequest(tokenId, targetCell, revert, debugInfo);
    } else {
      revert();
    }
  }

  private applyInteractivity(display: TokenDisplay, token: TokenRenderData): void {
    const canMove = this.canMoveToken(token);
    display.container.eventMode = canMove ? "static" : "none";
    display.container.cursor = canMove ? "grab" : "default";
  }

  private updatePreview(target: TokenMoveTarget): void {
    const half = this.gridSize / 2;
    const startX = target.xCell * this.gridSize - half;
    const startY = target.yCell * this.gridSize - half;

    this.dragPreview.clear();
    this.dragPreview.rect(startX, startY, this.gridSize, this.gridSize);
    this.dragPreview.stroke({ color: 0xffffff, width: Math.max(2, this.gridSize * 0.05), alpha: 0.9 });
    this.dragPreview.fill({ color: 0xffffff, alpha: 0.15 });
    this.dragPreview.visible = true;
  }

  private hidePreview(): void {
    this.dragPreview.visible = false;
    this.dragPreview.clear();
  }
}

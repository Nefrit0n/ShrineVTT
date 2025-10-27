import { Container, FederatedPointerEvent, Graphics, Point, Sprite, Text, Texture } from "pixi.js";

import { BaseCanvasLayer } from "./CanvasLayer";
import { cellCenterToPixel } from "../utils/gridMath";
import {
  cellFromWorld,
  clampCell,
  gridColsRows,
  worldFromPointer,
} from "../coords";
import { HoverCellLayer } from "../HoverCellLayer";

const colorCache = new Map<string, number>();

const parseCssColor = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const expanded = hex
        .split("")
        .map((char) => char + char)
        .join("");
      return Number.parseInt(expanded, 16);
    }
    if (hex.length === 6) {
      return Number.parseInt(hex, 16);
    }
    return null;
  }

  const rgbMatch = trimmed.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    const parts = rgbMatch[1]
      .split(",")
      .map((segment) => Number.parseFloat(segment.trim()))
      .slice(0, 3);
    if (parts.length === 3 && parts.every((value) => Number.isFinite(value))) {
      const [r, g, b] = parts.map((component) =>
        Math.max(0, Math.min(255, Math.round(component)))
      );
      return (r << 16) | (g << 8) | b;
    }
  }

  return null;
};

export type TokenRenderData = {
  id: string;
  name: string;
  xCell: number;
  yCell: number;
  ownerUserId?: string | null;
  sprite?: string | null;
  actorId?: string | null;
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
  id: string;
  container: Container;
  halo: Graphics;
  placeholder: Graphics;
  labelContainer: Container;
  labelBackground: Graphics;
  label: Text;
  sprite: Sprite | null;
  handlersAttached: boolean;
  fullName: string;
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
  private canMoveToken: (token: TokenRenderData) => boolean = () => false;
  private onMoveRequest: TokenMoveHandler | null = null;
  private onTokenSelect: ((token: TokenRenderData | null) => void) | null = null;
  private onTokenActivate: ((token: TokenRenderData) => void) | null = null;
  private dragState: DragState | null = null;
  private sceneWidth = 2048;
  private sceneHeight = 2048;
  private originX = 0;
  private originY = 0;
  private hoverLayer: HoverCellLayer | null = null;
  private snapToGrid = true;
  private selectedTokenId: string | null = null;
  private canvasElement: HTMLCanvasElement | null = null;

  constructor(gridSize: number) {
    super({ sortableChildren: true, eventMode: "static" });
    this.gridSize = gridSize;
  }

  public upsert(token: TokenRenderData): void {
    let display = this.tokens.get(token.id);

    if (!display) {
      display = this.createDisplay(token.id, token.name);
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

    this.hoverLayer?.setGridSize(this.gridSize);
    this.hideHover();
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

  public setSelectionHandler(
    handler: ((token: TokenRenderData | null) => void) | null
  ): void {
    this.onTokenSelect = handler;
  }

  public setActivateHandler(handler: ((token: TokenRenderData) => void) | null): void {
    this.onTokenActivate = handler;
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

    if (this.hoverLayer) {
      this.hoverLayer.setSceneBounds({
        widthPx: this.sceneWidth,
        heightPx: this.sceneHeight,
        originX: this.originX,
        originY: this.originY,
      });
    }
  }

  public setHoverLayer(layer: HoverCellLayer | null): void {
    this.hoverLayer = layer;
    if (layer) {
      layer.setGridSize(this.gridSize);
      layer.setSceneBounds({
        widthPx: this.sceneWidth,
        heightPx: this.sceneHeight,
        originX: this.originX,
        originY: this.originY,
      });
    }
  }

  public setSnapToGrid(enabled: boolean): void {
    this.snapToGrid = enabled;
  }

  public setCanvasElement(canvas: HTMLCanvasElement | null): void {
    if (!canvas && this.canvasElement) {
      this.canvasElement.removeAttribute("title");
    }
    this.canvasElement = canvas;
  }

  private createDisplay(id: string, initialName: string): TokenDisplay {
    const container = new Container();
    container.eventMode = "static";
    container.cursor = "pointer";
    container.sortableChildren = true;

    const halo = new Graphics();
    halo.visible = false;
    halo.zIndex = 0;
    container.addChild(halo);

    const placeholder = new Graphics();
    placeholder.zIndex = 1;
    container.addChild(placeholder);

    const labelContainer = new Container();
    labelContainer.eventMode = "static";
    labelContainer.cursor = "help";
    labelContainer.zIndex = 3;

    const labelBackground = new Graphics();
    labelContainer.addChild(labelBackground);

    const label = new Text({
      text: initialName,
      style: {
        fill: 0xffffff,
        fontSize: 16,
        fontWeight: "600",
        wordWrap: true,
        wordWrapWidth: 220,
        align: "center",
      },
    });
    label.anchor.set(0.5);
    labelContainer.addChild(label);

    container.addChild(labelContainer);

    const display: TokenDisplay = {
      id,
      container,
      halo,
      placeholder,
      labelContainer,
      labelBackground,
      label,
      sprite: null,
      handlersAttached: false,
      fullName: initialName,
    };

    labelContainer.on("pointerover", () => {
      this.setCanvasTooltip(display.fullName);
    });
    labelContainer.on("pointerout", () => {
      this.setCanvasTooltip(null);
    });

    this.configureTokenAppearance(display);
    return display;
  }

  private updateDisplay(display: TokenDisplay, token: TokenRenderData): void {
    const { container, placeholder, label } = display;
    const centerX = cellCenterToPixel(token.xCell, this.gridSize);
    const centerY = cellCenterToPixel(token.yCell, this.gridSize);

    container.position.set(centerX, centerY);
    container.zIndex = token.yCell;

    display.fullName = token.name;
    label.text = this.truncateLabel(token.name);
    this.configureTokenAppearance(display, token);

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

  private configureTokenAppearance(
    display: TokenDisplay,
    token?: TokenRenderData
  ): void {
    const { placeholder, label, labelBackground, labelContainer } = display;
    const radius = Math.max(18, this.gridSize * 0.35);
    const roleColor = this.resolveColor(
      token?.ownerUserId ? "--success" : "--accent",
      token?.ownerUserId ? 0x27c281 : 0xa0b3ff
    );

    placeholder.clear();
    placeholder.circle(0, 0, radius);
    placeholder.fill({ color: roleColor, alpha: 0.82 });
    placeholder.stroke({
      color: 0xffffff,
      alpha: 0.14,
      width: Math.max(2, this.gridSize * 0.06),
    });

    const fontSize = Math.max(12, this.gridSize * 0.28);
    const maxWidth = Math.max(120, this.gridSize * 2.4);
    label.style.fontSize = fontSize;
    label.style.wordWrapWidth = maxWidth;

    const paddingX = 12;
    const paddingY = 6;
    const chipWidth = Math.min(maxWidth, Math.max(label.width, fontSize)) + paddingX * 2;
    const chipHeight = label.height + paddingY * 2;
    const halfWidth = chipWidth / 2;
    const halfHeight = chipHeight / 2;

    labelBackground.clear();
    labelBackground.roundRect(-halfWidth, -halfHeight, chipWidth, chipHeight, 12);
    labelBackground.fill({
      color: this.resolveColor("--panel-2", 0x1c2230),
      alpha: 0.7,
    });
    labelBackground.stroke({ color: 0xffffff, width: 1, alpha: 0.08 });

    label.position.set(0, 0);
    labelContainer.position.set(0, -(radius + halfHeight + 8));

    this.updateHalo(display);
  }

  private attachDragHandlers(tokenId: string, display: TokenDisplay): void {
    if (display.handlersAttached) {
      return;
    }

    display.container.on("pointerdown", (event: FederatedPointerEvent) => {
      this.handleDragStart(tokenId, display, event);
    });

    display.container.on("pointertap", () => {
      this.handleTokenTap(tokenId);
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
      this.hideHover();
    }

    this.tokenData.delete(tokenId);
    this.tokens.delete(tokenId);
    this.container.removeChild(display.container);
    display.container.destroy({ children: true, texture: false, baseTexture: false });

    if (this.selectedTokenId === tokenId) {
      this.setSelectedToken(null);
    }
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

    this.setSelectedToken(tokenId);

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

    this.updateHover({
      xCell: targetCell.xCell,
      yCell: targetCell.yCell,
      isInside: true,
    });
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
    const clamped = clampCell(nx, ny, cols, rows);
    const isInside = nx >= 0 && ny >= 0 && nx < cols && ny < rows;
    const targetCell = this.snapToGrid ? clamped : { xCell: nx, yCell: ny };

    this.dragState.debugInfo = {
      worldX: centerX,
      worldY: centerY,
      nx,
      ny,
      cols,
      rows,
    };

    const current = this.dragState.targetCell;
    if (current.xCell !== targetCell.xCell || current.yCell !== targetCell.yCell) {
      this.dragState.targetCell = { ...targetCell };
    }

    this.updateHover({
      xCell: clamped.xCell,
      yCell: clamped.yCell,
      isInside,
      outOfBounds: {
        left: nx < 0,
        right: nx >= cols,
        top: ny < 0,
        bottom: ny >= rows,
      },
    });
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

    this.hideHover();

    display.container.alpha = 1;

    const token = this.tokenData.get(tokenId);
    const canMove = token ? this.canMoveToken(token) : false;
    display.container.cursor = canMove ? "grab" : "pointer";

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
    display.container.eventMode = "static";
    if (this.dragState?.tokenId === display.id) {
      display.container.cursor = "grabbing";
    } else {
      display.container.cursor = canMove ? "grab" : "pointer";
    }
  }

  private updateHover(
    target:
      | (TokenMoveTarget & { isInside: true })
      | (TokenMoveTarget & {
          isInside: false;
          outOfBounds: { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean };
        })
  ): void {
    this.hoverLayer?.show(target);
  }

  private hideHover(): void {
    this.hoverLayer?.hide();
  }

  private setSelectedToken(tokenId: string | null): void {
    this.selectedTokenId = tokenId;

    for (const [id, display] of this.tokens.entries()) {
      this.updateHalo(display);
      const token = this.tokenData.get(id);
      if (token) {
        this.applyInteractivity(display, token);
      }
    }

    if (this.onTokenSelect) {
      const token = tokenId ? this.tokenData.get(tokenId) ?? null : null;
      this.onTokenSelect(token);
    }
  }

  private updateHalo(display: TokenDisplay): void {
    const isSelected = this.selectedTokenId === display.id;
    display.halo.clear();
    display.halo.visible = isSelected;

    if (!isSelected) {
      return;
    }

    const radius = Math.max(22, this.gridSize * 0.45);
    const accent = this.resolveColor("--accent", 0xa0b3ff);
    display.halo.circle(0, 0, radius);
    display.halo.stroke({ color: accent, width: Math.max(2.5, this.gridSize * 0.05), alpha: 0.9 });
    display.halo.fill({ color: accent, alpha: 0.08 });
  }

  private truncateLabel(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length <= 24) {
      return trimmed;
    }
    return `${trimmed.slice(0, 23)}…`;
  }

  private setCanvasTooltip(text: string | null): void {
    if (!this.canvasElement) {
      return;
    }
    if (text && text.trim()) {
      this.canvasElement.title = text;
    } else {
      this.canvasElement.removeAttribute("title");
    }
  }

  private resolveColor(variable: string, fallback: number): number {
    if (colorCache.has(variable)) {
      return colorCache.get(variable)!;
    }

    if (typeof window === "undefined") {
      return fallback;
    }

    const computed = getComputedStyle(document.documentElement).getPropertyValue(variable);
    const parsed = computed ? parseCssColor(computed) : null;
    const value = parsed ?? fallback;
    colorCache.set(variable, value);
    return value;
  }

  private handleTokenTap(tokenId: string): void {
    if (this.dragState && this.dragState.tokenId === tokenId) {
      return;
    }

    if (!this.onTokenActivate) {
      return;
    }

    const token = this.tokenData.get(tokenId);
    if (!token) {
      return;
    }

    this.onTokenActivate(token);
  }
}

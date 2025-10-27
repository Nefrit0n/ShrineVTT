import { Graphics, type Container as PixiContainer } from "pixi.js";

import { BaseCanvasLayer } from "./CanvasLayer";

export type GridState = {
  scale: number;
  position: { x: number; y: number };
  viewportWidth: number;
  viewportHeight: number;
};

export class GridLayer extends BaseCanvasLayer {
  private gridSize: number;
  private readonly graphics: Graphics;
  private lastState:
    | {
        startX: number;
        endX: number;
        startY: number;
        endY: number;
        scale: number;
      }
    | null = null;

  constructor(gridSize: number) {
    super({ eventMode: "none" });
    this.gridSize = gridSize;
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  public setGridSize(gridSize: number): void {
    if (!Number.isFinite(gridSize) || gridSize <= 0 || gridSize === this.gridSize) {
      return;
    }

    this.gridSize = gridSize;
    this.lastState = null;
  }

  public setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  public update(state: GridState): void {
    if (!this.container.visible) {
      return;
    }

    const { scale, position, viewportWidth, viewportHeight } = state;
    const worldLeft = -position.x / scale;
    const worldTop = -position.y / scale;
    const worldRight = worldLeft + viewportWidth / scale;
    const worldBottom = worldTop + viewportHeight / scale;

    const startXIndex = Math.floor(worldLeft / this.gridSize) - 1;
    const endXIndex = Math.ceil(worldRight / this.gridSize) + 1;
    const startYIndex = Math.floor(worldTop / this.gridSize) - 1;
    const endYIndex = Math.ceil(worldBottom / this.gridSize) + 1;

    if (
      this.lastState &&
      this.lastState.scale === scale &&
      this.lastState.startX === startXIndex &&
      this.lastState.endX === endXIndex &&
      this.lastState.startY === startYIndex &&
      this.lastState.endY === endYIndex
    ) {
      return;
    }

    this.lastState = {
      scale,
      startX: startXIndex,
      endX: endXIndex,
      startY: startYIndex,
      endY: endYIndex,
    };

    this.graphics.clear();
    this.graphics.lineStyle({
      width: 1 / scale,
      color: 0xffffff,
      alpha: 0.2,
      alignment: 0,
    });

    const verticalStart = startXIndex * this.gridSize;
    const verticalEnd = endXIndex * this.gridSize;
    const horizontalStart = startYIndex * this.gridSize;
    const horizontalEnd = endYIndex * this.gridSize;

    for (let x = verticalStart; x <= verticalEnd; x += this.gridSize) {
      this.graphics.moveTo(x, horizontalStart);
      this.graphics.lineTo(x, horizontalEnd);
    }

    for (let y = horizontalStart; y <= horizontalEnd; y += this.gridSize) {
      this.graphics.moveTo(verticalStart, y);
      this.graphics.lineTo(verticalEnd, y);
    }
  }

  public override attach(stage: PixiContainer): void {
    super.attach(stage);
    this.container.sortableChildren = false;
  }
}

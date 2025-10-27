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
  private highContrast = false;

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

  public setHighContrast(enabled: boolean): void {
    if (this.highContrast === enabled) {
      return;
    }
    this.highContrast = enabled;
    this.lastState = null;
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

    const cellSize = this.gridSize;
    const verticalStart = startXIndex * cellSize;
    const verticalEnd = endXIndex * cellSize;
    const horizontalStart = startYIndex * cellSize;
    const horizontalEnd = endYIndex * cellSize;

    if (this.highContrast) {
      for (let xIndex = startXIndex; xIndex < endXIndex; xIndex += 1) {
        for (let yIndex = startYIndex; yIndex < endYIndex; yIndex += 1) {
          const x = xIndex * cellSize;
          const y = yIndex * cellSize;
          const alpha = (xIndex + yIndex) % 2 === 0 ? 0.16 : 0.07;
          this.graphics.rect(x, y, cellSize, cellSize);
          this.graphics.fill({ color: 0xffffff, alpha });
        }
      }
    }

    this.graphics.lineStyle({
      width: this.highContrast ? Math.max(1.5 / scale, 1.2) : 1 / scale,
      color: this.highContrast ? 0xa0b3ff : 0xffffff,
      alpha: this.highContrast ? 0.4 : 0.2,
      alignment: 0,
    });

    for (let x = verticalStart; x <= verticalEnd; x += cellSize) {
      this.graphics.moveTo(x, horizontalStart);
      this.graphics.lineTo(x, horizontalEnd);
    }

    for (let y = horizontalStart; y <= horizontalEnd; y += cellSize) {
      this.graphics.moveTo(verticalStart, y);
      this.graphics.lineTo(verticalEnd, y);
    }
  }

  public override attach(stage: PixiContainer): void {
    super.attach(stage);
    this.container.sortableChildren = false;
  }
}

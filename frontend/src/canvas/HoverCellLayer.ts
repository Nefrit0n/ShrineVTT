import { Graphics, type Container as PixiContainer } from "pixi.js";

import { BaseCanvasLayer } from "./layers/CanvasLayer";

type HoverOutOfBounds = {
  left?: boolean;
  right?: boolean;
  top?: boolean;
  bottom?: boolean;
};

type HoverTarget = {
  xCell: number;
  yCell: number;
  isInside: boolean;
  outOfBounds?: HoverOutOfBounds;
};

export class HoverCellLayer extends BaseCanvasLayer {
  private gridSize: number;
  private sceneWidth = 2048;
  private sceneHeight = 2048;
  private originX = 0;
  private originY = 0;
  private readonly cell: Graphics;
  private readonly edge: Graphics;

  constructor(gridSize: number) {
    super({ eventMode: "none" });
    this.gridSize = gridSize;
    this.cell = new Graphics();
    this.edge = new Graphics();
    this.edge.zIndex = Number.MAX_SAFE_INTEGER - 2;
    this.cell.zIndex = Number.MAX_SAFE_INTEGER - 3;
    this.container.addChild(this.cell);
    this.container.addChild(this.edge);
    this.hide();
  }

  public setGridSize(size: number): void {
    if (!Number.isFinite(size) || size <= 0 || size === this.gridSize) {
      return;
    }

    this.gridSize = size;
    this.hide();
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

  public show(target: HoverTarget): void {
    if (target.isInside) {
      this.drawCell(target.xCell, target.yCell);
      this.edge.visible = false;
      return;
    }

    const out = target.outOfBounds ?? {};
    this.cell.visible = false;
    this.edge.visible = true;
    this.edge.clear();
    const strokeWidth = Math.max(3, this.gridSize * 0.08);
    this.edge.stroke({ color: 0xef5b5b, width: strokeWidth, alpha: 0.9, alignment: 0.5 });

    const left = this.originX;
    const right = this.originX + this.sceneWidth;
    const top = this.originY;
    const bottom = this.originY + this.sceneHeight;

    if (out.left) {
      this.edge.moveTo(left, top);
      this.edge.lineTo(left, bottom);
    }
    if (out.right) {
      this.edge.moveTo(right, top);
      this.edge.lineTo(right, bottom);
    }
    if (out.top) {
      this.edge.moveTo(left, top);
      this.edge.lineTo(right, top);
    }
    if (out.bottom) {
      this.edge.moveTo(left, bottom);
      this.edge.lineTo(right, bottom);
    }
  }

  public hide(): void {
    this.cell.visible = false;
    this.edge.visible = false;
    this.cell.clear();
    this.edge.clear();
  }

  private drawCell(xCell: number, yCell: number): void {
    const startX = xCell * this.gridSize + this.originX;
    const startY = yCell * this.gridSize + this.originY;
    this.cell.visible = true;
    this.cell.clear();
    this.cell.rect(startX, startY, this.gridSize, this.gridSize);
    this.cell.stroke({ color: 0xa0b3ff, width: Math.max(2, this.gridSize * 0.05), alpha: 0.9 });
    this.cell.fill({ color: 0xa0b3ff, alpha: 0.16 });
  }

  public override attach(stage: PixiContainer): void {
    super.attach(stage);
    this.container.sortableChildren = false;
  }
}

import { Container } from "pixi.js";

export interface CanvasLayer {
  init(): Promise<void> | void;
  attach(stage: Container): void;
  destroy(): void;
  getView(): Container;
}

export abstract class BaseCanvasLayer implements CanvasLayer {
  protected readonly container: Container;

  protected constructor({
    sortableChildren = false,
    eventMode,
  }: {
    sortableChildren?: boolean;
    eventMode?: Container["eventMode"];
  } = {}) {
    this.container = new Container();
    this.container.sortableChildren = sortableChildren;
    if (eventMode) {
      this.container.eventMode = eventMode;
    }
  }

  public getView(): Container {
    return this.container;
  }

  public init(): Promise<void> | void {
    return undefined;
  }

  public attach(stage: Container): void {
    stage.addChild(this.container);
  }

  public destroy(): void {
    this.container.destroy({
      children: true,
      texture: false,
      baseTexture: false,
    });
  }
}

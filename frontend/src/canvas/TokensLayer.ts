import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";

export type TokenRenderData = {
  id: string;
  name: string;
  xCell: number;
  yCell: number;
  sprite?: string | null;
};

type TokenDisplay = {
  container: Container;
  placeholder: Graphics;
  label: Text;
  sprite: Sprite | null;
};

export class TokensLayer extends Container {
  private readonly gridSize: number;
  private readonly tokens = new Map<string, TokenDisplay>();

  constructor(gridSize: number) {
    super();
    this.eventMode = "static";
    this.sortableChildren = true;
    this.gridSize = gridSize;
  }

  public upsert(token: TokenRenderData): void {
    let display = this.tokens.get(token.id);

    if (!display) {
      display = this.createDisplay(token.name);
      this.tokens.set(token.id, display);
      this.addChild(display.container);
    }

    this.updateDisplay(display, token);
  }

  private createDisplay(initialName: string): TokenDisplay {
    const container = new Container();
    container.eventMode = "static";
    container.cursor = "pointer";
    container.sortableChildren = false;

    const placeholder = new Graphics();
    const radius = Math.max(16, this.gridSize * 0.35);
    placeholder.circle(0, 0, radius);
    placeholder.fill({ color: 0x4b5fff, alpha: 0.85 });
    placeholder.stroke({
      color: 0xffffff,
      alpha: 0.9,
      width: Math.max(2, this.gridSize * 0.08),
    });
    container.addChild(placeholder);

    const label = new Text({
      text: initialName,
      style: {
        fill: 0xffffff,
        fontSize: Math.max(12, this.gridSize * 0.3),
        stroke: { color: 0x000000, width: 3, alpha: 0.6 },
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(0, -(radius + 6));
    container.addChild(label);

    return { container, placeholder, label, sprite: null };
  }

  private updateDisplay(display: TokenDisplay, token: TokenRenderData): void {
    const { container, placeholder, label } = display;
    const centerX = token.xCell * this.gridSize + this.gridSize / 2;
    const centerY = token.yCell * this.gridSize + this.gridSize / 2;

    container.position.set(centerX, centerY);
    container.zIndex = token.yCell;

    label.text = token.name;

    const spriteUrl =
      typeof token.sprite === "string" ? token.sprite.trim() : "";

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
}

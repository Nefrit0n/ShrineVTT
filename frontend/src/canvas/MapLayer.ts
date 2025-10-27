import { Assets, Container, Graphics, Sprite, Texture } from "pixi.js";

export type MapDescriptor = {
  url?: string | null;
  fallbackColor?: number;
  fallbackSize?: { width: number; height: number };
};

export class MapLayer extends Container {
  private sprite: Sprite | null = null;
  private readonly fallback: Graphics;

  constructor() {
    super();
    this.eventMode = "none";
    this.fallback = new Graphics();
    this.fallback.rect(0, 0, 2048, 2048);
    this.fallback.fill({ color: 0x1b1b1b, alpha: 1 });
    this.addChild(this.fallback);
  }

  public async setBackground(descriptor: MapDescriptor): Promise<void> {
    const { url, fallbackColor = 0x1b1b1b, fallbackSize = { width: 2048, height: 2048 } } =
      descriptor;

    this.applyFallback(fallbackColor, fallbackSize);

    if (!url) {
      this.destroySprite();
      return;
    }

    try {
      const texture = await Assets.load(url);
      if (!texture) {
        this.destroySprite();
        return;
      }

      this.ensureSprite(texture);
      this.fallback.visible = false;
    } catch (error) {
      console.error("Failed to load map texture", error);
      this.destroySprite();
    }
  }

  private ensureSprite(texture: Texture): void {
    if (!this.sprite) {
      this.sprite = new Sprite(texture);
      this.sprite.eventMode = "none";
      this.addChildAt(this.sprite, 0);
    } else {
      this.sprite.texture = texture;
    }

    this.sprite.width = texture.width;
    this.sprite.height = texture.height;
  }

  private applyFallback(color: number, size: { width: number; height: number }): void {
    this.fallback.clear();
    this.fallback.rect(0, 0, size.width, size.height);
    this.fallback.fill({ color, alpha: 1 });
    this.fallback.visible = true;
  }

  private destroySprite(): void {
    if (this.sprite) {
      this.sprite.destroy({ texture: false, baseTexture: false });
      this.removeChild(this.sprite);
      this.sprite = null;
    }
  }

  public getContentBounds(): { width: number; height: number } {
    if (this.sprite) {
      return { width: this.sprite.width, height: this.sprite.height };
    }

    const bounds = this.fallback.getLocalBounds();
    return { width: bounds.width, height: bounds.height };
  }
}

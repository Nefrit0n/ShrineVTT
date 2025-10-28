import { Container, Graphics, Sprite, Texture } from 'https://cdn.jsdelivr.net/npm/pixi.js@7.4.0/+esm';
import { ensurePositiveNumber } from './coords.js';

export default class MapLayer {
  constructor({ fallbackColor = 0x0b1016 } = {}) {
    this.container = new Container();
    this.container.eventMode = 'none';
    this.fallbackColor = fallbackColor;
  }

  clear() {
    this.container.removeChildren();
  }

  setScene(scene) {
    this.container.removeChildren();
    if (!scene || typeof scene !== 'object') {
      return;
    }

    const width = ensurePositiveNumber(scene.widthPx, 0);
    const height = ensurePositiveNumber(scene.heightPx, 0);

    if (!width || !height) {
      return;
    }

    if (scene.mapImage && typeof scene.mapImage === 'string') {
      try {
        const texture = Texture.from(scene.mapImage);
        texture.baseTexture.scaleMode = 'linear';
        const sprite = new Sprite(texture);
        sprite.x = 0;
        sprite.y = 0;
        sprite.width = width;
        sprite.height = height;
        sprite.eventMode = 'none';
        this.container.addChild(sprite);
        return;
      } catch (err) {
        console.warn('Failed to load scene map texture', err);
      }
    }

    const graphics = new Graphics();
    graphics.beginFill(this.fallbackColor, 0.95);
    graphics.drawRect(0, 0, width, height);
    graphics.endFill();
    this.container.addChild(graphics);
  }
}

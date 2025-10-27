import { Container } from "pixi.js";

export class TokensLayer extends Container {
  constructor() {
    super();
    this.eventMode = "static";
    this.sortableChildren = true;
  }
}

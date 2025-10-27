import { Scene } from "../entities/Scene.js";

export const sceneFromRecord = (record) => {
  if (!record) {
    return null;
  }

  return new Scene({ ...record });
};

export const sceneToRecord = (scene) => ({
  id: scene.id,
  roomId: scene.roomId,
  name: scene.name,
  gridSize: scene.gridSize,
  mapImage: scene.mapImage,
  widthPx: scene.widthPx,
  heightPx: scene.heightPx,
});

export const sceneToDTO = sceneToRecord;

export const sceneToPublicDTO = (scene) => ({
  id: scene.id,
  name: scene.name,
  gridSize: scene.gridSize,
  mapImage: scene.mapImage,
  widthPx: scene.widthPx,
  heightPx: scene.heightPx,
});

import test from 'node:test';
import assert from 'node:assert/strict';
import Scene from './Scene.js';
import Token from './Token.js';

const BASE_PROPS = {
  id: 'scene-1',
  name: 'Dungeon',
  gridSize: 64,
  widthPx: 2048,
  heightPx: 2048,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test('scene columns computed from grid', () => {
  const scene = new Scene(BASE_PROPS);
  assert.equal(scene.getColumns(), 32);
  assert.equal(scene.getRows(), 32);
});

test('token within bounds passes validation', () => {
  const scene = new Scene(BASE_PROPS);
  const token = new Token(
    {
      id: 'token-1',
      sceneId: scene.id,
      name: 'Hero',
      xCell: 31,
      yCell: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    scene,
  );

  assert.equal(token.xCell, 31);
});

test('token outside bounds throws', () => {
  const scene = new Scene(BASE_PROPS);

  assert.throws(
    () =>
      new Token(
        {
          id: 'token-2',
          sceneId: scene.id,
          name: 'Hero',
          xCell: 32,
          yCell: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        scene,
      ),
    (err) => {
      assert.equal(err.code, 'OUT_OF_BOUNDS');
      return true;
    },
  );
});

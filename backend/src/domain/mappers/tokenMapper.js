import { Token } from "../entities/Token.js";

const cloneMeta = (meta) => {
  if (meta === null || meta === undefined) {
    return {};
  }

  if (typeof structuredClone === "function") {
    return structuredClone(meta);
  }

  return JSON.parse(JSON.stringify(meta));
};

export const tokenFromRecord = (record) => {
  if (!record) {
    return null;
  }

  return new Token({
    ...record,
    meta: cloneMeta(record.meta),
    version: Number(record.version ?? 1),
    updatedAt: record.updatedAt ?? new Date().toISOString(),
  });
};

export const tokenToRecord = (token) => ({
  id: token.id,
  sceneId: token.sceneId,
  ownerUserId: token.ownerUserId,
  name: token.name,
  xCell: token.xCell,
  yCell: token.yCell,
  sprite: token.sprite,
  visibility: token.visibility,
  meta: cloneMeta(token.meta),
  version: token.version,
  updatedAt: token.updatedAt,
});

export const tokenToDTO = tokenToRecord;

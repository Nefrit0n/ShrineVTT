import { Item } from "../entities/Item.js";

const cloneData = (data) => {
  if (data === null || data === undefined) {
    return undefined;
  }

  if (typeof structuredClone === "function") {
    return structuredClone(data);
  }

  return JSON.parse(JSON.stringify(data));
};

export const itemFromRecord = (record) => {
  if (!record) {
    return null;
  }

  return new Item({
    ...record,
    data: cloneData(record.data),
  });
};

export const itemToRecord = (item) => ({
  id: item.id,
  name: item.name,
  type: item.type,
  data: cloneData(item.data) ?? {},
});

export const itemToDTO = (item) => ({
  id: item.id,
  name: item.name,
  type: item.type,
  data: cloneData(item.data) ?? {},
});

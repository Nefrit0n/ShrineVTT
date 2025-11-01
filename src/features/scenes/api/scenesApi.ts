import type {
  Scene,
  SceneCreatePayload,
  SceneUpdatePayload,
} from "../types";

const DEFAULT_API_BASE_URL = "http://localhost:3000";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? DEFAULT_API_BASE_URL;

const headers = {
  "Content-Type": "application/json",
};

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Ошибка запроса к серверу");
  }
  return response.json() as Promise<T>;
}

export async function fetchScenes(): Promise<{
  scenes: Scene[];
  activeSceneId: string | null;
}> {
  const response = await fetch(`${API_BASE_URL}/api/scenes`);
  return handleResponse(response);
}

export async function fetchScene(id: string): Promise<Scene> {
  const response = await fetch(`${API_BASE_URL}/api/scenes/${id}`);
  return handleResponse(response);
}

export async function createScene(payload: SceneCreatePayload): Promise<Scene> {
  const response = await fetch(`${API_BASE_URL}/api/scenes`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function updateScene(
  id: string,
  payload: SceneUpdatePayload
): Promise<Scene> {
  const response = await fetch(`${API_BASE_URL}/api/scenes/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function deleteScene(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/scenes/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Не удалось удалить сцену");
  }
}

export async function duplicateScene(id: string): Promise<Scene> {
  const response = await fetch(`${API_BASE_URL}/api/scenes/${id}/duplicate`, {
    method: "POST",
  });
  return handleResponse(response);
}

export async function activateScene(id: string): Promise<{ success: true }>{
  const response = await fetch(`${API_BASE_URL}/api/scenes/${id}/activate`, {
    method: "POST",
  });
  return handleResponse(response);
}

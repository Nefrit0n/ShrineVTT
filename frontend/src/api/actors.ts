export type AbilityKey = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";

export type AbilityScores = Record<AbilityKey, number>;

export type ActorDTO = {
  id: string;
  name: string;
  ownerUserId: string;
  abilities: AbilityScores;
  profBonus: number;
  maxHP: number;
  ac: number;
  items: string[];
};

export type ActorsListResponse = { actors: ActorDTO[] };
export type ActorResponse = { actor: ActorDTO };

export type ActorPatchPayload = {
  name?: string;
  abilities?: Partial<AbilityScores>;
  profBonus?: number;
  maxHP?: number;
  ac?: number;
};

export class ActorsApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: Record<string, string>;

  constructor({
    message,
    status,
    code,
    details,
  }: {
    message: string;
    status: number;
    code?: string;
    details?: Record<string, string>;
  }) {
    super(message);
    this.name = "ActorsApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const buildHeaders = (authToken: string | null, includeJson = false) => {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
};

const parseError = async (response: Response): Promise<ActorsApiError> => {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  const body =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as { error?: string; code?: string; details?: unknown })
      : { error: undefined, code: undefined, details: undefined };

  const details =
    body.details && typeof body.details === "object" && !Array.isArray(body.details)
      ? Object.fromEntries(
          Object.entries(body.details).map(([key, value]) => [key, String(value)])
        )
      : undefined;

  return new ActorsApiError({
    message: body.error ?? `Request failed with status ${response.status}`,
    status: response.status,
    code: typeof body.code === "string" ? body.code : undefined,
    details,
  });
};

const handleJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as T;
};

export const listActors = async (authToken: string | null): Promise<ActorDTO[]> => {
  const response = await fetch("/api/actors", {
    headers: buildHeaders(authToken),
  });

  const data = await handleJson<ActorsListResponse>(response);
  return Array.isArray(data.actors) ? data.actors : [];
};

export const getActor = async (
  actorId: string,
  authToken: string | null
): Promise<ActorDTO> => {
  const response = await fetch(`/api/actors/${encodeURIComponent(actorId)}`, {
    headers: buildHeaders(authToken),
  });

  const data = await handleJson<ActorResponse>(response);
  return data.actor;
};

export const updateActor = async (
  actorId: string,
  payload: ActorPatchPayload,
  authToken: string | null
): Promise<ActorDTO> => {
  const response = await fetch(`/api/actors/${encodeURIComponent(actorId)}`, {
    method: "PATCH",
    headers: buildHeaders(authToken, true),
    body: JSON.stringify(payload),
  });

  const data = await handleJson<ActorResponse>(response);
  return data.actor;
};

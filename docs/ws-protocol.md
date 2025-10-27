# ShrineVTT WebSocket Protocol

All real-time interactions take place inside the `/game` namespace. Messages use JSON payloads.

## Common Structures

### `Token`

```json
{
  "id": "string",
  "sceneId": "string",
  "ownerUserId": "string | null",
  "name": "string",
  "xCell": 0,
  "yCell": 0,
  "sprite": "string | null",
  "visibility": "string",
  "meta": {},
  "version": 1,
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

The `version` counter is incremented on every server-side mutation and `updatedAt` contains the ISO timestamp of the latest change.

### Error envelope

All acknowledgements follow the same envelope:

```json
{
  "ok": false,
  "error": {
    "code": "string",
    "message": "string",
    "context": {}
  }
}
```

`context` may be `null` when additional data is not available.

When a callback is not provided, the server emits an `error` event with the same `error` object.

#### Error codes

| Code | Meaning |
| --- | --- |
| `forbidden` | The user lacks permission to perform the action. |
| `invalid_payload` | Payload failed validation. `context` contains field errors. |
| `rate_limited` | The rate limit for the event was exceeded. `context` exposes `windowMs` and `max`. |
| `internal_error` | Unexpected server failure. |
| `token.out_of_bounds` | The requested position is outside of the scene grid. |
| `token.not_owner` | Player attempted to manipulate a token they do not own. |
| `token.not_found` | Token/scene referenced in the payload does not exist. |
| `token.stale_update` | Request was based on an outdated `version`/`updatedAt`. `context` includes the current state. |
| `token.invalid_update` | Provided `updatedAt` timestamp is invalid. |
| `scene.invalid_grid` | Scene dimensions do not allow the requested operation. |
| `domain.error` | Generic domain error fallback. |

## Events

### `token.create:in`

Client → server. Requires `MASTER` role.

```json
{
  "sceneId": "string",
  "name": "string",
  "xCell": 0,
  "yCell": 0,
  "ownerUserId": "string | null", // optional
  "sprite": "string | null"        // optional
}
```

#### Acknowledgement (`token.create:in`)

On success:

```json
{
  "ok": true,
  "token": { /* Token */ }
}
```

On failure: error envelope.

#### Broadcast (`token.create:out`)

Server → all clients in the room.

```json
{
  "token": { /* Token */ }
}
```

### `token.move:in`

Client → server. Requires `MASTER` or owning `PLAYER` role.

```json
{
  "tokenId": "string",
  "xCell": 0,
  "yCell": 0,
  "version": 3,             // optional concurrency guard
  "updatedAt": "2024-01-01T00:00:00.000Z" // optional concurrency guard
}
```

The server ignores (with an error acknowledgement) updates that reference stale `version` or `updatedAt` values.

Rate limiting: each socket may send up to 20 `token.move:in` messages per second. Exceeding the limit returns `rate_limited`.

#### Acknowledgement (`token.move:in`)

On success:

```json
{
  "ok": true,
  "token": { /* Token */ }
}
```

On failure: error envelope.

#### Broadcast (`token.move:out`)

Server → all clients in the room.

```json
{
  "token": { /* Token */ }
}
```

### Error events

When an acknowledgement callback is omitted, the server sends the `error` event with the same error object as described above. Clients are expected to surface the message unobtrusively (e.g. toast notifications).

## Version handling

Clients should persist the latest `version` and `updatedAt` received for each token and include them when issuing `token.move:in`. If the server detects that the provided values are stale, it returns `token.stale_update` without mutating the state.

Incoming `token.create:out`/`token.move:out` broadcasts should replace local state only when the payload has a higher `version`, or the same `version` but a newer `updatedAt`, to avoid visual desynchronisation.

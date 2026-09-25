# Wire Format & JSON Contracts

FeedbackKit intentionally decouples the public Swift SDK API from the network wire format and the database schema.

---

## Swift API vs. Ingestion Payload

In `Sources/FeedbackKit/Model/FeedbackReport.swift`:
- `FeedbackReport` is the public Swift struct. It uses idiomatic **camelCase** properties (`screenshotRawPNG`, `screenName`, `deviceModel`).
- In `FeedbackSubmitter.swift`, an internal struct `IngestPayload` serializes into **snake_case** for HTTP POST requests.

### Field Mapping

| Swift Property (`FeedbackReport`) | Wire Format (`IngestPayload`) | Postgres Column (`feedback_items`) | Notes |
|---|---|---|---|
| `id` | `client_id` | `client_id` (UUID) | Client-generated UUID for idempotency |
| `timestamp` | `timestamp` | `client_timestamp` (timestamptz) | ISO 8601 string |
| `text` | `text` | `text` (text) | User's feedback description |
| `screenName` | `screen_name` | `screen_name` (text) | Name of screen where report was triggered |
| `screenshotRawPNG` | `screenshot_raw_png` | `screenshot_raw_path` (text) | Base64 PNG over wire; stored as S3 object path |
| `screenshotAnnotatedPNG`| `screenshot_annotated_png`| `screenshot_annotated_path` (text)| Base64 PNG over wire; stored as S3 object path |
| `attachment` | `attachment` | `attachment_path` (text) | Optional log or diagnostic file |
| `annotations` | `annotations` | `annotations` (jsonb) | Preserved as camelCase JSON array |
| `environment` | `environment` | `environment` (jsonb) | Preserved as camelCase JSON object |

---

## The JSONB Boundary: `environment` and `annotations`

Notice that `environment` and `annotations` remain **camelCase** even though the outer payload is snake_case:

```json
{
  "project_key": "pk_...",
  "id": "9B1DE6E8-8B7C-4C9D-9F0A-1B2C3D4E5F6A",
  "created_at": "2026-09-25T12:00:00Z",
  "text": "The checkout button is obscured by the banner.",
  "screenshot_raw_png_base64": "iVBORw0…",
  "screenshot_annotated_png_base64": "iVBORw0…",
  "annotations": [
    {
      "kind": "rectangle",
      "colorHex": "#FF3B30",
      "points": [[0.12, 0.45], [0.88, 0.62]],
      "scale": 1,
      "rotation": 0
    }
  ],
  "environment": {
    "appVersion": "1.2.0",
    "appBuild": "42",
    "bundleIdentifier": "com.example.app",
    "osName": "iOS",
    "osVersion": "18.2",
    "deviceModel": "iPhone17,1",
    "screenName": "Checkout",
    "locale": "en_US",
    "screenWidthPoints": 393,
    "screenHeightPoints": 852,
    "screenScale": 3.0
  }
}
```

Points are `[x, y]` arrays normalized to 0…1 — that's how Swift's `CGPoint`
encodes through `Codable`, and the web SDK emits the same shape.

### Web SDK additions

Reports from the web SDK (`web-sdk/`) use the exact same payload. Every
`environment` field above is always present (the Developer Portal decodes it
with the Swift type), plus optional web-only fields, and a top-level `logs`
array stored in `feedback_items.logs`:

```json
{
  "environment": {
    "osName": "macOS", "osVersion": "15.2", "deviceModel": "Chrome 141",
    "bundleIdentifier": "app.example.com", "screenWidthPoints": 1440,
    "screenHeightPoints": 900, "screenScale": 2,
    "platform": "web",
    "pageUrl": "https://app.example.com/checkout?session=%5Bredacted%5D",
    "userAgent": "Mozilla/5.0 …",
    "browserName": "Chrome",
    "browserVersion": "141.0.7390.54"
  },
  "logs": [
    { "level": "error", "message": "TypeError: …", "timestamp": "2026-09-25T11:59:58.120Z" },
    { "level": "network", "message": "POST https://api.example.com/cart → 500", "timestamp": "2026-09-25T11:59:59.004Z" }
  ]
}
```

### Why?
`environment` and `annotations` are stored directly in PostgreSQL as unstructured `jsonb` columns. Storing them in camelCase ensures that:
1. The web dashboard's TypeScript interfaces (`web/src/lib/types.ts`) can read the JSONB objects directly without a translation layer.
2. The CLI (`cli/src/types.ts`) can deserialize these columns directly into TypeScript types.
3. If new diagnostic fields are added to `EnvironmentInfo` in the Swift SDK, no database migrations are needed.

::: warning Maintenance Rule
When adding a field to `FeedbackReport` or `FeedbackAnnotation`:
1. Update `FeedbackReport.swift` in the Swift SDK.
2. Update `IngestPayload` in `FeedbackSubmitter.swift`.
3. Update `ingest-feedback/index.ts` in the Supabase Edge Function.
4. Update `web/src/lib/types.ts` in the Web dashboard.
5. Update `cli/src/types.ts` in the CLI.
:::

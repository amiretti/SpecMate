# Modelo de datos: `steps.inventory` en `relevamiento.json`

US-14 acepta `steps` como objeto opaco que el build ignora (plan de US-14, decisión 8). US-15 define `steps.inventory`.
El resto del archivo no cambia.

```json
{
  "$schemaVersion": 1,
  "brief": { "...": "sin cambios" },
  "steps": {
    "inventory": {
      "version": 1,
      "summary": { "files": 6, "ignored": 2, "omitted": 1 },
      "missing": ["manual"],
      "entries": [
        {
          "path": "fotos/vidriera.jpg",
          "kind": "photo",
          "detectedKind": "photo",
          "size": 482113,
          "type": "jpeg",
          "width": 2000,
          "height": 1333,
          "sha256": "…",
          "notices": []
        },
        {
          "path": "planilla.xlsx",
          "kind": "prices",
          "detectedKind": "unclassified",
          "correctedBy": "manual",
          "size": 10240,
          "type": "xlsx",
          "sha256": "…",
          "notices": []
        },
        { "path": ".env", "kind": "secret", "detectedKind": "secret", "notices": ["possible-secret-not-read"] },
        { "path": "viejo/logo.png", "kind": "logo", "detectedKind": "logo", "status": "gone", "notices": [] }
      ],
      "omitted": [{ "path": "atajo", "reason": "link" }]
    }
  }
}
```

| Campo | Qué es |
|---|---|
| `path` | Ruta relativa a la carpeta del cliente, con `/`; clave de la entrada |
| `kind` | Clase vigente: `brand-manual`, `logo`, `photo`, `text`, `prices`, `tokens`, `secret`, `unclassified` |
| `detectedKind` | Lo que detectó la última corrida; si `kind` difiere, Harvi la corrigió |
| `correctedBy` | `"manual"` cuando `kind` ≠ `detectedKind`; una corrida nueva nunca pisa esa `kind` |
| `size`, `type`, `sha256` | Metadatos; un `secret` no se lee, así que no tiene `sha256` |
| `width`, `height` | Solo imágenes con cabecera legible |
| `notices` | `low-resolution-cover` (< 1600 px), `low-resolution` (< 800 px), `unreadable`, `too-many-pixels`, `possible-secret-not-read` |
| `status` | Ausente si el archivo está; `"gone"` si estaba en la corrida anterior y ya no |
| `missing` | Clases sin ningún archivo presente (no cuenta `secret` ni `unclassified`) |
| `omitted` | Links y entradas que no se recorrieron, con el motivo |

Nunca se guarda contenido de un archivo (FR-006). Las entradas van ordenadas por `path` y no hay fechas, así que dos
corridas sobre la misma carpeta dan el mismo JSON (SC-002).

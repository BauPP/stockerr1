# inventory-service

## GET /inventory/alerts

Endpoint read-only que deriva alertas activas desde datos de inventario en tiempo de consulta.

### Query params soportados

- `type`: lista separada por comas con `low-stock`, `high-stock`, `expiring-soon`.
- `categoryId`: string opaco opcional para filtrar por categoría.

### Respuesta

Devuelve `{ data, meta }`, donde `meta.generatedAt` indica cuándo se generó la vista y `meta.filters` refleja los filtros normalizados.

### Exclusiones de alcance

- No persiste alertas.
- No dispara notificaciones, jobs ni escrituras.
- `api-gateway` reexpone el contrato equivalente en `GET /api/inventory/alerts` sin lógica adicional.

## Trigger:
Resolver tareas ClickUp por URL o ID.

## Validaciones Previas
- Falla de forma explícita si falta token.
- Requiere CLICKUP_API_TOKEN local.
- No expongas secretos.

## Preferred Commands
- HTTP GET /task/{id}
- HTTP GET /list/{id}/task
- HTTP POST /task

## Límites
- comentarios, estado, assignee y custom fields básicos.
- runtime del producto fuera de alcance.
- Si piden delete, borrar, move, mover, overwrite o sobrescribir, confirma antes.

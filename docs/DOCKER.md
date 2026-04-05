# Guía Docker — STOCKERR Backend MS-01

## Objetivo

Levantar un entorno reproducible para backend usando contenedores:

- API Gateway
- Auth Service (MS-01)
- PostgreSQL

## Servicios definidos

### `api-gateway`
- Puerto host: `3000`
- Dependencia: `auth-service`
- Variable clave: `AUTH_SERVICE_URL=http://auth-service:3002`

### `auth-service`
- Puerto host: `3002`
- Dependencia: `postgres`
- Variables JWT y credenciales demo incluidas en compose para entorno local

### `postgres`
- Imagen: `postgres:16-alpine`
- Puerto host: `5432`
- Volumen persistente: `stockerr_pg_data`

## Comandos

### Construir y levantar

```bash
docker compose up --build
```

### Levantar en background

```bash
docker compose up -d --build
```

### Ver logs

```bash
docker compose logs -f
```

### Detener entorno

```bash
docker compose down
```

### Detener y borrar datos de PostgreSQL

```bash
docker compose down -v
```

## Prueba rápida de integración

1. Login por gateway:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nombre_usuario":"admin","contrasena":"Admin1234"}'
```

2. Copiar el `token` de la respuesta y validar:

```bash
curl http://localhost:3000/api/auth/verify \
  -H "Authorization: Bearer <TOKEN>"
```

## Consideraciones

- `.env` reales no se versionan.
- Para producción, mover secretos a gestor seguro y no dejar credenciales por defecto.
- El servicio auth está preparado para migrar de repositorio en memoria a persistencia completa en siguientes iteraciones.

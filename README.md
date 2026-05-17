# STOCKERR — Monorepo

Sistema de gestión de inventario y stock. Monorepo con API Gateway, microservicios backend y frontend React.

## Estructura del monorepo

```
stockerr1/
├── api-gateway/                  # Punto de entrada único (puerto 3000)
├── frontend/                     # SPA React 19 + Vite
├── services/
│   ├── auth-service/             # MS-01 Autenticación y sesión
│   ├── user-service/             # MS-02 Gestión de usuarios
│   ├── category-service/         # MS-03 Categorías
│   ├── product-service/          # MS-04 Productos y catálogo
│   ├── inventory-service/        # MS-05 Inventario (stock, alertas, movimientos)
│   ├── audit-service/            # MS-09 Auditoría
│   ├── config-service/           # MS-11 Configuración del sistema
│   ├── export-service/           # MS-12 Exportación de datos
│   ├── barcode-service/          # MS-08 Códigos de barras (esqueleto)
│   └── supplier-service/         # MS-10 Proveedores (no implementado)
└── shared/                       # Utilidades compartidas entre servicios
    ├── middlewares/               # verifyJWT (middleware JWT zero-trust)
    └── constants/                 # roles.js (constantes de roles y permisos)
```

## Requisitos

- Node.js 22+
- Docker Desktop (o Docker Engine + Docker Compose) para entorno completo
- Puertos libres: `3000` (gateway), `5433` (PostgreSQL)

## Cómo correr

### Entorno completo con Docker

```bash
docker compose up --build
```

El gateway queda accesible en `http://localhost:3000`. Los microservicios se comunican por red interna Docker (puertos no expuestos al host).

### Desarrollo local (servicios individuales)

Cada servicio se puede ejecutar de forma independiente:

```bash
npm --prefix services/auth-service start
npm --prefix api-gateway start
```

Variables de entorno requeridas (varían por servicio, ver `.env.example` en cada uno).

## Verificar funcionamiento

```bash
# Test básico del gateway
curl http://localhost:3000/

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo":"admin","contrasena":"Admin1234"}'
```

### Tests automatizados

```bash
# Todos los tests del monorepo
npm run verify:all

# Tests por servicio
npm run verify:gateway      # solo api-gateway
npm run verify:ms02         # solo user-service
npm run verify:ms04         # solo product-service
npm run verify:ms05         # solo inventory-service
```

**Cobertura actual de `verify:all`:**

| Servicio | Tests | Estado |
|----------|-------|--------|
| auth-service | Unit + Integración | ✅ |
| user-service | Integración | ✅ |
| category-service | Integración | ✅ |
| product-service | Unit + Integración | ✅ |
| inventory-service | Integración | ✅ |
| audit-service | Unit | ✅ |
| export-service | Unit | ✅ |
| barcode-service | — | 🟡 Sin tests aún |
| config-service | Integración | ✅ |
| api-gateway | Integración | ✅ |
| frontend | Vitest (React Testing Library) | ✅ |

## Limitaciones conocidas

- **supplier-service (MS-10)**: No implementado. El gateway responde `501 Not Implemented` en `/api/suppliers`.
- **barcode-service (MS-08)**: Esqueleto sin rutas ni lógica de negocio.
- **PostgreSQL**: Solo se ejecuta en Docker. Los tests usan repositorios en memoria.
- **Frontend**: Los tests de frontend requieren jsdom (configurado en vitest).
- **verify:all**: Ejecuta los tests en serie. Servicios sin tests (barcode-service) emiten un aviso `baseline temporal`.

## Documentación técnica

- `docs/Backend_Entregable_MS01.md`
- `docs/QA_Guia_Verificacion_MS01_Gateway.md`
- `docs/Frontend_Integracion_MS01_Gateway.md`

## Apagar contenedores

```bash
docker compose down
docker compose down -v   # elimina también el volumen de base de datos
```

# Reporte de Inspeccion Tecnica — Stockerr

**Proyecto:** INVENTARIO STOCKERR  
**Fecha:** 2026-05-08  
**Objetivo:** dejar un panorama claro de bugs, inconsistencias, riesgos y prioridades reales de correccion para el equipo.

---

## Resumen ejecutivo

Se realizo una inspeccion tecnica del proyecto completo revisando:

- microservicios
- `api-gateway`
- frontend
- `docker-compose.yml`
- SQL de inicializacion
- PRs y ramas activas
- cobertura y scripts de prueba disponibles

### Resultado general

El proyecto **no esta roto**, pero tiene varios puntos donde la arquitectura declarada y el comportamiento real **no coinciden**.

Los hallazgos mas importantes no son solo “tests fallando”, sino:

- riesgos de seguridad por acceso directo a microservicios
- contratos HTTP inconsistentes
- bugs funcionales concretos en catálogos paginados
- cobertura que da falsa sensacion de seguridad
- documentacion y PRs que pueden inducir decisiones equivocadas

### Prioridad global

- **P0:** 1 issue
- **P1:** 3 issues
- **P2:** 3 issues
- **P3:** 2 issues

---

## Lectura rapida

Si el equipo necesita actuar YA, el orden recomendado es este:

1. **Cerrar bypass de auth/roles fuera del gateway**
2. **Resolver contrato y permisos de MS-11**
3. **Corregir el bug del selector de productos truncado a 20**
4. **Alinear login/documentacion con PostgreSQL real**
5. **Fortalecer verificaciones reales con PostgreSQL/compose**

---

## Hallazgos priorizados

## P0 — Bloqueante

### 1. Bypass real de autenticacion y roles fuera del gateway

**Que pasa**

El proyecto declara una arquitectura centralizada por `api-gateway`, pero varios microservicios quedan expuestos directamente al host y atienden rutas sin auth propia.

**Evidencia**

- `docker-compose.yml` publica puertos de microservicios al host.
- Servicios sin auth propia en app/rutas:
  - `services/user-service/src/app.js`
  - `services/product-service/src/app.js`
  - `services/category-service/src/app.js`
  - `services/barcode-service/src/app.js`
  - `services/config-service/src/app.js`
- El gateway promete validacion downstream, pero no es uniforme.

**Impacto**

- un cliente con acceso al host puede saltearse permisos del gateway
- se rompe la frontera de seguridad declarada
- CRUDs y configuracion quedan expuestos de forma inconsistente

**Correccion recomendada**

- no publicar puertos internos al host salvo los estrictamente necesarios
- y/o validar JWT y roles tambien dentro de cada microservicio sensible
- documentar una regla unica: **ningun endpoint sensible confia solo en el gateway**

---

## P1 — Alto impacto

### 2. Bug funcional: el selector de productos queda truncado a 20

**Que pasa**

Hay pantallas que intentan cargar “todos” los productos con `size=100`, pero `product-service` limita el maximo a `20`.

**Evidencia**

- `frontend/src/api/inventory.js`
- `frontend/src/pages/Inventory/Inventory.jsx`
- `services/product-service/src/models/product.model.js`
- mismo riesgo tambien aparece en el PR de MS-07 (`frontend/src/api/reports.js`)

**Impacto**

- formularios y filtros quedan incompletos cuando hay mas de 20 productos
- el usuario puede creer que faltan productos o que hubo perdida de datos

**Correccion recomendada**

- no subir el limite “porque si”
- crear endpoint de opciones liviano para selectores (`/api/products/options`)
- o paginar/buscar correctamente desde frontend

---

### 3. Drift de permisos y contrato en MS-11

**Que pasa**

MS-11 quedo con una verdad partida entre permisos, documentacion y contrato HTTP.

**Evidencia**

- `shared/constants/roles.js` sugiere que Operador no accede a configuracion
- `api-gateway/src/routes/config.routes.js` permite lectura a Operador
- `docs/Backend_Entregable_MS08_MS11_Integracion.md` replica esa politica
- implementacion actual usa `PUT /api/config/:key`
- la spec/tareas venian mas cerca de `PUT /api/config`

**Impacto**

- frontend, QA y backend pueden trabajar con supuestos distintos
- se generan bugs de integracion y expectativas rotas

**Correccion recomendada**

- decidir una politica de permisos FINAL para MS-11
- decidir un contrato FINAL de escritura
- alinear:
  - codigo
  - tests
  - spec
  - docs

---

### 4. Login y documentacion no reflejan bien PostgreSQL real

**Que pasa**

La app parece aceptar login por `correo` o `nombre_usuario`, pero el repositorio PostgreSQL real resuelve solo por correo.

**Evidencia**

- `services/auth-service/src/models/auth.model.js`
- `services/auth-service/src/repositories/pg.auth.repository.js`
- `README.md`
- `docker/postgres/init/01_backup_stockerrbd.sql`

**Impacto**

- la documentacion puede guiar a un flujo que falla en entorno real
- los tests pueden dar una sensacion falsa de compatibilidad

**Correccion recomendada**

- elegir una identidad unica de login
- si es correo, limpiar compatibilidad engañosa
- si quieren `nombre_usuario`, persistirlo y soportarlo en PostgreSQL de verdad

---

## P2 — Importante pero no bloqueante inmediato

### 5. Cobertura verde, pero confianza tecnica engañosa

**Que pasa**

La suite pasa, pero gran parte de la evidencia usa repositorios in-memory o mocks, no el camino productivo real con PostgreSQL + compose.

**Evidencia**

- `package.json` con `verify:all` sin incluir todo el sistema nuevo
- tests integration de varios servicios usando repositorios in-memory
- frontend sin script de test consistente dentro del flujo raiz

**Impacto**

- “todo esta OK” puede significar solo que los mocks estan OK
- se escapan errores de SQL, networking o contratos reales

**Correccion recomendada**

- separar claramente:
  - unit/in-memory
  - contract/proxy
  - smoke real con PostgreSQL
- ampliar `verify:all`

---

### 6. Status codes inconsistentes en el gateway

**Que pasa**

Algunos modulos responden `502` ante upstream caido, otros terminan en `500` por el handler global.

**Evidencia**

- `api-gateway/src/routes/barcode.routes.js`
- `api-gateway/src/routes/config.routes.js`
- `api-gateway/src/routes/inventory.routes.js`
- `api-gateway/src/routes/user.routes.js`
- `api-gateway/src/routes/category.routes.js`
- `api-gateway/src/routes/product.routes.js`
- `api-gateway/src/routes/auth.routes.js`
- `api-gateway/src/app.js`

**Impacto**

- misma falla tecnica, distinto contrato observable
- dificulta frontend, debugging y monitoreo

**Correccion recomendada**

- unificar politica de errores de proxy:
  - upstream down → `502`
  - timeout → `504`
  - status del upstream → propagarlo

---

### 7. PRs grandes y sin checks visibles

**Que pasa**

Hay PRs abiertos con mucho volumen y sin señal automatica fuerte de validacion.

**Evidencia**

- PR `#24` sin checks reportados y con diff muy grande
- PR `#28` sin checks reportados

**Impacto**

- riesgo alto de merge por confianza subjetiva
- review cansada y poco profunda

**Correccion recomendada**

- exigir checks minimos antes de review/merge
- partir PRs grandes en slices revisables
- no usar resultados manuales como reemplazo de CI del repo completo

---

## P3 — Mejora y claridad

### 8. README raiz desactualizado

**Que pasa**

La raiz todavia presenta el repo como backend MS-01, cuando hoy ya es un sistema mucho mas amplio.

**Evidencia**

- `README.md`

**Impacto**

- onboarding engañoso
- expectativas incorrectas del alcance real del repo

**Correccion recomendada**

- reescribir README como mapa real del monorepo

---

### 9. Placeholder de suppliers expuesto sin servicio real

**Que pasa**

El gateway expone `/api/suppliers`, pero no existe `supplier-service` en compose para ese flujo.

**Evidencia**

- `api-gateway/src/app.js`
- `api-gateway/src/routes/supplier.routes.js`
- `api-gateway/src/config/services.js`
- `docker-compose.yml`

**Impacto**

- QA o frontend pueden asumir que MS-10 existe cuando no existe

**Correccion recomendada**

- responder `501 Not Implemented` de forma explicita
- o esconderlo detras de feature flag

---

## Patrones sistemicos detectados

No son bugs aislados. Hay patrones que se repiten:

### 1. Arquitectura declarada vs arquitectura real

Se dice que todo pasa por gateway, pero no siempre se cumple en runtime.

### 2. Contratos sin fuente unica de verdad

Specs, docs, tests y codigo no siempre evolucionan juntos.

### 3. Mucha confianza en tests in-memory

Eso ayuda para velocidad, pero no cubre suficientes riesgos de integracion real.

### 4. PRs mas grandes de lo razonable

El tamaño actual castiga la calidad de la revision.

---

## Plan de correccion por fases

## Fase 1 — Riesgos que no deberian seguir abiertos

### Objetivo
cerrar huecos de seguridad y coherencia contractual

### Acciones

1. bloquear acceso directo a microservicios sensibles
2. definir politica final de auth downstream
3. resolver permisos y contrato de MS-11
4. resolver identidad real de login (`correo` vs `nombre_usuario`)

### Resultado esperado

- la arquitectura de seguridad vuelve a ser coherente
- el equipo deja de trabajar con supuestos contradictorios

---

## Fase 2 — Bugs funcionales visibles

### Objetivo
corregir problemas que el usuario puede sentir directamente

### Acciones

1. arreglar catalogos de productos para selectores
2. revisar PR #24 con ese mismo criterio en reportes
3. unificar status codes del gateway
4. marcar suppliers como `501` o esconderlo

### Resultado esperado

- formularios y filtros confiables
- respuestas HTTP consistentes

---

## Fase 3 — Confianza tecnica real

### Objetivo
dejar de depender solo de mocks y validaciones parciales

### Acciones

1. ampliar `verify:all`
2. agregar smoke tests reales con PostgreSQL + compose
3. definir checks minimos obligatorios para PRs
4. reducir PRs oversized

### Resultado esperado

- menos merges “a ciegas”
- mejor señal automatica para el equipo

---

## Recomendacion final para el equipo

Si quieren corregir con criterio, no arranquen por “pulir docs” ni por “sumar mas tests porque si”.

El orden correcto es:

1. **seguridad y fronteras**
2. **contratos y permisos**
3. **bugs funcionales visibles**
4. **confianza tecnica del pipeline**
5. **documentacion y claridad final**

Porque si no arreglan primero las bases, van a documentar y testear inconsistencias.

---

## Estado del reporte

Este documento sirve como base para:

- dividir trabajo en ClickUp
- abrir issues tecnicos
- planificar una fase de hardening del proyecto
- justificar por que algunos PRs no deberian mergearse aun

Si el equipo quiere, el siguiente paso natural es convertir esto en:

- **tickets accionables por modulo**, o
- **una matriz de correccion con responsable, prioridad y criterio de cierre**.

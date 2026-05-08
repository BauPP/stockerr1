# Propuesta: Sistema de Variantes para Inventario

**Proyecto:** INVENTARIO STOCKERR  
**Autor:** Juan Nicolás Urrutia Salcedo  
**Fecha:** 2026-05-08  
**Estado:** Propuesta para revisión del líder de proyecto

---

## Resumen ejecutivo

Actualmente el inventario trata cada producto como una entidad plana. Si una tienda vende **"Camiseta básica"** en **3 tallas** y **4 colores**, tiene que registrar **12 productos separados**, sin relación entre ellos. Esto es manual, repetitivo, propenso a errores y no escala.

Esta propuesta plantea agregar **variantes inteligentes** al sistema: un producto puede tener atributos configurables (color, talla, tipo, material, etc.) y el sistema genera, gestiona y clasifica el stock por variante de forma automática.

---

## Problema real que resuelve

### Situación actual
- Un producto con variantes se registra como N productos independientes
- No hay forma de saber que "Camiseta básica - Roja - M" y "Camiseta básica - Azul - L" son el mismo producto
- Modificar el precio o nombre del producto base requiere editar N registros
- Los reportes no agrupan por producto base, solo por variante individual
- El stock total de un producto (suma de todas sus variantes) no se ve en ningún lado

### Ejemplo concreto
Una tienda de ropa tiene:
- **5 modelos** de camiseta
- Cada modelo en **4 tallas** (S, M, L, XL)
- Cada modelo en **3 colores** (negro, blanco, azul)

**Sin variantes:** 5 × 4 × 3 = **60 productos** que gestionar individualmente.  
**Con variantes:** **5 productos base** con atributos, el sistema maneja el resto.

---

## Qué propongo

Agregar al inventario un sistema de **variantes de producto** con tres pilares:

### 1. Producto base + definición de atributos
Cada producto puede definir qué atributos lo varían:
- **Color** (rojo, azul, negro, blanco, verde)
- **Talla** (XS, S, M, L, XL, XXL)
- **Tipo** (estándar, premium, económico)
- **Material** (algodón, poliéster, cuero)
- **Tamaño** (chico, mediano, grande — para productos no-ropa)
- **Personalizado** (cualquier atributo que el negocio necesite)

Los atributos son **definidos por el usuario**, no vienen pre-cargados. Cada negocio decide qué le sirve.

### 2. Generación automática de combinaciones
El sistema genera automáticamente las combinaciones de variantes:
- El usuario selecciona un producto base
- Elige los atributos que aplican (ej: "Color" y "Talla")
- Define los valores (ej: Color = [Rojo, Azul], Talla = [S, M, L])
- El sistema crea **2 × 3 = 6 variantes** con su propio stock, código de barras y precio individual

Cada variante puede tener:
- **Stock individual**
- **Precio de venta** (puede diferir del base — ej: talla XL cuesta más)
- **Código de barras propio** (generado automáticamente o manual)
- **Estado** (activo / inactivo)

### 3. Vista unificada y reportes inteligentes
- **Vista de producto**: muestra el producto base, sus atributos y una tabla con todas las variantes y su stock
- **Stock total del producto**: suma automática de todas las variantes activas
- **Filtros en reportes**: poder filtrar por producto base y ver el desglose por variante
- **Alertas de stock**: si una variante específica está baja, se alerta, pero también se puede ver el stock total del producto

---

## Cómo se vería en la práctica

### Flujo del usuario
1. Crea un producto: **"Camiseta básica"**
2. Define atributos: **Color** (Rojo, Azul, Negro) y **Talla** (S, M, L)
3. El sistema genera automáticamente **9 variantes**
4. El usuario ajusta stock inicial, precios y códigos de barras por variante
5. En inventario, movimientos de stock se registran **por variante**
6. En reportes, el producto aparece agrupado con total y desglose

### Ejemplo visual de lo que vería el usuario

```
Producto: Camiseta básica
Atributos: Color, Talla
Stock total: 45 unidades

┌────────┬───────┬───────┬──────────────┬──────────────┐
│ Variante       │ Color │ Talla │ Stock │ Precio       │
├────────┬───────┬───────┬──────────────┬──────────────┤
│ CAM-BAS-001    │ Rojo  │ S     │ 5     │ $25.000      │
│ CAM-BAS-002    │ Rojo  │ M     │ 8     │ $25.000      │
│ CAM-BAS-003    │ Rojo  │ L     │ 3     │ $25.000      │
│ CAM-BAS-004    │ Azul  │ S     │ 6     │ $25.000      │
│ ...            │ ...   │ ...   │ ...   │ ...          │
└────────┴───────┴───────┴──────────────┴──────────────┘
```

---

## Impacto técnico

### Qué cambia en la base de datos
- Nueva tabla `atributos_producto`: define los atributos configurables
- Nueva tabla `valores_atributo`: valores posibles por atributo
- Nueva tabla `variantes_producto`: relaciona producto base con combinación de atributos
- La tabla `productos` actual **no se rompe**: los productos sin variantes siguen funcionando igual
- Las variantes son esencialmente productos hijos con FK al producto padre

### Qué cambia en el backend
- **Nuevo microservicio** o extensión de `product-service`: `variant-service`
- Endpoints para CRUD de atributos, valores y variantes
- El catálogo de opciones (`/api/products/options`) debe mostrar solo productos base, no variantes
- Los reportes deben poder agrupar por producto base
- Las alertas de stock deben considerar variantes individuales

### Qué cambia en el frontend
- Formulario de producto con sección de atributos
- Vista de detalle de producto con tabla de variantes
- Formularios de inventario que permitan seleccionar producto base → variante
- Reportes con opción de agrupar/desglosar por variante

---

## Estimación de esfuerzo

| Fase | Qué incluye | Esfuerzo estimado |
|------|-------------|-------------------|
| **Fase 1 — Fundación** | Tablas SQL, migración, modelo de atributos y variantes en backend | 2-3 días |
| **Fase 2 — CRUD backend** | Endpoints de atributos, valores, variantes. Integración con MS-04 y MS-08 (códigos de barras) | 3-4 días |
| **Fase 3 — Frontend base** | UI de creación de producto con variantes, vista de detalle | 3-4 días |
| **Fase 4 — Inventario y reportes** | Adaptar movimientos de stock a variantes, reportes agrupados | 2-3 días |
| **Fase 5 — Pulido y QA** | Pruebas integrales, documentación, ajustes de UX | 2 días |
| **Total** | | **12-16 días** |

---

## Riesgos y consideraciones

### Riesgos
- **Complejidad de UI**: la interfaz de gestión de variantes puede volverse confusa si no se diseña bien
- **Performance**: si un producto tiene muchas variantes (ej: 5 colores × 5 tallas × 3 tipos = 75), las consultas deben ser eficientes
- **Migración**: productos existentes sin variantes deben seguir funcionando sin cambios

### Mitigaciones
- Empezar con un **MVP acotado**: solo 2 atributos por producto, máximo 20 variantes
- La UI se diseña con el patrón de "producto base + tabla de variantes", que es familiar para el usuario
- Los productos legacy quedan como "producto sin variantes", sin migración forzada

---

## Por qué esto suma al proyecto

1. **Diferenciación real**: muy pocos sistemas de inventario para tiendas de barrio manejan variantes
2. **Escala**: una tienda con 50 productos base y 4 variantes cada uno gestiona 200 SKU sin esfuerzo manual
3. **Datos más ricos**: stock por color, ventas por talla, permite decisiones de compra más informadas
4. **Código de barras inteligente**: cada variante puede tener su propio código generado automáticamente (MS-08 ya implementado)
5. **No rompe nada**: compatible 100% con productos sin variantes

---

## Próximo paso recomendado

Si el líder aprueba la dirección, el siguiente paso es:
1. **Definir alcance exacto del MVP** (cuántos atributos, cuántas variantes máximo)
2. **Crear mockups de UI** para validar con el equipo
3. **Iniciar SDD formal** con propuesta, specs y diseño técnico

---

## Preguntas para el líder

- ¿Cuántos atributos por producto les parece razonable para el MVP?
- ¿Prefieren que las variantes tengan código de barras automático (MS-08) o manual?
- ¿El precio de la variante debería poder diferir del producto base? (ej: talla XL +$2.000)
- ¿Quieren que el stock mínimo se configure por variante o solo por producto base?

---

*Esta propuesta queda abierta para discusión y ajustes según las prioridades del proyecto.*

-- =============================================================
-- MS-08 / MS-10 / MS-11 | Script 04: Configuración del sistema
-- Variables globales, configuracion_sistema y validación FK
-- Base de datos: stockerr
-- Rama: feature/MS-08-MS-10-MS-11-devops
-- =============================================================

-- -------------------------------------------------------
-- OBJETIVO 4: Ampliar parametros_sistema (MS-11)
-- Ya existe la tabla, solo agregamos parámetros faltantes
-- -------------------------------------------------------
INSERT INTO public.parametros_sistema (clave, valor) VALUES
  -- Configuración de stock
  ('stock_minimo_global',              '5'),
  ('stock_maximo_global',              '500'),
  ('stock_critico_porcentaje',         '50'),
  ('dias_alerta_vencimiento',          '30'),
  -- Configuración de exportaciones (MS-07/MS-12)
  ('formato_exportacion_default',      'PDF'),
  ('max_registros_exportacion',        '10000'),
  ('ruta_exportaciones_temp',          '/exports/temp'),
  ('ruta_exportaciones_reportes',      '/exports/reportes'),
  -- Configuración de auditoría (MS-09)
  ('dias_retencion_auditoria',         '365'),
  ('nivel_auditoria',                  'COMPLETO'),
  -- Configuración de proveedores (MS-08)
  ('max_proveedores_activos',          '100'),
  ('dias_evaluacion_proveedor',        '90'),
  ('calificacion_minima_proveedor',    '3'),
  -- Configuración de sistema
  ('nombre_tienda',                    'Stockerr Demo'),
  ('moneda',                           'COP'),
  ('zona_horaria',                     'America/Bogota'),
  ('version_sistema',                  '1.0.0'),
  ('modo_mantenimiento',               'false'),
  ('max_sesiones_simultaneas',         '5')
ON CONFLICT (clave) DO NOTHING;

-- -------------------------------------------------------
-- OBJETIVO 2: Datos iniciales configuracion_sistema (MS-10)
-- La tabla ya existe en el schema con 1 registro demo
-- -------------------------------------------------------
INSERT INTO public.configuracion_sistema
  (nombre_tienda, moneda, stock_minimo_default, stock_maximo_default, prefijo_codigo_barras)
VALUES
  ('Stockerr - Tienda Principal', 'COP', 5, 500, 'STK')
ON CONFLICT (nombre_tienda) DO NOTHING;

-- -------------------------------------------------------
-- OBJETIVO 5: Validar relaciones FK proveedores → movimientos
-- Verificar integridad referencial con consulta de prueba
-- -------------------------------------------------------

-- Verificar que la FK existe y está activa
SELECT
    tc.table_name        AS tabla,
    kcu.column_name      AS columna,
    ccu.table_name       AS tabla_referenciada,
    ccu.column_name      AS columna_referenciada,
    rc.update_rule       AS on_update,
    rc.delete_rule       AS on_delete
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND (tc.table_name = 'movimientos_inventario'
       OR ccu.table_name = 'proveedores')
ORDER BY tc.table_name, kcu.column_name;

-- -------------------------------------------------------
-- OBJETIVO 5: Índices para optimizar relación
-- proveedores ↔ movimientos_inventario
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_movimientos_proveedor_fecha
    ON public.movimientos_inventario (id_proveedor, fecha_hora_exacta DESC)
    WHERE id_proveedor IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proveedores_activos_nit
    ON public.proveedores (nit_identificacion, estado)
    WHERE estado = true;

-- Índice para búsqueda por nombre en supplier-service
CREATE INDEX IF NOT EXISTS idx_proveedores_nombre_lower
    ON public.proveedores (LOWER(razon_social));

-- -------------------------------------------------------
-- VERIFICACIÓN FINAL
-- -------------------------------------------------------
SELECT 'parametros_sistema'      AS tabla, COUNT(*) AS registros FROM public.parametros_sistema
UNION ALL SELECT 'configuracion_sistema', COUNT(*) FROM public.configuracion_sistema
UNION ALL SELECT 'proveedores activos',   COUNT(*) FROM public.proveedores WHERE estado = true
UNION ALL SELECT 'indices proveedores',
    COUNT(*) FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'proveedores';

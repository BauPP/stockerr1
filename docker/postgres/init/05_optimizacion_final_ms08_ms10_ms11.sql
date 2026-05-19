-- =============================================================
-- MS-08 / MS-10 / MS-11 | Script 05: Optimización final
-- Alertas de stock, trigger, índices y datos históricos
-- Base de datos: stockerr
-- Rama: feature/MS-08-MS-10-MS-11-devops
-- =============================================================

-- -------------------------------------------------------
-- OBJETIVO 6: Tabla alertas_stock (MS-06)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alertas_stock (
    id_alerta        INTEGER NOT NULL,
    id_producto      INTEGER NOT NULL,
    tipo_alerta      CHARACTER VARYING(20) NOT NULL,
    stock_actual     INTEGER NOT NULL,
    stock_minimo     INTEGER,
    stock_maximo     INTEGER,
    mensaje          TEXT NOT NULL,
    resuelta         BOOLEAN DEFAULT false,
    fecha_alerta     TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_resolucion TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT alertas_stock_pkey PRIMARY KEY (id_alerta),
    CONSTRAINT alertas_stock_tipo_check CHECK (
        tipo_alerta IN ('STOCK_BAJO', 'STOCK_CRITICO', 'STOCK_ALTO', 'SIN_STOCK')
    ),
    CONSTRAINT alertas_stock_id_producto_fkey
        FOREIGN KEY (id_producto) REFERENCES public.productos(id_producto)
);

CREATE SEQUENCE IF NOT EXISTS public.alertas_stock_id_alerta_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER TABLE public.alertas_stock
    ALTER COLUMN id_alerta SET DEFAULT nextval('public.alertas_stock_id_alerta_seq'::regclass);

ALTER SEQUENCE public.alertas_stock_id_alerta_seq OWNED BY public.alertas_stock.id_alerta;

-- -------------------------------------------------------
-- Trigger de generación automática de alertas
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generar_alerta_stock()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_stock_actual  INTEGER;
    v_stock_minimo  INTEGER;
    v_stock_maximo  INTEGER;
    v_nombre        CHARACTER VARYING(150);
    v_tipo_alerta   CHARACTER VARYING(20);
    v_mensaje       TEXT;
BEGIN
    SELECT stock_actual, stock_minimo, stock_maximo, nombre
    INTO v_stock_actual, v_stock_minimo, v_stock_maximo, v_nombre
    FROM public.productos WHERE id_producto = NEW.id_producto;

    IF v_stock_actual = 0 THEN
        v_tipo_alerta := 'SIN_STOCK';
        v_mensaje := format('SIN STOCK: El producto "%s" (ID: %s) tiene 0 unidades.', v_nombre, NEW.id_producto);
    ELSIF v_stock_minimo IS NOT NULL AND v_stock_actual <= ROUND(v_stock_minimo * 0.5) THEN
        v_tipo_alerta := 'STOCK_CRITICO';
        v_mensaje := format('STOCK CRITICO: El producto "%s" (ID: %s) tiene %s unidades (50%% del minimo %s).', v_nombre, NEW.id_producto, v_stock_actual, v_stock_minimo);
    ELSIF v_stock_minimo IS NOT NULL AND v_stock_actual <= v_stock_minimo THEN
        v_tipo_alerta := 'STOCK_BAJO';
        v_mensaje := format('STOCK BAJO: El producto "%s" (ID: %s) tiene %s unidades (minimo: %s).', v_nombre, NEW.id_producto, v_stock_actual, v_stock_minimo);
    ELSIF v_stock_maximo IS NOT NULL AND v_stock_actual >= v_stock_maximo THEN
        v_tipo_alerta := 'STOCK_ALTO';
        v_mensaje := format('STOCK ALTO: El producto "%s" (ID: %s) tiene %s unidades (maximo: %s).', v_nombre, NEW.id_producto, v_stock_actual, v_stock_maximo);
    ELSE
        RETURN NEW;
    END IF;

    INSERT INTO public.alertas_stock (id_producto, tipo_alerta, stock_actual, stock_minimo, stock_maximo, mensaje, resuelta, fecha_alerta)
    SELECT NEW.id_producto, v_tipo_alerta, v_stock_actual, v_stock_minimo, v_stock_maximo, v_mensaje, false, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (
        SELECT 1 FROM public.alertas_stock
        WHERE id_producto = NEW.id_producto AND tipo_alerta = v_tipo_alerta AND resuelta = false
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generar_alerta_stock ON public.movimientos_inventario;
CREATE TRIGGER trigger_generar_alerta_stock
    AFTER INSERT ON public.movimientos_inventario
    FOR EACH ROW EXECUTE FUNCTION public.generar_alerta_stock();

-- -------------------------------------------------------
-- OBJETIVO 6: Índices completos de integración
-- -------------------------------------------------------

-- Alertas
CREATE INDEX IF NOT EXISTS idx_alertas_producto    ON public.alertas_stock (id_producto);
CREATE INDEX IF NOT EXISTS idx_alertas_tipo        ON public.alertas_stock (tipo_alerta);
CREATE INDEX IF NOT EXISTS idx_alertas_resuelta    ON public.alertas_stock (resuelta, fecha_alerta DESC);

-- Movimientos
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha_producto
    ON public.movimientos_inventario (fecha_hora_exacta DESC, id_producto);
CREATE INDEX IF NOT EXISTS idx_movimientos_usuario_fecha
    ON public.movimientos_inventario (id_usuario, fecha_hora_exacta DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_proveedor
    ON public.movimientos_inventario (id_proveedor) WHERE id_proveedor IS NOT NULL;

-- Productos
CREATE INDEX IF NOT EXISTS idx_productos_categoria_estado
    ON public.productos (id_categoria, estado);
CREATE INDEX IF NOT EXISTS idx_productos_stock_estado
    ON public.productos (stock_actual, stock_minimo, stock_maximo) WHERE estado = true;

-- Exportaciones
CREATE INDEX IF NOT EXISTS idx_exportaciones_usuario_fecha
    ON public.exportaciones_reportes (usuario_generador, fecha_generacion DESC);
CREATE INDEX IF NOT EXISTS idx_exportaciones_tipo
    ON public.exportaciones_reportes (tipo_reporte, fecha_generacion DESC);
CREATE INDEX IF NOT EXISTS idx_exportaciones_fecha_brin
    ON public.exportaciones_reportes USING BRIN (fecha_generacion);

-- Auditoría
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha_brin
    ON public.auditoria_operaciones USING BRIN (fecha_hora);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad
    ON public.auditoria_operaciones (entidad_afectada, id_entidad_afectada);

-- -------------------------------------------------------
-- OBJETIVO 3: Datos históricos para pruebas de integración
-- -------------------------------------------------------

-- Exportaciones de prueba
INSERT INTO public.exportaciones_reportes (tipo_reporte, formato, fecha_generacion, usuario_generador, ruta_archivo)
SELECT v.tipo, v.formato, v.fecha::timestamp, u.id_usuario, v.ruta
FROM (VALUES
    ('Reporte Movimientos Abril 2026',  'PDF',   '2026-04-30 08:00:00', '/exports/reportes/movimientos_abril.pdf'),
    ('Reporte Ventas Abril 2026',       'EXCEL', '2026-04-30 08:30:00', '/exports/reportes/ventas_abril.xlsx'),
    ('Inventario Actual',               'PDF',   '2026-05-01 09:00:00', '/exports/reportes/inventario_mayo.pdf'),
    ('Reporte Proveedores Activos',     'EXCEL', '2026-05-01 09:30:00', '/exports/reportes/proveedores.xlsx'),
    ('Stock Critico Mayo 2026',         'PDF',   '2026-05-05 10:00:00', '/exports/reportes/stock_critico.pdf'),
    ('Reporte Integracion MS-08',       'EXCEL', '2026-05-12 11:00:00', '/exports/reportes/integracion_ms08.xlsx')
) AS v(tipo, formato, fecha, ruta)
JOIN public.usuarios u ON u.correo = 'admin@stockerr.com';

-- Acciones de auditoría
INSERT INTO public.acciones_auditoria (nombre_accion)
VALUES ('login'), ('logout'), ('crear'), ('actualizar'), ('eliminar'), ('consultar'), ('exportar')
ON CONFLICT (nombre_accion) DO NOTHING;

-- -------------------------------------------------------
-- VERIFICACIÓN FINAL DE INTEGRACIÓN
-- -------------------------------------------------------
SELECT
    'alertas_stock (tabla)'           AS objeto, 'OK' AS estado
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alertas_stock')
UNION ALL SELECT
    'trigger_generar_alerta_stock',   'OK'
WHERE EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_generar_alerta_stock')
UNION ALL SELECT
    'parametros_sistema',             CAST(COUNT(*) AS text) || ' registros'
FROM public.parametros_sistema
UNION ALL SELECT
    'proveedores activos',            CAST(COUNT(*) AS text) || ' registros'
FROM public.proveedores WHERE estado = true
UNION ALL SELECT
    'exportaciones_reportes',         CAST(COUNT(*) AS text) || ' registros'
FROM public.exportaciones_reportes
UNION ALL SELECT
    'indices creados',                CAST(COUNT(*) AS text) || ' indices'
FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';

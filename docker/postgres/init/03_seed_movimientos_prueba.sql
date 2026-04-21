-- =============================================================
-- MS-05 | Datos de prueba para movimientos de inventario
-- Requiere: 02_seed_categorias_productos.sql ejecutado antes
-- =============================================================

-- -------------------------------------------------------
-- OBJETIVO 4: Verificar que existan motivos de movimiento
-- (ya incluidos en el backup, pero se insertan si faltan)
-- -------------------------------------------------------
INSERT INTO public.motivos_movimiento (nombre_motivo, tipo_operacion)
VALUES
  ('Compra / Reposición',   'ENTRADA'),
  ('Devolución proveedor',  'ENTRADA'),
  ('Venta',                 'SALIDA'),
  ('Dañado',                'SALIDA'),
  ('Vencido',               'SALIDA'),
  ('Merma',                 'SALIDA'),
  ('Ajuste sobrante',       'AJUSTE'),
  ('Ajuste faltante',       'AJUSTE'),
  ('Robo',                  'AJUSTE'),
  ('Rotura',                'AJUSTE'),
  ('Caducidad',             'AJUSTE')
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------
-- Verificación de motivos disponibles para pruebas
-- -------------------------------------------------------
SELECT
  id_motivo,
  nombre_motivo,
  tipo_operacion
FROM public.motivos_movimiento
ORDER BY tipo_operacion, id_motivo;

-- -------------------------------------------------------
-- Resumen de productos listos para movimientos
-- -------------------------------------------------------
SELECT
  p.id_producto,
  p.codigo_barras_unico  AS barcode,
  p.nombre,
  c.nombre_categoria     AS categoria,
  p.stock_actual,
  p.stock_minimo,
  p.precio_venta
FROM public.productos p
JOIN public.categorias c ON c.id_categoria = p.id_categoria
ORDER BY c.nombre_categoria, p.nombre;

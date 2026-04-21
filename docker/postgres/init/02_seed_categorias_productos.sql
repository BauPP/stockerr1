-- =============================================================
-- MS-04 / MS-05 | Seed: Categorías, Productos y datos de prueba
-- Base de datos: stockerr
-- Fecha: 2026-04-21
-- =============================================================

-- -------------------------------------------------------
-- OBJETIVO 2: Insertar categorías válidas
-- -------------------------------------------------------
INSERT INTO public.categorias (nombre_categoria, descripcion, estado)
VALUES
  ('Alimentos',         'Productos alimenticios no perecederos y perecederos', true),
  ('Bebidas',           'Bebidas gaseosas, jugos, agua y energizantes',         true),
  ('Lácteos',           'Leche, quesos, yogures y derivados',                   true),
  ('Aseo Personal',     'Shampoo, jabón, desodorante y cuidado personal',       true),
  ('Limpieza Hogar',    'Detergentes, desinfectantes y productos de limpieza',   true),
  ('Snacks',            'Mecato, galletas, dulces y pasabocas',                 true),
  ('Panadería',         'Pan, tortas, galletas artesanales',                    true),
  ('Carnes y Embutidos','Carnes frías, chorizos, salchichas',                   false)
ON CONFLICT (nombre_categoria) DO NOTHING;

-- -------------------------------------------------------
-- OBJETIVO 3 & 1: Los productos usan id_categoria (FK)
-- Los id_categoria se obtienen dinámicamente con subquery
-- para evitar problemas si la secuencia arrancó diferente.
-- -------------------------------------------------------

-- -------------------------------------------------------
-- OBJETIVO 2: Insertar productos de prueba con FK válida
-- EAN-13 válidos (check digit calculado)
-- -------------------------------------------------------
INSERT INTO public.productos
  (id_categoria, codigo_barras_unico, nombre, precio_compra, precio_venta,
   stock_actual, stock_minimo, stock_maximo, estado, ubicacion, descripcion)
VALUES
  -- Alimentos
  ((SELECT id_categoria FROM public.categorias WHERE nombre_categoria = 'Alimentos'),
   '1000000000009', 'Arroz Diana x 500g',
   2500.00, 3800.00, 50, 10, 200, true, 'Estante A1', 'Arroz blanco de grano largo'),

  ((SELECT id_categoria FROM public.categorias WHERE nombre_categoria = 'Alimentos'),
   '2000000000008', 'Aceite Girasol x 1L',
   7500.00, 10500.00, 30, 5, 100, true, 'Estante A2', 'Aceite vegetal de girasol'),

  ((SELECT id_categoria FROM public.categorias WHERE nombre_categoria = 'Alimentos'),
   '3000000000007', 'Azúcar Riopaila x 1kg',
   3200.00, 4500.00, 40, 10, 150, true, 'Estante A3', 'Azúcar blanca refinada'),

  -- Bebidas
  ((SELECT id_categoria FROM public.categorias WHERE nombre_categoria = 'Bebidas'),
   '4000000000006', 'Gaseosa Cola x 2L',
   4000.00, 6000.00, 60, 12, 120, true, 'Refrigerador B1', 'Gaseosa sabor cola 2 litros'),

  ((SELECT id_categoria FROM public.categorias WHERE nombre_categoria = 'Bebidas'),
   '5000000000005', 'Agua Cristal x 600ml',
   700.00, 1500.00, 100, 20, 300, true, 'Estante B2', 'Agua purificada sin gas'),

  ((SELECT id_categoria FROM public.categorias WHERE nombre_categoria = 'Bebidas'),
   '6000000000004', 'Jugo Hit Naranja x 1L',
   2800.00, 4200.00, 45, 10, 100, true, 'Refrigerador B3', 'Jugo de naranja Hit 1 litro'),

  -- Lácteos
  ((SELECT id_categoria FROM public.categorias WHERE nombre_categoria = 'Lácteos'),
   '7000000000003', 'Leche Alquería x 1L',
   2900.00, 4000.00, 35, 10, 80, true, 'Refrigerador C1', 'Leche entera larga vida'),

  ((SELECT id_categoria FROM public.categorias WHERE nombre_categoria = 'Lácteos'),
   '8000000000002', 'Yogurt Alpina x 200g',
   1800.00, 2800.00, 25, 5, 60, true, 'Refrigerador C2', 'Yogurt con cereal fresa'),

  -- Aseo Personal
  ((SELECT id_categoria FROM public.categorias WHERE nombre_categoria = 'Aseo Personal'),
   '9000000000001', 'Shampoo Head & Shoulders x 375ml',
   12000.00, 18500.00, 20, 5, 50, true, 'Estante D1', 'Shampoo anticaspa clásico'),

  -- Snacks
  ((SELECT id_categoria FROM public.categorias WHERE nombre_categoria = 'Snacks'),
   '1100000000002', 'Papas Margarita x 95g',
   2000.00, 3200.00, 80, 20, 200, true, 'Estante E1', 'Papas fritas originales'),

  ((SELECT id_categoria FROM public.categorias WHERE nombre_categoria = 'Snacks'),
   '1200000000001', 'Chocoramo x 45g',
   1200.00, 1800.00, 60, 15, 150, true, 'Estante E2', 'Ponqué con cobertura de chocolate'),

  -- Limpieza
  ((SELECT id_categoria FROM public.categorias WHERE nombre_categoria = 'Limpieza Hogar'),
   '1300000000009', 'Detergente Ariel x 1kg',
   9500.00, 14000.00, 15, 5, 40, true, 'Estante F1', 'Detergente en polvo multiacción')

ON CONFLICT (codigo_barras_unico) DO NOTHING;

-- -------------------------------------------------------
-- OBJETIVO 4: Proveedor de prueba para movimientos
-- (si no existe ya de un seed anterior)
-- -------------------------------------------------------
INSERT INTO public.proveedores (razon_social, nit_identificacion, telefono, direccion, correo, estado)
VALUES
  ('Distribuidora Test SAS',  '900111222-1', '3001112233', 'Calle 10 #20-30, Bogotá',   'distribuidora@test.com', true),
  ('Comercial Demo Ltda',     '800333444-5', '3114445566', 'Carrera 5 #15-25, Medellín', 'comercial@demo.com',     true)
ON CONFLICT (nit_identificacion) DO NOTHING;

-- -------------------------------------------------------
-- VERIFICACIÓN FINAL
-- -------------------------------------------------------
SELECT
  'categorias'  AS tabla, COUNT(*) AS registros FROM public.categorias
UNION ALL SELECT
  'productos',   COUNT(*) FROM public.productos
UNION ALL SELECT
  'proveedores', COUNT(*) FROM public.proveedores
UNION ALL SELECT
  'motivos_movimiento', COUNT(*) FROM public.motivos_movimiento;

'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Pool } = require('pg');

const MAX_EXPORT_RECORDS = 100000;
const TEMP_FILE_TTL_MS = 60 * 60 * 1000;

const DATASETS = Object.freeze({
  PRODUCTOS: 'productos',
  MOVIMIENTOS: 'movimientos',
  PROVEEDORES: 'proveedores',
  CATEGORIAS: 'categorias',
  TODO: 'todo',
});

const DATASET_ORDER = [
  DATASETS.PRODUCTOS,
  DATASETS.MOVIMIENTOS,
  DATASETS.PROVEEDORES,
  DATASETS.CATEGORIAS,
];

const DATASET_ALIASES = Object.freeze({
  productos: DATASETS.PRODUCTOS,
  products: DATASETS.PRODUCTOS,
  movimientos: DATASETS.MOVIMIENTOS,
  movements: DATASETS.MOVIMIENTOS,
  proveedores: DATASETS.PROVEEDORES,
  suppliers: DATASETS.PROVEEDORES,
  categorias: DATASETS.CATEGORIAS,
  categories: DATASETS.CATEGORIAS,
  todo: DATASETS.TODO,
  all: DATASETS.TODO,
});

const FORMAT_ALIASES = Object.freeze({
  csv: { key: 'csv', ext: 'csv', contentType: 'text/csv; charset=utf-8' },
  json: { key: 'json', ext: 'json', contentType: 'application/json; charset=utf-8' },
  pdf: { key: 'pdf', ext: 'pdf', contentType: 'application/pdf' },
  excel: {
    key: 'excel',
    ext: 'xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  xlsx: {
    key: 'excel',
    ext: 'xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
});

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'passwd',
  'contrasena',
  'contrasena_hash',
  'token',
  'access_token',
  'refresh_token',
  'session_token',
  'sesion_token',
  'jwt',
  'api_key',
  'secret',
]);

class ExportError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : String(value || '').trim();
}

function normalizeKey(value) {
  return normalizeString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function normalizeDate(value, fieldName) {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  const normalized = normalizeString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new ExportError(400, 'VALIDATION_ERROR', `${fieldName} debe tener formato YYYY-MM-DD`);
  }

  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new ExportError(400, 'VALIDATION_ERROR', `${fieldName} no es una fecha valida`);
  }

  return normalized;
}

function normalizePositiveInteger(value, fieldName) {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new ExportError(400, 'VALIDATION_ERROR', `${fieldName} debe ser un entero positivo`);
  }

  return normalized;
}

function normalizeExportRequest(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ExportError(400, 'VALIDATION_ERROR', 'El cuerpo de la solicitud es obligatorio');
  }

  const datasetKey = normalizeKey(body.conjunto_datos || body.dataset || body.entidad);
  const dataset = DATASET_ALIASES[datasetKey];
  if (!dataset) {
    throw new ExportError(
      400,
      'VALIDATION_ERROR',
      'conjunto_datos debe ser productos, movimientos, proveedores, categorias o todo'
    );
  }

  const formatKey = normalizeKey(body.formato || body.format);
  const format = FORMAT_ALIASES[formatKey];
  if (!format) {
    throw new ExportError(
      400,
      'VALIDATION_ERROR',
      'formato debe ser CSV, JSON, PDF, EXCEL o XLSX'
    );
  }

  const fecha_inicio = normalizeDate(body.fecha_inicio, 'fecha_inicio');
  const fecha_fin = normalizeDate(body.fecha_fin, 'fecha_fin');
  if (fecha_inicio && fecha_fin && fecha_inicio > fecha_fin) {
    throw new ExportError(400, 'VALIDATION_ERROR', 'fecha_inicio no puede ser mayor a fecha_fin');
  }

  return {
    conjunto_datos: dataset,
    formato: format,
    filters: {
      fecha_inicio,
      fecha_fin,
      id_categoria: normalizePositiveInteger(body.id_categoria, 'id_categoria'),
    },
  };
}

function buildUrl(baseUrl, urlPath, query = {}) {
  const url = new URL(urlPath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function extractRows(payload, preferredKeys = []) {
  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [payload?.data, payload, payload?.data?.data];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }

    for (const key of preferredKeys) {
      if (Array.isArray(candidate?.[key])) {
        return candidate[key];
      }
    }

    for (const key of ['items', 'productos', 'categorias', 'proveedores', 'movimientos']) {
      if (Array.isArray(candidate?.[key])) {
        return candidate[key];
      }
    }
  }

  return [];
}

function isSensitiveKey(key) {
  const normalized = normalizeKey(key);
  return (
    SENSITIVE_KEYS.has(normalized) ||
    normalized.includes('password') ||
    normalized.includes('contrasena') ||
    normalized.includes('token') ||
    normalized.endsWith('_hash') ||
    normalized.includes('session')
  );
}

function stripSensitiveFields(value) {
  if (Array.isArray(value)) {
    return value.map(stripSensitiveFields);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return Object.entries(value).reduce((safe, [key, item]) => {
    if (!isSensitiveKey(key)) {
      safe[key] = stripSensitiveFields(item);
    }
    return safe;
  }, {});
}

function flattenValue(value) {
  if (value === null || typeof value === 'undefined') {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

function collectColumns(rows = []) {
  const columns = [];
  const seen = new Set();

  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    });
  });

  return columns;
}

function toCsvCell(value) {
  const text = String(flattenValue(value));
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsvContent(dataByDataset, { includeDatasetColumn }) {
  const rows = Object.entries(dataByDataset).flatMap(([dataset, items]) =>
    items.map((item) => (includeDatasetColumn ? { conjunto_datos: dataset, ...item } : item))
  );
  const columns = collectColumns(rows);
  const lines = [columns.map(toCsvCell).join(',')];

  rows.forEach((row) => {
    lines.push(columns.map((column) => toCsvCell(row[column])).join(','));
  });

  return `\uFEFF${lines.join('\n')}\n`;
}

async function writeJson(filePath, dataByDataset, meta) {
  const content = JSON.stringify({ meta, data: dataByDataset }, null, 2);
  await fsp.writeFile(filePath, content, 'utf8');
}

async function writeCsv(filePath, dataByDataset, meta) {
  const includeDatasetColumn = meta.conjunto_datos === DATASETS.TODO;
  await fsp.writeFile(filePath, buildCsvContent(dataByDataset, { includeDatasetColumn }), 'utf8');
}

function normalizeSheetName(name) {
  return name.replace(/[\\/*?:[\]]/g, '').slice(0, 31) || 'export';
}

async function writeExcel(filePath, dataByDataset, meta) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'STOCKERR MS-12';
  workbook.created = new Date(meta.generatedAt);

  Object.entries(dataByDataset).forEach(([dataset, rows]) => {
    if (rows.length === 0) {
      return;
    }

    const worksheet = workbook.addWorksheet(normalizeSheetName(dataset));
    const columns = collectColumns(rows);
    worksheet.columns = columns.map((column) => ({
      header: column,
      key: column,
      width: Math.min(40, Math.max(12, column.length + 4)),
    }));
    rows.forEach((row) => {
      worksheet.addRow(
        columns.reduce((item, column) => {
          item[column] = flattenValue(row[column]);
          return item;
        }, {})
      );
    });
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  });

  await workbook.xlsx.writeFile(filePath);
}

async function writePdf(filePath, dataByDataset, meta) {
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const stream = fs.createWriteStream(filePath);

    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.on('error', reject);
    doc.pipe(stream);

    doc.fontSize(16).text('STOCKERR - Exportacion de datos', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9).text(`Conjunto: ${meta.conjunto_datos}`);
    doc.text(`Formato solicitado: ${meta.formato}`);
    doc.text(`Generado: ${meta.generatedAt}`);
    doc.text(`Total registros: ${meta.total_registros}`);
    doc.moveDown();

    Object.entries(dataByDataset).forEach(([dataset, rows], datasetIndex) => {
      if (rows.length === 0) {
        return;
      }
      if (datasetIndex > 0) {
        doc.addPage();
      }

      doc.fontSize(13).text(dataset.toUpperCase());
      doc.fontSize(9).text(`Registros: ${rows.length}`);
      doc.moveDown(0.5);

      const columns = collectColumns(rows).slice(0, 8);
      rows.slice(0, 250).forEach((row, index) => {
        const line = columns
          .map((column) => `${column}: ${flattenValue(row[column])}`)
          .join(' | ');
        doc.text(`${index + 1}. ${line}`, { width: 520 });
      });

      if (rows.length > 250) {
        doc.moveDown(0.5);
        doc.text(`Se omitio la vista previa de ${rows.length - 250} registros adicionales.`);
      }
    });

    doc.end();
  });
}

function buildDefaultDbPool() {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'stockerr',
    database: process.env.DB_NAME || 'stockerr',
  });
}

class ExportService {
  constructor({
    inventoryServiceUrl = 'http://localhost:3005',
    auditServiceUrl = 'http://localhost:3006',
    fetchImpl = fetch,
    dataSources = {},
    dbPool,
    tempDir = path.join(os.tmpdir(), 'stockerr-exports'),
    nowProvider = () => new Date().toISOString(),
  } = {}) {
    this.inventoryServiceUrl = inventoryServiceUrl;
    this.auditServiceUrl = auditServiceUrl;
    this.fetchImpl = fetchImpl;
    this.dataSources = dataSources;
    this.dbPool = dbPool;
    this.tempDir = tempDir;
    this.nowProvider = nowProvider;
  }

  getPool() {
    if (!this.dbPool) {
      this.dbPool = buildDefaultDbPool();
    }
    return this.dbPool;
  }

  async readFromInjectedSource(dataset, filters, context) {
    const source = this.dataSources[dataset];
    if (!source) {
      return null;
    }

    const result = typeof source === 'function' ? await source(filters, context) : source;
    return extractRows(result);
  }

  async requestJson(url, context = {}) {
    const headers = { accept: 'application/json' };
    if (context.authorization) {
      headers.Authorization = context.authorization;
    }

    const response = await this.fetchImpl(url, { method: 'GET', headers });
    const payload = await response.json();
    if (!response.ok) {
      const message =
        payload?.error?.message || payload?.error || 'No fue posible consultar datos para exportacion';
      throw new ExportError(response.status >= 500 ? 502 : response.status, 'UPSTREAM_ERROR', message);
    }
    return payload;
  }

  async getProducts(filters, context) {
    const injected = await this.readFromInjectedSource(DATASETS.PRODUCTOS, filters, context);
    if (injected) {
      return injected;
    }

    const { rows } = await this.getPool().query(
      `
        SELECT
          p.id_producto,
          p.id_categoria,
          p.codigo_barras_unico,
          p.nombre,
          p.descripcion,
          c.nombre_categoria AS categoria,
          p.precio_compra,
          p.precio_venta,
          p.stock_actual,
          p.stock_minimo,
          p.stock_maximo,
          p.fecha_vencimiento,
          p.ubicacion,
          p.estado,
          p.fecha_creacion
        FROM productos p
        JOIN categorias c ON c.id_categoria = p.id_categoria
        WHERE ($1::int IS NULL OR p.id_categoria = $1)
        ORDER BY p.id_producto ASC
        LIMIT $2
      `,
      [filters.id_categoria || null, MAX_EXPORT_RECORDS + 1]
    );
    return rows;
  }

  async getMovements(filters, context) {
    const injected = await this.readFromInjectedSource(DATASETS.MOVIMIENTOS, filters, context);
    if (injected) {
      return injected;
    }

    const query = {
      fecha_inicio: filters.fecha_inicio,
      fecha_fin: filters.fecha_fin,
      categoria: filters.id_categoria,
    };
    const url = buildUrl(this.inventoryServiceUrl, '/api/inventory/reports/movements', query);
    const payload = await this.requestJson(url, context);
    return extractRows(payload, ['items']);
  }

  async getSuppliers(filters, context) {
    const injected = await this.readFromInjectedSource(DATASETS.PROVEEDORES, filters, context);
    if (injected) {
      return injected;
    }

    const { rows } = await this.getPool().query(
      `
        SELECT id_proveedor, razon_social, nit_identificacion, telefono, direccion, correo, estado
        FROM proveedores
        ORDER BY id_proveedor ASC
        LIMIT $1
      `,
      [MAX_EXPORT_RECORDS + 1]
    );
    return rows;
  }

  async getCategories(filters, context) {
    const injected = await this.readFromInjectedSource(DATASETS.CATEGORIAS, filters, context);
    if (injected) {
      return injected;
    }

    const { rows } = await this.getPool().query(
      `
        SELECT id_categoria, nombre_categoria, descripcion, estado
        FROM categorias
        ORDER BY id_categoria ASC
        LIMIT $1
      `,
      [MAX_EXPORT_RECORDS + 1]
    );
    return rows;
  }

  async collectData(request, context) {
    const selected =
      request.conjunto_datos === DATASETS.TODO ? DATASET_ORDER : [request.conjunto_datos];
    const dataByDataset = {};

    for (const dataset of selected) {
      if (dataset === DATASETS.PRODUCTOS) {
        dataByDataset[dataset] = await this.getProducts(request.filters, context);
      } else if (dataset === DATASETS.MOVIMIENTOS) {
        dataByDataset[dataset] = await this.getMovements(request.filters, context);
      } else if (dataset === DATASETS.PROVEEDORES) {
        dataByDataset[dataset] = await this.getSuppliers(request.filters, context);
      } else if (dataset === DATASETS.CATEGORIAS) {
        dataByDataset[dataset] = await this.getCategories(request.filters, context);
      }
    }

    return Object.fromEntries(
      Object.entries(dataByDataset).map(([dataset, rows]) => [
        dataset,
        stripSensitiveFields(rows),
      ])
    );
  }

  countRows(dataByDataset) {
    return Object.values(dataByDataset).reduce((total, rows) => total + rows.length, 0);
  }

  async notifyAudit({ actor, request, totalRows, filename }) {
    if (!this.auditServiceUrl) {
      return;
    }

    await this.fetchImpl(`${this.auditServiceUrl}/api/audit/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        action: 'exportar_datos',
        module: 'exportaciones',
        entity: request.conjunto_datos,
        user: actor
          ? {
              id_usuario: actor.id_usuario,
              nombre: actor.nombre,
              rol: actor.rol,
            }
          : undefined,
        detail: {
          formato: request.formato.key,
          total_registros: totalRows,
          archivo: filename,
          filtros: request.filters,
        },
      }),
    });
  }

  async createExport(body, context = {}) {
    const request = normalizeExportRequest(body);
    const dataByDataset = await this.collectData(request, context);
    const totalRows = this.countRows(dataByDataset);

    if (totalRows === 0) {
      throw new ExportError(
        404,
        'EXPORT_DATA_NOT_FOUND',
        'No se encontraron datos con los filtros seleccionados'
      );
    }

    if (totalRows > MAX_EXPORT_RECORDS) {
      throw new ExportError(
        413,
        'EXPORT_LIMIT_EXCEEDED',
        'El volumen supera el limite de 100.000 registros'
      );
    }

    const generatedAt = this.nowProvider();
    const datePart = generatedAt.slice(0, 10);
    const filename = `${request.conjunto_datos}_${datePart}.${request.formato.ext}`;
    const tempFilename = `${request.conjunto_datos}_${datePart}_${randomUUID()}.${request.formato.ext}`;
    await fsp.mkdir(this.tempDir, { recursive: true });
    const filePath = path.join(this.tempDir, tempFilename);

    const meta = {
      conjunto_datos: request.conjunto_datos,
      formato: request.formato.key,
      generatedAt,
      total_registros: totalRows,
      filtros: request.filters,
    };

    if (request.formato.key === 'csv') {
      await writeCsv(filePath, dataByDataset, meta);
    } else if (request.formato.key === 'json') {
      await writeJson(filePath, dataByDataset, meta);
    } else if (request.formato.key === 'excel') {
      await writeExcel(filePath, dataByDataset, meta);
    } else if (request.formato.key === 'pdf') {
      await writePdf(filePath, dataByDataset, meta);
    }

    void this.notifyAudit({
      actor: context.actor,
      request,
      totalRows,
      filename,
    }).catch(() => {});

    return {
      filePath,
      filename,
      contentType: request.formato.contentType,
      ttlMs: TEMP_FILE_TTL_MS,
      meta,
    };
  }
}

module.exports = {
  DATASETS,
  ExportError,
  ExportService,
  MAX_EXPORT_RECORDS,
  TEMP_FILE_TTL_MS,
  buildCsvContent,
  normalizeExportRequest,
  stripSensitiveFields,
};

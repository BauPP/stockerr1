const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

function pickFirstArray(candidates) {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }

  return []
}

function getToken() {
  return localStorage.getItem('stockerr_token') ?? ''
}

function extractErrorMessage(data) {
  if (!data) return 'Ocurrió un error inesperado. Por favor intenta nuevamente.'

  const candidates = [
    data?.error?.message,
    data.message,
    data.mensaje,
    data.error,
    data.msg,
    data.detail,
  ]

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }

  return 'Ocurrió un error inesperado. Por favor intenta nuevamente.'
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers ?? {}),
    },
  })

  let data = null
  try { data = await response.json() } catch { /* sin body */ }

  if (!response.ok) {
    const error = new Error(extractErrorMessage(data))
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

export const REPORT_TYPES = [
  { value: 'movements', label: 'Movimientos' },
  { value: 'sales', label: 'Ventas' },
  { value: 'stock', label: 'Stock actual' },
]

export const REPORT_FILTERS = {
  movements: ['fecha_inicio', 'fecha_fin', 'categoria', 'producto', 'tipo'],
  sales: ['fecha_inicio', 'fecha_fin', 'categoria', 'producto'],
  stock: ['categoria', 'producto'],
}

export const MOVEMENT_FILTER_OPTIONS = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'salida', label: 'Salida' },
  { value: 'ajuste', label: 'Ajuste' },
]

export function buildReportQuery(reportType, filters = {}) {
  const params = new URLSearchParams()
  const supportedFilters = REPORT_FILTERS[reportType] ?? []

  for (const key of supportedFilters) {
    const value = filters[key]
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, value)
    }
  }

  return params.toString()
}

export async function getReport(reportType, filters = {}) {
  const query = buildReportQuery(reportType, filters)
  const payload = await apiFetch(`/inventory/reports/${reportType}${query ? `?${query}` : ''}`)
  return payload.data
}

export function normalizeCatalogResponse({ categoriesResponse, productsResponse }) {
  return {
    categories: pickFirstArray([
      categoriesResponse?.data?.categorias,
      categoriesResponse?.data?.categories,
      categoriesResponse?.data,
    ]),
    products: pickFirstArray([
      productsResponse?.data?.productos,
      productsResponse?.data?.items,
      productsResponse?.data,
    ]),
  }
}

export async function getReportFiltersCatalog() {
  const [categoriesResponse, productsResponse] = await Promise.all([
    apiFetch('/categories?estado=activo'),
    apiFetch('/products?page=1&size=100'),
  ])

  return normalizeCatalogResponse({ categoriesResponse, productsResponse })
}

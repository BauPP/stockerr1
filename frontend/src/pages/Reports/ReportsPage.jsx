import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildReportQuery,
  getReport,
  getReportFiltersCatalog,
  MOVEMENT_FILTER_OPTIONS,
  REPORT_FILTERS,
  REPORT_TYPES,
} from '../../api/reports.js'
import './reports.css'

const INITIAL_FILTERS = {
  fecha_inicio: '',
  fecha_fin: '',
  categoria: '',
  producto: '',
  tipo: '',
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatCellValue(columnKey, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (columnKey === 'valor_total' || columnKey === 'precio_unitario') return formatCurrency(value)
  return value
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState('movements')
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [catalog, setCatalog] = useState({ categories: [], products: [] })
  const [report, setReport] = useState(null)
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [loadingReport, setLoadingReport] = useState(true)
  const [error, setError] = useState('')

  const activeFilters = REPORT_FILTERS[reportType] ?? []

  const queryPreview = useMemo(() => buildReportQuery(reportType, filters), [reportType, filters])

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true)
    try {
      const nextCatalog = await getReportFiltersCatalog()
      setCatalog(nextCatalog)
    } catch (err) {
      setError(err.message ?? 'No fue posible cargar categorías y productos.')
    } finally {
      setLoadingCatalog(false)
    }
  }, [])

  const loadReport = useCallback(async (nextReportType, nextFilters) => {
    setLoadingReport(true)
    setError('')

    try {
      const payload = await getReport(nextReportType, nextFilters)
      setReport(payload)
    } catch (err) {
      setReport(null)
      setError(err.message ?? 'No fue posible consultar el reporte.')
    } finally {
      setLoadingReport(false)
    }
  }, [])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    void loadReport('movements', INITIAL_FILTERS)
  }, [loadReport])

  function handleFilterChange(event) {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    void loadReport(reportType, filters)
  }

  function handleReset() {
    setFilters(INITIAL_FILTERS)
    void loadReport(reportType, INITIAL_FILTERS)
  }

  function handleReportChange(event) {
    const nextReportType = event.target.value
    setReportType(nextReportType)
    setFilters(INITIAL_FILTERS)
    void loadReport(nextReportType, INITIAL_FILTERS)
  }

  return (
    <section className="reports-page">
      <header className="reports-page__header">
        <div>
          <p className="reports-page__eyebrow">MS-07</p>
          <h1>Reportes operativos</h1>
          <p className="reports-page__subtitle">
            Consulta movimientos, ventas y stock actual con el mismo contrato del backend.
          </p>
        </div>
        <div className="reports-page__status">
          <span className="reports-badge">{loadingCatalog ? 'Cargando catálogos' : 'Catálogos listos'}</span>
          <span className="reports-badge reports-badge--muted">
            {queryPreview ? `?${queryPreview}` : 'Sin filtros aplicados'}
          </span>
        </div>
      </header>

      <form className="reports-filters" onSubmit={handleSubmit}>
        <label className="reports-field reports-field--wide">
          <span>Reporte</span>
          <select value={reportType} onChange={handleReportChange}>
            {REPORT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        {activeFilters.includes('fecha_inicio') && (
          <label className="reports-field">
            <span>Fecha inicio</span>
            <input type="date" name="fecha_inicio" value={filters.fecha_inicio} onChange={handleFilterChange} />
          </label>
        )}

        {activeFilters.includes('fecha_fin') && (
          <label className="reports-field">
            <span>Fecha fin</span>
            <input type="date" name="fecha_fin" value={filters.fecha_fin} onChange={handleFilterChange} />
          </label>
        )}

        {activeFilters.includes('categoria') && (
          <label className="reports-field">
            <span>Categoría</span>
            <select name="categoria" value={filters.categoria} onChange={handleFilterChange} disabled={loadingCatalog}>
              <option value="">Todas</option>
              {catalog.categories.map((category) => (
                <option key={category.id_categoria} value={category.id_categoria}>
                  {category.nombre_categoria}
                </option>
              ))}
            </select>
          </label>
        )}

        {activeFilters.includes('producto') && (
          <label className="reports-field reports-field--wide">
            <span>Producto</span>
            <select name="producto" value={filters.producto} onChange={handleFilterChange} disabled={loadingCatalog}>
              <option value="">Todos</option>
              {catalog.products.map((product) => (
                <option key={product.id_producto} value={product.id_producto}>
                  {product.nombre}
                </option>
              ))}
            </select>
          </label>
        )}

        {activeFilters.includes('tipo') && (
          <label className="reports-field">
            <span>Tipo</span>
            <select name="tipo" value={filters.tipo} onChange={handleFilterChange}>
              <option value="">Todos</option>
              {MOVEMENT_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )}

        <div className="reports-actions">
          <button type="submit" className="reports-btn" disabled={loadingReport}>Consultar</button>
          <button type="button" className="reports-btn reports-btn--ghost" onClick={handleReset} disabled={loadingReport}>
            Limpiar
          </button>
        </div>
      </form>

      {error && <div className="reports-error">{error}</div>}

      <div className="reports-summary">
        <article>
          <span>Registros</span>
          <strong>{report?.summary?.total_items ?? '—'}</strong>
        </article>
        <article>
          <span>Cantidad total</span>
          <strong>{report?.summary?.total_quantity ?? '—'}</strong>
        </article>
        <article>
          <span>Valor total</span>
          <strong>{formatCurrency(report?.summary?.total_value ?? 0)}</strong>
        </article>
      </div>

      <section className="reports-results">
        <div className="reports-results__header">
          <div>
            <h2>Resultado</h2>
            <p>
              {report?.meta?.generatedAt
                ? `Generado: ${new Date(report.meta.generatedAt).toLocaleString('es-CO')}`
                : 'Sin consulta exitosa todavía.'}
            </p>
          </div>
          {loadingReport && <span className="reports-badge">Consultando…</span>}
        </div>

        {loadingReport ? (
          <div className="reports-empty">Consultando reporte…</div>
        ) : report?.items?.length ? (
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  {report.columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.items.map((item, index) => (
                  <tr key={`${item.id_movimiento ?? item.id_producto ?? item.producto}-${index}`}>
                    {report.columns.map((column) => (
                      <td key={column.key}>{formatCellValue(column.key, item[column.key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="reports-empty">No hay datos para los filtros seleccionados.</div>
        )}
      </section>
    </section>
  )
}

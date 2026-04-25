// src/App.jsx — con ruta de Productos (MS-04)
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.js'
import Login from './pages/Login/login'
import Layout from './components/Layout'
import Categories from './pages/Categories/Categories.jsx'
import UsersPage from './pages/Users/UsersPage.jsx'
import ProductsPage from './pages/Products/ProductsPage.jsx'
import Inventory from './pages/Inventory/Inventory.jsx'

function HomeRedirect() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  return isAuthenticated
    ? <Navigate to="/dashboard" replace />
    : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />
}

function PrivateRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.rol !== 'Administrador') return <Navigate to="/dashboard" replace />
  return children
}

function Dashboard() {
  return (
    <Layout>
      <h1>Dashboard</h1>
      <p>Contenido inicial</p>
    </Layout>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />

      <Route path="/login" element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      } />

      <Route path="/dashboard/*" element={
        <PrivateRoute>
          <Dashboard />
        </PrivateRoute>
      } />

      <Route path="/categorias" element={
        <PrivateRoute>
          <Layout>
            <Categories />
          </Layout>
        </PrivateRoute>
      } />

      {/* MS-02 — solo Administrador */}
      <Route path="/usuarios" element={
        <AdminRoute>
          <Layout>
            <UsersPage />
          </Layout>
        </AdminRoute>
      } />

      {/* MS-04 — Admin y Operador (operador solo lectura) */}
      <Route path="/productos" element={
        <PrivateRoute>
          <Layout>
            <ProductsPage />
          </Layout>
        </PrivateRoute>
      } />
      
      {/* MS-05 — Administrador y Operador (con rotación de rol en la vista) */}
      <Route path="/inventario" element={
        <PrivateRoute>
          <Layout>
            <Inventory />
          </Layout>
        </PrivateRoute>
      } />

    </Routes>
  )
}
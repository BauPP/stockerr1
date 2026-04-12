// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.js'
import Login from './pages/Login/login'
import Layout from './components/Layout'
import Categories from './pages/Categories/Categories.jsx'
import UsersPage from './pages/Users/UsersPage.jsx'


// Redirige según estado de sesión al entrar a "/"
function HomeRedirect() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  return isAuthenticated
    ? <Navigate to="/dashboard" replace />
    : <Navigate to="/login" replace />
}

// impide que un usuario logueado vuelva al login
function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />
}

// redirige al login si no hay sesión activa
function PrivateRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

// Solo Administrador — Operador no puede ver gestión de usuarios
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

    </Routes>
  )
}
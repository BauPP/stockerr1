// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.js'
import Login from './pages/Login/login'

// Redirige según estado de sesión al entrar a "/"
// Si ya está logueado → dashboard
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

// Placeholder hasta que se implemente el dashboard real
function Dashboard() {
  const { user, logout } = useAuth()
  return (
    <div style={{ padding: '2rem', fontFamily: 'Roboto, sans-serif' }}>
      <h1>Dashboard — Bienvenido, {user?.nombre}</h1>
      <p>Rol: <strong>{user?.rol}</strong></p>
      <button
        onClick={logout}
        style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
      >
        Cerrar sesión
      </button>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* redirección  según sesión */}
      <Route path="/" element={<HomeRedirect />} />

      {/* no accesible si ya hay sesión */}
      <Route path="/login" element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      } />

      {/* se requiere sesión activa */}
      <Route path="/dashboard/*" element={
        <PrivateRoute>
          <Dashboard />
        </PrivateRoute>
      } />
    </Routes>
  )
}
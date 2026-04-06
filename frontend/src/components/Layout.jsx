import { useAuth } from '../hooks/useAuth'
import './layout.css'

export default function Layout({ children }) {
  const { user, logout } = useAuth()

  return (
    <div className="layout">

      {/* SIDEBAR */}
      <aside className="sidebar">
        <h2>Inventario</h2>

     <nav>
         <ul>
           <li>🏠 Inicio</li>
           <li>👥 Usuarios</li>
           <li>📦 Categorías</li>
           <li>📝 Registrar productos</li>
           <li>🔍 Buscar productos</li>
           <li>💰 Ventas</li>
           <li>📜 Historial</li>
           <li>⚠️ Alertas</li>
           <li>📊 Reportes</li>
         </ul>
     </nav>
      </aside>

      {/* CONTENIDO */}
      <div className="main">

        {/* NAVBAR */}
        <header className="navbar">
          <span>Bienvenido, {user?.nombre}</span>

          <div className="nav-right">
            <span className="rol">Rol: {user?.rol}</span>
            <button onClick={logout}>Cerrar sesión</button>
          </div>
        </header>

        {/* CONTENIDO DINÁMICO */}
        <main className="content">
          {children}
        </main>

      </div>
    </div>
  )
}
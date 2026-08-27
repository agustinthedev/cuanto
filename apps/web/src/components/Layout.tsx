import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAdminAuth } from "../auth/AdminAuth";

export function Layout({ children }: { children: ReactNode }) {
  const { isAdmin } = useAdminAuth();

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="site-header container">
        <Link className="brand" to="/" aria-label="Cuánto.uy, inicio">
          <span className="brand-mark">$</span>
          <span>cuánto<span className="brand-domain">.uy</span></span>
        </Link>
        <nav className="site-nav" aria-label="Navegación principal">
          {isAdmin && <>
            <NavLink to="/admin" end className={({ isActive }) => (isActive ? "active" : "")}>Resumen</NavLink>
            <NavLink to="/admin/productos-sugeridos" className={({ isActive }) => (isActive ? "active" : "")}>Sugerencias</NavLink>
          </>}
        </nav>
        <div className="live-pill"><span className="live-dot" /> Datos diarios</div>
      </header>
      <main>{children}</main>
      <footer className="site-footer container">
        <span>cuánto.uy</span>
        <span>Precios claros para decidir mejor en Uruguay.</span>
      </footer>
    </div>
  );
}

import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAdminAuth } from "../auth/AdminAuth";

export function Layout({ children }: { children: ReactNode }) {
  const { isAdmin, signOut } = useAdminAuth();
  const location = useLocation();
  const isAdminArea = isAdmin && location.pathname.startsWith("/admin");
  const isProductSearch = location.pathname === "/productos";
  const howItWorksHref = location.pathname === "/" ? "#como-funciona" : "/#como-funciona";

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className={isAdminArea ? "site-header admin-site-header" : "site-header"}>
        <div className="site-header-inner container">
          <Link className="brand" to="/" aria-label="Cuánto.uy, inicio">
            <span className="brand-mark">$</span>
            <span>cuánto<span className="brand-domain">.uy</span></span>
          </Link>
          <nav className={isAdminArea ? "site-nav admin-site-nav" : "site-nav"} aria-label="Navegación principal">
            {isAdminArea ? <>
              <NavLink to="/admin" end className={({ isActive }) => (isActive ? "active" : "")}>Resumen</NavLink>
              <NavLink to="/admin/productos" end className={({ isActive }) => (isActive ? "active" : "")}>Productos</NavLink>
              <NavLink to="/admin/productos-sugeridos" className={({ isActive }) => (isActive ? "active" : "")}>Sugerencias</NavLink>
            </> : <>
              <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>Explorar</NavLink>
              <a href={howItWorksHref}>Cómo funciona</a>
            </>}
          </nav>
          <div className="site-header-actions">
            {isAdminArea ? <button className="header-sign-out" type="button" onClick={() => void signOut()}>Cerrar sesión</button> : !isProductSearch && <Link className="header-action" to="/productos">Buscar productos</Link>}
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer container">
        <div className="footer-main">
          <Link className="footer-brand" to="/" aria-label="Volver al inicio de Cuánto.uy">
            <span className="footer-mark">$</span>
            <span>cuánto<span className="brand-domain">.uy</span></span>
          </Link>
          <p className="footer-copy"><strong>Precios claros</strong><span>para decidir mejor en Uruguay.</span></p>
        </div>
        <div className="footer-links">
          <a href={howItWorksHref}>Cómo funciona</a>
          <Link to="/#explorar">Explorar productos</Link>
        </div>
      </footer>
    </div>
  );
}

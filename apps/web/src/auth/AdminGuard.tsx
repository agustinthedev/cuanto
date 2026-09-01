import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isSupabaseConfigured } from "../lib/supabase";
import { useAdminAuth } from "./AdminAuth";

const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

export function AdminGuard() {
  const { session, loading, isAdmin, signOut } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return <div className="container page-loading"><div className="loading-orb" /><p>Verificando acceso...</p></div>;
  }

  if (isDemoMode) return <Outlet />;

  if (!isSupabaseConfigured || !session) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  if (!isAdmin) {
    return (
      <div className="container page-state">
        <div className="state-message">
          <div className="state-icon">!</div>
          <div>
            <h3>Acceso no habilitado</h3>
            <p>Tu cuenta está autenticada, pero no forma parte de los administradores.</p>
            <button className="button button-secondary admin-state-button" onClick={() => void signOut()}>Cerrar sesión</button>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

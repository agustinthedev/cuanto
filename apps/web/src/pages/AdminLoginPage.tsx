import { FormEvent, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../auth/AdminAuth";
import { isSupabaseConfigured } from "../lib/supabase";

export function AdminLoginPage() {
  const { session, isAdmin, signIn } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const from = (location.state as { from?: string } | null)?.from ?? "/admin";

  useEffect(() => {
    if (session && isAdmin) navigate(from, { replace: true });
  }, [from, isAdmin, navigate, session]);

  if (session && isAdmin) return <Navigate to={from} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container admin-login-page">
      <div className="admin-login-card">
        <span className="section-kicker">Acceso privado</span>
        <h1>Panel de administración</h1>
        <p>Ingresá con tu cuenta autorizada para gestionar el catálogo, revisar propuestas y monitorear los precios.</p>
        {!isSupabaseConfigured && <div className="inline-alert">La conexión con Supabase no está configurada en este entorno.</div>}
        {error && <div className="inline-alert" role="alert">{error}</div>}
        <form onSubmit={handleSubmit} className="admin-login-form">
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
          <button className="button button-primary admin-submit-button" type="submit" disabled={submitting || !isSupabaseConfigured}>{submitting ? "Verificando..." : "Ingresar"}<span>↗</span></button>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "../auth/AdminAuth";
import { StateMessage } from "../components/StateMessage";
import { getAdminDashboardData } from "../services/data";
import type { AdminDashboardData, AdminSuggestionStats, PriceObservationDay } from "../services/types";

const emptyDashboard: AdminDashboardData = {
  stats: { products: 0, stores: 0, observations: 0, days: 0 },
  suggestions: { pending: 0, approved: 0, rejected: 0, total: 0 },
  observationHistory: [],
};

function number(value: number) {
  return new Intl.NumberFormat("es-UY").format(value);
}

function shortDate(date: string) {
  return new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`));
}

function ObservationChart({ data }: { data: PriceObservationDay[] }) {
  if (!data.length) return <div className="chart-empty">Todavía no hay observaciones para graficar.</div>;

  const width = 760;
  const height = 250;
  const padding = 34;
  const values = data.map((item) => Number(item.observation_count));
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => ({
    x: data.length === 1 ? width / 2 : padding + (index / (data.length - 1)) * (width - padding * 2),
    y: height - padding - (value / max) * (height - padding * 2),
  }));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");

  return (
    <div className="chart-wrap admin-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Observaciones de precios por día">
        <defs>
          <linearGradient id="admin-observations-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#9cf6d4" stopOpacity=".24" />
            <stop offset="100%" stopColor="#9cf6d4" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((step) => {
          const y = padding + (step / 3) * (height - padding * 2);
          return <line key={step} x1={padding} x2={width - padding} y1={y} y2={y} className="chart-grid" />;
        })}
        <path d={`${path} L${points[points.length - 1].x},${height - padding} L${points[0].x},${height - padding} Z`} fill="url(#admin-observations-fill)" />
        <path d={path} className="chart-line average-line" />
        {points.map((point, index) => <circle key={data[index].date} cx={point.x} cy={point.y} r="3.5" className="chart-point" />)}
        <text x={padding} y={height - 8} className="chart-label">{shortDate(data[0].date)}</text>
        <text x={width - padding} y={height - 8} textAnchor="end" className="chart-label">{shortDate(data[data.length - 1].date)}</text>
        <text x={padding} y={16} className="chart-value">{number(max)}</text>
        <text x={padding} y={height - padding - 4} className="chart-value">0</text>
        <title>Observaciones de precios durante los últimos días</title>
      </svg>
    </div>
  );
}

function SuggestionStatusChart({ stats }: { stats: AdminSuggestionStats }) {
  const items = [
    { key: "pending", label: "Pendientes", value: stats.pending, className: "pending" },
    { key: "approved", label: "Aprobadas", value: stats.approved, className: "approved" },
    { key: "rejected", label: "Rechazadas", value: stats.rejected, className: "rejected" },
  ];

  return (
    <div className="status-chart" aria-label="Propuestas por estado">
      {items.map((item) => {
        const percentage = stats.total ? (item.value / stats.total) * 100 : 0;
        return (
          <div className="status-chart-row" key={item.key}>
            <div className="status-chart-label"><span><i className={`status-dot ${item.className}`} />{item.label}</span><strong>{number(item.value)}</strong></div>
            <div className="status-bar"><span className={`status-bar-fill ${item.className}`} style={{ width: `${percentage}%` }} /></div>
          </div>
        );
      })}
      {!stats.total && <StateMessage compact title="Sin propuestas todavía" text="Las nuevas propuestas van a aparecer en este resumen." />}
    </div>
  );
}

export function AdminHomePage() {
  const { signOut } = useAdminAuth();
  const [data, setData] = useState<AdminDashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminDashboardData()
      .then((nextData) => {
        if (!cancelled) setData(nextData);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No pudimos cargar el resumen.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="container admin-page admin-dashboard-page">
      <div className="admin-page-header">
        <div><span className="section-kicker">Admin / panel</span><h1>Resumen general</h1><p>Una vista rápida del catálogo, la actividad de precios y las propuestas por revisar.</p></div>
        <div className="admin-header-actions"><Link className="text-link" to="/admin/productos-sugeridos">Ver sugerencias <span>↗</span></Link><button className="button button-secondary" onClick={() => void signOut()}>Cerrar sesión</button></div>
      </div>

      {error && <div className="inline-alert" role="alert">{error}</div>}
      {loading ? <div className="admin-loading dashboard-loading"><div className="loading-orb" /><p>Cargando resumen...</p></div> : (
        <>
          <div className="admin-stat-grid" aria-label="Métricas del panel">
            <div className="admin-stat-card"><span className="admin-stat-icon">◌</span><strong>{number(data.stats.products)}</strong><span>Productos seguidos</span></div>
            <div className="admin-stat-card"><span className="admin-stat-icon">⌘</span><strong>{number(data.stats.stores)}</strong><span>Cadenas comparadas</span></div>
            <div className="admin-stat-card"><span className="admin-stat-icon">↗</span><strong>{number(data.stats.observations)}</strong><span>Precios registrados</span></div>
            <div className="admin-stat-card highlight"><span className="admin-stat-icon">!</span><strong>{number(data.suggestions.pending)}</strong><span>Propuestas pendientes</span></div>
          </div>

          <div className="admin-dashboard-grid">
            <section className="admin-dashboard-card admin-observation-card">
              <div className="admin-dashboard-card-heading"><div><span className="section-kicker">Cobertura de datos</span><h2>Actividad de precios</h2></div><span className="section-note">Últimos 14 días</span></div>
              <ObservationChart data={data.observationHistory} />
            </section>
            <section className="admin-dashboard-card">
              <div className="admin-dashboard-card-heading"><div><span className="section-kicker">Flujo de trabajo</span><h2>Estado de propuestas</h2></div><span className="section-note">{number(data.suggestions.total)} en total</span></div>
              <SuggestionStatusChart stats={data.suggestions} />
              <Link className="dashboard-card-link" to="/admin/productos-sugeridos">Abrir bandeja de revisión <span>→</span></Link>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

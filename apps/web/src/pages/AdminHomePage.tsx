import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StateMessage } from "../components/StateMessage";
import { emptyAdminAnalytics, getAdminAnalytics, getAdminDashboardData } from "../services/data";
import type {
  AdminAnalytics,
  AdminAnalyticsTrafficPoint,
  AdminDashboardData,
  AdminSuggestionStats,
  AnalyticsPeriod,
  PriceObservationDay,
} from "../services/types";

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

const analyticsPeriodOptions: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "all", label: "Todo el tiempo" },
];

const trafficSeries = [
  { key: "uniqueVisitors", label: "Visitantes", color: "#0b795f", dash: undefined, marker: "circle" },
  { key: "sessions", label: "Sesiones", color: "#6d5fd0", dash: "8 5", marker: "square" },
  { key: "pageViews", label: "Páginas", color: "#d18445", dash: "2 5", marker: "diamond" },
  { key: "searches", label: "Búsquedas", color: "#3274a8", dash: "12 4 2 4", marker: "triangle" },
] as const;
type TrafficSeries = (typeof trafficSeries)[number];
type TrafficChartPoint = { x: number; y: number; value: number };
type TrafficBucket = {
  bucket: string;
  x: number;
  anchorY: number;
  series: Array<{ definition: TrafficSeries; point: TrafficChartPoint }>;
};

function trafficBucketLabel(bucket: string, period: AnalyticsPeriod) {
  const date = new Date(bucket);
  if (Number.isNaN(date.getTime())) return "";
  if (period === "today") return new Intl.DateTimeFormat("es-UY", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Montevideo" }).format(date);
  if (period === "all") return new Intl.DateTimeFormat("es-UY", { month: "short", year: "numeric", timeZone: "America/Montevideo" }).format(date);
  return new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "short", timeZone: "America/Montevideo" }).format(date);
}

function trafficTooltipLabel(bucket: string, period: AnalyticsPeriod) {
  const date = new Date(bucket);
  if (Number.isNaN(date.getTime())) return "";
  if (period === "today") return new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Montevideo" }).format(date);
  return new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Montevideo" }).format(date);
}

function TrafficPointMarker({ definition, point, active }: { definition: TrafficSeries; point: TrafficChartPoint; active: boolean }) {
  const className = `analytics-chart-marker${active ? " is-active" : ""}`;
  const markerProps = { className, fill: "#f4fbf6", stroke: definition.color, strokeWidth: 2, pointerEvents: "none" as const };
  if (definition.marker === "square") return <rect {...markerProps} x={point.x - 4} y={point.y - 4} width="8" height="8" rx="1" />;
  if (definition.marker === "diamond") return <path {...markerProps} d={`M${point.x},${point.y - 5} L${point.x + 5},${point.y} L${point.x},${point.y + 5} L${point.x - 5},${point.y} Z`} />;
  if (definition.marker === "triangle") return <path {...markerProps} d={`M${point.x},${point.y - 5} L${point.x + 5},${point.y + 4} L${point.x - 5},${point.y + 4} Z`} />;
  return <circle {...markerProps} cx={point.x} cy={point.y} r="4" />;
}

function AnalyticsTrafficTooltip({ bucket, period, width, height, padding }: { bucket: TrafficBucket; period: AnalyticsPeriod; width: number; height: number; padding: number }) {
  const tooltipWidth = 188;
  const tooltipHeight = 34 + bucket.series.length * 17;
  const x = Math.min(Math.max(bucket.x - tooltipWidth / 2, padding), width - padding - tooltipWidth);
  const aboveY = bucket.anchorY - tooltipHeight - 12;
  const y = aboveY >= padding ? aboveY : Math.min(bucket.anchorY + 12, height - padding - tooltipHeight);
  const dateLabel = trafficTooltipLabel(bucket.bucket, period);

  return (
    <g className="chart-tooltip analytics-chart-tooltip" pointerEvents="none" transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
      <rect width={tooltipWidth} height={tooltipHeight} rx="7" className="chart-tooltip-bg" />
      <text x="11" y="16" className="chart-tooltip-date">{dateLabel}</text>
      {bucket.series.map(({ definition, point }, index) => (
        <g key={definition.key}>
          <circle cx="14" cy={31 + index * 17} r="3" fill={definition.color} />
          <text x="23" y={34 + index * 17} className="chart-tooltip-value analytics-chart-tooltip-value">{definition.label}: {number(point.value)}</text>
        </g>
      ))}
    </g>
  );
}

function AnalyticsTrafficChart({ data, period }: { data: AdminAnalyticsTrafficPoint[]; period: AnalyticsPeriod }) {
  const [activeBucketIndex, setActiveBucketIndex] = useState<number | null>(null);
  useEffect(() => setActiveBucketIndex(null), [data, period]);
  if (!data.length) return <div className="chart-empty">Todavía no hay actividad para graficar.</div>;

  const width = 900;
  const height = 275;
  const padding = 36;
  const max = Math.max(1, ...data.flatMap((point) => trafficSeries.map((series) => point[series.key])));
  const pointsFor = (series: typeof trafficSeries[number]) => data.map((point, index) => ({
    x: data.length === 1 ? width / 2 : padding + (index / (data.length - 1)) * (width - padding * 2),
    y: height - padding - (point[series.key] / max) * (height - padding * 2),
  }));
  const pathFor = (points: Array<{ x: number; y: number }>) => points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const trafficBuckets: TrafficBucket[] = data.map((point, index) => {
    const x = data.length === 1 ? width / 2 : padding + (index / (data.length - 1)) * (width - padding * 2);
    const series = trafficSeries.map((definition) => {
      const value = point[definition.key];
      return {
        definition,
        point: {
          x,
          y: height - padding - (value / max) * (height - padding * 2),
          value,
        },
      };
    });
    return { bucket: point.bucket, x, anchorY: Math.min(...series.map(({ point: seriesPoint }) => seriesPoint.y)), series };
  });
  const labelIndexes = data.length > 4 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : data.map((_, index) => index);
  const activeBucket = activeBucketIndex === null ? null : trafficBuckets[activeBucketIndex] ?? null;

  return (
    <div className="chart-wrap analytics-traffic-chart">
      <div className="chart-legend" aria-label="Métricas de actividad">
        {trafficSeries.map((series) => <span key={series.key}><i className={`analytics-legend-marker marker-${series.marker}`} style={{ background: series.color, borderBottomColor: series.color }} />{series.label}</span>)}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Actividad de visitantes, sesiones, páginas y búsquedas a lo largo del tiempo">
        {[0, 1, 2, 3].map((step) => {
          const y = padding + (step / 3) * (height - padding * 2);
          return <line key={step} x1={padding} x2={width - padding} y1={y} y2={y} className="chart-grid" />;
        })}
        {trafficSeries.map((series) => <path key={series.key} d={pathFor(pointsFor(series))} className="chart-line" style={{ stroke: series.color }} strokeDasharray={series.dash} />)}
        {trafficBuckets.map((bucket, bucketIndex) => bucket.series.map(({ definition, point }) => (
          <TrafficPointMarker key={`${definition.key}-${bucket.bucket}`} definition={definition} point={point} active={activeBucketIndex === bucketIndex} />
        )))}
        {trafficBuckets.map((bucket, bucketIndex) => {
          const pointLabel = `${trafficTooltipLabel(bucket.bucket, period)}: ${bucket.series.map(({ definition, point }) => `${definition.label}, ${number(point.value)}`).join("; ")}`;
          return (
            <rect
              key={`hit-${bucket.bucket}`}
              x={bucket.x - 12}
              y={padding}
              width="24"
              height={height - padding * 2}
              rx="8"
              className="analytics-chart-hit-target"
              tabIndex={0}
              aria-label={pointLabel}
              pointerEvents="all"
              onMouseEnter={() => setActiveBucketIndex(bucketIndex)}
              onMouseLeave={() => setActiveBucketIndex(null)}
              onFocus={() => setActiveBucketIndex(bucketIndex)}
              onBlur={() => setActiveBucketIndex(null)}
            >
              <title>{pointLabel}</title>
            </rect>
          );
        })}
        {labelIndexes.map((index) => <text key={data[index].bucket} x={data.length === 1 ? width / 2 : padding + (index / (data.length - 1)) * (width - padding * 2)} y={height - 8} textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"} className="chart-label">{trafficBucketLabel(data[index].bucket, period)}</text>)}
        {activeBucket && <AnalyticsTrafficTooltip bucket={activeBucket} period={period} width={width} height={height} padding={padding} />}
        <text x={padding} y={16} className="chart-value">{number(max)}</text>
        <text x={padding} y={height - padding - 4} className="chart-value">0</text>
      </svg>
    </div>
  );
}

function AnalyticsTableEmpty() {
  return <div className="analytics-table-empty">No hay datos en este período.</div>;
}

function AnalyticsTables({ analytics }: { analytics: AdminAnalytics }) {
  return (
    <div className="admin-analytics-tables">
      <section className="admin-dashboard-card analytics-table-card">
        <div className="admin-dashboard-card-heading"><div><span className="section-kicker">Productos</span><h2>Most viewed products</h2></div></div>
        {analytics.mostViewedProducts.length ? <div className="analytics-table-scroll"><table className="analytics-table"><thead><tr><th>Producto</th><th>Vistas</th><th>Visitantes</th></tr></thead><tbody>{analytics.mostViewedProducts.map((row) => <tr key={row.productId}><td>{row.productName}</td><td>{number(row.views)}</td><td>{number(row.uniqueVisitors)}</td></tr>)}</tbody></table></div> : <AnalyticsTableEmpty />}
      </section>

      <section className="admin-dashboard-card analytics-table-card">
        <div className="admin-dashboard-card-heading"><div><span className="section-kicker">Demanda</span><h2>Top searches</h2></div></div>
        {analytics.topSearches.length ? <div className="analytics-table-scroll"><table className="analytics-table"><thead><tr><th>Consulta</th><th>Búsquedas</th><th>Prom. resultados</th></tr></thead><tbody>{analytics.topSearches.map((row) => <tr key={row.query}><td>{row.query}</td><td>{number(row.searches)}</td><td>{row.averageResultCount.toLocaleString("es-UY", { maximumFractionDigits: 1 })}</td></tr>)}</tbody></table></div> : <AnalyticsTableEmpty />}
      </section>

      <section className="admin-dashboard-card analytics-table-card">
        <div className="admin-dashboard-card-heading"><div><span className="section-kicker">Oportunidades</span><h2>Zero-result searches</h2></div></div>
        {analytics.zeroResultSearches.length ? <div className="analytics-table-scroll"><table className="analytics-table"><thead><tr><th>Consulta</th><th>Veces</th><th>Última búsqueda</th></tr></thead><tbody>{analytics.zeroResultSearches.map((row) => <tr key={row.query}><td>{row.query}</td><td>{number(row.searches)}</td><td>{shortDateTime(row.lastSearchedAt)}</td></tr>)}</tbody></table></div> : <AnalyticsTableEmpty />}
      </section>

      <section className="admin-dashboard-card analytics-table-card">
        <div className="admin-dashboard-card-heading"><div><span className="section-kicker">Navegación</span><h2>Most visited pages</h2></div></div>
        {analytics.mostVisitedPages.length ? <div className="analytics-table-scroll"><table className="analytics-table"><thead><tr><th>Página</th><th>Vistas</th></tr></thead><tbody>{analytics.mostVisitedPages.map((row) => <tr key={row.page}><td>{row.page}</td><td>{number(row.views)}</td></tr>)}</tbody></table></div> : <AnalyticsTableEmpty />}
      </section>

      <section className="admin-dashboard-card analytics-table-card analytics-referrals-card">
        <div className="admin-dashboard-card-heading"><div><span className="section-kicker">Descubrimiento</span><h2>Top product referrals</h2></div></div>
        {analytics.topProductReferrals.length ? <div className="analytics-table-scroll"><table className="analytics-table"><thead><tr><th>Producto de origen</th><th>Destino</th><th>Visitas</th><th>% destino</th></tr></thead><tbody>{analytics.topProductReferrals.map((row) => <tr key={`${row.referringProductId}-${row.destinationProductId}`}><td>{row.referringProductName}</td><td>{row.destinationProductName}</td><td>{number(row.visits)}</td><td>{row.destinationViewPercentage.toLocaleString("es-UY", { maximumFractionDigits: 1 })}%</td></tr>)}</tbody></table></div> : <AnalyticsTableEmpty />}
      </section>
    </div>
  );
}

function shortDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Montevideo" }).format(date);
}

function AnalyticsDashboard({ analytics, loading, error, period, onPeriodChange }: { analytics: AdminAnalytics; loading: boolean; error: string | null; period: AnalyticsPeriod; onPeriodChange: (period: AnalyticsPeriod) => void }) {
  const summary = analytics.summary;
  return (
    <section className="admin-analytics-section" aria-labelledby="analytics-title">
      <div className="admin-analytics-heading">
        <div><span className="section-kicker">Actividad anónima</span><h2 id="analytics-title">Analítica de producto</h2><p>Comportamiento agregado de visitantes, búsquedas y navegación interna.</p></div>
        <div className="analytics-period-picker" role="group" aria-label="Período de analítica">
          {analyticsPeriodOptions.map((option) => <button key={option.value} type="button" className={period === option.value ? "is-active" : ""} aria-pressed={period === option.value} onClick={() => onPeriodChange(option.value)}>{option.label}</button>)}
        </div>
      </div>
      {error && <div className="inline-alert" role="alert">{error}</div>}
      {loading ? <div className="admin-loading analytics-loading"><div className="loading-orb" /><p>Cargando analítica...</p></div> : (
        <>
          <div className="admin-analytics-stat-grid" aria-label="Métricas de analítica">
            <div className="admin-analytics-stat"><strong>{number(summary.uniqueVisitors)}</strong><span>Unique visitors</span></div>
            <div className="admin-analytics-stat"><strong>{number(summary.sessions)}</strong><span>Sessions</span></div>
            <div className="admin-analytics-stat"><strong>{number(summary.pageViews)}</strong><span>Page views</span></div>
            <div className="admin-analytics-stat"><strong>{number(summary.productViews)}</strong><span>Product views</span></div>
            <div className="admin-analytics-stat"><strong>{number(summary.searches)}</strong><span>Searches</span></div>
            <div className="admin-analytics-stat"><strong>{number(summary.zeroResultSearches)} <small>({summary.zeroResultPercentage.toLocaleString("es-UY", { maximumFractionDigits: 1 })}%)</small></strong><span>Zero-result searches</span></div>
            <div className="admin-analytics-stat"><strong>{summary.pagesPerSession.toLocaleString("es-UY", { maximumFractionDigits: 2 })}</strong><span>Pages per session</span></div>
            <div className="admin-analytics-stat"><strong>{summary.searchesPerSession.toLocaleString("es-UY", { maximumFractionDigits: 2 })}</strong><span>Searches per session</span></div>
          </div>
          <section className="admin-dashboard-card analytics-traffic-card">
            <div className="admin-dashboard-card-heading"><div><span className="section-kicker">Tendencia</span><h2>Traffic over time</h2></div><span className="section-note">{analyticsPeriodOptions.find((option) => option.value === period)?.label}</span></div>
            <AnalyticsTrafficChart data={analytics.traffic} period={period} />
          </section>
          <AnalyticsTables analytics={analytics} />
        </>
      )}
    </section>
  );
}

export function AdminHomePage() {
  const [data, setData] = useState<AdminDashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics>(emptyAdminAnalytics);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>("30d");
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    getAdminAnalytics(analyticsPeriod)
      .then((nextAnalytics) => {
        if (!cancelled) setAnalytics(nextAnalytics);
      })
      .catch((reason) => {
        if (!cancelled) setAnalyticsError(reason instanceof Error ? reason.message : "No pudimos cargar la analítica.");
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false);
      });
    return () => { cancelled = true; };
  }, [analyticsPeriod]);

  return (
    <div className="container admin-page admin-dashboard-page">
      <div className="admin-page-header">
        <div><span className="section-kicker">Admin / panel</span><h1>Resumen general</h1><p>Una vista rápida del catálogo, la actividad de precios y las propuestas por revisar.</p></div>
      </div>

      {error && <div className="inline-alert" role="alert">{error}</div>}
      {loading ? <div className="admin-loading dashboard-loading"><div className="loading-orb" /><p>Cargando resumen...</p></div> : (
        <>
          <div className="admin-stat-grid" aria-label="Métricas del panel">
            <div className="admin-stat-card"><span className="admin-stat-icon">◌</span><strong>{number(data.stats.products)}</strong><span>Productos seguidos</span></div>
            <div className="admin-stat-card"><span className="admin-stat-icon">◎</span><strong>{number(data.stats.stores)}</strong><span>Cadenas comparadas</span></div>
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
          <AnalyticsDashboard analytics={analytics} loading={analyticsLoading} error={analyticsError} period={analyticsPeriod} onPeriodChange={setAnalyticsPeriod} />
        </>
      )}
    </div>
  );
}

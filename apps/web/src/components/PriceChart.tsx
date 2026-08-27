import type { AveragePrice, StorePrice } from "../services/types";

const storeColors = ["#9cf6d4", "#a8b8ff", "#ffc28f", "#ef9be7"];

function shortDate(date: string) {
  return new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`));
}

function priceLabel(value: number) {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 }).format(value);
}

function chartPoints(values: number[], width: number, height: number, padding: number) {
  if (!values.length) return [];
  const min = 0;
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : padding + (index / (values.length - 1)) * (width - padding * 2),
    y: height - padding - ((value - min) / range) * (height - padding * 2),
  }));
}

function linePath(points: { x: number; y: number }[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

export function AverageChart({ data }: { data: AveragePrice[] }) {
  if (!data.length) return <div className="chart-empty">Todavía no hay días suficientes para graficar.</div>;
  const width = 760;
  const height = 260;
  const padding = 34;
  const points = chartPoints(data.map((item) => Number(item.average_price)), width, height, padding);
  const values = data.map((item) => Number(item.average_price));
  const min = 0;
  const max = Math.max(...values);
  const range = max - min || 1;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Precio promedio histórico entre supermercados">
        <defs>
          <linearGradient id="average-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#9cf6d4" stopOpacity=".22" />
            <stop offset="100%" stopColor="#9cf6d4" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((step) => {
          const y = padding + (step / 3) * (height - padding * 2);
          return <line key={step} x1={padding} x2={width - padding} y1={y} y2={y} className="chart-grid" />;
        })}
        <path d={`${linePath(points)} L${points[points.length - 1]?.x},${height - padding} L${points[0].x},${height - padding} Z`} fill="url(#average-fill)" />
        <path d={linePath(points)} className="chart-line average-line" />
        {points.map((point, index) => <circle key={data[index].date} cx={point.x} cy={point.y} r="3.5" className="chart-point" />)}
        <text x={padding} y={height - 8} className="chart-label">{shortDate(data[0].date)}</text>
        <text x={width - padding} y={height - 8} textAnchor="end" className="chart-label">{shortDate(data[data.length - 1].date)}</text>
        <text x={padding} y={16} className="chart-value">{priceLabel(max)}</text>
        <text x={padding} y={height - padding - 4} className="chart-value">{priceLabel(min)}</text>
        <title>Promedio entre supermercados, rango {range.toFixed(0)} pesos</title>
      </svg>
    </div>
  );
}

export function StoreChart({ data }: { data: StorePrice[] }) {
  const groups = [...new Map(data.map((item) => [item.store_slug, item.store_name])).entries()];
  if (!data.length) return <div className="chart-empty">Aún no hay historia por supermercado.</div>;
  const dates = [...new Set(data.map((item) => item.date))].sort();
  const width = 760;
  const height = 280;
  const padding = 34;
  const values = data.map((item) => Number(item.price));
  const min = 0;
  const max = Math.max(...values);
  const range = max - min || 1;

  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        {groups.map(([slug, name], index) => <span key={slug}><i style={{ background: storeColors[index % storeColors.length] }} />{name}</span>)}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Historial de precio por supermercado">
        {[0, 1, 2, 3].map((step) => {
          const y = padding + (step / 3) * (height - padding * 2);
          return <line key={step} x1={padding} x2={width - padding} y1={y} y2={y} className="chart-grid" />;
        })}
        {groups.map(([slug], groupIndex) => {
          const valuesForGroup = dates.map((date) => data.find((item) => item.store_slug === slug && item.date === date)?.price ?? NaN);
          const points = valuesForGroup.flatMap((value, index) => {
            if (!Number.isFinite(value)) return [];
            return [{
              x: dates.length === 1 ? width / 2 : padding + (index / (dates.length - 1)) * (width - padding * 2),
              y: height - padding - ((Number(value) - min) / range) * (height - padding * 2),
            }];
          });
          if (!points.length) return null;
          return <path key={slug} d={linePath(points)} className="chart-line" style={{ stroke: storeColors[groupIndex % storeColors.length] }} />;
        })}
        <text x={padding} y={height - 8} className="chart-label">{shortDate(dates[0])}</text>
        <text x={width - padding} y={height - 8} textAnchor="end" className="chart-label">{shortDate(dates[dates.length - 1])}</text>
        <text x={padding} y={16} className="chart-value">{priceLabel(max)}</text>
        <text x={padding} y={height - padding - 4} className="chart-value">{priceLabel(min)}</text>
        <title>Precios por cadena, rango {range.toFixed(0)} pesos</title>
      </svg>
    </div>
  );
}

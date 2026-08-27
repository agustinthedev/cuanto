import type { AveragePrice, StorePrice } from "../services/types";
import { useEffect, useState } from "react";

const storeColors = ["#9cf6d4", "#a8b8ff", "#ffc28f", "#ef9be7"];

function shortDate(date: string) {
  return new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`));
}

function priceLabel(value: number) {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 }).format(value);
}

function exactPriceLabel(value: number) {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function exactPercentageLabel(value: number) {
  return new Intl.NumberFormat("es-UY", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value));
}

function signedPercentageLabel(value: number) {
  if (value === 0) return exactPercentageLabel(0);
  return `${value < 0 ? "−" : "+"}${exactPercentageLabel(value)}`;
}

type AverageRangeKey = "7d" | "30d" | "90d" | "365d" | "custom";

const averageRangeOptions: Array<{ key: Exclude<AverageRangeKey, "custom">; label: string; days: number }> = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "365d", label: "365D", days: 365 },
];

function dateDaysBefore(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
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

type TooltipData = {
  point: { x: number; y: number };
  date: string;
  value: number;
  stores?: Array<{ name: string; value: number }>;
};

function ChartTooltip({ data, width, height, padding }: { data: TooltipData; width: number; height: number; padding: number }) {
  const stores = data.stores ?? [];
  const tooltipWidth = data.stores ? 220 : 122;
  const tooltipHeight = stores.length ? 24 + stores.length * 16 : 42;
  const x = Math.min(Math.max(data.point.x - tooltipWidth / 2, padding), width - padding - tooltipWidth);
  const aboveY = data.point.y - tooltipHeight - 12;
  const y = aboveY >= padding ? aboveY : Math.min(data.point.y + 12, height - padding - tooltipHeight);

  return (
    <g className="chart-tooltip" pointerEvents="none" transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
      <rect width={tooltipWidth} height={tooltipHeight} rx="7" className="chart-tooltip-bg" />
      <text x="11" y="16" className="chart-tooltip-date">{shortDate(data.date)}</text>
      {stores.length ? stores.map((store, index) => <text key={`${store.name}-${store.value}`} x="11" y={33 + index * 16} className="chart-tooltip-value">{store.name}: {exactPriceLabel(store.value)}</text>) : <text x="11" y="33" className="chart-tooltip-value">{exactPriceLabel(data.value)}</text>}
    </g>
  );
}

function pointLabelPosition(point: { x: number; y: number }, width: number, height: number, padding: number) {
  const labelWidth = 82;
  const labelHeight = 21;
  const gap = 9;
  const x = Math.min(Math.max(point.x - labelWidth / 2, padding), width - padding - labelWidth);
  const aboveY = point.y - labelHeight - gap;
  const y = aboveY >= padding ? aboveY : Math.min(point.y + gap, height - padding - labelHeight);
  return { x, y, width: labelWidth, height: labelHeight };
}

function ChartPointLabel({ point, value, width, height, padding }: { point: { x: number; y: number }; value: number; width: number; height: number; padding: number }) {
  const position = pointLabelPosition(point, width, height, padding);
  return (
    <g className="chart-data-label" pointerEvents="none" transform={`translate(${position.x.toFixed(1)},${position.y.toFixed(1)})`}>
      <rect width={position.width} height={position.height} rx="6" className="chart-data-label-bg" />
      <text x={position.width / 2} y="14" textAnchor="middle" className="chart-data-label-text">{exactPriceLabel(value)}</text>
    </g>
  );
}

function AverageChangeBadge({ firstValue, lastValue, rangeLabel }: { firstValue: number; lastValue: number; rangeLabel: string }) {
  const change = lastValue - firstValue;
  const percentage = firstValue ? change / firstValue : 0;
  const direction = change < 0 ? "Bajó" : change > 0 ? "Subió" : "Sin cambio";
  const changeSummary = change === 0
    ? `${direction} (${signedPercentageLabel(percentage)})`
    : `${direction} ${exactPriceLabel(Math.abs(change))} (${signedPercentageLabel(percentage)})`;

  return (
    <div className={`chart-change-badge ${change < 0 ? "is-decrease" : change > 0 ? "is-increase" : "is-neutral"}`} aria-label={`Variación ${rangeLabel}: ${changeSummary}`}>
      <span className="chart-change-arrow" aria-hidden="true">{change < 0 ? "↓" : change > 0 ? "↑" : "→"}</span>
      <span className="chart-change-copy">
        <small>{rangeLabel}</small>
        <strong>{direction}{change !== 0 && ` ${exactPriceLabel(Math.abs(change))}`}</strong>
      </span>
      <span className="chart-change-percent">{signedPercentageLabel(percentage)}</span>
    </div>
  );
}

export function AverageChart({ data }: { data: AveragePrice[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [rangeKey, setRangeKey] = useState<AverageRangeKey>("30d");
  const [customStartDate, setCustomStartDate] = useState(data[0]?.date ?? "");
  useEffect(() => {
    setRangeKey("30d");
    setCustomStartDate(data[0]?.date ?? "");
    setActiveIndex(null);
  }, [data]);
  if (!data.length) return <div className="chart-empty">Todavía no hay días suficientes para graficar.</div>;
  const width = 760;
  const height = 260;
  const padding = 34;
  const firstAvailableDate = data[0].date;
  const lastAvailableDate = data[data.length - 1].date;
  const selectedRange = averageRangeOptions.find((option) => option.key === rangeKey);
  const requestedStartDate = rangeKey === "custom"
    ? customStartDate || firstAvailableDate
    : dateDaysBefore(lastAvailableDate, (selectedRange?.days ?? 30) - 1);
  const startDate = requestedStartDate < firstAvailableDate ? firstAvailableDate : requestedStartDate > lastAvailableDate ? lastAvailableDate : requestedStartDate;
  const visibleData = data.filter((item) => item.date >= startDate && item.date <= lastAvailableDate);
  const points = chartPoints(visibleData.map((item) => Number(item.average_price)), width, height, padding);
  const values = visibleData.map((item) => Number(item.average_price));
  const min = 0;
  const max = Math.max(...values);
  const range = max - min || 1;
  const rangeLabel = rangeKey === "custom" ? `Desde ${shortDate(startDate)}` : `Últimos ${selectedRange?.days ?? 30} días`;

  return (
    <div className="chart-wrap">
      <div className="chart-range-toolbar">
        <div className="chart-range-options" role="group" aria-label="Seleccionar rango de fechas">
          <span className="chart-range-title">Rango</span>
          {averageRangeOptions.map((option) => <button key={option.key} type="button" className={`chart-range-button ${rangeKey === option.key ? "is-active" : ""}`} aria-pressed={rangeKey === option.key} onClick={() => { setRangeKey(option.key); setActiveIndex(null); }}>{option.label}</button>)}
        </div>
        <label className={`chart-date-picker ${rangeKey === "custom" ? "is-active" : ""}`}>
          <span>Desde</span>
          <input type="date" value={customStartDate} min={firstAvailableDate} max={lastAvailableDate} aria-label="Elegir fecha inicial" onFocus={() => setRangeKey("custom")} onChange={(event) => { setCustomStartDate(event.target.value); setRangeKey("custom"); setActiveIndex(null); }} />
        </label>
      </div>
      <AverageChangeBadge firstValue={values[0]} lastValue={values[values.length - 1]} rangeLabel={rangeLabel} />
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
        {points.map((point, index) => {
          const value = values[index];
          const pointLabel = `${shortDate(visibleData[index].date)}: ${exactPriceLabel(value)}`;
          return (
            <circle
              key={visibleData[index].date}
              cx={point.x}
              cy={point.y}
              r="3.5"
              className="chart-point"
              tabIndex={0}
              aria-label={pointLabel}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
            >
              <title>{pointLabel}</title>
            </circle>
          );
        })}
        {points.map((point, index) => {
          if (index !== 0 && index !== points.length - 1) return null;
          return <ChartPointLabel key={`label-${visibleData[index].date}`} point={point} value={values[index]} width={width} height={height} padding={padding} />;
        })}
        {activeIndex !== null && <ChartTooltip data={{ point: points[activeIndex], date: visibleData[activeIndex].date, value: values[activeIndex] }} width={width} height={height} padding={padding} />}
        <text x={padding} y={height - 8} className="chart-label">{shortDate(visibleData[0].date)}</text>
        <text x={width - padding} y={height - 8} textAnchor="end" className="chart-label">{shortDate(visibleData[visibleData.length - 1].date)}</text>
        <text x={padding} y={16} className="chart-value">{priceLabel(max)}</text>
        <text x={padding} y={height - padding - 4} className="chart-value">{priceLabel(min)}</text>
        <title>Promedio entre supermercados, {rangeLabel}, rango {range.toFixed(0)} pesos</title>
      </svg>
    </div>
  );
}

export function StoreChart({ data }: { data: StorePrice[] }) {
  const groups = [...new Map(data.map((item) => [item.store_slug, item.store_name])).entries()];
  const [activePoint, setActivePoint] = useState<TooltipData | null>(null);
  if (!data.length) return <div className="chart-empty">Aún no hay historia por supermercado.</div>;
  const dates = [...new Set(data.map((item) => item.date))].sort();
  const width = 760;
  const height = 280;
  const padding = 34;
  const values = data.map((item) => Number(item.price));
  const min = 0;
  const max = Math.max(...values);
  const range = max - min || 1;
  const storeSeries = groups.flatMap(([slug, name], groupIndex) => {
    const color = storeColors[groupIndex % storeColors.length];
    const valuesForGroup = dates.map((date) => data.find((item) => item.store_slug === slug && item.date === date)?.price ?? NaN);
    const points = valuesForGroup.flatMap((value, index) => {
      if (!Number.isFinite(value)) return [];
      return [{
        x: dates.length === 1 ? width / 2 : padding + (index / (dates.length - 1)) * (width - padding * 2),
        y: height - padding - ((Number(value) - min) / range) * (height - padding * 2),
        date: dates[index],
        value: Number(value),
      }];
    });
    return points.length ? [{ slug, name, color, points }] : [];
  });
  const interactionPoints = new Map<string, { point: (typeof storeSeries)[number]["points"][number]; stores: Array<{ name: string; value: number }> }>();
  storeSeries.forEach((series) => series.points.forEach((point) => {
    const key = `${point.date}:${point.value}`;
    const existing = interactionPoints.get(key);
    if (existing) {
      existing.stores.push({ name: series.name, value: point.value });
    } else {
      interactionPoints.set(key, { point, stores: [{ name: series.name, value: point.value }] });
    }
  }));

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
        {storeSeries.map(({ slug, color, points }) => (
          <g key={slug}>
            <path d={linePath(points)} className="chart-line" style={{ stroke: color }} />
            {points.map((point) => <circle key={`${slug}-${point.date}`} cx={point.x} cy={point.y} r="3.5" className="chart-point" style={{ stroke: color }} pointerEvents="none" aria-hidden="true" />)}
          </g>
        ))}
        {[...interactionPoints].map(([key, { point, stores }]) => {
          const pointLabel = `${shortDate(point.date)}: ${stores.map((store) => `${store.name}, ${exactPriceLabel(store.value)}`).join("; ")}`;
          const tooltipData = { point, date: point.date, value: point.value, stores };
          return (
            <circle
              key={key}
              cx={point.x}
              cy={point.y}
              r="8"
              className="chart-hit-target"
              tabIndex={0}
              aria-label={pointLabel}
              pointerEvents="all"
              onMouseEnter={() => setActivePoint(tooltipData)}
              onMouseLeave={() => setActivePoint(null)}
              onFocus={() => setActivePoint(tooltipData)}
              onBlur={() => setActivePoint(null)}
            >
              <title>{pointLabel}</title>
            </circle>
          );
        })}
        {activePoint && <ChartTooltip data={activePoint} width={width} height={height} padding={padding} />}
        <text x={padding} y={height - 8} className="chart-label">{shortDate(dates[0])}</text>
        <text x={width - padding} y={height - 8} textAnchor="end" className="chart-label">{shortDate(dates[dates.length - 1])}</text>
        <text x={padding} y={16} className="chart-value">{priceLabel(max)}</text>
        <text x={padding} y={height - padding - 4} className="chart-value">{priceLabel(min)}</text>
        <title>Precios por cadena, rango {range.toFixed(0)} pesos</title>
      </svg>
    </div>
  );
}

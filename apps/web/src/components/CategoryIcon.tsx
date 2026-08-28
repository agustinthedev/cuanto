export function CategoryIcon({ slug }: { slug: string }) {
  const common = { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (slug === "almacen") {
    return <svg className="category-icon" viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 10h16l-1.1 9H5.1L4 10Z" /><path {...common} d="M7 10a5 5 0 0 1 10 0M3 10h18M8 14v2m4-2v2m4-2v2" /></svg>;
  }

  if (slug === "bebidas") {
    return <svg className="category-icon" viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M7 4h10l-1 16H8L7 4Zm2-2h6M9 9h6" /></svg>;
  }

  if (slug === "lacteos") {
    return <svg className="category-icon" viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m7 5 2-2h6l2 2v15H7V5Z" /><path {...common} d="M7 8h10M11 3v5" /></svg>;
  }

  if (slug === "limpieza") {
    return <svg className="category-icon" viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M9 8h8l2 3v9H7v-9l2-3Zm2-5h5v5h-5zM17 5l3-2M7 14h12" /></svg>;
  }

  if (slug === "cuidado-personal") {
    return <svg className="category-icon" viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M9 4h6M10 2h4v2h-4v-2Zm-2 7h8v10H8V9Zm2-3h4v5h-4V6Z" /><path {...common} d="M11 14h2" /></svg>;
  }

  return <svg className="category-icon" viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m12 3 2.1 5.2L20 10l-5.9 1.8L12 17l-2.1-5.2L4 10l5.9-1.8L12 3Z" /></svg>;
}

const storeLogoUrls: Record<string, string> = {
  disco: "https://www.google.com/s2/favicons?domain=www.disco.com.uy&sz=128",
  "tienda-inglesa": "https://www.google.com/s2/favicons?domain=www.tiendainglesa.com.uy&sz=128",
  "ta-ta": "https://www.google.com/s2/favicons?domain=www.tata.com.uy&sz=128",
};

const storeWordmarks: Record<string, string> = {
  disco: "Disco",
  "tienda-inglesa": "Tienda Inglesa",
  "ta-ta": "Ta-Ta",
};

function slugFromName(name: string) {
  return name.toLocaleLowerCase("es-UY").replace(/\s+/g, "-");
}

export function StoreLogo({ name, slug, compact = false }: { name: string; slug?: string | null; compact?: boolean }) {
  const storeSlug = slug ?? slugFromName(name);
  const logoUrl = storeLogoUrls[storeSlug];
  const wordmark = storeWordmarks[storeSlug] ?? name;

  return (
    <span className={`store-logo${compact ? " compact" : ""} ${logoUrl ? "has-image" : "no-image"} store-logo-${storeSlug}`} aria-label={`${name}, logo de cadena`}>
      {logoUrl && (
        <img
          src={logoUrl}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = "none";
            const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.display = "inline";
          }}
        />
      )}
      <span className="store-wordmark">{wordmark}</span>
    </span>
  );
}

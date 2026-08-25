export class ScraperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScraperError";
  }
}

export async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit, attempts = 2): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (response.ok || response.status < 500 || attempt === attempts) return response;
      lastError = new ScraperError(`Respuesta HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 220 * attempt));
  }
  throw lastError instanceof Error ? lastError : new ScraperError("Error de red");
}

export async function requireResponseText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetchWithRetry(url, init);
  if (!response.ok) throw new ScraperError(`No se pudo leer ${url}: HTTP ${response.status}`);
  return response.text();
}

export async function requireResponseJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetchWithRetry(url, init);
  if (!response.ok) throw new ScraperError(`No se pudo leer ${url}: HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new ScraperError(`La respuesta de ${url} no es JSON válido`);
  }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");
}

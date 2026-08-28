import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "./base";

describe("fetchWithRetry", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reintenta respuestas HTTP fallidas con esperas de 2 y 5 segundos", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const firstResponse = new Response("bloqueado", { status: 403, headers: { "CF-Ray": "ray-1" } });
    const secondResponse = new Response("bloqueado", { status: 400 });
    const firstCancel = vi.spyOn(firstResponse.body!, "cancel");
    const secondCancel = vi.spyOn(secondResponse.body!, "cancel");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(secondResponse)
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const request = fetchWithRetry("https://example.test/product");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(firstCancel).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(request).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(secondCancel).toHaveBeenCalledTimes(1);
  });
});

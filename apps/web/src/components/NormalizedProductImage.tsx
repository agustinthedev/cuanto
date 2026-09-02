import { useEffect, useRef, useState } from "react";

const CANVAS_SIZE = 400;
const CANVAS_PADDING = 40;
const CANVAS_BACKGROUND = "#f2f2f2";

export function NormalizedProductImage({ src }: { src: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(canvas);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoad) return;

    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context || !image.naturalWidth || !image.naturalHeight) {
        setUseFallback(true);
        return;
      }

      const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = CANVAS_SIZE * devicePixelRatio;
      canvas.height = CANVAS_SIZE * devicePixelRatio;
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = CANVAS_BACKGROUND;
      context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      const availableSize = CANVAS_SIZE - CANVAS_PADDING * 2;
      const scale = Math.min(availableSize / image.naturalWidth, availableSize / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(image, (CANVAS_SIZE - width) / 2, (CANVAS_SIZE - height) / 2, width, height);
      setUseFallback(false);
    };
    image.onerror = () => !cancelled && setUseFallback(true);
    image.src = src;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [shouldLoad, src]);

  if (useFallback) {
    return <img src={src} alt="" className="product-image product-image-fallback" loading="lazy" />;
  }

  return <canvas ref={canvasRef} className="product-image" aria-hidden="true" />;
}

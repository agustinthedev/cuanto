import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AdminAuthProvider } from "../auth/AdminAuth";
import { AdminGuard } from "../auth/AdminGuard";
import { Layout } from "../components/Layout";
import { AdminLoginPage } from "../pages/AdminLoginPage";
import { AdminHomePage } from "../pages/AdminHomePage";
import { AdminProductsPage } from "../pages/AdminProductsPage";
import { HomePage } from "../pages/HomePage";
import { ProductPage } from "../pages/ProductPage";
import { ProductSearchPage } from "../pages/ProductSearchPage";
import { ProductSuggestionsPage } from "../pages/ProductSuggestionsPage";
import { EmailCaptureModal } from "../components/EmailCaptureModal";
import { isSupabaseConfigured } from "../lib/supabase";
import { captureEmail } from "../services/emailCapture";
import { getLocationPath, getPageType, getPageViewReferrer, getProductIdFromPath, registerUniqueProductPageView, trackEmailCaptureEvent, trackPageView } from "../services/analytics";

function AnalyticsRouteTracker() {
  const location = useLocation();
  const previousPathRef = useRef<string | null>(null);
  const lastEffectLocationRef = useRef<ReturnType<typeof useLocation> | null>(null);

  useEffect(() => {
    // React StrictMode can replay the same effect with the same location
    // object. POP navigation creates a fresh location object even when it
    // restores an existing history key, so revisits remain trackable.
    if (lastEffectLocationRef.current === location) return;
    lastEffectLocationRef.current = location;

    // Keep private admin work out of public visitor metrics. Product-to-product
    // referrals are derived from the structured previous product ID below.
    if (location.pathname.startsWith("/admin")) {
      previousPathRef.current = null;
      return;
    }

    const path = getLocationPath(location);
    const previousPath = previousPathRef.current;
    previousPathRef.current = path;
    const referrer = getPageViewReferrer(
      previousPath,
      previousPath ? "" : typeof document === "undefined" ? "" : document.referrer,
      typeof window === "undefined" ? "" : window.location.origin,
    );

    void trackPageView({
      path,
      pageType: getPageType(location.pathname),
      productId: getProductIdFromPath(location.pathname),
      referrer,
    });
  }, [location]);

  return null;
}

interface EmailCapturePromptState {
  productId: string;
  path: string;
}

interface EmailCapturePromptProps {
  productPageReady: boolean;
}

const EMAIL_CAPTURE_PROMPT_DELAY_MS = 700;

function EmailCapturePrompt({ productPageReady }: EmailCapturePromptProps) {
  const location = useLocation();
  const [prompt, setPrompt] = useState<EmailCapturePromptState | null>(null);
  const lastEffectLocationRef = useRef<ReturnType<typeof useLocation> | null>(null);
  const lastRegisteredLocationRef = useRef<ReturnType<typeof useLocation> | null>(null);
  const promptRef = useRef<EmailCapturePromptState | null>(null);
  const promptTimerRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  const clearPromptTimer = useCallback(() => {
    if (promptTimerRef.current === null) return;
    window.clearTimeout(promptTimerRef.current);
    promptTimerRef.current = null;
  }, []);

  const closePrompt = useCallback(() => {
    clearPromptTimer();
    const currentPrompt = promptRef.current;
    if (currentPrompt && !submittedRef.current) {
      void trackEmailCaptureEvent({
        eventType: "email_capture_dismissed",
        productId: currentPrompt.productId,
        path: currentPrompt.path,
      });
    }
    submittedRef.current = false;
    promptRef.current = null;
    setPrompt(null);
  }, [clearPromptTimer]);

  const submitEmail = useCallback(async (email: string) => {
    const currentPrompt = promptRef.current;
    if (!currentPrompt) return;
    await captureEmail(email, currentPrompt.productId);
    submittedRef.current = true;
    await trackEmailCaptureEvent({
      eventType: "email_capture_submitted",
      productId: currentPrompt.productId,
      path: currentPrompt.path,
    });
  }, []);

  useEffect(() => {
    if (lastEffectLocationRef.current === location) return;
    lastEffectLocationRef.current = location;
    clearPromptTimer();

    if (!isSupabaseConfigured || location.pathname.startsWith("/admin")) {
      promptRef.current = null;
      submittedRef.current = false;
      setPrompt(null);
      return;
    }

    const productId = getProductIdFromPath(location.pathname);
    if (!productId) {
      promptRef.current = null;
      submittedRef.current = false;
      setPrompt(null);
    }
  }, [clearPromptTimer, location]);

  useEffect(() => {
    if (!productPageReady || lastRegisteredLocationRef.current === location) return;

    const productId = getProductIdFromPath(location.pathname);
    if (!productId || !isSupabaseConfigured || location.pathname.startsWith("/admin")) return;

    lastRegisteredLocationRef.current = location;

    const registration = registerUniqueProductPageView(productId);
    if (!registration.shouldPrompt) return;

    const nextPrompt: EmailCapturePromptState = {
      productId,
      path: getLocationPath(location),
    };
    promptTimerRef.current = window.setTimeout(() => {
      if (lastRegisteredLocationRef.current !== location) return;
      promptTimerRef.current = null;
      promptRef.current = nextPrompt;
      submittedRef.current = false;
      setPrompt(nextPrompt);
      void trackEmailCaptureEvent({
        eventType: "email_capture_shown",
        productId,
        uniqueProductCount: registration.uniqueProductCount,
        path: nextPrompt.path,
      });
    }, EMAIL_CAPTURE_PROMPT_DELAY_MS);
  }, [location, productPageReady]);

  if (!prompt) return null;
  return <EmailCaptureModal onClose={closePrompt} onSubmit={submitEmail} />;
}

function ScrollToTop() {
  const { pathname, search, hash, state } = useLocation();
  const restoreScrollY = typeof (state as { restoreScrollY?: unknown } | null)?.restoreScrollY === "number"
    ? (state as { restoreScrollY: number }).restoreScrollY
    : null;

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";

    if (restoreScrollY !== null) {
      window.scrollTo(0, restoreScrollY);
    } else if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      target?.scrollIntoView({ block: "start", inline: "nearest" });
    } else {
      window.scrollTo(0, 0);
    }

    root.style.scrollBehavior = previousScrollBehavior;
  }, [hash, pathname, restoreScrollY, search]);

  return null;
}

function AppRoutes() {
  const location = useLocation();
  const [readyProductId, setReadyProductId] = useState<string | null>(null);
  const handleProductReady = useCallback((productId: string) => {
    setReadyProductId(productId);
  }, []);
  const currentProductId = getProductIdFromPath(location.pathname);

  return (
    <>
      <ScrollToTop />
      <AnalyticsRouteTracker />
      <EmailCapturePrompt productPageReady={currentProductId !== undefined && readyProductId === currentProductId} />
      <AdminAuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/productos" element={<ProductSearchPage />} />
            <Route path="/productos/:id" element={<ProductPage onReady={handleProductReady} />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminGuard />}>
              <Route index element={<AdminHomePage />} />
              <Route path="productos" element={<AdminProductsPage />} />
              <Route path="productos-sugeridos" element={<ProductSuggestionsPage />} />
            </Route>
            <Route path="*" element={<HomePage />} />
          </Routes>
        </Layout>
      </AdminAuthProvider>
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

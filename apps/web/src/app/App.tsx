import { useEffect, useLayoutEffect, useRef } from "react";
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
import { getLocationPath, getPageType, getPageViewReferrer, getProductIdFromPath, trackPageView } from "../services/analytics";

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

export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AnalyticsRouteTracker />
      <AdminAuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/productos" element={<ProductSearchPage />} />
            <Route path="/productos/:id" element={<ProductPage />} />
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
    </BrowserRouter>
  );
}

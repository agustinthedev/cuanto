import { useLayoutEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AdminAuthProvider } from "../auth/AdminAuth";
import { AdminGuard } from "../auth/AdminGuard";
import { Layout } from "../components/Layout";
import { AdminLoginPage } from "../pages/AdminLoginPage";
import { AdminHomePage } from "../pages/AdminHomePage";
import { HomePage } from "../pages/HomePage";
import { ProductPage } from "../pages/ProductPage";
import { ProductSearchPage } from "../pages/ProductSearchPage";
import { ProductSuggestionsPage } from "../pages/ProductSuggestionsPage";

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
      <AdminAuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/productos" element={<ProductSearchPage />} />
            <Route path="/productos/:id" element={<ProductPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminGuard />}>
              <Route index element={<AdminHomePage />} />
              <Route path="productos-sugeridos" element={<ProductSuggestionsPage />} />
            </Route>
            <Route path="*" element={<HomePage />} />
          </Routes>
        </Layout>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}

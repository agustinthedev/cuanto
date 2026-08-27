import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminAuthProvider } from "../auth/AdminAuth";
import { AdminGuard } from "../auth/AdminGuard";
import { Layout } from "../components/Layout";
import { AdminLoginPage } from "../pages/AdminLoginPage";
import { HomePage } from "../pages/HomePage";
import { ProductPage } from "../pages/ProductPage";
import { ProductSuggestionsPage } from "../pages/ProductSuggestionsPage";

export function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/productos/:id" element={<ProductPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminGuard />}>
              <Route index element={<Navigate to="productos-sugeridos" replace />} />
              <Route path="productos-sugeridos" element={<ProductSuggestionsPage />} />
            </Route>
            <Route path="*" element={<HomePage />} />
          </Routes>
        </Layout>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}

import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Icon } from "./components/Icon";
import { ToastProvider } from "./components/Toast";
import { AccountDetailsPage } from "./pages/AccountDetailsPage";
import { AccountsPage } from "./pages/AccountsPage";
import { AccountsSummaryPage } from "./pages/AccountsSummaryPage";
import { AddOperationPage } from "./pages/AddOperationPage";
import { CategoryHistoryPage } from "./pages/CategoryHistoryPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DeficitMeterPage } from "./pages/DeficitMeterPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ShopDashboardPage } from "./pages/ShopDashboardPage";
import { ProductsPage } from "./pages/ProductsPage";
import { PosPage } from "./pages/PosPage";
import { InventoryPage } from "./pages/InventoryPage";
import { SalesPage } from "./pages/SalesPage";

/** Content (error-boundary wrapped). */
function Page() {
  return (
    <ErrorBoundary>
      <RoutesContent />
    </ErrorBoundary>
  );
}

function RoutesContent() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/accounts" element={<AccountsPage />} />
      <Route path="/accounts/:id" element={<AccountDetailsPage />} />
      <Route path="/history/:category" element={<CategoryHistoryPage />} />
      <Route path="/add" element={<AddOperationPage />} />
      <Route path="/summary" element={<AccountsSummaryPage />} />
      <Route path="/deficit" element={<DeficitMeterPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/shop" element={<ShopDashboardPage />} />
      <Route path="/shop/products" element={<ProductsPage />} />
      <Route path="/shop/pos" element={<PosPage />} />
      <Route path="/shop/inventory" element={<InventoryPage />} />
      <Route path="/shop/sales" element={<SalesPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppShell>
          <Page />
        </AppShell>
      </ToastProvider>
    </BrowserRouter>
  );
}

import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PreviewBanner } from "./components/PreviewBanner";
import { ToastProvider } from "./components/Toast";
import { AccountDetailsPage } from "./pages/AccountDetailsPage";
import { AccountsPage } from "./pages/AccountsPage";
import { AccountsSummaryPage } from "./pages/AccountsSummaryPage";
import { AddOperationPage } from "./pages/AddOperationPage";
import { CategoryHistoryPage } from "./pages/CategoryHistoryPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DeficitMeterPage } from "./pages/DeficitMeterPage";
import { SettingsPage } from "./pages/SettingsPage";

/** Content with the persistent preview-data banner above it. */
function Page() {
  return (
    <ErrorBoundary>
      <PreviewBanner />
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

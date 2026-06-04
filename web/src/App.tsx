import { Routes, Route, Navigate } from "react-router-dom";
import { OSLayout } from "./layouts/OSLayout";
import { MarketingLayout } from "./app/(marketing)/MarketingLayout";

// Marketing pages (unprotected — share MarketingLayout chrome)
import LandingPage from "./app/(marketing)/LandingPage";
import PricingPage from "./app/(marketing)/PricingPage";
import FeaturesPage from "./app/(marketing)/FeaturesPage";
import ChangelogPage from "./app/(marketing)/ChangelogPage";
import AboutPage from "./app/(marketing)/AboutPage";
import NotFoundPage from "./app/(marketing)/NotFoundPage";

// Auth pages (unprotected — no layout)
import LoginPage from "./app/(auth)/login/page";
import CallbackPage from "./app/(auth)/callback/page";

// App pages (gated under OSLayout). The folder name `(os)` is kept because
// the route group convention is purely cosmetic; the URL prefix changed
// from `/os/*` to `/app/*` for SaaS convention.
import Dashboard from "./app/(os)/Dashboard";
import BodyClient from "./app/(os)/os/body/BodyClient";
import MindClient from "./app/(os)/os/mind/MindClient";
import MoneyClient from "./app/(os)/os/money/MoneyClient";
import GeneralClient from "./app/(os)/os/general/GeneralClient";
import CommandCenterClient from "./app/(os)/os/command/CommandCenterClient";
import AnalyticsClient from "./app/(os)/os/analytics/AnalyticsClient";
import HabitsPage from "./app/(os)/os/habits/page";
import JournalPage from "./app/(os)/os/journal/page";
import GoalsPage from "./app/(os)/os/goals/page";
import FocusPage from "./app/(os)/os/focus/page";
import SettingsPage from "./app/(os)/os/settings/page";
import NutritionPage from "./app/(os)/os/body/nutrition/page";
import SleepPage from "./app/(os)/os/body/sleep/page";
import WeightPage from "./app/(os)/os/body/weight/page";
import WorkoutsPage from "./app/(os)/os/body/workouts/page";
import MoneyExpenseClient from "./app/(os)/os/money/MoneyExpenseClient";
import DeepWorkPage from "./app/(os)/os/money/deep-work/page";
import BudgetsPage from "./app/(os)/os/money/budgets/page";

export function App() {
  return (
    <Routes>
      {/* Marketing — public, share MarketingLayout */}
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/changelog" element={<ChangelogPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Route>

      {/* Auth — public, no layout */}
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<CallbackPage />} />

      {/* App — gated under OSLayout */}
      <Route path="/app" element={<OSLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="body" element={<BodyClient />} />
        <Route path="body/nutrition" element={<NutritionPage />} />
        <Route path="body/sleep" element={<SleepPage />} />
        <Route path="body/weight" element={<WeightPage />} />
        <Route path="body/workouts" element={<WorkoutsPage />} />
        <Route path="mind" element={<MindClient />} />
        <Route path="money" element={<MoneyClient />} />
        <Route path="money/cashflow" element={<MoneyExpenseClient />} />
        <Route path="money/deep-work" element={<DeepWorkPage />} />
        <Route path="money/budgets" element={<BudgetsPage />} />
        <Route path="general" element={<GeneralClient />} />
        <Route path="command" element={<CommandCenterClient />} />
        <Route path="analytics" element={<AnalyticsClient />} />
        <Route path="habits" element={<HabitsPage />} />
        <Route path="journal" element={<JournalPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="focus" element={<FocusPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Back-compat: any pre-rename /os links forward into /app */}
      <Route path="/os" element={<Navigate to="/app" replace />} />
      <Route path="/os/*" element={<LegacyOsRedirect />} />

      {/* Branded 404 — wraps marketing chrome for context */}
      <Route element={<MarketingLayout />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

/** Pre-SaaS-rename links pointed at /os/... — forward them to /app/... so
 *  old emails / Discord pins / external docs don't 404. HashRouter so the
 *  path lives after the `#`. */
function LegacyOsRedirect() {
  const path = window.location.hash
    .replace(/^#/, "")
    .replace(/^\/os/, "/app");
  return <Navigate to={path || "/app"} replace />;
}

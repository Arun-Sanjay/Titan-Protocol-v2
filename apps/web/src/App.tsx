import { Routes, Route, Navigate } from "react-router-dom";
import { OSLayout } from "./layouts/OSLayout";

// OS pages - direct imports (no lazy loading = instant navigation)
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
      {/* OS routes — all under shared layout */}
      <Route path="/os" element={<OSLayout />}>
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

      {/* Everything else → straight to dashboard */}
      <Route path="*" element={<Navigate to="/os" replace />} />
    </Routes>
  );
}

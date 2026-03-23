import { Outlet } from "react-router-dom";

export function MarketingLayout() {
  return (
    <div className="tp-marketing tp-marketing-root">
      <Outlet />
    </div>
  );
}

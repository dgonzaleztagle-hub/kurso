import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { MainLayout } from "@/layouts/MainLayout";
import { StudentLayout } from "@/layouts/StudentLayout";
import { LockModal } from "./subscription/LockModal";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { userRole: globalRole } = useAuth();
  const { roleInCurrentTenant, currentTenant } = useTenant();
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (!currentTenant) {
      setIsLocked(false);
      return;
    }

    const { subscription_status, trial_ends_at } = currentTenant;

    // Check Status
    const isGrace = subscription_status === 'grace_period';
    const isLockedStatus = subscription_status === 'locked';

    // Check Date (if trial)
    let isExpiredTrial = false;
    if (subscription_status === 'trial' && trial_ends_at) {
      const daysRemaining = Math.ceil((new Date(trial_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysRemaining < 0) {
        isExpiredTrial = true;
      }
    }

    // SuperAdmin Override (Global Admins typically bypass, but here we test the flow)
    // If Global Role is 'master', we might want to bypass lock to help user?
    // User Requirement: "lock de ingreso". 
    // Let's allow Master (SuperAdmin) to bypass lock to fix things if needed, or see the org.
    if (globalRole === 'master') {
      setIsLocked(false);
    } else {
      setIsLocked(isGrace || isLockedStatus || isExpiredTrial);
    }

  }, [currentTenant, globalRole]);

  const activeRole = roleInCurrentTenant || globalRole;
  // Owners, Admins and Masters see the full App
  const showFullNav = activeRole === 'admin' || activeRole === 'master' || activeRole === 'owner';

  // If locked, we show the modal AND maybe hide content or just overlay?
  // User asked for "lock de ingreso". Best is to show modal and render nothing behind or blur.
  // LockModal behaves as an overlay. If we render children, user *can* inspect.
  // But for UX, seeing the dashboard behind a blur is nice.

  return (
    <>
      <LockModal
        isOpen={isLocked}
        isGracePeriod={currentTenant?.subscription_status === 'grace_period'}
      />

      {/* If locked, we could wrap children in a blur div or just let Modal cover it. 
          Dialog with modal=true traps focus. 
      */}
      {showFullNav ? (
        <MainLayout>{children}</MainLayout>
      ) : (
        <StudentLayout>{children}</StudentLayout>
      )}
    </>
  );
};


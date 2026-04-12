import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import OwnerPage from "./pages/OwnerPage";
import AdminPage from "./pages/AdminPage";
import KitchenPage from "./pages/KitchenPage";
import CashierPage from "./pages/CashierPage";
import InventoryPage from "./pages/InventoryPage";
import WaiterPage from "./pages/WaiterPage";
import OrderPage from "./pages/OrderPage";
import PickupOrderPage from "./pages/PickupOrderPage";
import { clearSession, getDefaultRoute, getSession, setSession } from "./auth";

function ProtectedRoute({ session, allowedRoles, children }) {
  if (!session) {
    return <Navigate replace to="/login" />;
  }

  if (!allowedRoles.includes(session.user.systemRole)) {
    return <Navigate replace to={getDefaultRoute(session.user)} />;
  }

  return children;
}

function ProtectedEmployeeRoute({ session, allowedEmployeeRoles, children }) {
  if (!session) {
    return <Navigate replace to="/login" />;
  }

  if (session.user.systemRole !== "EMPLOYEE") {
    return <Navigate replace to={getDefaultRoute(session.user)} />;
  }

  if (!allowedEmployeeRoles.includes(String(session.user.employeeRole || "").trim().toLowerCase())) {
    return <Navigate replace to={getDefaultRoute(session.user)} />;
  }

  return children;
}

function RedirectHome({ session }) {
  if (!session) {
    return <Navigate replace to="/login" />;
  }
  return <Navigate replace to={getDefaultRoute(session.user)} />;
}

export default function App() {
  const navigate = useNavigate();
  const [session, setSessionState] = useState(() => getSession());
  const role = useMemo(() => session?.user?.systemRole, [session]);

  function handleLogin(nextSession) {
    setSessionState(setSession(nextSession));
  }

  function handleLogout() {
    clearSession();
    setSessionState(null);
    navigate("/login", { replace: true });
  }

  return (
    <Routes>
      <Route path="/" element={<RedirectHome session={session} />} />
      <Route
        path="/login"
        element={role ? <Navigate replace to={getDefaultRoute(session?.user || role)} /> : <LoginPage onLogin={handleLogin} />}
      />
      <Route
        path="/signup"
        element={role ? <Navigate replace to={getDefaultRoute(session?.user || role)} /> : <SignupPage onLogin={handleLogin} />}
      />
      <Route
        path="/owner"
        element={
          <ProtectedRoute allowedRoles={["OWNER"]} session={session}>
            <OwnerPage onLogout={handleLogout} session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["SUPER_ADMIN"]} session={session}>
            <AdminPage onLogout={handleLogout} session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kitchen"
        element={
          <ProtectedEmployeeRoute allowedEmployeeRoles={["chef", "kitchen"]} session={session}>
            <KitchenPage onLogout={handleLogout} session={session} />
          </ProtectedEmployeeRoute>
        }
      />
      <Route
        path="/cashier"
        element={
          <ProtectedEmployeeRoute allowedEmployeeRoles={["cashier"]} session={session}>
            <CashierPage onLogout={handleLogout} session={session} />
          </ProtectedEmployeeRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <ProtectedEmployeeRoute allowedEmployeeRoles={["inventory_manager"]} session={session}>
            <InventoryPage onLogout={handleLogout} session={session} />
          </ProtectedEmployeeRoute>
        }
      />
      <Route
        path="/waiter"
        element={
          <ProtectedEmployeeRoute allowedEmployeeRoles={["waiter"]} session={session}>
            <WaiterPage onLogout={handleLogout} session={session} />
          </ProtectedEmployeeRoute>
        }
      />
      <Route path="/employee" element={<Navigate replace to="/" />} />
      <Route path="/t/:tableId" element={<OrderPage />} />
      <Route path="/order/:tableId" element={<OrderPage />} />
      <Route path="/:tenantSlug" element={<PickupOrderPage />} />
      <Route path="/:tenantSlug/menu" element={<PickupOrderPage />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}

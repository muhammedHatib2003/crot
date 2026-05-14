import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import OwnerPage from "./pages/OwnerPage";
import OwnerOnlineOrdersPage from "./pages/OwnerOnlineOrdersPage";
import AdminPage from "./pages/AdminPage";
import KitchenPage from "./pages/KitchenPage";
import CashierPage from "./pages/CashierPage";
import InventoryPage from "./pages/InventoryPage";
import WaiterPage from "./pages/WaiterPage";
import CourierPage from "./pages/CourierPage";
import CourierLoginPage from "./pages/CourierLoginPage";
import CourierSignupPage from "./pages/CourierSignupPage";
import OrderPage from "./pages/OrderPage";
import PickupOrderPage from "./pages/PickupOrderPage";
import OnlineOrderPage from "./pages/OnlineOrderPage";
import OnlineRestaurantPage from "./pages/OnlineRestaurantPage";
import OnlineCartPage from "./pages/OnlineCartPage";
import MyOnlineOrdersPage from "./pages/MyOnlineOrdersPage";
import OnlineCustomerLoginPage from "./pages/OnlineCustomerLoginPage";
import OnlineCustomerSignupPage from "./pages/OnlineCustomerSignupPage";
import PaymentStartPage from "./pages/PaymentStartPage";
import PaymentResultPage from "./pages/PaymentResultPage";
import LanguageSwitcher from "./components/app/LanguageSwitcher";
import { clearSession, getDefaultRoute, getSession, setSession } from "./auth";
import {
  clearOnlineCustomerSession,
  getOnlineCustomerSession,
  setOnlineCustomerSession
} from "./onlineAuth";
import { clearCourierSession, getCourierSession } from "./courierPortalAuth";

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

function ProtectedCourierRoute({ courierSession, children }) {
  if (!courierSession?.token) {
    return <Navigate replace to="/courier/login" />;
  }
  return children;
}

export default function App() {
  const navigate = useNavigate();
  const [session, setSessionState] = useState(() => getSession());
  const [courierSession, setCourierSessionState] = useState(() => getCourierSession());
  const [onlineCustomerSession, setOnlineCustomerSessionState] = useState(() => getOnlineCustomerSession());
  const role = useMemo(() => session?.user?.systemRole, [session]);

  function handleLogin(nextSession) {
    setSessionState(setSession(nextSession));
  }

  function handleLogout() {
    clearSession();
    setSessionState(null);
    navigate("/login", { replace: true });
  }

  function handleOnlineCustomerLogin(nextSession) {
    setOnlineCustomerSessionState(setOnlineCustomerSession(nextSession));
  }

  function handleOnlineCustomerLogout() {
    clearOnlineCustomerSession();
    setOnlineCustomerSessionState(null);
  }

  function handleCourierLogin(nextSession) {
    setCourierSessionState(nextSession || getCourierSession());
  }

  function handleCourierLogout() {
    clearCourierSession();
    setCourierSessionState(null);
    navigate("/courier/login", { replace: true });
  }

  return (
    <>
      <div className="fixed right-3 top-3 z-[80]">
        <LanguageSwitcher />
      </div>
      <Routes>
        <Route path="/" element={<RedirectHome session={session} />} />
        <Route
          path="/login"
          element={<LoginPage onLogin={handleLogin} session={session} />}
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
          path="/owner/online-orders"
          element={
            <ProtectedRoute allowedRoles={["OWNER"]} session={session}>
              <OwnerOnlineOrdersPage onLogout={handleLogout} session={session} />
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
        <Route
          path="/courier/login"
          element={<CourierLoginPage courierSession={courierSession} onLogin={handleCourierLogin} />}
        />
        <Route path="/courier/signup" element={<CourierSignupPage />} />
        <Route
          path="/courier"
          element={
            <ProtectedCourierRoute courierSession={courierSession}>
              <CourierPage courierSession={courierSession} onLogout={handleCourierLogout} />
            </ProtectedCourierRoute>
          }
        />
        <Route path="/employee" element={<Navigate replace to="/" />} />
        <Route
          path="/online-order"
          element={
            <OnlineOrderPage
              customerSession={onlineCustomerSession}
              onLogout={handleOnlineCustomerLogout}
            />
          }
        />
        <Route
          path="/online-order/login"
          element={
            <OnlineCustomerLoginPage
              customerSession={onlineCustomerSession}
              onLogin={handleOnlineCustomerLogin}
            />
          }
        />
        <Route
          path="/online-order/signup"
          element={
            <OnlineCustomerSignupPage
              customerSession={onlineCustomerSession}
              onLogin={handleOnlineCustomerLogin}
            />
          }
        />
        <Route
          path="/online-order/my-orders"
          element={
            <MyOnlineOrdersPage
              customerSession={onlineCustomerSession}
              onLogout={handleOnlineCustomerLogout}
            />
          }
        />
        <Route
          path="/online-order/:restaurantSlug/cart"
          element={
            <OnlineCartPage
              customerSession={onlineCustomerSession}
              onCustomerLogin={handleOnlineCustomerLogin}
              onCustomerLogout={handleOnlineCustomerLogout}
            />
          }
        />
        <Route path="/online-order/:restaurantSlug" element={<OnlineRestaurantPage />} />
        <Route
          path="/payment/start"
          element={<PaymentStartPage customerSession={onlineCustomerSession} />}
        />
        <Route
          path="/payment/result"
          element={<PaymentResultPage customerSession={onlineCustomerSession} />}
        />
        <Route path="/t/:tableId" element={<OrderPage />} />
        <Route path="/order/:tableId" element={<OrderPage />} />
        <Route path="/:tenantSlug" element={<PickupOrderPage />} />
        <Route path="/:tenantSlug/menu" element={<PickupOrderPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </>
  );
}

import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import OwnerPage from "./pages/OwnerPage";
import AdminPage from "./pages/AdminPage";
import EmployeePage from "./pages/EmployeePage";
import OrderPage from "./pages/OrderPage";
import { clearSession, getDefaultRoute, getSession, setSession } from "./auth";

function ProtectedRoute({ session, allowedRoles, children }) {
  if (!session) {
    return <Navigate replace to="/login" />;
  }

  if (!allowedRoles.includes(session.user.systemRole)) {
    return <Navigate replace to={getDefaultRoute(session.user.systemRole)} />;
  }

  return children;
}

function RedirectHome({ session }) {
  if (!session) {
    return <Navigate replace to="/login" />;
  }
  return <Navigate replace to={getDefaultRoute(session.user.systemRole)} />;
}

export default function App() {
  const navigate = useNavigate();
  const [session, setSessionState] = useState(getSession());
  const role = useMemo(() => session?.user?.systemRole, [session]);

  function handleLogin(nextSession) {
    setSession(nextSession);
    setSessionState(nextSession);
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
        element={role ? <Navigate replace to={getDefaultRoute(role)} /> : <LoginPage onLogin={handleLogin} />}
      />
      <Route
        path="/signup"
        element={role ? <Navigate replace to={getDefaultRoute(role)} /> : <SignupPage onLogin={handleLogin} />}
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
        path="/employee"
        element={
          <ProtectedRoute allowedRoles={["EMPLOYEE"]} session={session}>
            <EmployeePage onLogout={handleLogout} session={session} />
          </ProtectedRoute>
        }
      />
      <Route path="/order/:tableId" element={<OrderPage />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}

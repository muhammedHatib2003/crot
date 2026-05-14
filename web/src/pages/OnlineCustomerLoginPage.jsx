import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { loginOnlineCustomer } from "../api";

function resolveRedirectPath(rawRedirect) {
  const redirect = String(rawRedirect || "").trim();
  if (!redirect.startsWith("/") || redirect.startsWith("//")) {
    return "/online-order";
  }

  return redirect;
}

export default function OnlineCustomerLoginPage({ customerSession, onLogin }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const redirectPath = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    return resolveRedirectPath(params.get("redirect"));
  }, [location.search]);

  if (customerSession) {
    return <Navigate replace to={redirectPath} />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = await loginOnlineCustomer({ email, password });
      onLogin(payload);
      navigate(redirectPath, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">{t("onlineAuth.login.title")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("onlineAuth.login.description")}</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm text-slate-700">
            {t("auth.login.email")}
            <input
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>

          <label className="block text-sm text-slate-700">
            {t("auth.login.password")}
            <input
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="text-sm text-rose-700">{error}</p> : null}

          <button
            className="w-full rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            type="submit"
          >
            {loading ? t("auth.login.loading") : t("auth.login.submit")}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          {t("onlineAuth.login.signupPrompt")}{" "}
          <Link className="font-medium text-brand-700 hover:text-brand-900" to={`/online-order/signup?redirect=${encodeURIComponent(redirectPath)}`}>
            {t("onlineAuth.login.signupLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}

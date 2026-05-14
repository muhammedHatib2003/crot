import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { signupOnlineCustomer } from "../api";

function resolveRedirectPath(rawRedirect) {
  const redirect = String(rawRedirect || "").trim();
  if (!redirect.startsWith("/") || redirect.startsWith("//")) {
    return "/online-order";
  }

  return redirect;
}

export default function OnlineCustomerSignupPage({ customerSession, onLogin }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
      const payload = await signupOnlineCustomer({
        fullName,
        email,
        phone,
        password
      });
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
        <h1 className="text-2xl font-semibold text-slate-900">{t("onlineAuth.signup.title")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("onlineAuth.signup.description")}</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm text-slate-700">
            {t("onlineAuth.signup.fullName")}
            <input
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              onChange={(event) => setFullName(event.target.value)}
              value={fullName}
            />
          </label>

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
            {t("common.labels.phone")}
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              onChange={(event) => setPhone(event.target.value)}
              value={phone}
            />
          </label>

          <label className="block text-sm text-slate-700">
            {t("auth.login.password")}
            <input
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              minLength={6}
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
            {loading ? t("onlineAuth.signup.loading") : t("onlineAuth.signup.submit")}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          {t("onlineAuth.signup.loginPrompt")}{" "}
          <Link className="font-medium text-brand-700 hover:text-brand-900" to={`/online-order/login?redirect=${encodeURIComponent(redirectPath)}`}>
            {t("onlineAuth.signup.loginLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}

import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiRequest } from "../api";
import { setCourierSession } from "../courierPortalAuth";

export default function CourierLoginPage({ courierSession, onLogin }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (courierSession?.token) {
      navigate("/courier", { replace: true });
    }
  }, [courierSession, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await apiRequest("/courier-auth/login", {
        method: "POST",
        body: { email, password }
      });
      const next = setCourierSession({ token: result.token, courier: result.courier });
      if (next) {
        onLogin?.(next);
      }
      navigate("/courier", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-brand-100/70">
        <h1 className="text-2xl font-bold text-brand-900">{t("courierPortal.login.title")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("courierPortal.login.description")}</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t("auth.login.email")}</label>
            <input
              required
              type="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t("auth.login.password")}</label>
            <input
              required
              type="password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            disabled={loading}
            className="w-full rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white transition hover:bg-brand-900 disabled:opacity-60"
            type="submit"
          >
            {loading ? t("courierPortal.login.loading") : t("courierPortal.login.submit")}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          {t("courierPortal.login.signupPrompt")}{" "}
          <Link className="font-medium text-brand-700 hover:text-brand-900" to="/courier/signup">
            {t("courierPortal.login.signupLink")}
          </Link>
        </p>
        <p className="mt-3 text-sm text-slate-600">
          <Link className="font-medium text-slate-700 hover:text-brand-900" to="/login">
            {t("courierPortal.login.staffLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}

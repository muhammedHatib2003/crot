import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFormPost } from "../api";

export default function CourierSignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [documentFile, setDocumentFile] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!documentFile) {
      setError(t("courierPortal.signup.documentRequired"));
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("fullName", fullName.trim());
      formData.append("email", email.trim());
      formData.append("password", password);
      if (phone.trim()) {
        formData.append("phone", phone.trim());
      }
      formData.append("document", documentFile);

      const result = await apiFormPost("/courier-auth/register", formData);
      setSuccess(result.message || t("courierPortal.signup.success"));
      setTimeout(() => navigate("/courier/login", { replace: true }), 2000);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-brand-100/70">
        <h1 className="text-2xl font-bold text-brand-900">{t("courierPortal.signup.title")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("courierPortal.signup.description")}</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t("courierPortal.signup.fullName")}</label>
            <input
              required
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
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
            <label className="mb-1 block text-sm font-medium text-slate-700">{t("courierPortal.signup.phone")}</label>
            <input
              type="tel"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t("auth.login.password")}</label>
            <input
              required
              minLength={6}
              type="password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t("courierPortal.signup.document")}</label>
            <input
              required
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              type="file"
              className="w-full text-sm text-slate-600"
              onChange={(event) => setDocumentFile(event.target.files?.[0] || null)}
            />
            <p className="mt-1 text-xs text-slate-500">{t("courierPortal.signup.documentHint")}</p>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
          <button
            disabled={loading}
            className="w-full rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white transition hover:bg-brand-900 disabled:opacity-60"
            type="submit"
          >
            {loading ? t("courierPortal.signup.submitting") : t("courierPortal.signup.submit")}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          {t("courierPortal.signup.loginPrompt")}{" "}
          <Link className="font-medium text-brand-700 hover:text-brand-900" to="/courier/login">
            {t("courierPortal.signup.loginLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}

import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { apiRequest } from "../api";
import { getDefaultRoute } from "../auth";

export default function SignupPage({ onLogin }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    restaurantName: "",
    phone: "",
    restaurantPhone: "",
    email: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await apiRequest("/auth/owner-signup", {
        method: "POST",
        body: form
      });
      onLogin(result);
      navigate(getDefaultRoute(result.user), { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-xl shadow-brand-100/70">
        <h1 className="text-2xl font-bold text-brand-900">Owner Sign Up</h1>
        <p className="mt-2 text-sm text-slate-600">Create your restaurant account first.</p>

        <form className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Your Name</label>
            <input
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
              value={form.fullName}
              onChange={(event) => updateField("fullName", event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Restaurant Name</label>
            <input
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
              value={form.restaurantName}
              onChange={(event) => updateField("restaurantName", event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Restaurant Phone</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
              value={form.restaurantPhone}
              onChange={(event) => updateField("restaurantPhone", event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              required
              type="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              required
              type="password"
              minLength={6}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}

          <div className="md:col-span-2">
            <button
              disabled={loading}
              className="w-full rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white transition hover:bg-brand-900 disabled:opacity-60"
              type="submit"
            >
              {loading ? "Creating..." : "Create owner account"}
            </button>
          </div>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Already have an account?{" "}
          <Link className="font-medium text-brand-700 hover:text-brand-900" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

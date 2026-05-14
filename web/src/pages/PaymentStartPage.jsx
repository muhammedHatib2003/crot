import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { startIyzicoCheckout } from "../api";

export default function PaymentStartPage({ customerSession }) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const orderId = searchParams.get("orderId") || "";

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkoutFormHtml, setCheckoutFormHtml] = useState("");
  const startedForRef = useRef("");

  async function startPayment() {
    if (!customerSession?.token || !orderId) {
      return;
    }

    setLoading(true);
    setError("");
    setCheckoutFormHtml("");

    try {
      const result = await startIyzicoCheckout(orderId, customerSession.token);

      if (result.paymentPageUrl) {
        window.location.href = result.paymentPageUrl;
        return;
      }

      if (result.checkoutFormContent) {
        setCheckoutFormHtml(result.checkoutFormContent);
        return;
      }

      setError("Iyzico odeme sayfasi alinamadi.");
    } catch (requestError) {
      setError(requestError.message || "Odeme baslatilamadi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!orderId || !customerSession?.token) {
      return;
    }

    if (startedForRef.current === orderId) {
      return;
    }

    startedForRef.current = orderId;
    startPayment();
  }, [orderId, customerSession?.token]);

  if (!customerSession?.token) {
    return <Navigate replace to={`/online-order/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} />;
  }

  if (!orderId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Odeme</h1>
          <p className="mt-2 text-sm text-rose-700">Siparis bulunamadi (orderId yok).</p>
          <Link className="mt-4 inline-block text-sm font-medium text-brand-700 hover:text-brand-900" to="/online-order/my-orders">
            Siparislerime don
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Iyzico ile odeme</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sandbox modu. Test kartlari ile odeme yapabilirsiniz.
        </p>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        {!checkoutFormHtml ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-slate-600">
              {loading ? "Odeme sayfasi hazirlaniyor..." : "Odeme sayfasini baslatmak icin Odemeye Git butonuna basin."}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
                onClick={startPayment}
                type="button"
              >
                {loading ? "Yonlendiriliyor..." : "Odemeye Git"}
              </button>
              <Link
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                to="/online-order/my-orders"
              >
                Siparislerime don
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-slate-600">
              Iyzico Sandbox formu yukleniyor. Yuklenmiyorsa onceki butona tekrar basin.
            </p>
            <div
              id="iyzipay-checkout-form"
              className="responsive"
              dangerouslySetInnerHTML={{ __html: checkoutFormHtml }}
            />
          </div>
        )}
      </section>
    </div>
  );
}

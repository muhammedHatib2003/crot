import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getIyzicoPaymentStatus } from "../api";

const STATUS_COPY = {
  success: {
    title: "Odeme basarili",
    description: "Siparisiniz onaylandi. Mutfak hazirlamaya basliyor.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700"
  },
  failure: {
    title: "Odeme basarisiz",
    description: "Odeme tamamlanamadi. Tekrar denemek isterseniz Odemeye Git butonunu kullanabilirsiniz.",
    tone: "border-rose-200 bg-rose-50 text-rose-700"
  }
};

const REASON_COPY = {
  missing_token: "Iyzico token bulunamadi.",
  payment_not_found: "Bu odeme kaydi bulunamadi.",
  conversation_mismatch: "Iyzico ve sistem arasinda dogrulama uyusmazligi.",
  iyzico_retrieve_failed: "Iyzico tarafindan dogrulama alinamadi.",
  server_error: "Sunucu hatasi.",
  ORDER_ALREADY_PAID: "Odeme zaten yapilmis."
};

export default function PaymentResultPage({ customerSession }) {
  const [searchParams] = useSearchParams();
  const status = (searchParams.get("status") || "failure").toLowerCase();
  const orderId = searchParams.get("orderId") || "";
  const reason = searchParams.get("reason") || "";
  const copy = STATUS_COPY[status] || STATUS_COPY.failure;

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId || !customerSession?.token) {
      return;
    }

    let active = true;
    setLoading(true);

    getIyzicoPaymentStatus(orderId, customerSession.token)
      .then((data) => {
        if (active) {
          setDetails(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [customerSession?.token, orderId]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className={`rounded-2xl border px-6 py-6 shadow-sm ${copy.tone}`}>
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="mt-2 text-sm">{copy.description}</p>
        {reason ? <p className="mt-2 text-xs opacity-80">{REASON_COPY[reason] || reason}</p> : null}
      </div>

      <section className="mt-5 rounded-2xl bg-white p-5 text-sm text-slate-700 shadow-sm">
        <p>
          Siparis: <span className="font-medium text-slate-900">{orderId || "-"}</span>
        </p>
        {loading ? (
          <p className="mt-2 text-slate-500">Durum aliniyor...</p>
        ) : details ? (
          <div className="mt-2 space-y-1">
            <p>
              Siparis durumu: <span className="font-medium text-slate-900">{details.orderStatus}</span>
            </p>
            <p>
              Odeme durumu: <span className="font-medium text-slate-900">{details.paymentStatus}</span>
            </p>
            {details.payment?.iyzicoPaymentId ? (
              <p className="text-xs text-slate-500">iyzico paymentId: {details.payment.iyzicoPaymentId}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
          to="/online-order/my-orders"
        >
          Siparislerim
        </Link>
        {status !== "success" && orderId ? (
          <Link
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            to={`/payment/start?orderId=${encodeURIComponent(orderId)}`}
          >
            Tekrar Odemeye Git
          </Link>
        ) : null}
        <Link
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          to="/online-order"
        >
          Restoranlar
        </Link>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getIyzicoPaymentStatus } from "../api";
import useAppTranslation from "../hooks/useAppTranslation";

export default function PaymentResultPage({ customerSession }) {
  const { t } = useAppTranslation();
  const [searchParams] = useSearchParams();
  const kind = (searchParams.get("kind") || "order").toLowerCase();
  const isSubscription = kind === "subscription";
  const status = (searchParams.get("status") || "failure").toLowerCase();
  const orderId = searchParams.get("orderId") || "";
  const planCode = searchParams.get("planCode") || "";
  const reason = searchParams.get("reason") || "";
  const copyNamespace = isSubscription ? "payment.subscription" : "payment.order";
  const resultStatus = status === "success" ? "success" : "failure";

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSubscription || !orderId || !customerSession?.token) {
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
  }, [customerSession?.token, orderId, isSubscription]);

  const tone =
    resultStatus === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700";
  const reasonMessage = reason ? t(`payment.reasons.${reason}`, { defaultValue: reason }) : "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className={`rounded-2xl border px-6 py-6 shadow-sm ${tone}`}>
        <h1 className="text-2xl font-semibold">{t(`${copyNamespace}.${resultStatus}Title`)}</h1>
        <p className="mt-2 text-sm">{t(`${copyNamespace}.${resultStatus}Description`)}</p>
        {reasonMessage ? <p className="mt-2 text-xs opacity-80">{reasonMessage}</p> : null}
      </div>

      {isSubscription ? (
        <section className="mt-5 rounded-2xl bg-white p-5 text-sm text-slate-700 shadow-sm">
          {planCode ? (
            <p>
              {t("payment.planLabel")} <span className="font-medium text-slate-900">{planCode}</span>
            </p>
          ) : null}
          <p className="mt-2 text-slate-500">{t("payment.subscriptionHint")}</p>
        </section>
      ) : (
        <section className="mt-5 rounded-2xl bg-white p-5 text-sm text-slate-700 shadow-sm">
          <p>
            {t("payment.orderLabel")} <span className="font-medium text-slate-900">{orderId || "-"}</span>
          </p>
          {loading ? (
            <p className="mt-2 text-slate-500">{t("payment.loadingStatus")}</p>
          ) : details ? (
            <div className="mt-2 space-y-1">
              <p>
                {t("payment.orderStatus")} <span className="font-medium text-slate-900">{details.orderStatus}</span>
              </p>
              <p>
                {t("payment.paymentStatusLabel")} <span className="font-medium text-slate-900">{details.paymentStatus}</span>
              </p>
              {details.payment?.iyzicoPaymentId ? (
                <p className="text-xs text-slate-500">
                  {t("payment.iyzicoPaymentId", { id: details.payment.iyzicoPaymentId })}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {isSubscription ? (
          <Link
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
            to="/owner"
          >
            {t("payment.ownerPanel")}
          </Link>
        ) : (
          <Link
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
            to="/online-order/my-orders"
          >
            {t("payment.myOrders")}
          </Link>
        )}
        {!isSubscription && status !== "success" && orderId ? (
          <Link
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            to={`/payment/start?orderId=${encodeURIComponent(orderId)}`}
          >
            {t("payment.retryPayment")}
          </Link>
        ) : null}
        {!isSubscription ? (
          <Link
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            to="/online-order"
          >
            {t("payment.restaurants")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

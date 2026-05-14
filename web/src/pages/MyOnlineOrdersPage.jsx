import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { getMyOnlineOrders } from "../api";
import { formatTryCurrency } from "../utils/currency";

export default function MyOnlineOrdersPage({ customerSession, onLogout }) {
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!customerSession?.token) {
      return;
    }

    let active = true;

    async function loadOrders() {
      setLoading(true);
      setError("");

      try {
        const payload = await getMyOnlineOrders(customerSession.token);
        if (!active) {
          return;
        }

        setOrders(payload.orders || []);
      } catch (requestError) {
        if (!active) {
          return;
        }

        setError(requestError.message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadOrders();

    return () => {
      active = false;
    };
  }, [customerSession?.token]);

  if (!customerSession?.token) {
    return <Navigate replace to={`/online-order/login?redirect=${encodeURIComponent(location.pathname)}`} />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Online Siparislerim</h1>
            <p className="mt-1 text-sm text-slate-600">Hesabiniza ait online siparisler.</p>
          </div>
          {onLogout ? (
            <button
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              onClick={onLogout}
              type="button"
            >
              Cikis
            </button>
          ) : null}
        </div>
      </header>

      {loading ? <div className="rounded-2xl bg-white p-6 text-slate-600 shadow-sm">Siparisler yukleniyor...</div> : null}
      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      {!loading && orders.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-slate-600 shadow-sm">
          Henuz online siparisiniz yok. <Link className="text-brand-700 hover:text-brand-900" to="/online-order">Restoranlari gor</Link>
        </div>
      ) : null}

      <div className="space-y-4">
        {orders.map((order) => (
          <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">{new Date(order.createdAt).toLocaleString()}</p>
                <h2 className="text-lg font-semibold text-slate-900">{order.restaurant?.name || "Restoran"}</h2>
                <p className="text-sm text-slate-600">{order.orderCode || order.publicId || order.id} - {order.orderType}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{order.status}</span>
            </div>

            <div className="mt-4 space-y-2">
              {(order.items || []).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span>
                    {item.quantity} x {item.productNameSnapshot}
                  </span>
                  <span>{formatTryCurrency(item.totalPrice)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-1 text-sm">
              <p className="flex justify-between text-slate-600">
                <span>Ara toplam</span>
                <span>{formatTryCurrency(order.subtotal)}</span>
              </p>
              <p className="flex justify-between text-slate-600">
                <span>Teslimat</span>
                <span>{formatTryCurrency(order.deliveryFee)}</span>
              </p>
              <p className="flex justify-between font-semibold text-slate-900">
                <span>Toplam</span>
                <span>{formatTryCurrency(order.total)}</span>
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

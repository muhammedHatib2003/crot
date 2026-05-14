import { formatTryCurrency } from "../../utils/currency";

export default function CartSummary({ cart, totals, onIncrease, onDecrease, onRemove, checkoutButton }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Sepet</h2>
      <p className="mt-1 text-sm text-slate-500">{cart.restaurant?.name || "Restoran secili degil"}</p>

      <div className="mt-4 space-y-3">
        {cart.items.map((item) => (
          <article key={item.productId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{item.name}</p>
                <p className="text-sm text-slate-500">{formatTryCurrency(item.price)} x {item.quantity}</p>
              </div>
              <p className="font-semibold text-slate-900">{formatTryCurrency(item.price * item.quantity)}</p>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100"
                onClick={() => onDecrease(item.productId)}
                type="button"
              >
                -
              </button>
              <span className="min-w-8 text-center text-sm font-semibold text-slate-900">{item.quantity}</span>
              <button
                className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100"
                onClick={() => onIncrease(item.productId)}
                type="button"
              >
                +
              </button>
              <button
                className="ml-auto rounded-md border border-rose-300 px-2 py-1 text-sm text-rose-700 hover:bg-rose-50"
                onClick={() => onRemove(item.productId)}
                type="button"
              >
                Kaldir
              </button>
            </div>
          </article>
        ))}

        {cart.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Sepetiniz bos.</div>
        ) : null}
      </div>

      <div className="mt-5 space-y-1 border-t border-slate-200 pt-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Ara toplam</span>
          <span className="font-medium text-slate-900">{formatTryCurrency(totals.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Teslimat ucreti</span>
          <span className="font-medium text-slate-900">{formatTryCurrency(totals.deliveryFee)}</span>
        </div>
        <div className="flex items-center justify-between text-base font-semibold">
          <span className="text-slate-900">Genel toplam</span>
          <span className="text-slate-900">{formatTryCurrency(totals.total)}</span>
        </div>
      </div>

      <div className="mt-4">{checkoutButton}</div>
    </section>
  );
}

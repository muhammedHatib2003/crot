import { formatTryCurrency } from "../../utils/currency";

export default function ProductCard({ product, onAdd }) {
  const disabled = !product.isAvailable || product.isOrderable === false;

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{product.name}</h3>
          <p className="mt-1 text-sm text-slate-600">{product.description || "Aciklama yok"}</p>
          <p className="mt-2 text-xs text-slate-500">{disabled ? "Musait degil" : `Hazirlik: ${product.preparationMinutes || 0} dk`}</p>
        </div>
        <p className="text-base font-semibold text-brand-900">{formatTryCurrency(product.price)}</p>
      </div>

      <button
        className="mt-4 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={() => onAdd(product)}
        type="button"
      >
        {disabled ? "Stokta yok" : "Sepete ekle"}
      </button>
    </article>
  );
}

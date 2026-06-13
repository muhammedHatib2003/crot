import useAppTranslation from "../../hooks/useAppTranslation";
import {
  formatPrintCurrency,
  formatPrintDateTime,
  getOrderItems,
  getOrderLocationLabel,
  getOrderTypeLabel,
  getOrderUnitPrice
} from "./printUtils";

function getCurrencySymbol(order) {
  const explicit = order?.payment?.currency || order?.currency || "";
  if (explicit) {
    return String(explicit).trim();
  }

  const orderType = String(order?.orderType || "").trim().toUpperCase();
  const source = String(order?.source || "").trim().toUpperCase();

  if (orderType === "DELIVERY" || orderType === "PICKUP" || source === "ONLINE") {
    return "TL";
  }
  return "$";
}

function getPaymentLabel(order) {
  const method = order?.payment?.paymentMethod || order?.paymentMethod;
  if (!method) {
    return null;
  }
  return String(method).toUpperCase();
}

function getPaymentStatusLabel(order, t) {
  const status = String(order?.paymentStatus || "").trim().toUpperCase();
  if (!status) {
    return t("common.notAvailable");
  }
  if (status === "PAID") {
    return t("print.paymentStatus.paid");
  }
  if (status === "PENDING") {
    return t("print.paymentStatus.pending");
  }
  if (status === "FAILED") {
    return t("print.paymentStatus.failed");
  }
  return status;
}

export default function CustomerReceiptPrint({ order, restaurant }) {
  const { t } = useAppTranslation();

  if (!order) {
    return null;
  }

  const restaurantName = restaurant?.name || order?.restaurant?.name || t("print.restaurantFallback");
  const items = getOrderItems(order);
  const orderTypeLabel = getOrderTypeLabel(order);
  const locationLabel = getOrderLocationLabel(order);
  const currency = getCurrencySymbol(order);
  const paymentLabel = getPaymentLabel(order);

  const itemsTotal = items.reduce((sum, item) => {
    const unit = getOrderUnitPrice(item);
    const qty = Number(item?.quantity || 0);
    return sum + unit * qty;
  }, 0);

  const subtotal = Number(
    order.subtotal != null && order.subtotal !== 0
      ? order.subtotal
      : order.subtotalCents
      ? order.subtotalCents / 100
      : itemsTotal
  );
  const deliveryFee = Number(
    order.deliveryFee != null
      ? order.deliveryFee
      : order.deliveryFeeCents
      ? order.deliveryFeeCents / 100
      : 0
  );
  const total = Number(
    order.totalPrice != null
      ? order.totalPrice
      : order.total != null
      ? order.total
      : order.totalCents
      ? order.totalCents / 100
      : subtotal + deliveryFee
  );
  const discount = Number(order.discount || order.discountAmount || 0);
  const tax = Number(order.tax || order.taxAmount || 0);

  return (
    <article className="print-ticket print-ticket--customer">
      <header className="print-ticket__header">
        <h1 className="print-ticket__restaurant">{restaurantName}</h1>
        <p className="print-ticket__subtitle">{t("print.customerReceipt")}</p>
      </header>

      <section className="print-ticket__meta">
        <div className="print-ticket__row">
          <span className="print-ticket__label">{t("print.order")}</span>
          <span className="print-ticket__value print-ticket__value--strong">
            {order.orderCode || order.id}
          </span>
        </div>
        <div className="print-ticket__row">
          <span className="print-ticket__label">{t("print.date")}</span>
          <span className="print-ticket__value">{formatPrintDateTime(order.createdAt)}</span>
        </div>
        <div className="print-ticket__row">
          <span className="print-ticket__label">{t("print.type")}</span>
          <span className="print-ticket__value">{orderTypeLabel}</span>
        </div>
        <div className="print-ticket__row">
          <span className="print-ticket__label">{t("print.location")}</span>
          <span className="print-ticket__value">{locationLabel}</span>
        </div>
        {order.customerName ? (
          <div className="print-ticket__row">
            <span className="print-ticket__label">{t("print.customer")}</span>
            <span className="print-ticket__value">{order.customerName}</span>
          </div>
        ) : null}
      </section>

      <div className="print-ticket__divider" />

      <section className="print-ticket__items print-ticket__items--receipt">
        <div className="print-ticket__items-header">
          <span className="print-ticket__col print-ticket__col--qty">{t("print.qty")}</span>
          <span className="print-ticket__col print-ticket__col--name">{t("print.product")}</span>
          <span className="print-ticket__col print-ticket__col--price">{t("print.unitPrice")}</span>
          <span className="print-ticket__col print-ticket__col--total">{t("print.amount")}</span>
        </div>
        {items.length === 0 ? (
          <p className="print-ticket__empty">{t("print.noItems")}</p>
        ) : (
          items.map((item, index) => {
            const itemKey = item.id || `${item.name || item.productName || "item"}-${index}`;
            const itemName = item.name || item.productName || item.productNameSnapshot || t("print.productFallback");
            const unitPrice = getOrderUnitPrice(item);
            const qty = Number(item?.quantity || 0);
            const lineTotal = unitPrice * qty;

            return (
              <div className="print-ticket__item-row" key={itemKey}>
                <span className="print-ticket__col print-ticket__col--qty">{qty}</span>
                <span className="print-ticket__col print-ticket__col--name">{itemName}</span>
                <span className="print-ticket__col print-ticket__col--price">
                  {formatPrintCurrency(unitPrice)}
                </span>
                <span className="print-ticket__col print-ticket__col--total">
                  {formatPrintCurrency(lineTotal)}
                </span>
              </div>
            );
          })
        )}
      </section>

      <div className="print-ticket__divider" />

      <section className="print-ticket__totals">
        <div className="print-ticket__row">
          <span className="print-ticket__label">{t("print.subtotal")}</span>
          <span className="print-ticket__value">
            {formatPrintCurrency(subtotal)} {currency}
          </span>
        </div>
        {deliveryFee > 0 ? (
          <div className="print-ticket__row">
            <span className="print-ticket__label">{t("print.delivery")}</span>
            <span className="print-ticket__value">
              {formatPrintCurrency(deliveryFee)} {currency}
            </span>
          </div>
        ) : null}
        {discount > 0 ? (
          <div className="print-ticket__row">
            <span className="print-ticket__label">{t("print.discount")}</span>
            <span className="print-ticket__value">
              - {formatPrintCurrency(discount)} {currency}
            </span>
          </div>
        ) : null}
        {tax > 0 ? (
          <div className="print-ticket__row">
            <span className="print-ticket__label">{t("print.tax")}</span>
            <span className="print-ticket__value">
              {formatPrintCurrency(tax)} {currency}
            </span>
          </div>
        ) : null}
        <div className="print-ticket__row print-ticket__row--total">
          <span className="print-ticket__label print-ticket__label--strong">{t("print.total")}</span>
          <span className="print-ticket__value print-ticket__value--strong">
            {formatPrintCurrency(total)} {currency}
          </span>
        </div>
        <div className="print-ticket__row">
          <span className="print-ticket__label">{t("print.payment")}</span>
          <span className="print-ticket__value">
            {paymentLabel ? `${paymentLabel} - ${getPaymentStatusLabel(order, t)}` : getPaymentStatusLabel(order, t)}
          </span>
        </div>
      </section>

      <div className="print-ticket__divider" />

      <footer className="print-ticket__thanks">
        <p>{t("print.thanks")}</p>
        <p>{t("print.enjoy")}</p>
      </footer>
    </article>
  );
}

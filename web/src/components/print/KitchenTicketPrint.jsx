import useAppTranslation from "../../hooks/useAppTranslation";
import {
  formatPrintDateTime,
  getOrderItems,
  getOrderLocationLabel,
  getOrderTypeLabel
} from "./printUtils";

export default function KitchenTicketPrint({ order, restaurant }) {
  const { t } = useAppTranslation();

  if (!order) {
    return null;
  }

  const restaurantName = restaurant?.name || order?.restaurant?.name || t("print.restaurantFallback");
  const items = getOrderItems(order);
  const orderTypeLabel = getOrderTypeLabel(order);
  const locationLabel = getOrderLocationLabel(order);
  const deliveryAddress =
    order.orderType === "DELIVERY"
      ? order.deliveryAddressText || order.customerAddress || ""
      : "";

  return (
    <article className="print-ticket print-ticket--kitchen">
      <header className="print-ticket__header">
        <h1 className="print-ticket__restaurant">{restaurantName}</h1>
        <p className="print-ticket__subtitle">{t("print.kitchenTicket")}</p>
      </header>

      <section className="print-ticket__meta">
        <div className="print-ticket__row">
          <span className="print-ticket__label">{t("print.order")}</span>
          <span className="print-ticket__value print-ticket__value--strong">
            {order.orderCode || order.id}
          </span>
        </div>
        <div className="print-ticket__row">
          <span className="print-ticket__label">{t("print.type")}</span>
          <span className="print-ticket__value">{orderTypeLabel}</span>
        </div>
        <div className="print-ticket__row">
          <span className="print-ticket__label">{t("print.location")}</span>
          <span className="print-ticket__value">{locationLabel}</span>
        </div>
        <div className="print-ticket__row">
          <span className="print-ticket__label">{t("print.time")}</span>
          <span className="print-ticket__value">{formatPrintDateTime(order.createdAt)}</span>
        </div>
        {order.customerName ? (
          <div className="print-ticket__row">
            <span className="print-ticket__label">{t("print.customer")}</span>
            <span className="print-ticket__value">{order.customerName}</span>
          </div>
        ) : null}
        {order.customerPhone ? (
          <div className="print-ticket__row">
            <span className="print-ticket__label">{t("print.phone")}</span>
            <span className="print-ticket__value">{order.customerPhone}</span>
          </div>
        ) : null}
        {deliveryAddress ? (
          <div className="print-ticket__row print-ticket__row--block">
            <span className="print-ticket__label">{t("print.address")}</span>
            <span className="print-ticket__value">{deliveryAddress}</span>
          </div>
        ) : null}
      </section>

      <div className="print-ticket__divider" />

      <section className="print-ticket__items">
        {items.length === 0 ? (
          <p className="print-ticket__empty">{t("print.noItems")}</p>
        ) : (
          items.map((item, index) => {
            const itemKey = item.id || `${item.name || item.productName || "item"}-${index}`;
            const itemName = item.name || item.productName || item.productNameSnapshot || t("print.productFallback");
            const itemNote = item.notes || item.note || "";

            return (
              <div className="print-ticket__item" key={itemKey}>
                <div className="print-ticket__item-line">
                  <span className="print-ticket__qty">{item.quantity || 1}x</span>
                  <span className="print-ticket__item-name">{itemName}</span>
                </div>
                {itemNote ? <p className="print-ticket__item-note">{t("print.itemNote", { note: itemNote })}</p> : null}
              </div>
            );
          })
        )}
      </section>

      {order.notes || order.note ? (
        <>
          <div className="print-ticket__divider" />
          <section className="print-ticket__note">
            <p className="print-ticket__label">{t("print.orderNote")}</p>
            <p className="print-ticket__value">{order.notes || order.note}</p>
          </section>
        </>
      ) : null}

      {order.paymentMethod ? (
        <>
          <div className="print-ticket__divider" />
          <section className="print-ticket__footer">
            <div className="print-ticket__row">
              <span className="print-ticket__label">{t("print.payment")}</span>
              <span className="print-ticket__value">{order.paymentMethod}</span>
            </div>
          </section>
        </>
      ) : null}
    </article>
  );
}

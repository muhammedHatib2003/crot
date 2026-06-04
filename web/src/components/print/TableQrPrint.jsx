export default function TableQrPrint({ restaurantName, tableName, seats, orderLink, qrDataUrl }) {
  if (!qrDataUrl || !tableName) {
    return null;
  }

  return (
    <article className="print-table-qr">
      <header className="print-table-qr__header">
        <h1 className="print-table-qr__restaurant">{restaurantName || "Restoran"}</h1>
        <p className="print-table-qr__subtitle">Masadan sipariş verin</p>
      </header>

      <div className="print-table-qr__table">
        <p className="print-table-qr__table-name">{tableName}</p>
        {seats ? <p className="print-table-qr__table-meta">{seats} kişilik</p> : null}
      </div>

      <div className="print-table-qr__code-wrap">
        <img alt="" className="print-table-qr__code" src={qrDataUrl} />
      </div>

      <p className="print-table-qr__hint">QR kodu okutarak menüye ulaşın</p>
      {orderLink ? <p className="print-table-qr__link">{orderLink}</p> : null}
    </article>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "../../api";
import {
  AppShell,
  EmptyState,
  Field,
  MessageBanner,
  PageHeader,
  SectionCard,
  SimpleTable,
  StatusPill,
  buttonStyles,
  fieldStyles,
  textareaStyles
} from "../../components/app/AppShell";

const CART_KEY = "online_food_cart";
const ORDER_STATUSES = ["PENDING", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "READY", "COMPLETED", "CANCELLED"];

const emptyProductForm = { id: "", categoryId: "", name: "", description: "", price: "", imageUrl: "", isAvailable: true };

function formatPrice(value) { return `$${Number(value || 0).toFixed(2)}`; }
function tone(status) { if (status === "COMPLETED") return "success"; if (status === "CANCELLED") return "danger"; if (status === "READY") return "info"; if (status === "PENDING") return "warning"; return "neutral"; }
function readCart() { try { return JSON.parse(localStorage.getItem(CART_KEY) || "null") || { restaurant: null, items: [] }; } catch { return { restaurant: null, items: [] }; } }
function writeCart(cart) { localStorage.setItem(CART_KEY, JSON.stringify(cart)); window.dispatchEvent(new Event("online-food-cart")); return cart; }
function clearCart() { return writeCart({ restaurant: null, items: [] }); }

function useCart() {
  const [cart, setCart] = useState(readCart);
  useEffect(() => {
    const sync = () => setCart(readCart());
    window.addEventListener("online-food-cart", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("online-food-cart", sync); window.removeEventListener("storage", sync); };
  }, []);
  return [cart, (next) => setCart(writeCart(next))];
}

function useApi(path, options = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    apiRequest(path, options).then((result) => { if (active) setData(result); }).catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, options.token, tick]);
  return { data, error, loading, reload: () => setTick((v) => v + 1) };
}

export function RestaurantsPage() {
  const { data, error, loading } = useApi("/online/restaurants");
  const restaurants = data?.restaurants || [];
  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title="Restaurants" eyebrow="Online Ordering" description="Premium restaurants with online ordering enabled." />
        {error ? <MessageBanner tone="error">{error}</MessageBanner> : null}
        {loading ? <SectionCard><p className="text-sm text-slate-600">Loading restaurants...</p></SectionCard> : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {restaurants.map((r) => (
            <Link key={r.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70" to={`/restaurants/${r.slug}`}>
              <div className="flex items-start justify-between gap-2"><h2 className="text-lg font-semibold text-slate-950">{r.name}</h2><StatusPill tone={r.isOpen ? "success" : "neutral"}>{r.isOpen ? "Open" : "Closed"}</StatusPill></div>
              <p className="mt-1 text-sm text-slate-600">{r.description || "Online ordering restaurant"}</p>
              <div className="mt-3 text-sm text-slate-500">
                <p>{[r.city, r.district].filter(Boolean).join(" / ") || "-"}</p>
                <p>Delivery Fee: {formatPrice(r.deliveryFee)}</p>
                <p>Min Order: {formatPrice(r.minOrderAmount)}</p>
                <p>Online Ordering: {r.onlineOrderingAvailable ? "Available" : "Unavailable"}</p>
              </div>
            </Link>
          ))}
        </div>
        {!loading && restaurants.length === 0 ? <SectionCard><EmptyState title="No restaurants available" description="No eligible restaurant found." /></SectionCard> : null}
      </div>
    </AppShell>
  );
}

export function RestaurantDetailPage() {
  const { slug } = useParams();
  const [cart, setCart] = useCart();
  const { data, error, loading } = useApi(`/online/restaurants/${slug}/menu`);
  const [warning, setWarning] = useState("");
  const restaurant = data?.restaurant;
  const categories = data?.categories || [];
  const products = data?.products || [];

  function add(product) {
    if (!restaurant) return;
    if (cart.restaurant?.id && cart.restaurant.id !== restaurant.id) {
      setWarning("Your cart has items from another restaurant.");
      return;
    }
    const existing = cart.items.find((item) => item.productId === product.id);
    setCart({
      restaurant,
      items: existing ? cart.items.map((item) => (item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item)) : [...cart.items, { productId: product.id, name: product.name, price: product.price, quantity: 1, note: "" }]
    });
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title={restaurant?.name || "Restaurant"} eyebrow="Menu" description={restaurant?.description || ""} actions={<Link className={buttonStyles.primary} to="/cart">Cart ({cart.items.length})</Link>} />
        {warning ? <MessageBanner tone="warning">{warning} <button className="font-semibold underline" onClick={() => { clearCart(); setCart(readCart()); setWarning(""); }} type="button">Clear cart</button></MessageBanner> : null}
        {error ? <MessageBanner tone="error">{error}</MessageBanner> : null}
        {loading ? <SectionCard><p className="text-sm text-slate-600">Loading menu...</p></SectionCard> : null}
        {categories.map((category) => {
          const categoryProducts = products.filter((product) => product.categoryId === category.id);
          if (categoryProducts.length === 0) return null;
          return (
            <SectionCard key={category.id} title={category.name}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {categoryProducts.map((product) => (
                  <article key={product.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-semibold text-slate-950">{product.name}</h3>
                    <p className="mt-1 min-h-10 text-sm text-slate-600">{product.description || "-"}</p>
                    <div className="mt-4 flex items-center justify-between gap-3"><span className="font-semibold text-brand-900">{formatPrice(product.price)}</span><button className={buttonStyles.primary} disabled={!product.isAvailable} onClick={() => add(product)} type="button">Add</button></div>
                  </article>
                ))}
              </div>
            </SectionCard>
          );
        })}
      </div>
    </AppShell>
  );
}

export function CartPage() {
  const [cart, setCart] = useCart();
  const subtotal = cart.items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  function setQty(productId, quantity) { setCart({ ...cart, items: cart.items.map((item) => (item.productId === productId ? { ...item, quantity } : item)).filter((item) => item.quantity > 0) }); }
  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title="Cart" description={cart.restaurant?.name || "No restaurant selected"} actions={<><button className={buttonStyles.secondary} onClick={() => setCart(clearCart())} type="button">Clear Cart</button><Link className={buttonStyles.primary} to="/checkout">Checkout</Link></>} />
        <SectionCard>
          {cart.items.length === 0 ? <EmptyState title="Cart is empty" action={<Link className={buttonStyles.primary} to="/restaurants">Browse</Link>} /> : null}
          <div className="space-y-3">
            {cart.items.map((item) => (
              <div key={item.productId} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div><p className="font-semibold text-slate-900">{item.name}</p><p className="text-sm text-slate-500">{formatPrice(item.price)}</p></div>
                <div className="flex items-center gap-2"><button className={buttonStyles.secondary} onClick={() => setQty(item.productId, item.quantity - 1)} type="button">-</button><span className="min-w-8 text-center">{item.quantity}</span><button className={buttonStyles.secondary} onClick={() => setQty(item.productId, item.quantity + 1)} type="button">+</button></div>
              </div>
            ))}
          </div>
          {cart.items.length > 0 ? <p className="mt-4 text-lg font-semibold">Subtotal: {formatPrice(subtotal)}</p> : null}
        </SectionCard>
      </div>
    </AppShell>
  );
}

export function CheckoutPage({ session }) {
  const navigate = useNavigate();
  const [cart] = useCart();
  const { data } = useApi("/online/profile", { token: session?.token });
  const profile = data?.profile;
  const [form, setForm] = useState({ orderType: "DELIVERY", customerName: "", customerPhone: "", deliveryAddress: "", note: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm((previous) => ({ ...previous, customerName: previous.customerName || profile.fullName || "", customerPhone: previous.customerPhone || profile.phone || "", deliveryAddress: previous.deliveryAddress || [profile.address, profile.district, profile.city].filter(Boolean).join(", ") }));
  }, [profile?.id]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!cart.restaurant || cart.items.length === 0) return setError("Cart is empty.");
    setSubmitting(true);
    try {
      const result = await apiRequest("/online/orders", { method: "POST", token: session.token, body: { restaurantId: cart.restaurant.id, orderType: form.orderType, customerName: form.customerName, customerPhone: form.customerPhone, deliveryAddress: form.orderType === "DELIVERY" ? form.deliveryAddress : null, note: form.note, items: cart.items.map((item) => ({ productId: item.productId, quantity: item.quantity, note: item.note })) } });
      clearCart();
      navigate(`/orders/${result.order.id}`, { replace: true });
    } catch (requestError) { setError(requestError.message); } finally { setSubmitting(false); }
  }

  return (
    <AppShell>
      <form className="space-y-5" onSubmit={submit}>
        <PageHeader title="Checkout" description={cart.restaurant?.name || "Cart"} />
        {error ? <MessageBanner tone="error">{error}</MessageBanner> : null}
        <SectionCard title="Customer Information">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Order Type"><select className={fieldStyles} value={form.orderType} onChange={(event) => setForm({ ...form, orderType: event.target.value })}><option value="DELIVERY">DELIVERY</option><option value="PICKUP">PICKUP</option></select></Field>
            <Field label="Name"><input className={fieldStyles} required value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} /></Field>
            <Field label="Phone"><input className={fieldStyles} value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: event.target.value })} /></Field>
            <Field label="Address"><input className={fieldStyles} disabled={form.orderType === "PICKUP"} required={form.orderType === "DELIVERY"} value={form.deliveryAddress} onChange={(event) => setForm({ ...form, deliveryAddress: event.target.value })} /></Field>
          </div>
          <Field label="Order Note"><textarea className={textareaStyles} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></Field>
          <button className={buttonStyles.primary} disabled={submitting} type="submit">{submitting ? "Placing order..." : "Place Order"}</button>
        </SectionCard>
      </form>
    </AppShell>
  );
}

export function OrdersPage({ session }) {
  const { data, error, loading } = useApi("/online/orders/my", { token: session?.token });
  const orders = data?.orders || [];
  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title="My Orders" />
        {error ? <MessageBanner tone="error">{error}</MessageBanner> : null}
        {loading ? <SectionCard><p>Loading orders...</p></SectionCard> : null}
        {orders.map((order) => (
          <Link key={order.id} className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70" to={`/orders/${order.id}`}>
            <div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{order.restaurant?.name}</p><p className="text-sm text-slate-500">{new Date(order.createdAt).toLocaleString()}</p></div><StatusPill tone={tone(order.status)}>{order.status}</StatusPill></div>
            <p className="mt-2 font-semibold">{formatPrice(order.total)}</p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}

export function OrderDetailPage({ session }) {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/online/orders/${id}`, { token: session?.token });
  const order = data?.order;
  useEffect(() => { const intervalId = setInterval(() => reload(), 10000); return () => clearInterval(intervalId); }, [id]);
  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title="Order Tracking" description={order?.restaurant?.name} />
        {error ? <MessageBanner tone="error">{error}</MessageBanner> : null}
        {loading ? <SectionCard><p>Loading order...</p></SectionCard> : null}
        {order ? <SectionCard title={`Status: ${order.status}`}><div className="space-y-2">{order.items.map((item) => <div key={item.id} className="flex justify-between rounded-xl bg-slate-50 p-3"><span>{item.quantity}x {item.productName}</span><span>{formatPrice(item.totalPrice)}</span></div>)}</div><p className="mt-4 text-lg font-semibold">Total: {formatPrice(order.total)}</p></SectionCard> : null}
      </div>
    </AppShell>
  );
}

export function ProfilePage({ session }) {
  const { data, error, loading, reload } = useApi("/online/profile", { token: session?.token });
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => { if (data?.profile) setForm(data.profile); }, [data?.profile?.userId]);
  async function save(event) { event.preventDefault(); setMessage(""); await apiRequest("/online/profile", { method: "PUT", token: session.token, body: form }); await reload(); setMessage("Profile saved."); }
  if (!form && loading) return <AppShell><SectionCard><p>Loading profile...</p></SectionCard></AppShell>;
  return (
    <AppShell>
      <form className="space-y-5" onSubmit={save}>
        <PageHeader title="Profile" description="Contact and address information." />
        {error ? <MessageBanner tone="error">{error}</MessageBanner> : null}
        {message ? <MessageBanner tone="success">{message}</MessageBanner> : null}
        <SectionCard><div className="grid grid-cols-1 gap-3 md:grid-cols-2">{["fullName", "phone", "address", "city", "district"].map((field) => <Field key={field} label={field}><input className={fieldStyles} value={form?.[field] || ""} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /></Field>)}</div><button className={buttonStyles.primary} type="submit">Save profile</button></SectionCard>
      </form>
    </AppShell>
  );
}

function OwnerLayout({ session, section, boardMode }) {
  const { restaurantId: routeRestaurantId } = useParams();
  const [settings, setSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [categoryName, setCategoryName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const premium = Boolean(settings?.premiumEnabled);

  const visibleOrders = useMemo(() => boardMode === "kitchen" ? orders.filter((order) => ["PENDING", "ACCEPTED", "PREPARING"].includes(order.status)) : boardMode === "cashier" ? orders.filter((order) => ["READY", "OUT_FOR_DELIVERY", "COMPLETED"].includes(order.status)) : orders, [orders, boardMode]);

  async function loadSettings() {
    const result = await apiRequest("/online/owner/settings", { token: session.token });
    setSettings(result);
    setSettingsForm({
      onlineOrderingEnabled: Boolean(result.restaurant?.onlineOrderingEnabled),
      deliveryEnabled: Boolean(result.restaurant?.deliveryEnabled),
      pickupEnabled: Boolean(result.restaurant?.pickupEnabled),
      minOrderAmount: Number(result.restaurant?.minOrderAmount || 0),
      deliveryFee: Number(result.restaurant?.deliveryFee || 0)
    });
  }
  async function loadMenu() { const result = await apiRequest("/online/owner/menu", { token: session.token }); setCategories(result.categories || []); setProducts(result.products || []); }
  async function loadOrders() { const result = await apiRequest("/online/owner/orders", { token: session.token }); setOrders(result.orders || []); }
  async function loadAll() { setError(""); try { await Promise.all([loadSettings(), loadMenu(), loadOrders()]); } catch (requestError) { setError(requestError.message); } }

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (!boardMode) return; const id = setInterval(() => { loadOrders().catch((requestError) => setError(requestError.message)); }, 12000); return () => clearInterval(id); }, [boardMode]);

  async function saveSettings(event) {
    event.preventDefault();
    setError(""); setMessage("");
    try { const result = await apiRequest("/online/owner/settings", { method: "PUT", token: session.token, body: settingsForm }); setSettings(result); setMessage("Settings updated."); } catch (requestError) { setError(requestError.message); }
  }
  async function addCategory(event) { event.preventDefault(); if (!categoryName.trim()) return; setError(""); setMessage(""); try { await apiRequest("/online/owner/categories", { method: "POST", token: session.token, body: { name: categoryName } }); setCategoryName(""); setMessage("Category added."); await loadMenu(); } catch (requestError) { setError(requestError.message); } }
  async function saveProduct(event) {
    event.preventDefault();
    setError(""); setMessage("");
    const body = { categoryId: productForm.categoryId || null, name: productForm.name, description: productForm.description, price: Number(productForm.price), imageUrl: productForm.imageUrl, isAvailable: Boolean(productForm.isAvailable) };
    try { if (productForm.id) await apiRequest(`/online/owner/products/${productForm.id}`, { method: "PUT", token: session.token, body }); else await apiRequest("/online/owner/products", { method: "POST", token: session.token, body }); setProductForm(emptyProductForm); setMessage("Product saved."); await loadMenu(); } catch (requestError) { setError(requestError.message); }
  }
  async function removeProduct(id) { setError(""); setMessage(""); try { await apiRequest(`/online/owner/products/${id}`, { method: "DELETE", token: session.token }); setMessage("Product deleted."); await loadMenu(); } catch (requestError) { setError(requestError.message); } }
  async function updateStatus(orderId, status) { setError(""); try { await apiRequest(`/online/owner/orders/${orderId}/status`, { method: "PUT", token: session.token, body: { status } }); await loadOrders(); } catch (requestError) { setError(requestError.message); } }

  const nav = <><Link className={buttonStyles.secondary} to="/restaurant-dashboard">Dashboard</Link><Link className={buttonStyles.secondary} to="/restaurant-dashboard/products">Products</Link><Link className={buttonStyles.secondary} to="/restaurant-dashboard/orders">Orders</Link><Link className={buttonStyles.secondary} to="/restaurant-dashboard/settings">Settings</Link>{settings?.restaurant?.id ? <Link className={buttonStyles.secondary} to={`/kitchen/${settings.restaurant.id}`}>Kitchen</Link> : null}{settings?.restaurant?.id ? <Link className={buttonStyles.secondary} to={`/cashier/${settings.restaurant.id}`}>Cashier</Link> : null}</>;

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title={boardMode === "kitchen" ? "Kitchen" : boardMode === "cashier" ? "Cashier" : "Restaurant Dashboard"} description={settings?.restaurant?.name || "Owner restaurant"} actions={nav} />
        {routeRestaurantId && settings?.restaurant?.id && routeRestaurantId !== settings.restaurant.id ? <MessageBanner tone="warning">Route restaurant id does not match owner restaurant.</MessageBanner> : null}
        {error ? <MessageBanner tone="error">{error}</MessageBanner> : null}
        {message ? <MessageBanner tone="success">{message}</MessageBanner> : null}

        {section === "dashboard" ? <SectionCard><p className="text-sm text-slate-600">Manage online ordering for your existing restaurant from Settings, Products, and Orders.</p></SectionCard> : null}

        {section === "settings" ? (
          <SectionCard title="Online Ordering Settings">
            {!settings || !settingsForm ? <p className="text-sm text-slate-600">Loading settings...</p> : (
              <form className="grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={saveSettings}>
                <Field label="Restaurant Name"><input className={fieldStyles} readOnly value={settings.restaurant?.name || ""} /></Field>
                <Field label="Slug"><input className={fieldStyles} readOnly value={settings.restaurant?.slug || ""} /></Field>
                <Field label="Current Plan"><input className={fieldStyles} readOnly value={settings.plan?.displayName || "No plan"} /></Field>
                <Field label="Premium Status"><input className={fieldStyles} readOnly value={premium ? "Premium Active" : "Not Premium"} /></Field>
                <Field label="Online Ordering Enabled"><select className={fieldStyles} disabled={!premium} value={settingsForm.onlineOrderingEnabled ? "true" : "false"} onChange={(event) => setSettingsForm({ ...settingsForm, onlineOrderingEnabled: event.target.value === "true" })}><option value="true">Enabled</option><option value="false">Disabled</option></select></Field>
                <Field label="Delivery Enabled"><select className={fieldStyles} value={settingsForm.deliveryEnabled ? "true" : "false"} onChange={(event) => setSettingsForm({ ...settingsForm, deliveryEnabled: event.target.value === "true" })}><option value="true">Enabled</option><option value="false">Disabled</option></select></Field>
                <Field label="Pickup Enabled"><select className={fieldStyles} value={settingsForm.pickupEnabled ? "true" : "false"} onChange={(event) => setSettingsForm({ ...settingsForm, pickupEnabled: event.target.value === "true" })}><option value="true">Enabled</option><option value="false">Disabled</option></select></Field>
                <Field label="Minimum Order Amount"><input className={fieldStyles} type="number" min="0" step="0.01" value={settingsForm.minOrderAmount} onChange={(event) => setSettingsForm({ ...settingsForm, minOrderAmount: Number(event.target.value || 0) })} /></Field>
                <Field label="Delivery Fee"><input className={fieldStyles} type="number" min="0" step="0.01" value={settingsForm.deliveryFee} onChange={(event) => setSettingsForm({ ...settingsForm, deliveryFee: Number(event.target.value || 0) })} /></Field>
                {!premium ? <div className="md:col-span-2"><MessageBanner tone="warning">Online ordering requires Premium plan</MessageBanner><div className="mt-3"><Link className={buttonStyles.secondary} to="/owner">Upgrade plan</Link></div></div> : null}
                <div className="md:col-span-2"><button className={buttonStyles.primary} type="submit">Save Settings</button></div>
              </form>
            )}
          </SectionCard>
        ) : null}

        {section === "products" ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <SectionCard title="Manage Categories and Products">
              <form className="space-y-3" onSubmit={addCategory}><Field label="Category Name"><input className={fieldStyles} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /></Field><button className={buttonStyles.secondary} type="submit">Add Category</button></form>
              <form className="mt-6 space-y-3" onSubmit={saveProduct}>
                <h3 className="text-base font-semibold text-slate-900">{productForm.id ? "Update Product" : "Add Product"}</h3>
                <Field label="Category"><select className={fieldStyles} value={productForm.categoryId} onChange={(event) => setProductForm({ ...productForm, categoryId: event.target.value })}><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
                <Field label="Name"><input className={fieldStyles} required value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></Field>
                <Field label="Description"><textarea className={textareaStyles} value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} /></Field>
                <Field label="Price"><input className={fieldStyles} required type="number" min="0" step="0.01" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} /></Field>
                <Field label="Image URL"><input className={fieldStyles} value={productForm.imageUrl} onChange={(event) => setProductForm({ ...productForm, imageUrl: event.target.value })} /></Field>
                <Field label="Available"><select className={fieldStyles} value={productForm.isAvailable ? "true" : "false"} onChange={(event) => setProductForm({ ...productForm, isAvailable: event.target.value === "true" })}><option value="true">Yes</option><option value="false">No</option></select></Field>
                <div className="flex gap-2"><button className={buttonStyles.primary} type="submit">Save Product</button>{productForm.id ? <button className={buttonStyles.secondary} onClick={() => setProductForm(emptyProductForm)} type="button">Cancel</button> : null}</div>
              </form>
            </SectionCard>
            <SectionCard title="Products">
              <SimpleTable headers={["Name", "Category", "Price", "Available", "Actions"]}>
                {products.map((product) => (
                  <tr key={product.id}><td className="px-4 py-3">{product.name}</td><td className="px-4 py-3">{product.category?.name || "-"}</td><td className="px-4 py-3">{formatPrice(product.price)}</td><td className="px-4 py-3"><StatusPill tone={product.isAvailable ? "success" : "neutral"}>{product.isAvailable ? "Yes" : "No"}</StatusPill></td><td className="px-4 py-3"><div className="flex gap-2"><button className={buttonStyles.subtle} type="button" onClick={() => setProductForm({ id: product.id, categoryId: product.categoryId || "", name: product.name, description: product.description || "", price: String(product.price), imageUrl: product.imageUrl || "", isAvailable: Boolean(product.isAvailable) })}>Edit</button><button className={buttonStyles.subtle} type="button" onClick={() => removeProduct(product.id)}>Delete</button></div></td></tr>
                ))}
              </SimpleTable>
            </SectionCard>
          </div>
        ) : null}

        {section === "orders" || boardMode ? (
          <SectionCard title="Incoming Orders">
            {visibleOrders.length === 0 ? <EmptyState title="No orders" /> : null}
            <div className="space-y-4">{visibleOrders.map((order) => <article key={order.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-slate-950">{order.customerName}</p><p className="text-sm text-slate-500">{order.orderType} - {new Date(order.createdAt).toLocaleString()}</p></div><StatusPill tone={tone(order.status)}>{order.status}</StatusPill></div><div className="mt-3 space-y-2">{order.items.map((item) => <div key={item.id} className="flex justify-between rounded-xl bg-white p-3 text-sm"><span>{item.quantity}x {item.productName}</span><span>{formatPrice(item.totalPrice)}</span></div>)}</div><p className="mt-3 font-semibold text-brand-900">Total: {formatPrice(order.total)}</p><div className="mt-4 flex flex-wrap gap-2">{ORDER_STATUSES.map((status) => <button key={status} className={buttonStyles.subtle} onClick={() => updateStatus(order.id, status)} type="button">{status}</button>)}</div></article>)}</div>
          </SectionCard>
        ) : null}
      </div>
    </AppShell>
  );
}

export function OnlineOwnerDashboardPage({ session, section = "dashboard" }) { return <OwnerLayout session={session} section={section} />; }
export function OnlineOrderBoardPage({ session, mode }) { return <OwnerLayout session={session} section="orders" boardMode={mode} />; }
export function RequireOnlineAuth({ session, children }) { return session ? children : <Navigate replace to="/login" />; }

import { useState } from "react";

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    message: ""
  });

  function updateField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4500);
    setForm({ name: "", email: "", company: "", message: "" });
  }

  return (
    <section id="contact" className="relative overflow-hidden bg-ink-950 py-24 text-white sm:py-32">
      <div className="absolute inset-0 bg-grid opacity-30 mask-fade-bottom" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-32 right-1/4 -z-10 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl animate-blob-spin"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-300">
              İletişim
            </p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Restoranınız için CROT'u{" "}
              <span className="text-gradient">birlikte konuşalım</span>
            </h2>
            <p className="mt-5 text-base text-ink-300">
              Sorularınızı, demo taleplerinizi veya özel ihtiyaçlarınızı yazın. Sizinle
              en kısa sürede iletişime geçelim — birlikte sizin işletmeniz için en uygun
              paketi belirleyelim.
            </p>

            <div className="mt-10 space-y-5">
              {[
                {
                  icon: (
                    <>
                      <path d="M3 7l9 6 9-6" />
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                    </>
                  ),
                  label: "E-posta",
                  value: "info@crot.example"
                },
                {
                  icon: (
                    <>
                      <path d="M22 16.92V21a1 1 0 0 1-1.1 1 19 19 0 0 1-8.27-3.07 19 19 0 0 1-6-6A19 19 0 0 1 3.56 4.62 1 1 0 0 1 4.56 3.5h4.08a1 1 0 0 1 1 .86c.13.84.32 1.65.58 2.43a1 1 0 0 1-.23 1.05L8.27 9.55a16 16 0 0 0 6 6l1.71-1.71a1 1 0 0 1 1.05-.23c.78.26 1.59.45 2.43.58a1 1 0 0 1 .86 1z" />
                    </>
                  ),
                  label: "Telefon",
                  value: "+90 (212) 000 00 00"
                },
                {
                  icon: (
                    <>
                      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </>
                  ),
                  label: "Adres",
                  value: "İstanbul, Türkiye"
                }
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-4">
                  <span className="mt-0.5 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      {item.icon}
                    </svg>
                  </span>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-ink-400">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-base font-medium text-white">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur sm:p-8"
          >
            {submitted ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-ink-950/70 backdrop-blur-sm">
                <div className="rounded-2xl border border-brand-500/30 bg-brand-500/10 px-6 py-5 text-center">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <p className="mt-3 text-base font-semibold text-white">Mesajınız alındı</p>
                  <p className="mt-1 text-xs text-ink-300">
                    (Bu form tanıtım amaçlıdır, gerçek bir e-posta gönderilmez.)
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-ink-400">
                  Ad Soyad
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-ink-500 outline-none transition focus:border-brand-400 focus:bg-white/10"
                  placeholder="Ali Yılmaz"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-ink-400">
                  E-posta
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-ink-500 outline-none transition focus:border-brand-400 focus:bg-white/10"
                  placeholder="ali@restoran.com"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium uppercase tracking-wider text-ink-400">
                  İşletme Adı
                </label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(event) => updateField("company", event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-ink-500 outline-none transition focus:border-brand-400 focus:bg-white/10"
                  placeholder="Restoran adı"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium uppercase tracking-wider text-ink-400">
                  Mesaj
                </label>
                <textarea
                  rows={4}
                  required
                  value={form.message}
                  onChange={(event) => updateField("message", event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-ink-500 outline-none transition focus:border-brand-400 focus:bg-white/10"
                  placeholder="Hangi modüller ilginizi çekti, kaç şubeli bir işletmesiniz?"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-ink-950 shadow-glow transition hover:bg-brand-400 sm:w-auto"
            >
              Mesaj Gönder
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M13 5l7 7-7 7" />
              </svg>
            </button>

            <p className="mt-4 text-xs text-ink-400">
              ⓘ Bu form sadece görsel amaçlıdır; herhangi bir e-posta gönderilmez ve
              CROT backend'i ile haberleşmez.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

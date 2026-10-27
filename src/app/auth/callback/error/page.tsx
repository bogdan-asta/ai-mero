import Link from "next/link";

export default function AuthCallbackErrorPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link aria-label="EventAI — на главную" className="auth-brand" href="/">
          <span className="brand-mark">!</span>
          <span>event<span className="brand-accent">ai</span></span>
        </Link>
        <div className="auth-heading">
          <h1>Ссылка недействительна</h1>
          <p>Возможно, срок действия ссылки истёк. Запросите новую и попробуйте ещё раз.</p>
        </div>
        <Link className="button button-primary auth-submit" href="/sign-in">
          Перейти ко входу
        </Link>
      </section>
    </main>
  );
}

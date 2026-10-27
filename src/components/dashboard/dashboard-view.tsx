"use client";

import { ArrowRight, CalendarDays, LogOut, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function DashboardView({
  email,
  fullName,
  organization,
}: {
  email: string;
  fullName: string;
  organization: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setError("");
    setIsSigningOut(true);

    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/");
      router.refresh();
    } catch (signOutError) {
      setError(
        signOutError instanceof Error
          ? `Не удалось выйти: ${signOutError.message}`
          : "Не удалось выйти из аккаунта.",
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link aria-label="EventAI — на главную" className="auth-brand" href="/">
          <span className="brand-mark"><Sparkles size={17} /></span>
          <span>event<span className="brand-accent">ai</span></span>
        </Link>
        <button className="dashboard-signout" disabled={isSigningOut} onClick={signOut} type="button">
          <LogOut size={15} /> {isSigningOut ? "Выходим…" : "Выйти"}
        </button>
      </header>

      <section className="dashboard-card">
        <span className="section-kicker">ВАШЕ ПРОСТРАНСТВО EVENTAI</span>
        <h1>Рады знакомству, {fullName || "организатор"}!</h1>
        <p className="dashboard-intro">
          {organization ? `${organization} · ` : ""}{email}
        </p>

        {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}

        <div className="dashboard-empty">
          <span className="dashboard-empty-icon"><CalendarDays size={23} /></span>
          <h2>Пора придумать первое событие</h2>
          <p>В следующих этапах здесь появятся мероприятия, задачи и документы.</p>
          <button className="button button-primary" disabled type="button">
            Создать мероприятие <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </main>
  );
}

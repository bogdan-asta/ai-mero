"use client";

import { ArrowRight, LogOut, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EventRecord } from "@/lib/supabase/database.types";
import { EventListView } from "@/components/events/event-list-view";

export function DashboardView({
  email,
  fullName,
  organization,
  events,
}: {
  email: string;
  fullName: string;
  organization: string;
  events: EventRecord[];
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
        <nav className="dashboard-nav" aria-label="Разделы приложения">
          <Link className="dashboard-nav-active" href="/dashboard">Главная</Link>
          <Link href="/events">Мероприятия</Link>
          <Link href="/venues">Площадки</Link>
        </nav>
        <div className="dashboard-header-actions">
          <Link className="button button-primary dashboard-new-event" href="/events/new">
            <Plus size={15} /> Новое
          </Link>
          <button className="dashboard-signout" disabled={isSigningOut} onClick={signOut} type="button">
            <LogOut size={15} /> {isSigningOut ? "Выходим…" : "Выйти"}
          </button>
        </div>
      </header>

      <section className="dashboard-card">
        <span className="section-kicker">ВАШЕ ПРОСТРАНСТВО EVENTAI</span>
        <h1>Рады знакомству, {fullName || "организатор"}!</h1>
        <p className="dashboard-intro">
          {organization ? `${organization} · ` : ""}{email}
        </p>

        {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}

        <div className="dashboard-section-heading">
          <div>
            <h2>Ваши мероприятия</h2>
            <p>Идеи и события, которые вы готовите.</p>
          </div>
          <Link className="text-link" href="/events">Все мероприятия <ArrowRight size={15} /></Link>
        </div>
        <EventListView events={events} />
      </section>
    </main>
  );
}

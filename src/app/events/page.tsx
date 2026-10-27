import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EventListView } from "@/components/events/event-list-view";
import { createClient } from "@/lib/supabase/server";
import { PageLoading } from "@/components/ui/page-loading";

export default function EventsPage() {
  return (
    <Suspense fallback={<EventsLoading />}>
      <EventsContent />
    </Suspense>
  );
}

async function EventsContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <main className="app-page">
        <div className="app-page-inner">
          <div className="auth-message auth-message-error" role="alert">
            Не удалось загрузить список: {error.message}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page">
      <div className="app-page-inner">
        <Link className="back-link" href="/dashboard">← Главная</Link>
        <header className="app-page-header">
          <div className="page-heading">
            <span className="section-kicker">EVENTAI</span>
            <h1>Мероприятия</h1>
            <p>Планы, площадки и подготовка в одном месте.</p>
          </div>
          <Link className="button button-primary" href="/events/new">Создать мероприятие</Link>
        </header>
        <EventListView events={events} />
      </div>
    </main>
  );
}

function EventsLoading() {
  return <PageLoading message="Загружаем ваши мероприятия" variant="events" />;
}

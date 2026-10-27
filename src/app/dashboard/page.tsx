import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { createClient } from "@/lib/supabase/server";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, organization, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return (
      <main className="dashboard-page">
        <section className="dashboard-card">
          <h1>Не удалось загрузить профиль</h1>
          <p role="alert">{error.message}</p>
        </section>
      </main>
    );
  }

  if (!profile || !profile.onboarding_completed) {
    redirect("/onboarding");
  }

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(6);

  if (eventsError) {
    return (
      <main className="dashboard-page">
        <section className="dashboard-card">
          <h1>Не удалось загрузить мероприятия</h1>
          <p role="alert">{eventsError.message}</p>
        </section>
      </main>
    );
  }

  return (
    <DashboardView
      email={user.email ?? ""}
      events={events}
      fullName={profile.full_name}
      organization={profile.organization}
    />
  );
}

function DashboardLoading() {
  return (
    <main className="dashboard-page">
      <section className="dashboard-card"><p>Загружаем EventAI…</p></section>
    </main>
  );
}

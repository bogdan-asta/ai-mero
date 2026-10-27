import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { EventForm } from "@/components/events/event-form";
import { createClient } from "@/lib/supabase/server";

export default function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<EditEventLoading />}>
      <EditEventContent params={params} />
    </Suspense>
  );
}

async function EditEventContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <main className="app-page">
        <div className="app-page-inner">
          <p className="auth-message auth-message-error" role="alert">
            Не удалось загрузить мероприятие: {error.message}
          </p>
        </div>
      </main>
    );
  }

  if (!event) {
    notFound();
  }

  if (event.created_by !== user.id) {
    redirect(`/events/${event.id}`);
  }

  return <EventForm event={event} />;
}

function EditEventLoading() {
  return (
    <main className="app-page">
      <div className="app-page-inner"><p>Загружаем мероприятие…</p></div>
    </main>
  );
}

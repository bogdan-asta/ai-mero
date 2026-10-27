import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { EventForm } from "@/components/events/event-form";
import { createClient } from "@/lib/supabase/server";

export default function NewEventPage() {
  return (
    <Suspense fallback={<EventFormLoading />}>
      <NewEventContent />
    </Suspense>
  );
}

async function NewEventContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return <EventForm />;
}

function EventFormLoading() {
  return (
    <main className="app-page">
      <div className="app-page-inner"><p>Подготавливаем форму…</p></div>
    </main>
  );
}

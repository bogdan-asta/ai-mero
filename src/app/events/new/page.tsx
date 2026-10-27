import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { EventForm } from "@/components/events/event-form";
import { createClient } from "@/lib/supabase/server";
import { PageLoading } from "@/components/ui/page-loading";

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
  return <PageLoading message="Готовим форму события" variant="form" />;
}

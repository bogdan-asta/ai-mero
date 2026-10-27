import type { UIMessage } from "ai";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { EventAssistant } from "@/components/ai/event-assistant";
import { createClient } from "@/lib/supabase/server";

export default function EventAssistantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<AssistantLoading />}>
      <EventAssistantContent params={params} />
    </Suspense>
  );
}

async function EventAssistantContent({
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

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, created_by")
    .eq("id", id)
    .maybeSingle();

  if (eventError) {
    return <AssistantError message={eventError.message} />;
  }
  if (!event) {
    notFound();
  }

  let canApplyPlan = event.created_by === user.id;
  if (!canApplyPlan) {
    const { data: membership, error: membershipError } = await supabase
      .from("event_members")
      .select("role")
      .eq("event_id", event.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      return <AssistantError message={membershipError.message} />;
    }
    canApplyPlan = membership?.role === "organizer";
  }

  const { data: threads, error: threadError } = await supabase
    .from("ai_threads")
    .select("id")
    .eq("event_id", event.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (threadError) {
    return <AssistantError message={threadError.message} />;
  }

  const thread = threads[0];
  let initialMessages: UIMessage[] = [];

  if (thread) {
    const { data: savedMessages, error: messageError } = await supabase
      .from("ai_messages")
      .select("id, role, content")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true })
      .limit(40);

    if (messageError) {
      return <AssistantError message={messageError.message} />;
    }

    initialMessages = savedMessages.map((message) => ({
      id: message.id,
      role: message.role,
      parts: [{ type: "text", text: message.content }],
    }));
  }

  return (
    <EventAssistant
      eventId={event.id}
      eventTitle={event.title}
      canApplyPlan={canApplyPlan}
      initialMessages={initialMessages}
      initialThreadId={thread?.id ?? null}
    />
  );
}

function AssistantLoading() {
  return <main className="assistant-page"><p>Загружаем помощника…</p></main>;
}

function AssistantError({ message }: { message: string }) {
  return (
    <main className="assistant-page">
      <div className="assistant-error" role="alert">
        Не удалось загрузить диалог: {message}
        <Link href="/dashboard">На главную</Link>
      </div>
    </main>
  );
}

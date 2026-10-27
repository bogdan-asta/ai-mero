import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { NotificationInbox } from "@/components/notifications/notification-inbox";
import { createClient } from "@/lib/supabase/server";

export default function NotificationsPage() {
  return (
    <Suspense fallback={<main className="app-page"><div className="app-page-inner"><p>Загружаем уведомления…</p></div></main>}>
      <NotificationsContent />
    </Suspense>
  );
}

async function NotificationsContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <main className="app-page">
        <div className="app-page-inner">
          <p className="auth-message auth-message-error" role="alert">
            Не удалось загрузить уведомления: {error.message}
          </p>
        </div>
      </main>
    );
  }

  return <NotificationInbox initialNotifications={notifications} />;
}

"use client";

import { Bell, Check, LoaderCircle, MailCheck, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NotificationRecord } from "@/lib/supabase/database.types";

const notificationIcons: Record<NotificationRecord["notification_type"], typeof Bell> = {
  event_invitation: MailCheck,
  invitation_response: Check,
  booking_request: Bell,
  booking_update: Bell,
};

function getNotificationHref(notification: NotificationRecord) {
  if (notification.notification_type === "booking_request") return "/venues";
  if (!notification.event_id) return "/notifications";
  const tab = notification.notification_type.startsWith("booking")
    ? "venue"
    : "team";
  return `/events/${notification.event_id}?tab=${tab}`;
}

export function NotificationInbox({
  initialNotifications,
}: {
  initialNotifications: NotificationRecord[];
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function markAsRead(notification: NotificationRecord) {
    if (notification.read_at) return;
    setError("");
    try {
      const readAt = new Date().toISOString();
      const { error: updateError } = await createClient()
        .from("notifications")
        .update({ read_at: readAt })
        .eq("id", notification.id);
      if (updateError) throw new Error(`Не удалось отметить уведомление: ${updateError.message}`);
      setNotifications((current) => current.map((item) =>
        item.id === notification.id ? { ...item, read_at: readAt } : item,
      ));
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось отметить уведомление.");
    }
  }

  async function respondToInvitation(
    notification: NotificationRecord,
    decision: "accepted" | "declined",
  ) {
    if (!notification.related_id) {
      setError("Не удалось определить приглашение. Обновите страницу.");
      return;
    }

    setError("");
    setBusyId(notification.id);
    try {
      const { data: eventId, error: responseError } = await createClient().rpc(
        "respond_event_invitation",
        {
          target_invitation_id: notification.related_id,
          decision,
        },
      );
      if (responseError) throw new Error(`Не удалось ответить на приглашение: ${responseError.message}`);

      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) =>
        item.id === notification.id ? { ...item, read_at: readAt } : item,
      ));
      router.refresh();
      if (decision === "accepted") {
        router.push(`/events/${eventId}?tab=team`);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось ответить на приглашение.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="app-page">
      <div className="app-page-inner">
        <div className="page-heading notification-page-heading">
          <span className="section-kicker">СОБЫТИЯ И КОМАНДА</span>
          <h1>Уведомления</h1>
          <p>Приглашения в команду и изменения по бронированиям мероприятий.</p>
        </div>

        {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}
        {notifications.length === 0 ? (
          <div className="planning-empty notification-empty">
            <Bell size={22} />
            <strong>Новых уведомлений пока нет</strong>
            <p>Здесь появятся приглашения и ответы по вашим событиям.</p>
          </div>
        ) : (
          <ul className="notification-list">
            {notifications.map((notification) => {
              const Icon = notificationIcons[notification.notification_type];
              const isInvitation =
                notification.notification_type === "event_invitation" &&
                notification.related_id !== null &&
                notification.read_at === null;

              return (
                <li className={`notification-card ${notification.read_at ? "" : "notification-unread"}`} key={notification.id}>
                  <span className="notification-icon"><Icon size={16} /></span>
                  <div className="notification-content">
                    <strong>{notification.title}</strong>
                    <p>{notification.body}</p>
                    <time dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString("ru-RU")}</time>
                    {isInvitation ? (
                      <div className="notification-actions">
                        <button className="button button-primary" disabled={busyId === notification.id} onClick={() => void respondToInvitation(notification, "accepted")} type="button">
                          {busyId === notification.id ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />}Принять
                        </button>
                        <button className="button button-outline" disabled={busyId === notification.id} onClick={() => void respondToInvitation(notification, "declined")} type="button"><X size={14} />Отклонить</button>
                      </div>
                    ) : (
                      <div className="notification-actions">
                        <Link className="text-link" href={getNotificationHref(notification)} onClick={() => void markAsRead(notification)}>
                          Открыть
                        </Link>
                        {!notification.read_at && (
                          <button className="notification-mark-read" onClick={() => void markAsRead(notification)} type="button">Отметить прочитанным</button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

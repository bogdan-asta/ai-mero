"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function DeleteEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function deleteEvent() {
    if (!window.confirm("Удалить мероприятие и связанные с ним данные? Это действие нельзя отменить.")) {
      return;
    }

    setError("");
    setIsDeleting(true);

    try {
      const { error: deleteError } = await createClient()
        .from("events")
        .delete()
        .eq("id", eventId);

      if (deleteError) {
        setError(`Не удалось удалить мероприятие: ${deleteError.message}`);
        return;
      }

      router.replace("/events");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? `Не удалось удалить мероприятие: ${deleteError.message}`
          : "Не удалось удалить мероприятие.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="delete-event">
      <button className="button button-danger" disabled={isDeleting} onClick={deleteEvent} type="button">
        {isDeleting ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}
        Удалить
      </button>
      {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}
    </div>
  );
}

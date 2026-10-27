"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, MailPlus, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { EventInvitationRecord, EventTeamMember } from "@/lib/supabase/database.types";

const inviteSchema = z.object({
  email: z.string().trim().email("Укажите корректный email.").max(320),
  role: z.enum(["participant", "organizer"]),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

export function EventTeam({
  eventId,
  members,
  invitations,
  canManage,
}: {
  eventId: string;
  members: EventTeamMember[];
  invitations: EventInvitationRecord[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "participant" },
  });

  async function inviteMember(values: InviteFormValues) {
    setFormError("");
    try {
      const { error } = await createClient().rpc("invite_event_member", {
        target_event_id: eventId,
        target_email: values.email,
        target_role: values.role,
      });

      if (error) {
        const message = error.message.includes("not registered")
          ? "Этот адрес ещё не зарегистрирован в EventAI. Попросите пользователя создать аккаунт."
          : error.message.includes("already a member")
            ? "Этот пользователь уже входит в команду мероприятия."
            : error.message.includes("already pending")
              ? "Приглашение для этого пользователя уже ожидает ответа."
              : `Не удалось отправить приглашение: ${error.message}`;
        throw new Error(message);
      }

      reset();
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Не удалось отправить приглашение.");
    }
  }

  async function cancelInvitation(invitation: EventInvitationRecord) {
    if (!window.confirm(`Отменить приглашение для ${invitation.email}?`)) return;
    setActionError("");
    setBusyInvitationId(invitation.id);
    try {
      const { error } = await createClient().rpc("cancel_event_invitation", {
        target_invitation_id: invitation.id,
      });
      if (error) throw new Error(`Не удалось отменить приглашение: ${error.message}`);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось отменить приглашение.");
    } finally {
      setBusyInvitationId(null);
    }
  }

  return (
    <section className="planning-module team-module">
      <header className="planning-module-heading">
        <div>
          <span className="section-kicker">УЧАСТНИКИ</span>
          <h2>Команда мероприятия</h2>
          <p>Приглашайте зарегистрированных пользователей и распределяйте роли.</p>
        </div>
        <Users className="team-module-icon" size={20} />
      </header>

      {canManage && (
        <form className="team-invite-form" onSubmit={handleSubmit(inviteMember)} noValidate>
          <label className="form-field">
            <span>Email участника</span>
            <input autoComplete="email" maxLength={320} type="email" {...register("email")} placeholder="name@example.com" />
            {errors.email && <small>{errors.email.message}</small>}
          </label>
          <label className="form-field">
            <span>Роль</span>
            <select {...register("role")}>
              <option value="participant">Участник</option>
              <option value="organizer">Организатор</option>
            </select>
          </label>
          <button className="button button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? <LoaderCircle className="spin" size={15} /> : <MailPlus size={15} />}Пригласить
          </button>
          {formError && <p className="auth-message auth-message-error team-form-error" role="alert">{formError}</p>}
        </form>
      )}

      {actionError && <p className="auth-message auth-message-error" role="alert">{actionError}</p>}
      <div className="team-members-grid">
        {members.map((member) => (
          <article className="team-member-card" key={member.user_id}>
            <span className="team-member-avatar">{member.full_name.trim().charAt(0).toUpperCase() || "У"}</span>
            <div>
              <strong>{member.full_name}</strong>
              <p>{member.is_owner ? "Владелец мероприятия" : member.role === "organizer" ? "Организатор" : "Участник"}</p>
            </div>
            <time dateTime={member.joined_at}>{new Date(member.joined_at).toLocaleDateString("ru-RU")}</time>
          </article>
        ))}
      </div>

      {canManage && (
        <section className="team-pending-invitations">
          <h3>Ожидают ответа <span>{invitations.length}</span></h3>
          {invitations.length === 0 ? (
            <p className="venue-no-rooms">Нет ожидающих приглашений.</p>
          ) : (
            <ul>
              {invitations.map((invitation) => (
                <li key={invitation.id}>
                  <div><strong>{invitation.email}</strong><span>{invitation.role === "organizer" ? "Организатор" : "Участник"}</span></div>
                  <button aria-label={`Отменить приглашение для ${invitation.email}`} className="planning-delete" disabled={busyInvitationId === invitation.id} onClick={() => void cancelInvitation(invitation)} type="button">
                    {busyInvitationId === invitation.id ? <LoaderCircle className="spin" size={14} /> : <Trash2 size={14} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </section>
  );
}

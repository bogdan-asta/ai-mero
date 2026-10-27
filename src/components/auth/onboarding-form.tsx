"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/database.types";

const onboardingSchema = z.object({
  fullName: z.string().trim().min(2, "Введите имя не короче двух символов."),
  role: z.enum(["student", "teacher", "staff", "other"], {
    error: "Выберите свою роль.",
  }),
  organization: z.string().trim().min(2, "Укажите вуз, организацию или команду."),
  eventInterest: z.string().trim().min(2, "Расскажите, какие мероприятия вы планируете."),
});

type OnboardingValues = z.infer<typeof onboardingSchema>;

const roleOptions = [
  { value: "student", label: "Студент / студсовет" },
  { value: "teacher", label: "Преподаватель" },
  { value: "staff", label: "Сотрудник организации" },
  { value: "other", label: "Другое" },
] as const;

export function OnboardingForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      fullName: profile.full_name,
      role: profile.onboarding_role ?? undefined,
      organization: profile.organization,
      eventInterest: profile.event_interest,
    },
  });

  async function onSubmit(values: OnboardingValues) {
    setFormError("");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setFormError("Сессия истекла. Войдите в аккаунт и попробуйте ещё раз.");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: values.fullName,
          onboarding_role: values.role,
          organization: values.organization,
          event_interest: values.eventInterest,
          onboarding_completed: true,
        })
        .eq("id", user.id);

      if (error) {
        setFormError(`Не удалось сохранить профиль: ${error.message}`);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? `Не удалось сохранить профиль: ${error.message}`
          : "Не удалось сохранить профиль.",
      );
    }
  }

  return (
    <main className="auth-page onboarding-page">
      <section className="auth-card onboarding-card">
        <Link aria-label="EventAI — на главную" className="auth-brand" href="/">
          <span className="brand-mark"><Sparkles size={17} /></span>
          <span>event<span className="brand-accent">ai</span></span>
        </Link>
        <div className="onboarding-progress" aria-label="Шаг 1 из 1">
          <span />
        </div>
        <div className="auth-heading">
          <span className="section-kicker">ПЕРВЫЙ ШАГ</span>
          <h1>Расскажите о себе</h1>
          <p>Так EventAI сможет лучше подстраивать подсказки под ваши задачи.</p>
        </div>

        {formError && <p className="auth-message auth-message-error" role="alert">{formError}</p>}

        <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <label className="form-field">
            <span>Как к вам обращаться?</span>
            <input autoComplete="name" {...register("fullName")} placeholder="Ваше имя" />
            {errors.fullName && <small>{errors.fullName.message}</small>}
          </label>

          <label className="form-field">
            <span>Ваша роль</span>
            <select {...register("role")} defaultValue="">
              <option disabled value="">Выберите роль</option>
              {roleOptions.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {errors.role && <small>{errors.role.message}</small>}
          </label>

          <label className="form-field">
            <span>Вуз, организация или команда</span>
            <input {...register("organization")} placeholder="Например, Университет" />
            {errors.organization && <small>{errors.organization.message}</small>}
          </label>

          <label className="form-field">
            <span>Какие мероприятия планируете?</span>
            <input {...register("eventInterest")} placeholder="Конференции, хакатоны, встречи..." />
            {errors.eventInterest && <small>{errors.eventInterest.message}</small>}
          </label>

          <button className="button button-primary auth-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? <LoaderCircle className="spin" size={17} /> : null}
            Продолжить
            {!isSubmitting && <ArrowRight size={16} />}
          </button>
        </form>
      </section>
    </main>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  Sparkles,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";

export type AuthFormMode =
  | "sign-in"
  | "sign-up"
  | "forgot-password"
  | "update-password";

type AuthFormValues = {
  fullName?: string;
  email: string;
  password?: string;
  confirmPassword?: string;
};

const authFields = z.object({
  fullName: z.string().optional(),
  email: z.string(),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
});

const headings: Record<AuthFormMode, { title: string; subtitle: string }> = {
  "sign-in": {
    title: "С возвращением",
    subtitle: "Войдите, чтобы продолжить планировать.",
  },
  "sign-up": {
    title: "Создайте аккаунт",
    subtitle: "Начните превращать идеи в события.",
  },
  "forgot-password": {
    title: "Восстановление пароля",
    subtitle: "Отправим ссылку для смены пароля на вашу почту.",
  },
  "update-password": {
    title: "Новый пароль",
    subtitle: "Придумайте новый пароль для аккаунта.",
  },
};

function getErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Неизвестная ошибка сервиса.";
  const code =
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : undefined;

  switch (code) {
    case "invalid_credentials":
      return "Неверный email или пароль. Проверьте данные и попробуйте ещё раз.";
    case "email_exists":
    case "user_already_exists":
      return "Аккаунт с таким email уже существует. Попробуйте войти.";
    case "weak_password":
      return "Пароль слишком простой. Используйте не менее 8 символов.";
    case "over_email_send_rate_limit":
      return "Слишком много писем за короткое время. Попробуйте позже.";
    case "otp_expired":
      return "Ссылка устарела. Запросите новую.";
    default:
      return `Не удалось выполнить запрос: ${message}`;
  }
}

function getCallbackUrl(next: string) {
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", next);
  return callback.toString();
}

function getSafeNextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next
    : "/dashboard";
}

export function AuthForm({ mode }: { mode: AuthFormMode }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const heading = headings[mode];
  const schema = useMemo(
    () =>
      authFields.superRefine((values, context) => {
        if (
          mode !== "update-password" &&
          !z.string().email().safeParse(values.email).success
        ) {
          context.addIssue({
            code: "custom",
            path: ["email"],
            message: "Введите корректный адрес электронной почты.",
          });
        }

        if (mode === "sign-up" && !values.fullName?.trim()) {
          context.addIssue({
            code: "custom",
            path: ["fullName"],
            message: "Укажите, как к вам обращаться.",
          });
        }

        if (mode === "sign-in" && !values.password) {
          context.addIssue({
            code: "custom",
            path: ["password"],
            message: "Введите пароль.",
          });
        }

        if (
          (mode === "sign-up" || mode === "update-password") &&
          (values.password?.length ?? 0) < 8
        ) {
          context.addIssue({
            code: "custom",
            path: ["password"],
            message: "Пароль должен содержать не менее 8 символов.",
          });
        }

        if (
          mode === "update-password" &&
          values.password !== values.confirmPassword
        ) {
          context.addIssue({
            code: "custom",
            path: ["confirmPassword"],
            message: "Пароли не совпадают.",
          });
        }
      }),
    [mode],
  );
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: AuthFormValues) {
    setFormError("");
    setNotice("");

    try {
      const supabase = createClient();

      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password ?? "",
        });
        if (error) throw error;
        router.replace(getSafeNextPath());
        router.refresh();
        return;
      }

      if (mode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password ?? "",
          options: {
            data: { full_name: values.fullName?.trim() ?? "" },
            emailRedirectTo: getCallbackUrl("/onboarding"),
          },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice("Проверьте почту и подтвердите адрес, чтобы завершить регистрацию.");
          return;
        }
        router.replace("/onboarding");
        router.refresh();
        return;
      }

      if (mode === "forgot-password") {
        const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
          redirectTo: getCallbackUrl("/auth/update-password"),
        });
        if (error) throw error;
        setNotice("Если аккаунт с таким email существует, на него отправлена ссылка для сброса пароля.");
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: values.password ?? "",
      });
      if (error) throw error;
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  async function sendMagicLink() {
    setFormError("");
    setNotice("");
    const email = getValues("email").trim();

    if (!z.string().email().safeParse(email).success) {
      setFormError("Введите корректный адрес электронной почты.");
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: getCallbackUrl("/dashboard"),
        },
      });
      if (error) throw error;
      setNotice("Ссылка для входа отправлена на вашу почту.");
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  async function signInWithGoogle() {
    setFormError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: getCallbackUrl("/onboarding") },
      });
      if (error) throw error;
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  async function signInAsGuest() {
    setFormError("");
    setNotice("");

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInAnonymously({
        options: { data: { full_name: "Гость" } },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Supabase не вернул гостевого пользователя.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: "Гость",
          onboarding_role: "other",
          organization: "Локальная разработка",
          event_interest: "Тестирование EventAI",
          onboarding_completed: true,
        })
        .eq("id", data.user.id)
        .select("id")
        .single();

      if (profileError) throw profileError;
      if (!profile) throw new Error("Не удалось создать профиль гостя.");

      router.replace(getSafeNextPath());
      router.refresh();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  const requiresPassword = mode === "sign-in" || mode === "sign-up" || mode === "update-password";
  const isDevelopment = process.env.NODE_ENV === "development";
  const hasSupabaseConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return (
    <section className="auth-card">
      <Link aria-label="EventAI — на главную" className="auth-brand" href="/">
        <span className="brand-mark"><Sparkles size={17} /></span>
        <span>event<span className="brand-accent">ai</span></span>
      </Link>

      <div className="auth-heading">
        <h1>{heading.title}</h1>
        <p>{heading.subtitle}</p>
      </div>

      {!hasSupabaseConfig && (
        <p className="auth-message auth-message-error" role="alert">
          Supabase ещё не настроен. Скопируйте <code>.env.example</code> в{" "}
          <code>.env.local</code>, добавьте URL проекта и anon-ключ, затем
          перезапустите приложение.
        </p>
      )}
      {formError && <p className="auth-message auth-message-error" role="alert">{formError}</p>}
      {notice && <p className="auth-message auth-message-success" role="status">{notice}</p>}

      <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {mode === "sign-up" && (
          <label className="form-field">
            <span>Ваше имя</span>
            <input autoComplete="name" {...register("fullName")} placeholder="Например, Анна" />
            {errors.fullName && <small>{errors.fullName.message}</small>}
          </label>
        )}

        {mode !== "update-password" && (
          <label className="form-field">
            <span>Email</span>
            <input
              autoComplete="email"
              id="auth-email"
              type="email"
              {...register("email")}
              placeholder="name@example.com"
            />
            {errors.email && <small>{errors.email.message}</small>}
          </label>
        )}

        {requiresPassword && (
          <label className="form-field">
            <span>{mode === "update-password" ? "Новый пароль" : "Пароль"}</span>
            <input
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              type="password"
              {...register("password")}
              placeholder="Не менее 8 символов"
            />
            {errors.password && <small>{errors.password.message}</small>}
          </label>
        )}

        {mode === "update-password" && (
          <label className="form-field">
            <span>Повторите пароль</span>
            <input
              autoComplete="new-password"
              type="password"
              {...register("confirmPassword")}
              placeholder="Введите пароль ещё раз"
            />
            {errors.confirmPassword && <small>{errors.confirmPassword.message}</small>}
          </label>
        )}

        <button className="button button-primary auth-submit" disabled={isSubmitting || !hasSupabaseConfig} type="submit">
          {isSubmitting ? <LoaderCircle className="spin" size={17} /> : null}
          {mode === "sign-in" && "Войти"}
          {mode === "sign-up" && "Создать аккаунт"}
          {mode === "forgot-password" && "Отправить ссылку"}
          {mode === "update-password" && "Сохранить пароль"}
          {!isSubmitting && <ArrowRight size={16} />}
        </button>
      </form>

      {mode === "sign-in" && (
        <>
          <div className="auth-divider"><span>или</span></div>
          <button className="button auth-secondary" disabled={!hasSupabaseConfig} onClick={signInWithGoogle} type="button">
            <GoogleMark /> Продолжить с Google
          </button>
          <button className="auth-magic-link" disabled={!hasSupabaseConfig} onClick={sendMagicLink} type="button">
            Отправить ссылку для входа на email
          </button>
          {isDevelopment && (
            <button
              className="button auth-secondary"
              disabled={!hasSupabaseConfig || isSubmitting}
              onClick={signInAsGuest}
              type="button"
            >
              <UserRound size={17} />
              Продолжить как гость
            </button>
          )}
        </>
      )}

      <div className="auth-links">
        {mode === "sign-in" && (
          <>
            <Link href="/forgot-password">Забыли пароль?</Link>
            <span>Нет аккаунта? <Link href="/sign-up">Зарегистрироваться</Link></span>
          </>
        )}
        {mode === "sign-up" && (
          <span>Уже есть аккаунт? <Link href="/sign-in">Войти</Link></span>
        )}
        {mode === "forgot-password" && (
          <Link href="/sign-in"><ArrowLeft size={14} /> Вернуться ко входу</Link>
        )}
        {mode === "update-password" && (
          <Link href="/sign-in"><ArrowLeft size={14} /> Вернуться ко входу</Link>
        )}
      </div>
    </section>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="google-mark" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.73 6C44.43 38.01 46.98 31.95 46.98 24.55Z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.12.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.55 2.56 10.78l7.97-6.19Z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.9 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}

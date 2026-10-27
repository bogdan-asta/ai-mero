import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { createClient } from "@/lib/supabase/server";
import { PageLoading } from "@/components/ui/page-loading";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingLoading />}>
      <OnboardingContent />
    </Suspense>
  );
}

async function OnboardingContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-heading">
            <h1>Профиль пока недоступен</h1>
            <p>
              Проверьте подключение Supabase и примените миграцию
              <code> 20261027000000_profiles.sql</code>.
            </p>
          </div>
          {error && <p className="auth-message auth-message-error" role="alert">{error.message}</p>}
        </section>
      </main>
    );
  }

  if (profile.onboarding_completed) {
    redirect("/dashboard");
  }

  return <OnboardingForm profile={profile} />;
}

function OnboardingLoading() {
  return <PageLoading message="Загружаем ваш профиль" variant="auth" />;
}

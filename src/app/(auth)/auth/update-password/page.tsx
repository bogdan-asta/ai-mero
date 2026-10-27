import { AuthForm } from "@/components/auth/auth-form";

export default function UpdatePasswordPage() {
  return (
    <main className="auth-page">
      <AuthForm mode="update-password" />
    </main>
  );
}

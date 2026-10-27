import { AuthForm } from "@/components/auth/auth-form";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page">
      <AuthForm mode="forgot-password" />
    </main>
  );
}

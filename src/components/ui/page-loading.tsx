import { Sparkles } from "lucide-react";

type LoadingVariant = "dashboard" | "events" | "form" | "detail" | "assistant" | "auth";

const variantContent: Record<LoadingVariant, React.ReactNode> = {
  dashboard: (
    <>
      <div className="loading-welcome">
        <div className="loading-block loading-title" />
        <div className="loading-block loading-copy" />
      </div>
      <div className="loading-section-heading">
        <div className="loading-block loading-subtitle" />
        <div className="loading-block loading-action" />
      </div>
      <div className="loading-card-grid">
        <LoadingCard />
        <LoadingCard />
      </div>
    </>
  ),
  events: (
    <>
      <div className="loading-section-heading loading-page-heading">
        <div>
          <div className="loading-block loading-eyebrow" />
          <div className="loading-block loading-title" />
          <div className="loading-block loading-copy" />
        </div>
        <div className="loading-block loading-action" />
      </div>
      <div className="loading-card-grid">
        <LoadingCard />
        <LoadingCard />
        <LoadingCard />
      </div>
    </>
  ),
  form: (
    <>
      <div className="loading-block loading-eyebrow" />
      <div className="loading-block loading-title" />
      <div className="loading-block loading-copy" />
      <div className="loading-form-card">
        <LoadingField wide />
        <LoadingField wide />
        <div className="loading-form-row">
          <LoadingField />
          <LoadingField />
        </div>
        <div className="loading-form-row">
          <LoadingField />
          <LoadingField />
        </div>
        <LoadingField wide />
      </div>
    </>
  ),
  detail: (
    <>
      <div className="loading-block loading-title" />
      <div className="loading-block loading-copy" />
      <div className="loading-detail-grid">
        <div className="loading-form-card">
          <div className="loading-block loading-subtitle" />
          <div className="loading-block loading-paragraph" />
          <div className="loading-block loading-paragraph" />
          <div className="loading-block loading-paragraph-short" />
        </div>
        <div className="loading-form-card loading-details-card">
          <div className="loading-block loading-subtitle" />
          <LoadingField />
          <LoadingField />
          <LoadingField />
        </div>
      </div>
    </>
  ),
  assistant: (
    <div className="loading-chat-card">
      <div className="loading-block loading-chat-bubble loading-chat-bubble-user" />
      <div className="loading-block loading-chat-bubble loading-chat-bubble-ai" />
      <div className="loading-block loading-chat-bubble loading-chat-bubble-short" />
      <div className="loading-block loading-chat-input" />
    </div>
  ),
  auth: (
    <div className="loading-auth-card">
      <div className="loading-block loading-title" />
      <div className="loading-block loading-copy" />
      <LoadingField wide />
      <LoadingField wide />
      <div className="loading-block loading-submit" />
    </div>
  ),
};

function LoadingCard() {
  return (
    <div className="loading-event-card">
      <div className="loading-block loading-eyebrow" />
      <div className="loading-block loading-card-title" />
      <div className="loading-block loading-paragraph" />
      <div className="loading-block loading-paragraph-short" />
    </div>
  );
}

function LoadingField({ wide = false }: { wide?: boolean }) {
  return (
    <div className={`loading-field${wide ? " loading-field-wide" : ""}`}>
      <div className="loading-block loading-field-label" />
      <div className="loading-block loading-field-control" />
    </div>
  );
}

export function PageLoading({
  message,
  variant,
}: {
  message: string;
  variant: LoadingVariant;
}) {
  return (
    <main className={`page-loading page-loading-${variant}`} aria-busy="true">
      <div className="loading-topbar">
        <span className="loading-brand">
          <span className="loading-brand-mark"><Sparkles aria-hidden="true" size={16} /></span>
          eventai
        </span>
        <span className="loading-nav loading-block" aria-hidden="true" />
      </div>
      <div className="loading-content">
        <div className="loading-status" role="status" aria-live="polite">
          <span className="loading-status-icon"><Sparkles aria-hidden="true" size={17} /></span>
          <span>{message}</span>
          <span className="loading-dots" aria-hidden="true"><i /><i /><i /></span>
        </div>
        <div className="loading-skeleton" aria-hidden="true">
          {variantContent[variant]}
        </div>
      </div>
    </main>
  );
}

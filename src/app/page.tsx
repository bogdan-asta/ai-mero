import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Lightbulb,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const features = [
  {
    icon: Sparkles,
    title: "От идеи к плану",
    description:
      "ИИ поможет продумать формат, программу, роли команды и риски — с учётом ваших условий.",
    tone: "violet",
  },
  {
    icon: CalendarDays,
    title: "Всё под контролем",
    description:
      "Дедлайны, задачи и бронирования собраны в одном месте. Ничего не потеряется в чатах.",
    tone: "blue",
  },
  {
    icon: FileText,
    title: "Документы без рутины",
    description:
      "Служебные записки и заявки заполняются по данным мероприятия — останется проверить и скачать.",
    tone: "orange",
  },
];

const steps = [
  {
    number: "01",
    title: "Опишите задумку",
    description: "Пара предложений — достаточно, чтобы начать.",
  },
  {
    number: "02",
    title: "Соберите план",
    description: "Уточните детали вместе с ИИ и распределите задачи.",
  },
  {
    number: "03",
    title: "Готовьтесь спокойно",
    description: "Следите за сроками и скачивайте готовые документы.",
  },
];

export default function Home() {
  return (
    <main id="top">
      <header className="site-header">
        <a aria-label="EventAI — на главную" className="brand" href="#">
          <span aria-hidden="true" className="brand-mark">
            <Sparkles size={18} strokeWidth={2.2} />
          </span>
          <span>event<span className="brand-accent">ai</span></span>
        </a>

        <nav aria-label="Основная навигация" className="desktop-nav">
          <a href="#features">Возможности</a>
          <a href="#how-it-works">Как это работает</a>
        </nav>

        <div className="header-actions">
          <a className="header-login" href="/sign-in">Войти</a>
          <a className="button button-primary header-cta" href="#preview">
            Посмотреть демо <ArrowDown size={15} />
          </a>
          <ThemeToggle />
        </div>
      </header>

      <section className="hero section-shell">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-sparkle"><Sparkles size={13} /></span>
            Планируйте события без лишней суеты
          </div>
          <h1>
            Хорошее событие
            <br />
            начинается <span className="gradient-text">с идеи.</span>
          </h1>
          <p className="hero-description">
            От первой идеи до готового плана: программа, задачи и документы
            для вашего события — в одном спокойном и понятном пространстве.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#preview">
              Посмотреть демо без регистрации <ArrowDown size={16} />
            </a>
            <a className="text-link" href="/sign-up">
              Создать аккаунт <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="hero-access-note">
            <CheckCircle2 aria-hidden="true" size={16} />
            <p>
              Сначала спокойно осмотритесь. Аккаунт понадобится, только чтобы
              создать и сохранить своё мероприятие.
            </p>
          </div>
        </div>

        <div aria-label="Пример плана мероприятия" className="hero-visual" id="preview">
          <div className="visual-glow" />
          <div className="floating-note note-top">
            <span className="note-icon note-icon-purple"><Sparkles size={15} /></span>
            <span><strong>План готов</strong><small>Собрали всё важное</small></span>
            <CheckCircle2 className="note-check" size={17} />
          </div>

          <div className="event-card">
            <div className="event-card-top">
              <span className="event-label"><span className="live-dot" /> НОВОЕ МЕРОПРИЯТИЕ</span>
              <span className="demo-label">ДЕМО</span>
            </div>
            <h2>День идей и технологий</h2>
            <p className="event-subtitle">Встречаем тех, кто меняет будущее</p>

            <div className="event-meta">
              <span><CalendarDays size={15} /> 28 ноября, 10:00</span>
              <span><MapPin size={15} /> Главный корпус</span>
              <span><Users size={15} /> До 80 гостей</span>
            </div>

            <div className="event-divider" />
            <div className="card-section-heading">
              <span>План подготовки</span><span className="progress-value">3 из 5</span>
            </div>
            <div aria-label="Готово 60 процентов" className="progress-track">
              <span />
            </div>
            <ul className="task-list">
              <li className="task-done"><span className="task-check"><Check size={12} /></span><span>Продумать концепцию</span><small>Готово</small></li>
              <li className="task-done"><span className="task-check"><Check size={12} /></span><span>Составить программу</span><small>Готово</small></li>
              <li><span className="task-empty" /><span>Подтвердить аудиторию</span><small className="task-date">до 14 ноя</small></li>
            </ul>

            <div className="ai-suggestion">
              <span className="suggestion-icon"><Lightbulb size={15} /></span>
              <p><strong>Хорошее начало!</strong><br />Добавим задачи по срокам?</p>
              <ArrowRight size={15} />
            </div>
          </div>

          <div className="floating-note note-bottom">
            <span className="note-icon note-icon-green"><FileText size={15} /></span>
            <span><strong>Записка готова</strong><small>Осталось проверить</small></span>
            <CheckCircle2 className="note-check" size={17} />
          </div>
          <div aria-hidden="true" className="decorative-sparkle"><Sparkles size={20} /></div>
        </div>
      </section>

      <section aria-label="Преимущества" className="trust-strip">
        <div className="trust-inner">
          <span>От первой мысли</span><span className="trust-line" />
          <span>до события, которое запомнят</span><Clock3 size={15} />
        </div>
      </section>

      <section className="features-section section-shell" id="features">
        <div className="section-heading">
          <span className="section-kicker">МЕНЬШЕ ХАОСА, БОЛЬШЕ СМЫСЛА</span>
          <h2>Всё для события —<br /><span>в одном месте.</span></h2>
          <p>Планирование становится понятным, когда рядом есть хороший помощник.</p>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, description, tone }) => (
            <article className="feature-card" key={title}>
              <span className={`feature-icon ${tone}`}><Icon size={20} strokeWidth={1.8} /></span>
              <h3>{title}</h3>
              <p>{description}</p>
              <span aria-hidden="true" className="feature-arrow"><ArrowUpRight size={17} /></span>
            </article>
          ))}
        </div>
      </section>

      <section className="steps-section" id="how-it-works">
        <div className="section-shell steps-inner">
          <div className="steps-intro">
            <span className="section-kicker">ПРОСТО НАЧАТЬ</span>
            <h2>От задумки<br />до <span>«всё готово».</span></h2>
            <p>Не нужно сразу знать каждый шаг. Начните с того, что уже есть.</p>
            <a className="button button-primary" href="/sign-up">
              Создать своё событие <ArrowRight size={17} />
            </a>
          </div>
          <div className="step-list">
            {steps.map((step) => (
              <article className="step-item" key={step.number}>
                <span className="step-number">{step.number}</span>
                <div><h3>{step.title}</h3><p>{step.description}</p></div>
                {step.number === "03" && <CheckCircle2 className="step-check" size={19} />}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta section-shell" id="start">
        <div className="cta-sparkle cta-sparkle-one"><Sparkles size={16} /></div>
        <div className="cta-sparkle cta-sparkle-two"><Sparkles size={12} /></div>
        <span className="section-kicker">ВАША ИДЕЯ УЖЕ ЖДЁТ</span>
        <h2>А что вы хотите<br />организовать?</h2>
        <p>Посмотрите пример без регистрации. Чтобы сохранить свою идею, понадобится аккаунт.</p>
        <a className="button button-light" href="/sign-up">
          Давайте начнём <ArrowRight size={17} />
        </a>
      </section>

      <footer className="site-footer section-shell">
        <a aria-label="EventAI — на главную" className="brand footer-brand" href="#top">
          <span aria-hidden="true" className="brand-mark"><Sparkles size={16} /></span>
          <span>event<span className="brand-accent">ai</span></span>
        </a>
        <p>Пусть хорошие идеи случаются чаще.</p>
        <span className="footer-copy">© 2026 EventAI</span>
      </footer>
    </main>
  );
}

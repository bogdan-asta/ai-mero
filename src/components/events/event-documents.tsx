"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import { Download, FileText, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { EventDocumentRecord, EventRecord } from "@/lib/supabase/database.types";

const createDocumentSchema = z.object({
  template: z.enum(["event_order", "invitation", "venue_request", "event_brief"]),
});

type DocumentTemplate = z.infer<typeof createDocumentSchema>["template"];

const templateLabels: Record<DocumentTemplate, string> = {
  event_order: "Приказ о проведении",
  invitation: "Приглашение",
  venue_request: "Запрос площадке",
  event_brief: "Краткая справка",
};

function formatEventDate(date: string | null) {
  return date
    ? new Date(`${date}T12:00:00`).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "[укажите дату]";
}

function createTemplate(template: DocumentTemplate, event: EventRecord) {
  const date = formatEventDate(event.event_date);
  const guests = event.guests_count ? `${event.guests_count} человек` : "[укажите количество гостей]";
  const venue = event.venue_name || "[укажите площадку]";
  const format = event.format || "[укажите формат]";

  switch (template) {
    case "event_order":
      return `ПРИКАЗ
о проведении мероприятия «${event.title}»

№ [номер] от ${date}

В целях организации мероприятия «${event.title}», посвящённого следующей идее:
${event.idea}

ПРИКАЗЫВАЮ:
1. Провести мероприятие «${event.title}» ${date} в формате «${format}» на площадке «${venue}».
2. Установить плановое количество участников: ${guests}.
3. Ответственным за проведение назначить: [ФИО, должность].
4. Ответственным за подготовку площадки и оборудования назначить: [ФИО, должность].
5. Контроль исполнения настоящего приказа оставляю за собой.

[Должность руководителя]
[ФИО]
[Подпись]`;
    case "invitation":
      return `ПРИГЛАШЕНИЕ

Приглашаем вас на мероприятие «${event.title}»!

Идея события:
${event.idea}

Дата: ${date}
Формат: ${format}
Место: ${venue}

Время начала: [укажите время]
Регистрация: [ссылка или контакт]

Будем рады видеть вас!
[Организатор и контакт для связи]`;
    case "venue_request":
      return `ЗАПРОС О ПРЕДОСТАВЛЕНИИ ПЛОЩАДКИ

Кому: [название организации или площадки]
От: [организатор / организация]

Просим рассмотреть возможность предоставления площадки «${venue}» для проведения мероприятия «${event.title}».

Планируемая дата: ${date}
Формат: ${format}
Количество гостей: ${guests}
Необходимое оснащение: [перечислите оборудование и требования]

Будем признательны за информацию о доступности площадки, условиях использования и стоимости.

[ФИО и должность]
[Контактные данные]
[Дата составления]`;
    case "event_brief":
      return `КРАТКАЯ СПРАВКА О МЕРОПРИЯТИИ

Название: ${event.title}
Идея: ${event.idea}
Дата: ${date}
Формат: ${format}
Плановое количество гостей: ${guests}
Площадка: ${venue}
Бюджет: ${event.budget !== null ? `${new Intl.NumberFormat("ru-RU").format(event.budget)} ₽` : "[укажите бюджет]"}

Цель мероприятия: ${event.goal || "[укажите цель]"}
Целевая аудитория: ${event.target_audience || "[укажите аудиторию]"}

Примечания: [добавьте важные сведения]`;
  }
}

export function EventDocuments({
  event,
  documents: initialDocuments,
  canManage,
}: {
  event: EventRecord;
  documents: EventDocumentRecord[];
  canManage: boolean;
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [selectedId, setSelectedId] = useState<string | null>(initialDocuments[0]?.id ?? null);
  const [draftTitle, setDraftTitle] = useState(initialDocuments[0]?.title ?? "");
  const [draftContent, setDraftContent] = useState(initialDocuments[0]?.content ?? "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const selectedDocument = documents.find((document) => document.id === selectedId) ?? null;

  const {
    register,
    handleSubmit,
    reset: resetTemplateForm,
    formState: { isSubmitting },
  } = useForm<{ template: DocumentTemplate }>({
    resolver: zodResolver(createDocumentSchema),
    defaultValues: { template: "event_brief" },
  });

  function selectDocument(document: EventDocumentRecord) {
    setSelectedId(document.id);
    setDraftTitle(document.title);
    setDraftContent(document.content);
    setError("");
    setNotice("");
  }

  async function createDocument(values: { template: DocumentTemplate }) {
    setError("");
    setNotice("");
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Сессия истекла. Войдите в аккаунт и попробуйте ещё раз.");

      const title = templateLabels[values.template];
      const content = createTemplate(values.template, event);
      const { data, error: insertError } = await supabase
        .from("event_documents")
        .insert({
          event_id: event.id,
          created_by: user.id,
          title,
          document_type: values.template,
          content,
        })
        .select("*")
        .single();

      if (insertError) throw new Error(`Не удалось создать документ: ${insertError.message}`);
      setDocuments((current) => [data, ...current]);
      selectDocument(data);
      resetTemplateForm();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось создать документ.");
    }
  }

  async function saveDocument() {
    if (!selectedDocument) return;
    setError("");
    setNotice("");
    setIsSaving(true);
    try {
      const { data, error: updateError } = await createClient()
        .from("event_documents")
        .update({ title: draftTitle.trim(), content: draftContent })
        .eq("id", selectedDocument.id)
        .select("*")
        .single();
      if (updateError) throw new Error(`Не удалось сохранить документ: ${updateError.message}`);

      setDocuments((current) => current.map((document) => document.id === data.id ? data : document));
      setNotice("Черновик сохранён.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось сохранить документ.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteDocument(document: EventDocumentRecord) {
    if (!window.confirm(`Удалить документ «${document.title}»?`)) return;
    setError("");
    setNotice("");
    try {
      const { error: deleteError } = await createClient()
        .from("event_documents")
        .delete()
        .eq("id", document.id);
      if (deleteError) throw new Error(`Не удалось удалить документ: ${deleteError.message}`);

      const nextDocuments = documents.filter((item) => item.id !== document.id);
      setDocuments(nextDocuments);
      if (selectedId === document.id) {
        const nextSelected = nextDocuments[0] ?? null;
        setSelectedId(nextSelected?.id ?? null);
        setDraftTitle(nextSelected?.title ?? "");
        setDraftContent(nextSelected?.content ?? "");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось удалить документ.");
    }
  }

  async function downloadDocument() {
    if (!selectedDocument) return;
    setError("");
    setIsDownloading(true);
    try {
      const docx = new Document({
        sections: [{
          children: [
            new Paragraph({ text: draftTitle, heading: HeadingLevel.TITLE, spacing: { after: 320 } }),
            ...draftContent.split(/\r?\n/).map((line) => new Paragraph({
              text: line || " ",
              spacing: { after: 150 },
            })),
          ],
        }],
      });
      const blob = await Packer.toBlob(docx);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${draftTitle.trim().replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-|-$/g, "") || "event-document"}.docx`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError(error instanceof Error ? `Не удалось подготовить файл Word: ${error.message}` : "Не удалось подготовить файл Word.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <section className="planning-module document-module">
      <header className="planning-module-heading">
        <div>
          <span className="section-kicker">ДОКУМЕНТЫ МЕРОПРИЯТИЯ</span>
          <h2>Шаблоны и черновики</h2>
          <p>Заполните проверенные данные, отредактируйте плейсхолдеры и скачайте файл Word.</p>
        </div>
        <FileText className="document-module-icon" size={20} />
      </header>

      {canManage && (
        <form className="document-create-form" onSubmit={handleSubmit(createDocument)}>
          <label className="form-field">
            <span>Шаблон документа</span>
            <select {...register("template")}>
              {Object.entries(templateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button className="button button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}
            Создать черновик
          </button>
        </form>
      )}

      {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}
      {notice && <p className="auth-message auth-message-success" role="status">{notice}</p>}

      <div className="document-workspace">
        <aside aria-label="Документы мероприятия" className="document-list-panel">
          <h3>Сохранённые документы</h3>
          {documents.length === 0 ? (
            <p className="venue-no-rooms">{canManage ? "Создайте первый черновик из шаблона." : "Организатор ещё не создал документы."}</p>
          ) : (
            <ul>
              {documents.map((document) => (
                <li key={document.id}>
                  <button className={document.id === selectedId ? "document-list-active" : ""} onClick={() => selectDocument(document)} type="button">
                    <FileText size={14} /><span><strong>{document.title}</strong><small>{templateLabels[document.document_type]}</small></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {selectedDocument ? (
          <div className="document-editor">
            <div className="document-editor-toolbar">
              <span className="planning-status">Черновик</span>
              <div>
                {canManage && (
                  <>
                    <button aria-label="Удалить документ" className="planning-delete" onClick={() => void deleteDocument(selectedDocument)} type="button"><Trash2 size={15} /></button>
                    <button className="button button-outline" disabled={isSaving} onClick={() => void saveDocument()} type="button">
                      {isSaving ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />}Сохранить
                    </button>
                  </>
                )}
                <button className="button button-outline" disabled={isDownloading} onClick={() => void downloadDocument()} type="button">
                  {isDownloading ? <LoaderCircle className="spin" size={14} /> : <Download size={14} />}Скачать DOCX
                </button>
              </div>
            </div>
            {canManage ? (
              <>
                <label className="sr-only" htmlFor="document-title">Название документа</label>
                <input id="document-title" className="document-title-input" maxLength={160} onChange={(event) => setDraftTitle(event.target.value)} value={draftTitle} />
                <label className="sr-only" htmlFor="document-content">Текст документа</label>
                <textarea id="document-content" className="document-content-input" maxLength={20000} onChange={(event) => setDraftContent(event.target.value)} value={draftContent} />
              </>
            ) : (
              <article className="document-readonly">
                <h3>{selectedDocument.title}</h3>
                <pre>{selectedDocument.content}</pre>
              </article>
            )}
          </div>
        ) : (
          <div className="document-preview-empty"><FileText size={22} /><p>Выберите документ или создайте черновик.</p></div>
        )}
      </div>
    </section>
  );
}

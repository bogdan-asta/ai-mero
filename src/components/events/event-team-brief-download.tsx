"use client";

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import type { EventRecord } from "@/lib/supabase/database.types";

const programSchema = z.array(
  z.object({
    startTime: z.string(),
    durationMinutes: z.number(),
    title: z.string(),
    description: z.string(),
  }),
);

function formatEventDate(date: string | null) {
  return date
    ? new Date(`${date}T12:00:00`).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "[уточнить дату]";
}

function field(label: string, value: string) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun(value),
    ],
    spacing: { after: 120 },
  });
}

function item(text: string) {
  return new Paragraph({
    text: `• ${text}`,
    spacing: { after: 100 },
  });
}

function section(title: string, tasks: string[]) {
  return [
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 280, after: 160 },
    }),
    ...tasks.map(item),
  ];
}

function createBrief(event: EventRecord) {
  const parsedProgram = programSchema.safeParse(event.program);
  const programLines = parsedProgram.success
    ? parsedProgram.data.map(
        (entry) =>
          `${entry.startTime} · ${entry.durationMinutes} мин. — ${entry.title}. ${entry.description}`,
      )
    : [];
  const budget =
    event.budget === null
      ? "[уточнить]"
      : `${new Intl.NumberFormat("ru-RU").format(event.budget)} ₽`;
  const guests =
    event.guests_count === null
      ? "[уточнить количество посетителей]"
      : `${event.guests_count} посетителей`;
  const commonDetails = [
    field("Мероприятие", event.title),
    field("Дата", formatEventDate(event.event_date)),
    field("Формат", event.format || "[уточнить формат]"),
    field("Цель", event.goal || "[согласовать цель с организатором]"),
    field("Аудитория", event.target_audience || "[уточнить аудиторию]"),
    field("Количество посетителей", guests),
    field("Площадка", event.venue_name || "[не подтверждена — уточнить]"),
    field("Бюджетный предел", budget),
    new Paragraph({
      text: "Краткое описание",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 280, after: 160 },
    }),
    new Paragraph({ text: event.idea, spacing: { after: 180 } }),
  ];

  const program = [
    new Paragraph({
      text: "Черновой план программы",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 280, after: 160 },
    }),
    ...(programLines.length
      ? programLines.map(item)
      : [item("Программа пока не добавлена. Согласовать содержание, время и длительность блоков.")]),
    item("Сверить общую длительность программы с доступным временем и расписанием площадки."),
  ];

  const roles = [
    ...section("1. Координатор мероприятия", [
      "Собрать у заказчика подтверждённые дату, время, площадку, вместимость, аудиторию, цель, бюджет и контакты ответственных.",
      "Согласовать программу, задачи специалистов, сроки подготовки и порядок утверждения материалов.",
      "Вести единый список решений, открытых вопросов, рисков и контактов команды.",
      "Проверить готовность площадки, специалистов и материалов перед мероприятием.",
      "Сроки и ответственные: [назначить организатором].",
    ]),
    ...section("2. Автор текстов и специалист по социальным сетям", [
      "Подготовить анонс: название, кому подходит мероприятие, польза для участника, подтверждённые дата, время и место, условия участия и способ регистрации.",
      "Подготовить короткую версию для публикации, текст для сторис/короткого объявления и напоминание зарегистрированным участникам.",
      "Уточнить площадки публикации, тон общения, ссылку на регистрацию, контакты и сроки публикаций у организатора.",
      "Не придумывать спикеров, программу, стоимость, адрес, ссылки и обещания; неизвестное помечать для согласования.",
      "Передать тексты в редактируемом формате и получить письменное согласование до публикации.",
    ]),
    ...section("3. Дизайнер", [
      "Подготовить главный визуал и адаптации для согласованных каналов и размеров; актуальные требования площадок проверить перед экспортом.",
      "По запросу организатора подготовить печатные материалы: навигацию, таблички, бейджи, программу, сертификаты и/или слайды.",
      "Получить у организатора логотипы, фирменные материалы, точные тексты, формат печати и требования к исходникам.",
      "Передать согласованные файлы для публикации и печати, а также исходники в оговорённом формате.",
      "Не размещать непроверенные даты, адреса, имена, QR-коды и логотипы.",
    ]),
    ...section("4. Ведущий", [
      "Подготовить сценарный план с приветствием, переходами между блоками, инструкциями участникам и завершением.",
      "Сверить сценарий с утверждённой программой и координатором; проверить произношение имён и названий.",
      "Подготовить краткие запасные реплики на случай задержки, отсутствия участника или технической паузы.",
      "До мероприятия проверить микрофон, тайминг и порядок связи с техническим директором.",
    ]),
    ...section("5. Фотограф / видеограф", [
      "Согласовать список ключевых кадров, формат съёмки, длительность работы, способ передачи и срок отдачи материалов.",
      "Снять общие планы, ключевые части программы, работу команды и детали площадки согласно согласованному списку.",
      "Заранее согласовать правила съёмки и публикации изображений участников, особенно несовершеннолетних; соблюдать требования организатора по согласию и приватности.",
      "Передать отобранные и обработанные материалы организатору; не публиковать их самостоятельно без отдельного согласования.",
    ]),
    ...section("6. Технический директор / технический специалист", [
      "Уточнить фактические возможности площадки: электропитание, звук, микрофоны, экран/проектор, подключение, освещение и доступ для монтажа.",
      "Составить перечень оборудования и схему подключения только после подтверждения площадки и формата программы.",
      "Проверить оборудование и провести тест до прихода участников; согласовать время монтажа и ответственных за доступ.",
      "Подготовить план на случай отказа оборудования и сообщить организатору критические технические риски.",
      "Не считать оборудование площадки доступным, пока ответственное лицо это не подтвердило.",
    ]),
    ...section("7. Ответственный за площадку и регистрацию", [
      "Подтвердить бронирование, вместимость, доступность помещения, время монтажа/демонтажа и правила использования.",
      "Настроить регистрацию и учёт посетителей; отдельно уточнить, включены ли организаторы в лимит вместимости.",
      "Если среди участников несовершеннолетние — согласовать с организатором необходимый порядок родительских согласий и обработки данных.",
      "Подготовить встречу гостей, список регистрации, навигацию, рассадку и контакт ответственного на площадке.",
      "Не сообщать участникам адрес или аудиторию до официального подтверждения.",
    ]),
  ];

  const finalChecks = section("Общие правила и контроль перед запуском", [
    "Все поля в квадратных скобках заполнить и проверить с организатором до передачи задания исполнителям.",
    "Дата, время, площадка, бюджет, число посетителей и программа являются подтверждёнными только после согласования ответственным.",
    "Все внешние тексты, макеты, сценарии и технические решения согласовать с координатором до публикации, печати или закупки.",
    "Зафиксировать для каждого специалиста имя, контакт, срок, формат результата и лицо, принимающее работу.",
    "План и это ТЗ — рабочий черновик, а не подтверждение бронирования, стоимости услуг или доступности оборудования.",
  ]);

  return new Document({
    title: `ТЗ для команды — ${event.title}`,
    subject: "Единое техническое задание специалистам по мероприятию",
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, right: 900, bottom: 900, left: 900 },
          },
        },
        children: [
          new Paragraph({
            text: "ЕДИНОЕ ТЕХНИЧЕСКОЕ ЗАДАНИЕ",
            heading: HeadingLevel.TITLE,
            spacing: { after: 220 },
          }),
          new Paragraph({
            text: "Рабочий документ для команды мероприятия. Заполните поля в квадратных скобках и согласуйте факты до начала работ.",
            spacing: { after: 260 },
          }),
          ...commonDetails,
          ...program,
          ...roles,
          ...finalChecks,
        ],
      },
    ],
  });
}

export function EventTeamBriefDownload({ event }: { event: EventRecord }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");

  async function downloadBrief() {
    setError("");
    setIsDownloading(true);
    try {
      const blob = await Packer.toBlob(createBrief(event));
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      const filename = event.title
        .trim()
        .replace(/[^\p{L}\p{N}-]+/gu, "-")
        .replace(/^-|-$/g, "");
      anchor.href = url;
      anchor.download = `TZ-komande-${filename || "meropriyatie"}.docx`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? `Не удалось подготовить файл Word: ${downloadError.message}`
          : "Не удалось подготовить файл Word.",
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <>
      <button
        className="button button-outline event-brief-download"
        disabled={isDownloading}
        onClick={() => void downloadBrief()}
        type="button"
      >
        {isDownloading ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />}
        Скачать ТЗ для команды
      </button>
      {error && <span className="event-brief-download-error" role="alert">{error}</span>}
    </>
  );
}

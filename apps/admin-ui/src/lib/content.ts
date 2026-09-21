import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABEL,
  type ItemKind,
  type ItemState,
  NEWS_CATEGORIES,
  PAGE_PATHS,
  type PageSlug,
  capitalize,
} from "@dhoa/shared";
import type { Field } from "./fields.ts";

export type KindConfig = {
  kind: ItemKind;
  /** Singular and plural, in plain words. */
  one: string;
  many: string;
  path: string;
  intro: string;
  fields: Field[];
  /** Whether the public site gives each item its own page (news, events, pages) or a link (documents). */
  publicUrl: (slug: string) => string;
};

export const KINDS: Record<ItemKind, KindConfig> = {
  news: {
    kind: "news",
    one: "news post",
    many: "News",
    path: "/content/news/",
    intro:
      "Announcements from the board. Newest first on the site; pinned posts stay at the top.",
    publicUrl: (slug) => `/news/${slug}/`,
    fields: [
      {
        key: "title",
        label: "Title",
        kind: "text",
        required: true,
        help: "Short and specific, like a headline.",
      },
      {
        key: "summary",
        label: "Summary",
        kind: "textarea",
        rows: 2,
        required: true,
        help: "One or two sentences shown in lists.",
      },
      {
        key: "body",
        label: "Full text",
        kind: "markdown",
        help: "The whole announcement. Paragraphs are fine; no formatting needed.",
      },
      {
        key: "category",
        label: "Category",
        kind: "select",
        options: NEWS_CATEGORIES.map((c) => ({
          value: c,
          label: capitalize(c),
        })),
      },
      {
        key: "pinned",
        label: "Pin to the top of the news list",
        kind: "boolean",
        help: "Use for one urgent notice at a time.",
      },
    ],
  },
  event: {
    kind: "event",
    one: "event",
    many: "Events",
    path: "/content/events/",
    intro:
      "Things residents can come to. They appear on the calendar feed and the home page until they are over.",
    publicUrl: (slug) => `/events/${slug}/`,
    fields: [
      { key: "title", label: "Title", kind: "text", required: true },
      {
        key: "summary",
        label: "Summary",
        kind: "textarea",
        rows: 2,
        required: true,
        help: "One sentence for the calendar and lists.",
      },
      { key: "start", label: "Starts", kind: "datetime", required: true },
      { key: "end", label: "Ends", kind: "datetime", required: true },
      { key: "location", label: "Where", kind: "text" },
      {
        key: "cost",
        label: "Cost",
        kind: "text",
        placeholder: "Free",
        help: "Leave blank if there is no charge.",
      },
      {
        key: "audience",
        label: "Who it is for",
        kind: "text",
        placeholder: "Everyone",
      },
      {
        key: "contact_email_key",
        label: "Questions go to",
        kind: "select",
        options: [
          { value: "", label: "Nobody in particular" },
          { value: "general", label: "The office" },
          { value: "pool_rec", label: "Pool & Recreation Committee" },
          { value: "acc", label: "Architectural Control Committee" },
        ],
      },
      { key: "body", label: "More details", kind: "markdown", rows: 6 },
    ],
  },
  document: {
    kind: "document",
    one: "document",
    many: "Documents",
    path: "/content/documents/",
    intro:
      "Forms, notices and other files in the site's document library. Upload the file, then describe it.",
    publicUrl: () => "/documents/",
    fields: [
      {
        key: "title",
        label: "Title",
        kind: "text",
        required: true,
        help: 'What people will click on, like "Recreation Center rental contract".',
      },
      {
        key: "summary",
        label: "What it is",
        kind: "textarea",
        rows: 2,
        required: true,
        help: "One sentence so people know whether it is the file they need.",
      },
      {
        key: "category",
        label: "Section of the library",
        kind: "select",
        options: DOCUMENT_CATEGORIES.map((c) => ({
          value: c,
          label: DOCUMENT_CATEGORY_LABEL[c],
        })),
      },
      {
        key: "language",
        label: "Language",
        kind: "select",
        options: [
          { value: "en", label: "English" },
          { value: "es", label: "Spanish" },
        ],
      },
      {
        key: "featured",
        label: "Feature it",
        kind: "boolean",
        help: "Featured documents are listed first in their section.",
      },
    ],
  },
  page: {
    kind: "page",
    one: "page",
    many: "Pages",
    path: "/content/pages/",
    intro:
      "The written text of the site's pages. Facts like phone numbers and fees are under Site settings, so they stay consistent everywhere.",
    publicUrl: (slug) => PAGE_PATHS[slug as PageSlug] ?? "/",
    fields: [
      { key: "title", label: "Title", kind: "text", required: true },
      {
        key: "summary",
        label: "Summary",
        kind: "textarea",
        rows: 2,
        help: "Shown under the title at the top of the page.",
      },
      { key: "body", label: "Text", kind: "markdown", rows: 16 },
    ],
  },
};

export const stateLabel: Record<ItemState, string> = {
  draft: "Draft",
  pending: "Waiting for approval",
  published: "Published",
};

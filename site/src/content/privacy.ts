/**
 * The Privacy page. The form lists must match what the forms actually
 * ask for, so update this file whenever a form field changes.
 *
 * TODO(leadership): approve the wording, the retention period, and the
 * date below.
 */

export type FormPrivacy = {
  name: string;
  href: string;
  collects: string[];
  why: string;
};

export const privacy = {
  updated: "2026-09-28",
  retentionMonths: 12,

  forms: [
    {
      name: "Contact",
      href: "/contact",
      collects: ["Name", "Email", "Phone (optional)", "Student, parent, or other", "Your message"],
      why: "So we can write back.",
    },
    {
      name: "Plan a visit",
      href: "/visit#coming",
      collects: ["Name", "Email or phone", "A note (optional)"],
      why: "So a leader can look out for you on your first night.",
    },
    {
      name: "Join the group chat",
      href: "/connect#join",
      collects: ["Name", "Email or phone", "High school or college (optional)"],
      why: "So a leader can add you to the chat.",
    },
    {
      name: "Serve",
      href: "/connect#serve",
      collects: ["Name", "Email or phone", "Areas you'd like to help in", "A note (optional)"],
      why: "So a leader can follow up.",
    },
  ] satisfies FormPrivacy[],
};

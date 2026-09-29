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
      collects: ["Name", "Email or phone", "High school or college", "A note (optional)"],
      why: "So a leader can look out for you on your first night.",
    },
    {
      name: "Join a group",
      href: "/connect#join",
      collects: ["Name", "Email or phone", "High school or college", "Which group", "Parent or guardian email (high school)"],
      why: "So a leader can add you, with a parent or guardian in the loop for high school students.",
    },
    {
      name: "Serve",
      href: "/connect#serve",
      collects: ["Name", "Email or phone", "High school or college", "Teams you're interested in", "A note (optional)"],
      why: "So the right team leader can follow up.",
    },
  ] satisfies FormPrivacy[],
};

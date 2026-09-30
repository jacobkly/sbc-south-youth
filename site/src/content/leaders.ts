/**
 * The two leader cards. Names, roles, bios, and emails are placeholders,
 * and the cards show generated art instead of stand-in faces, so no stock
 * photo ever passes for one of our leaders.
 *
 * TODO(leadership): real names, roles, bios, fun facts, emails, and
 * photos, each approved by the leader it describes.
 */

import type { Leader } from "@/lib/content/types";

export const leaders: Leader[] = [
  {
    slug: "youth-pastor",
    name: "Alex Example",
    role: "Youth Pastor",
    bio: "Placeholder bio. Two sentences about who they are and why they love leading youth.",
    funFact: "Placeholder fun fact, like a strong opinion about the best cafe drink.",
    email: "pastor@example.org",
  },
  {
    slug: "youth-leader",
    name: "Jordan Sample",
    role: "Youth Leader",
    bio: "Placeholder bio. Two sentences about how they got involved and what they run on a typical night.",
    funFact: "Placeholder fun fact, like the camp game they never lose.",
    email: "leader@example.org",
  },
];

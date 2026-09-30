import type { StudentBand } from "@/lib/forms/schemas";

/**
 * The teams on the Serve form. High school students see student teams and
 * college students see leader roles, so each team lists who it's for.
 *
 * TODO(leadership): the real teams, what each one does, and who can join.
 */

export type ServeTeam = {
  id: string;
  title: string;
  body: string;
  for: StudentBand[];
};

export const serveTeams: ServeTeam[] = [
  { id: "welcome", title: "Welcome", body: "Say hi at the door and help new people find their way.", for: ["hs", "college"] },
  { id: "worship", title: "Worship", body: "Sing or play in the band.", for: ["hs", "college"] },
  { id: "tech", title: "Tech", body: "Run slides, sound, and lights.", for: ["hs", "college"] },
  { id: "setup", title: "Setup", body: "Get the room ready before youth night and reset it after.", for: ["hs"] },
  { id: "small-groups", title: "Small group leader", body: "Lead a high school small group with a partner.", for: ["college"] },
  { id: "events", title: "Events", body: "Help plan and run retreats, camps, and big nights.", for: ["college"] },
];

/** The teams someone in that grade band can pick. */
export function teamsFor(band: StudentBand): ServeTeam[] {
  return serveTeams.filter((team) => team.for.includes(band));
}

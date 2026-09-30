/**
 * The areas to serve in, for regulars. They're on the Connect page and in
 * the Serve form, which checks against this file, so it ships to the
 * browser. Keep it to plain text, with no imports.
 */

export type ServeArea = {
  id: string;
  title: string;
  body: string;
};

export const serveAreas: ServeArea[] = [
  { id: "worship", title: "Worship", body: "Sing or play on the worship team." },
  { id: "cafe", title: "Cafe", body: "Run the church's cafe on Sundays and after youth. Youth members only." },
  // TODO(leadership): a line each for greeting, ushers, and media.
  { id: "greeting", title: "Greeting", body: "Welcome people as they come in." },
  { id: "ushers", title: "Ushers", body: "Help people find a seat and keep the service running smoothly." },
  { id: "media", title: "Media", body: "Slides, sound, and lights." },
  { id: "other", title: "Other", body: "Have an idea for a way to serve, or to make something better? Tell us below." },
];

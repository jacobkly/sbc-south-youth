import type { Metadata } from "next";
import { PageIntro } from "@/components/site/page-intro";
import { Stub } from "@/components/site/stub";

export const metadata: Metadata = { title: "This Week" };

export default function ThisWeekPage() {
  return (
    <>
      <PageIntro eyebrow="This week" title="What's happening.">
        Youth nights, events, and announcements for the next few weeks.
      </PageIntro>
      <Stub note="The feed of events and announcements goes here." />
    </>
  );
}

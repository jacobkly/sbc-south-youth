import type { Metadata } from "next";
import { PageIntro } from "@/components/site/page-intro";
import { Stub } from "@/components/site/stub";

export const metadata: Metadata = { title: "Plan a Visit" };

export default function VisitPage() {
  return (
    <>
      <PageIntro eyebrow="Plan a visit" title="Your first night, sorted.">
        When and where we meet, where to park, and what to expect when you walk in.
      </PageIntro>
      <Stub note="Times, directions, parking, and the FAQ go here." />
    </>
  );
}

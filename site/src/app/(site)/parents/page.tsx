import type { Metadata } from "next";
import { PageIntro } from "@/components/site/page-intro";
import { Stub } from "@/components/site/stub";

export const metadata: Metadata = { title: "Parents & Safety" };

export default function ParentsPage() {
  return (
    <>
      <PageIntro eyebrow="Parents & Safety" title="For parents.">
        How we look after students, what a typical night looks like, and how to reach us.
      </PageIntro>
      <Stub note="Safety, drop-off, and contact details go here." />
    </>
  );
}

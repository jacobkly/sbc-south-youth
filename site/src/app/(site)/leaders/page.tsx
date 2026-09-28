import type { Metadata } from "next";
import { PageIntro } from "@/components/site/page-intro";
import { Stub } from "@/components/site/stub";

export const metadata: Metadata = { title: "Leaders" };

export default function LeadersPage() {
  return (
    <>
      <PageIntro eyebrow="Leaders" title="Meet the team.">
        The people who lead youth nights and would love to meet you.
      </PageIntro>
      <Stub note="Leader cards go here." />
    </>
  );
}

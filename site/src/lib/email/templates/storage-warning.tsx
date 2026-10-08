import type { ReactElement } from "react";
import { EmailButton, EmailHeading, EmailLayout, EmailText } from "./layout";

export type StorageWarningInput = {
  /** The log's subject, which carries the percent. */
  subject: string;
  /** Warning at 80%, full at 95%, where new site photos stop. */
  level: "warning" | "full";
  /** The portal's Home, which shows the storage bar. */
  url: string;
};

/**
 * Tells every owner, at most once a month, that stored files passed 80% of
 * the free plan's 1 GB, and again when they pass 95%, so there's time to
 * make room before uploads are limited.
 */
export function storageWarningEmail({ subject, level, url }: StorageWarningInput): ReactElement {
  const full = level === "full";
  return (
    <EmailLayout
      preview={
        full
          ? "File storage is over 95% of the free plan, and new site photos have stopped."
          : "File storage is over 80% of the free plan's 1 GB."
      }
      reason={
        full
          ? "Owners get this at most once a month while stored files are over 95% of the free plan."
          : "Owners get this at most once a month while stored files are over 80% of the free plan."
      }
    >
      <EmailHeading>{subject}</EmailHeading>
      <EmailText>
        Receipts, site photos, and profile pictures share the 1 GB of file storage on Supabase&apos;s free plan.
      </EmailText>
      {full ? (
        <EmailText>
          New site photos have stopped, so receipts keep the room that&apos;s left. Past 1 GB, the free plan may
          limit uploads in both apps.
        </EmailText>
      ) : (
        <EmailText>
          At 95%, new site photos stop so receipts keep room. Past 1 GB, the free plan may limit uploads in both
          apps.
        </EmailText>
      )}
      <EmailText>
        {full
          ? "Back up older receipts and move them out of storage to make room."
          : "Now's a good time to plan where older receipts will go once they're backed up."}
      </EmailText>
      <EmailText>Home in the portal shows how much is used.</EmailText>
      <EmailButton href={url}>Open the portal</EmailButton>
    </EmailLayout>
  );
}

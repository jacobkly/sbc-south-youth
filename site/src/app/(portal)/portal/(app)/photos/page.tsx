import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ImagesIcon, TriangleAlertIcon } from "lucide-react";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { PhotoGrid } from "@/components/portal/photos/photo-grid";
import { PhotoUpload } from "@/components/portal/photos/photo-upload";
import { Alert, AlertDescription } from "@/components/portal/ui/alert";
import { readPortalEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { loadPhotos } from "@/lib/portal/photos/queries";
import { hasRole } from "@/lib/portal/roles";
import { supabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Photos",
};

export default async function PhotosPage() {
  // Site editors and owners. RLS keeps everyone else from listing photos anyway.
  const me = await getCurrentUser();
  if (!me || !hasRole(me.roles, "site_editor")) notFound();

  const readOnly = readPortalEnv().appEnv === "staging";
  const photos = await loadPhotos();

  return (
    <NarrowPage className="space-y-8">
      <PhotoUpload readOnly={readOnly}>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Photos</h1>
          <p className="text-muted-foreground">The library for the public site.</p>
        </div>
      </PhotoUpload>

      {readOnly && (
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>
            This is the staging copy of the portal, so it can&apos;t add photos. Use the real portal to add them.
          </AlertDescription>
        </Alert>
      )}

      {photos.length === 0 ? (
        <section aria-labelledby="empty-heading" className="space-y-3 rounded-xl border border-dashed p-6 text-center">
          <ImagesIcon className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <h2 id="empty-heading" className="font-semibold">
              No photos yet
            </h2>
            <p className="text-sm text-balance text-muted-foreground">
              Add photos from Fridays and events. They&apos;re shrunk on your phone first, and their location
              and camera details are left behind.
            </p>
          </div>
        </section>
      ) : (
        <PhotoGrid photos={photos} supabaseUrl={supabaseEnv().url} />
      )}
    </NarrowPage>
  );
}

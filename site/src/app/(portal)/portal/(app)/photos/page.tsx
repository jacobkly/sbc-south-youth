import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleCheckIcon, FlagIcon, ImagesIcon, TriangleAlertIcon } from "lucide-react";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { EmptySpots } from "@/components/portal/photos/empty-spots";
import { PhotoGrid } from "@/components/portal/photos/photo-grid";
import { PhotoUpload } from "@/components/portal/photos/photo-upload";
import { TakenDown } from "@/components/portal/photos/taken-down";
import { Alert, AlertDescription, AlertTitle } from "@/components/portal/ui/alert";
import { todayInLA } from "@/lib/dates";
import { readPortalEnv } from "@/lib/env";
import { loadPeopleNames } from "@/lib/portal/activity/queries";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { loadCoverEvents, loadOpenTakedowns, loadPhotos, loadTakenDown } from "@/lib/portal/photos/queries";
import { hasRole } from "@/lib/portal/roles";
import { supabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Photos",
};

export default async function PhotosPage({ searchParams }: PageProps<"/portal/photos">) {
  // Site editors and owners. RLS keeps everyone else from listing photos anyway.
  const me = await getCurrentUser();
  if (!me || !hasRole(me.roles, "site_editor")) notFound();

  const readOnly = readPortalEnv().appEnv === "staging";
  const now = new Date();
  // Takedown requests are messages, so only someone who can read them links one.
  const messages = hasRole(me.roles, "site_messages");
  const [photos, takedowns, takenDown, names] = await Promise.all([
    loadPhotos(),
    messages ? loadOpenTakedowns() : null,
    loadTakenDown(),
    loadPeopleNames(),
  ]);
  const covers = photos.flatMap(({ eventId }) => (eventId ? [eventId] : []));
  const events = await loadCoverEvents(now, covers);

  // Sent here from a takedown request, to find the photo it means.
  const { takedown } = await searchParams;
  const request = takedowns?.find(({ id }) => id === takedown) ?? null;
  const answered = request !== null && takenDown.photos.some(({ messageId }) => messageId === request.id);

  const shared = {
    events,
    takedowns,
    takedownId: request?.id ?? null,
    names: Object.fromEntries(names),
    supabaseUrl: supabaseEnv().url,
    today: todayInLA(now),
    readOnly,
  };

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
            This is the staging copy of the portal, so it can&apos;t change photos. Use the real portal to change
            them.
          </AlertDescription>
        </Alert>
      )}

      {request && (
        <Alert>
          {answered ? <CircleCheckIcon /> : <FlagIcon />}
          <AlertTitle>
            {answered ? `The photo is down for ${request.name}` : `Taking a photo down for ${request.name}`}
          </AlertTitle>
          <AlertDescription>
            {answered ? (
              <p>
                Reply from their request to let them know. If they meant another photo too, take it down the same
                way.
              </p>
            ) : (
              <p>
                Tap the photo they mean, then Take down. Their request is already picked, so it shows the photo is
                down.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <EmptySpots photos={photos} />

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
        <PhotoGrid photos={photos} {...shared} />
      )}

      <TakenDown
        photos={takenDown.photos}
        filesLeft={takenDown.filesLeft}
        names={shared.names}
        today={shared.today}
        showRequests={messages}
        readOnly={readOnly}
      />
    </NarrowPage>
  );
}

import { pages } from "@/content/pages";
import { sharePoster } from "@/lib/share-image";
import { SHARE_SIZE, shareAlt } from "@/lib/share";

const page = pages.give;

export const alt = shareAlt(page);
export const size = SHARE_SIZE;
export const contentType = "image/png";

export default function Image() {
  return sharePoster({ eyebrow: page.eyebrow, title: page.heading });
}

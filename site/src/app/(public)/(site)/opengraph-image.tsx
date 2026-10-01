import { homePoster, homePosterAlt } from "@/lib/share-image";
import { SHARE_SIZE } from "@/lib/share";

export const alt = homePosterAlt;
export const size = SHARE_SIZE;
export const contentType = "image/png";

export default function Image() {
  return homePoster();
}

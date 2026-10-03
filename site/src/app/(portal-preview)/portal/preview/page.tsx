import { PreviewFrame } from "@/components/portal/preview/preview-frame";
import { renderPreview } from "./actions";

/**
 * The editors' draft preview, which they show in a frame. The action comes
 * in from this server page, not an import in the frame, so the site
 * components it renders belong to this page's bundle.
 */
export default function PreviewPage() {
  return <PreviewFrame render={renderPreview} />;
}

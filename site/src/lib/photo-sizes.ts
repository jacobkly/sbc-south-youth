/**
 * The frame's inner width, in vw: the window less a 3.5vw gutter on each
 * side (`--gutter` in globals.css). That holds from about 570 px up. On
 * ultrawides the frame caps, so this runs a little large, which costs a
 * few bytes but never a soft photo.
 */
const FRAME_VW = 93;

type Shares = {
  /** The share of the frame from `2xl` (1536 px) up. Leave it out to use the `xl` share. */
  wide?: number;
  /** The share of the frame from `xl` (1280 px) up. Leave it out to use the `lg` share. */
  xl?: number;
  /** The share of the frame the photo spans from `lg` (1024 px) up. */
  lg: number;
  /** The share of the frame from `md` (768 px) to `lg`. Leave it out to use the phone share. */
  md?: number;
  /** The share of the window below `md`. */
  phone?: number;
};

// Rounded up, after trimming float noise like 1/3 × 93 = 31.000000000000004.
function vw(share: number, of: number): string {
  return `${Math.ceil(Number((share * of).toFixed(3)))}vw`;
}

/**
 * An image `sizes` for a photo that spans a share of the page frame, so
 * the browser picks the right file and the frame's width lives in one place.
 */
export function photoSizes({ wide, xl, lg, md, phone = 1 }: Shares): string {
  const steps: [string, string][] = [];
  if (wide !== undefined) steps.push(["(min-width: 96rem)", vw(wide, FRAME_VW)]);
  if (xl !== undefined) steps.push(["(min-width: 80rem)", vw(xl, FRAME_VW)]);
  steps.push(["(min-width: 64rem)", vw(lg, FRAME_VW)]);
  if (md !== undefined) steps.push(["(min-width: 48rem)", vw(md, FRAME_VW)]);
  // A step that matches the one below it is said once, at the lower width.
  const said = steps.filter(([, size], index) => size !== steps[index + 1]?.[1]);
  return [...said.map(([query, size]) => `${query} ${size}`), vw(phone, 100)].join(", ");
}

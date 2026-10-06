import clsx from "clsx";

// Hand-picked hues that read well on both light and dark backgrounds.
const COLORS = ["#10a37f", "#6e56cf", "#e5484d", "#0090ff", "#f76b15", "#d6409f", "#12a594", "#8e4ec6"];

function colorFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

/** The GPT's profile picture, or its initial on a colored circle. */
export function GptAvatar({ name, avatar, className }: { name: string; avatar?: string; className?: string }) {
  if (avatar) {
    return (
      // Data URL stored with the GPT; next/image adds nothing here.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatar} alt="" aria-hidden className={clsx("shrink-0 rounded-full object-cover", className)} />
    );
  }
  return (
    <span
      aria-hidden
      style={{ backgroundColor: colorFor(name) }}
      className={clsx("flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

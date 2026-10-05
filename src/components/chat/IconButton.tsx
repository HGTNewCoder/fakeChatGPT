import clsx from "clsx";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string };

// 36px square, icon-only button used across the sidebar and top bar.
export function IconButton({ label, className, children, ...props }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-fg",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

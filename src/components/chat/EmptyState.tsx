// Mobile: heading centered, composer docked at the bottom.
// Desktop: heading + composer centered together as one group.
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col md:justify-center md:pb-[12vh]">
      <div className="flex flex-1 items-center justify-center px-4 md:mb-7 md:flex-none">
        <h1 className="text-center text-[28px] leading-[34px] font-medium md:text-[32px] md:leading-[40px]">
          How can I help today?
        </h1>
      </div>
      <div className="pb-[env(safe-area-inset-bottom)]">{children}</div>
    </div>
  );
}

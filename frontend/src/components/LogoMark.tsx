export function LogoMark() {
  return (
    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <img
        src="/shortlink-logo.png"
        alt=""
        aria-hidden="true"
        className="h-full w-full object-cover"
      />
    </span>
  );
}

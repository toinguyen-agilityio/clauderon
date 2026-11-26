export function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">C/</div>
      <div>
        <div className="brand-name">Clauderon</div>
        <div className="brand-sub">ideas to delivery</div>
      </div>
    </div>
  );
}

export function Avatar({ name, email, picture }: { name: string | null; email: string; picture: string | null }) {
  const initials = (name ?? email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return (
    <span className="avatar" aria-hidden="true">
      {picture ? <img src={picture} alt="" referrerPolicy="no-referrer" /> : initials}
    </span>
  );
}

export default function PrivateLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <section>
      <header className="topbar">Private Area (placeholder)</header>
      {children}
    </section>
  );
}

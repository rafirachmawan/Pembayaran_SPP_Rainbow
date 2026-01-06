export default function CabangLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#f7f8fb" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
        {children}
      </div>
    </div>
  );
}

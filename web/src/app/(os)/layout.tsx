import "../globals.css";
import "./os.css";

export default function OSLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="tp-os tp-os-flat min-h-screen antialiased font-sans">
      {children}
    </div>
  );
}

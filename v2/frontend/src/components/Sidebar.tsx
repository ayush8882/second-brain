type Page = "dashboard" | "chat" | "ingest" | "notes";

const navItems = [
  { id: "dashboard", icon: "🏠", label: "Dashboard" },
  { id: "chat", icon: "💬", label: "Ask" },
  { id: "ingest", icon: "📥", label: "Add Knowledge" },
  { id: "notes", icon: "🗂️", label: "Notes" },
] as const;

export default function Sidebar({
  currentPage,
  onNavigate,
}: {
  currentPage: Page;
  onNavigate: (p: Page) => void;
}) {
  return (
    <div className="w-52 bg-[#161616] border-r border-[#222] flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-[#222]">
        <div className="text-sm font-semibold flex items-center gap-2">
          🧠 Second Brain
        </div>
        <div className="text-[10px] text-[#555] mt-1">
          Personal Knowledge OS
        </div>
      </div>

      <nav className="p-2 flex-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs mb-1 transition-colors
              ${
                currentPage === item.id
                  ? "bg-[#1E1E2E] text-[#8B7CF6]"
                  : "text-[#888] hover:bg-[#1A1A1A] hover:text-[#ccc]"
              }`}
          >
            <span>{item.icon}</span> {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

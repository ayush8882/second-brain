import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Ingest from "./pages/Ingest";
import Notes from "./pages/Notes";

type Page = "dashboard" | "chat" | "ingest" | "notes";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");

  return (
    <div className="flex h-screen bg-[#0F0F0F] text-white font-sans overflow-hidden">
      <Sidebar currentPage={page} onNavigate={setPage} />
      <main className="flex-1 overflow-hidden">
        {page === "dashboard" && <Dashboard onNavigate={setPage} />}
        {page === "chat" && <Chat />}
        {page === "ingest" && <Ingest />}
        {page === "notes" && <Notes />}
      </main>
    </div>
  );
}

import Sidebar from "@/components/ui/Sidebar";
import CommandPaletteLazy from "@/components/ui/CommandPaletteLazy";
import UniversalInboxLazy from "@/components/inbox/UniversalInboxLazy";
import NotificationWatcherLazy from "@/components/notifications/NotificationWatcherLazy";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="sb-app-shell flex overflow-hidden">
      <Sidebar />
      <main className="sb-scroll-area flex-1">
        {children}
      </main>
      <CommandPaletteLazy />
      <UniversalInboxLazy />
      <NotificationWatcherLazy />
    </div>
  );
}

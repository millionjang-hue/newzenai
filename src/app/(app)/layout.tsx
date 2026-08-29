import { AppShell } from "@/components/AppShell";
import { SetupNotice } from "@/components/SetupNotice";
import { isDatabaseConfigured } from "@/lib/db";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // A missing connection string is the usual first-deploy mistake, so say so on
  // the page rather than failing with a blank 500 deeper in the render.
  return <AppShell>{isDatabaseConfigured() ? children : <SetupNotice />}</AppShell>;
}

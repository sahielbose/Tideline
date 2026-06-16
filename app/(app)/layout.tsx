import { redirect } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { AppSubnav } from "@/components/app-subnav";
import { getSessionUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const initial = (user.name?.[0] ?? "D").toUpperCase();
  return (
    <>
      <TopNav userInitial={initial} />
      <AppSubnav />
      <main>{children}</main>
    </>
  );
}

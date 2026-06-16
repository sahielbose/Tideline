import { TopNav } from "@/components/top-nav";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <main>{children}</main>
    </>
  );
}

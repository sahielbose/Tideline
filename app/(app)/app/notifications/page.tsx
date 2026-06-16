import { Bell, Mail, MonitorSmartphone } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listNotifications } from "@/lib/services";
import { timeAgo } from "@/lib/utils";

export default async function NotificationsPage() {
  const user = await getSessionUser();
  const items = await listNotifications(user!.id);

  return (
    <div className="wrap" style={{ maxWidth: 760, marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Notifications</h1>
          <p className="sub">Alerts from your monitoring, in-app and (if opted in) by email.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty">
          <div className="badge-ic">
            <Bell />
          </div>
          <h2 className="serif h2">No notifications yet</h2>
          <p>When an elevated insight appears, you&apos;ll see it here.</p>
        </div>
      ) : (
        <div className="box" style={{ marginTop: 8 }}>
          {items.map((n) => (
            <div className="conn-item" key={n.id} style={{ padding: "14px 18px", alignItems: "flex-start" }}>
              <span className="ic">{n.channel === "email" ? <Mail /> : <MonitorSmartphone />}</span>
              <div className="body">
                <div className="n">{n.subject}</div>
                <div className="s" style={{ whiteSpace: "pre-wrap" }}>{n.body}</div>
                <div className="meta" style={{ fontSize: 12, color: "var(--muted-2)", marginTop: 4 }}>
                  {n.channel} · {timeAgo(n.createdAt)}
                </div>
              </div>
              <span className={`status ${n.status === "sent" ? "ok" : "info"}`}>
                <span className="dot" />
                {n.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

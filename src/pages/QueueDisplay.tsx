import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Public TV board.
 *
 * This page is intentionally dependency-free at runtime: no component library,
 * no icon package, no bundled images, no realtime websocket. Old Tizen / webOS
 * / Android TV engines choke on any of those and used to render a white screen
 * with no clue on the TV. Here we use plain elements, inline styles with basic
 * CSS only (no dvh, no container queries, no backdrop-filter, no modern color
 * functions), a simple polling read, and a visible error state.
 *
 * `?plain=1` renders numbers only, at the largest possible size, as a
 * guaranteed-render fallback for the oldest TVs.
 */

type Entry = {
  id: string;
  kind: string | null;
  display_code: string | null;
  status: string | null;
  client_name: string | null;
  device_type: string | null;
  brand: string | null;
  model: string | null;
};

const POLL_MS = 10000;

const COLORS = {
  page: "#f2f6ff",
  ink: "#111827",
  soft: "#4b5563",
  line: "#cbd5e1",
  blue: "#1d4ed8",
  blueBg: "#e6efff",
  green: "#046c4e",
  greenBg: "#e3f6ee",
  white: "#ffffff",
  warnBg: "#fff7e6",
  warnLine: "#e0a800",
  warnInk: "#7a5200",
};

function getParam(name: string): string | null {
  try {
    const q = window.location.search || "";
    const m = q.match(new RegExp("[?&]" + name + "=([^&]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function Column(props: {
  title: string;
  tone: "waiting" | "proceed";
  entries: Entry[];
  emptyLabel: string;
  highlightId?: string | null;
}) {
  const proceed = props.tone === "proceed";
  return (
    <div
      style={{
        border: "2px solid " + (proceed ? COLORS.green : COLORS.blue),
        background: proceed ? COLORS.greenBg : COLORS.blueBg,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: proceed ? COLORS.green : COLORS.blue,
            lineHeight: 1.1,
          }}
        >
          {props.title}
        </div>
        <div style={{ fontSize: 14, color: COLORS.soft }}>
          {props.entries.length} {props.entries.length === 1 ? "customer" : "customers"}
        </div>
      </div>

      {props.entries.length === 0 ? (
        <div
          style={{
            border: "2px dashed " + COLORS.line,
            borderRadius: 10,
            padding: "22px 10px",
            textAlign: "center",
            color: COLORS.soft,
            fontSize: 16,
            background: COLORS.white,
          }}
        >
          {props.emptyLabel}
        </div>
      ) : (
        <div>
          {props.entries.map((e) => {
            const mine = props.highlightId && props.highlightId === e.id;
            const device = [e.brand, e.model].filter(Boolean).join(" ") || e.device_type || "";
            return (
              <div
                key={e.id}
                style={{
                  border: "2px solid " + (mine ? COLORS.blue : COLORS.line),
                  background: mine ? COLORS.blueBg : COLORS.white,
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 8,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: proceed ? COLORS.green : COLORS.blue,
                  }}
                >
                  {e.display_code || "-"}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.ink }}>
                  {e.client_name || ""}
                </div>
                {device ? (
                  <div style={{ fontSize: 14, color: COLORS.soft }}>{device}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const QueueDisplay = () => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mine = getParam("entry");
  const plain = getParam("plain") === "1";

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const res = await supabase
          .from("queue_entries")
          .select("id,kind,display_code,status,client_name,device_type,brand,model")
          .in("status", ["waiting", "proceed"])
          .order("created_at", { ascending: true });
        if (!alive) return;
        if (res.error) {
          setError("We couldn't load the queue right now. Retrying...");
        } else {
          setError(null);
          setEntries((res.data || []) as Entry[]);
        }
      } catch {
        if (alive) setError("We couldn't load the queue right now. Retrying...");
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const pick = (kind: string, status: string) =>
    entries.filter((e) => (e.kind || "intake") === kind && e.status === status);

  const intakeWaiting = pick("intake", "waiting");
  const intakeProceed = pick("intake", "proceed");
  const releaseWaiting = pick("release", "waiting");
  const releaseProceed = pick("release", "proceed");

  const myEntry =
    (mine && entries.filter((e) => e.display_code === mine || e.id === mine)[0]) || null;

  const empty = (label: string) => (loading ? "Loading..." : label);

  if (plain) {
    const rows = [
      { label: "Intake - Proceed to Front", list: intakeProceed },
      { label: "Intake - Waiting", list: intakeWaiting },
      { label: "Release - Proceed to Front", list: releaseProceed },
      { label: "Release - Waiting", list: releaseWaiting },
    ];
    return (
      <div style={{ background: COLORS.white, color: COLORS.ink, padding: 16, minHeight: "100%" }}>
        {rows.map((r) => (
          <div key={r.label} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.soft }}>{r.label}</div>
            <div style={{ fontSize: 56, fontWeight: 700 }}>
              {r.list.length === 0
                ? "-"
                : r.list.map((e) => e.display_code || "-").join("   ")}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.page, padding: 16, minHeight: "100%" }}>
      <div style={{ maxWidth: 1800, marginLeft: "auto", marginRight: "auto" }}>
        {error ? (
          <div
            style={{
              border: "2px solid " + COLORS.warnLine,
              background: COLORS.warnBg,
              color: COLORS.warnInk,
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 12,
              fontSize: 16,
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 42, fontWeight: 700, color: COLORS.blue, margin: 0, lineHeight: 1.1 }}>
            AC Tech Repair — Live Queue
          </h1>
          <p style={{ fontSize: 18, color: COLORS.soft, margin: "6px 0 0" }}>
            Watch the board — you will be called when your number moves to "Proceed to Front".
          </p>
        </div>

        {myEntry ? (
          <div
            style={{
              border: "2px solid " + COLORS.blue,
              background: COLORS.blueBg,
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.blue }}>
              YOUR QUEUE NUMBER
            </div>
            <div style={{ fontSize: 52, fontWeight: 700, color: COLORS.blue, lineHeight: 1.1 }}>
              {myEntry.display_code}
            </div>
            <div style={{ fontSize: 18, color: COLORS.ink }}>
              Status: {myEntry.status === "proceed" ? "Proceed to Front" : "Waiting"}
            </div>
          </div>
        ) : null}

        <div className="queue-board">
          <div className="queue-half">
            <div
              style={{
                border: "2px solid " + COLORS.line,
                background: COLORS.white,
                borderRadius: 14,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.ink, marginBottom: 10 }}>
                Intake
                <span style={{ fontSize: 16, color: COLORS.soft, fontWeight: 400, marginLeft: 10 }}>
                  Dropping off a device
                </span>
              </div>
              <div className="queue-cols">
                <div className="queue-col">
                  <Column
                    title="Waiting"
                    tone="waiting"
                    entries={intakeWaiting}
                    emptyLabel={empty("No customers waiting")}
                    highlightId={myEntry ? myEntry.id : null}
                  />
                </div>
                <div className="queue-col">
                  <Column
                    title="Proceed to Front"
                    tone="proceed"
                    entries={intakeProceed}
                    emptyLabel={empty("No one called yet")}
                    highlightId={myEntry ? myEntry.id : null}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="queue-half">
            <div
              style={{
                border: "2px solid " + COLORS.line,
                background: COLORS.white,
                borderRadius: 14,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.ink, marginBottom: 10 }}>
                Release
                <span style={{ fontSize: 16, color: COLORS.soft, fontWeight: 400, marginLeft: 10 }}>
                  Picking up a completed device
                </span>
              </div>
              <div className="queue-cols">
                <div className="queue-col">
                  <Column
                    title="Waiting"
                    tone="waiting"
                    entries={releaseWaiting}
                    emptyLabel={empty("No customers waiting")}
                    highlightId={myEntry ? myEntry.id : null}
                  />
                </div>
                <div className="queue-col">
                  <Column
                    title="Proceed to Front"
                    tone="proceed"
                    entries={releaseProceed}
                    emptyLabel={empty("No one called yet")}
                    highlightId={myEntry ? myEntry.id : null}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Float-based layout so it degrades to stacked columns on old engines. */}
      <style
        dangerouslySetInnerHTML={{
          __html: [
            ".queue-board:after,.queue-cols:after{content:'';display:block;clear:both;}",
            ".queue-half{width:100%;}",
            ".queue-col{width:100%;}",
            "@media (min-width:900px){",
            ".queue-half{float:left;width:50%;box-sizing:border-box;padding:0 6px;}",
            ".queue-col{float:left;width:50%;box-sizing:border-box;padding:0 6px;}",
            "}",
          ].join(""),
        }}
      />
    </div>
  );
};

export default QueueDisplay;

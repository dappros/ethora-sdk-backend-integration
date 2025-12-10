import { useEffect, useMemo, useState } from "react";
import Chat from "@ethora/chat-component";

type Role = "admin" | "practitioner" | "patient";

interface Persona {
  userId: string;
  role: Role;
  label: string;
}

interface FetchState {
  roomJid?: string;
  token?: string;
  loading: boolean;
  error?: string;
}

const DEFAULT_BACKEND =
  import.meta.env.VITE_BACKEND_URL ?? "http://localhost:4000";

const CASE_ID = "case-123";

const personas: Persona[] = [
  { userId: "admin-1", role: "admin", label: "Admin (Portal)" },
  { userId: "practitioner-1", role: "practitioner", label: "Practitioner" },
  { userId: "patient-1", role: "patient", label: "Patient" },
];

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export default function App() {
  const [persona, setPersona] = useState<Persona>(personas[0]);
  const [state, setState] = useState<FetchState>({ loading: true });

  const backend = useMemo(() => DEFAULT_BACKEND.replace(/\/$/, ""), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ loading: true });
      try {
        // Ensure case exists and participants are granted access (idempotent-ish)
        await fetchJson(`${backend}/cases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseId: CASE_ID,
            participants: personas.map((p) => ({
              userId: p.userId,
              role: p.role,
              displayName: p.label,
            })),
          }),
        });

        const [{ roomJid }, { token }] = await Promise.all([
          fetchJson<{ roomJid: string }>(
            `${backend}/cases/${CASE_ID}/chat/jid`
          ),
          fetchJson<{ token: string }>(
            `${backend}/chat/token/${persona.userId}`
          ),
        ]);

        if (cancelled) return;
        setState({ loading: false, roomJid, token });
      } catch (error) {
        if (cancelled) return;
        setState({
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [backend, persona.userId]);

  return (
    <div style={styles.page}>
      <div style={styles.sidebar}>
        <h2>Healthcare/Insurance Portal</h2>
        <p style={styles.muted}>
          Emulates a portal tab where a user is viewing case <code>{CASE_ID}</code>
          .
        </p>
        <label style={styles.label}>Persona</label>
        <select
          value={persona.userId}
          onChange={(e) => {
            const next = personas.find((p) => p.userId === e.target.value);
            if (next) setPersona(next);
          }}
          style={styles.select}
        >
          {personas.map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.label}
            </option>
          ))}
        </select>

        <div style={styles.meta}>
          <div>
            <strong>User:</strong> {persona.userId}
          </div>
          <div>
            <strong>Role:</strong> {persona.role}
          </div>
          <div>
            <strong>Case:</strong> {CASE_ID}
          </div>
          <div>
            <strong>Backend:</strong> {backend}
          </div>
        </div>

        {state.error && (
          <div style={styles.error}>
            <strong>Load failed:</strong> {state.error}
          </div>
        )}
        {state.loading && <div style={styles.loading}>Loading chat…</div>}
      </div>

      <div style={styles.chatPane}>
        {!state.loading && !state.error && state.roomJid && state.token ? (
          <Chat
            roomJID={state.roomJid}
            user={{ token: state.token }}
            config={{
              xmppSettings: {
                devServer: "wss://xmpp.ethoradev.com:5443/ws",
                host: "xmpp.ethoradev.com",
                conference: "conference.xmpp.ethoradev.com",
              },
              baseUrl: "https://api.ethoradev.com/v1",
              newArch: true,
              refreshTokens: { enabled: true },
              disableRooms: false,
            }}
          />
        ) : (
          <div style={styles.placeholder}>Chat will appear here</div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    height: "100vh",
    fontFamily: "Inter, system-ui, sans-serif",
    color: "#0f172a",
    background: "#f8fafc",
  },
  sidebar: {
    padding: "24px",
    borderRight: "1px solid #e2e8f0",
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  chatPane: {
    padding: "12px",
    background: "#e2e8f0",
    display: "flex",
  },
  select: {
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#334155",
  },
  meta: {
    fontSize: "13px",
    lineHeight: "1.5",
    color: "#334155",
    display: "grid",
    gap: "4px",
  },
  error: {
    padding: "12px",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: "8px",
    border: "1px solid #fecdd3",
    fontSize: "13px",
  },
  loading: {
    padding: "10px 12px",
    background: "#eef2ff",
    color: "#4338ca",
    borderRadius: "8px",
    fontSize: "13px",
    border: "1px solid #e0e7ff",
  },
  muted: {
    color: "#64748b",
    fontSize: "13px",
    lineHeight: "1.5",
  },
  placeholder: {
    margin: "auto",
    color: "#475569",
    fontSize: "14px",
  },
};


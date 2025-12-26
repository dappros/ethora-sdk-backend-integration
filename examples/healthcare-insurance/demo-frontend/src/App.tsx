/** @format */

import { useEffect, useMemo, useState, useRef } from "react";
import { Chat, XmppProvider, logoutService } from "@ethora/chat-component";

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

const ETHORA_API_BASE_URL =
  import.meta.env.VITE_ETHORA_API_BASE_URL ?? "https://api.ethoradev.com/v1";
const XMPP_WS = import.meta.env.VITE_XMPP_WS ?? "wss://xmpp.ethoradev.com:5443/ws";
const XMPP_HOST = import.meta.env.VITE_XMPP_HOST ?? "xmpp.ethoradev.com";
const XMPP_CONFERENCE =
  import.meta.env.VITE_XMPP_CONFERENCE ?? "conference.xmpp.ethoradev.com";

const CASE_ID = "case-test";

const personas: Persona[] = [
  { userId: "admin-test", role: "admin", label: "Admin (Portal)" },
  { userId: "practitioner-test", role: "practitioner", label: "Practitioner" },
  { userId: "patient-test", role: "patient", label: "Patient" },
];

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// Inner component that handles logout when persona changes
function ChatContent({
  persona,
  setPersona,
  selectedPatient,
  setSelectedPatient,
  state,
  setState,
  backend,
  roomJidToUse,
  availablePatients,
}: {
  persona: Persona;
  setPersona: (p: Persona) => void;
  selectedPatient: Persona | null;
  setSelectedPatient: (p: Persona | null) => void;
  state: FetchState;
  setState: (s: FetchState) => void;
  backend: string;
  roomJidToUse: string | undefined;
  availablePatients: Persona[];
}) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const prevPersonaRef = useRef(persona.userId);

  // Handle persona change with logout
  useEffect(() => {
    if (prevPersonaRef.current !== persona.userId && prevPersonaRef.current) {
      // Persona changed, need to logout first
      setIsLoggingOut(true);
      // Clear current state to prevent rendering old chat
      setState({ loading: true });

      const performLogout = async () => {
        try {
          // Use logoutService from @ethora/chat-component
          await logoutService.performLogout();
          console.log("Logout completed successfully");
          // After logout completes, trigger reload by setting loading state
          // This will cause the parent App component to reload the token
          setState({ loading: true });
        } catch (error) {
          console.error("Error during logout:", error);
          // Even if logout fails, still trigger reload
          setState({ loading: true });
        } finally {
          setIsLoggingOut(false);
          prevPersonaRef.current = persona.userId;
        }
      };

      performLogout();
    } else {
      prevPersonaRef.current = persona.userId;
    }
  }, [persona.userId, setState]);

  // Don't render chat while logging out or loading
  // Only render after logout is complete and new token is loaded
  const shouldRenderChat =
    !isLoggingOut &&
    !state.loading &&
    !state.error &&
    roomJidToUse &&
    state.token &&
    prevPersonaRef.current === persona.userId; // Ensure persona hasn't changed during render

  return (
    <>
      <div style={styles.sidebar}>
        <h2>Healthcare/Insurance Portal</h2>
        <p style={styles.muted}>
          Emulates a portal tab where a user is viewing case{" "}
          <code>{CASE_ID}</code>.
        </p>
        <label style={styles.label}>Persona</label>
        <select
          value={persona.userId}
          onChange={(e) => {
            const next = personas.find((p) => p.userId === e.target.value);
            if (next) {
              setPersona(next);
              // Reset patient selection when switching personas
              if (next.role === "patient") {
                setSelectedPatient(null);
              } else if (
                next.role === "admin" ||
                next.role === "practitioner"
              ) {
                // Auto-select first patient for admin/practitioner
                if (availablePatients.length > 0) {
                  setSelectedPatient(availablePatients[0]);
                }
              }
            }
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
          {selectedPatient && (
            <div>
              <strong>Chatting with:</strong> {selectedPatient.label}
            </div>
          )}
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
        {(state.loading || isLoggingOut) && (
          <div style={styles.loading}>
            {isLoggingOut ? "Logging out..." : "Loading chat…"}
          </div>
        )}
      </div>

      <div style={styles.chatPane}>
        {shouldRenderChat && roomJidToUse ? (
          <Chat
            roomJID={roomJidToUse}
            config={{
              xmppSettings: {
                devServer: XMPP_WS,
                host: XMPP_HOST,
                conference: XMPP_CONFERENCE,
              },
              baseUrl: ETHORA_API_BASE_URL,
              newArch: true,
              refreshTokens: { enabled: true },
              disableRooms: persona.role === "patient",
              jwtLogin: {
                token: state.token || "",
                enabled: true,
              },
              disableRoomMenu: false,
              enableRoomsRetry: {
                enabled: true,
                helperText: "Initializing room",
              },
            }}
          />
        ) : state.loading || isLoggingOut ? (
          <div style={styles.placeholder}>
            {isLoggingOut ? "Logging out..." : "Loading chat…"}
          </div>
        ) : state.error ? (
          <div style={styles.placeholder}>Error: {state.error}</div>
        ) : (
          <div style={styles.placeholder}>
            {persona.role === "admin" || persona.role === "practitioner"
              ? "Please select a patient to chat with"
              : "Chat will appear here"}
          </div>
        )}
      </div>
    </>
  );
}

export default function App() {
  const [persona, setPersona] = useState<Persona>(personas[0]);
  const [selectedPatient, setSelectedPatient] = useState<Persona | null>(null);
  const [state, setState] = useState<FetchState>({ loading: true });
  const isRunningRef = useRef(false); // Prevent duplicate calls

  const backend = useMemo(() => DEFAULT_BACKEND.replace(/\/$/, ""), []);

  // Get available patients for admin/practitioner
  const availablePatients = useMemo(
    () => personas.filter((p) => p.role === "patient"),
    []
  );

  // Determine which room JID to use
  const roomJidToUse = useMemo(() => {
    // If persona is a patient, use the main case room
    // If persona is admin/practitioner and a patient is selected, use that patient's room
    if (persona.role === "patient") {
      return state.roomJid;
    }
    // For admin/practitioner, if patient selected, use that patient's case room
    // For now, use the main case room (same as admin)
    return state.roomJid;
  }, [persona.role, selectedPatient, state.roomJid]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isRunningRef.current) {
        console.log(
          "Case creation already in progress, skipping duplicate call"
        );
        return;
      }

      isRunningRef.current = true;
      setState({ loading: true });
      try {
        // Ensure case exists and participants are granted access (idempotent-ish)
        await fetchJson(`${backend}/cases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseId: CASE_ID,
            participants: personas.map((p) => {
              const nameParts = p.label.trim().split(/\s+/);
              const firstName = nameParts[0] || "User";
              let lastName = nameParts.slice(1).join(" ") || "";

              // Ensure lastName is at least 2 characters (API requirement)
              if (lastName.length < 2) {
                // Use a default lastName if empty or too short
                lastName =
                  p.role === "admin"
                    ? "Admin"
                    : p.role === "practitioner"
                    ? "Doctor"
                    : "Patient";
              }

              return {
                userId: p.userId,
                role: p.role,
                displayName: p.label,
                email: `${p.userId}@example.com`,
                firstName: firstName,
                lastName: lastName,
              };
            }),
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

        // Auto-select first patient for admin/practitioner if none selected
        if (
          (persona.role === "admin" || persona.role === "practitioner") &&
          !selectedPatient &&
          availablePatients.length > 0
        ) {
          setSelectedPatient(availablePatients[0]);
        }
      } catch (error) {
        if (cancelled) return;
        setState({
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        isRunningRef.current = false;
      }
    }
    load();
    return () => {
      cancelled = true;
      isRunningRef.current = false;
    };
  }, [backend, persona.userId]);

  return (
    <XmppProvider>
      <div style={styles.page}>
        <ChatContent
          persona={persona}
          setPersona={setPersona}
          selectedPatient={selectedPatient}
          setSelectedPatient={setSelectedPatient}
          state={state}
          setState={setState}
          backend={backend}
          roomJidToUse={roomJidToUse}
          availablePatients={availablePatients}
        />
      </div>
    </XmppProvider>
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
    maxHeight: "calc(100vh - 30px)",
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

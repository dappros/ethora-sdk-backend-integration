/**
 * Healthcare/Insurance demo backend for Ethora chat integration
 *
 * This is a minimal Express app showing how to:
 * - Create chat rooms per case/claim (workspaceId)
 * - Create users and grant them access based on role
 * - Issue client JWTs for the chat component/snippet
 *
 * Prereqs (env):
 *   ETHORA_CHAT_API_URL
 *   ETHORA_CHAT_APP_ID
 *   ETHORA_CHAT_APP_SECRET
 *
 * Run (from repo root):
 *   npm install express @types/express ts-node
 *   npx ts-node examples/healthcare-insurance/demo-backend.ts
 */

import express, { Request, Response } from "express";
import { getChatRepositoryImpl } from "../../src";

type Role = "admin" | "practitioner" | "patient";

interface Participant {
  userId: string;
  role: Role;
  displayName?: string;
}

interface CaseRecord {
  caseId: string;
  participants: string[];
  metadata?: Record<string, unknown>;
}

const app = express();
app.use(express.json());

const chatRepo = getChatRepositoryImpl();

const users = new Map<string, Participant>();
const cases = new Map<string, CaseRecord>();

async function ensureUser(user: Participant) {
  if (!users.has(user.userId)) {
    await chatRepo.createUser(user.userId, {
      role: user.role,
      displayName: user.displayName,
    });
    users.set(user.userId, user);
  }
}

async function grantAccess(caseId: string, userId: string) {
  await chatRepo.grantUserAccessToChatRoom(caseId, userId);
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

/**
 * Create a case and provision chat + participants
 */
app.post("/cases", async (req: Request, res: Response) => {
  try {
    const { caseId, participants = [], metadata } = req.body as {
      caseId: string;
      participants: Participant[];
      metadata?: Record<string, unknown>;
    };

    if (!caseId) {
      return res.status(400).json({ error: "caseId is required" });
    }

    // idempotent-ish: create room, then users, then access
    await chatRepo.createChatRoom(caseId);

    for (const participant of participants) {
      await ensureUser(participant);
      await grantAccess(caseId, participant.userId);
    }

    cases.set(caseId, {
      caseId,
      participants: participants.map((p) => p.userId),
      metadata,
    });

    const roomJid = chatRepo.createChatName(caseId, true);
    res.json({ caseId, roomJid, participants });
  } catch (error) {
    console.error("Failed to create case", error);
    res.status(500).json({ error: "Failed to create case" });
  }
});

/**
 * Add a participant to an existing case
 */
app.post("/cases/:caseId/users", async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const participant = req.body as Participant;

    if (!cases.has(caseId)) {
      return res.status(404).json({ error: "Case not found" });
    }
    if (!participant?.userId || !participant?.role) {
      return res
        .status(400)
        .json({ error: "userId and role are required" });
    }

    await ensureUser(participant);
    await grantAccess(caseId, participant.userId);

    const record = cases.get(caseId)!;
    if (!record.participants.includes(participant.userId)) {
      record.participants.push(participant.userId);
    }

    res.json({ caseId, userId: participant.userId });
  } catch (error) {
    console.error("Failed to add participant", error);
    res.status(500).json({ error: "Failed to add participant" });
  }
});

/**
 * Get client token for a user (for embedding in chat component/snippet)
 */
app.get("/chat/token/:userId", (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const token = chatRepo.createChatUserJwtToken(userId);
    res.json({ userId, token });
  } catch (error) {
    console.error("Failed to generate token", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

/**
 * Get full JID for a case
 */
app.get("/cases/:caseId/chat/jid", (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const roomJid = chatRepo.createChatName(caseId, true);
    res.json({ caseId, roomJid });
  } catch (error) {
    console.error("Failed to get JID", error);
    res.status(500).json({ error: "Failed to get JID" });
  }
});

/**
 * Delete chat room for a case (does not remove local memory)
 */
app.delete("/cases/:caseId/chat", async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const response = await chatRepo.deleteChatRoom(caseId);
    res.json({ caseId, response });
  } catch (error) {
    console.error("Failed to delete chat room", error);
    res.status(500).json({ error: "Failed to delete chat room" });
  }
});

/**
 * Bulk delete users
 */
app.delete("/users", async (req: Request, res: Response) => {
  try {
    const { userIds } = req.body as { userIds: string[] };
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res
        .status(400)
        .json({ error: "userIds must be a non-empty array" });
    }

    await chatRepo.deleteUsers(userIds);
    for (const id of userIds) {
      users.delete(id);
    }

    res.json({ deleted: userIds });
  } catch (error) {
    console.error("Failed to delete users", error);
    res.status(500).json({ error: "Failed to delete users" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Demo backend listening on port ${PORT}`);
});


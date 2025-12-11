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
 * .env loading:
 *   - Auto-loads examples/healthcare-insurance/.env.local if present
 *   - Falls back to process env
 *
 * Run (from repo root):
 *   npm install express @types/express ts-node
 *   npx ts-node examples/healthcare-insurance/demo-backend.ts
 *
 * @format
 */

import path from "path";
import { randomUUID } from "crypto";
import { config as loadEnv } from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";
import axios from "axios";
import { getChatRepositoryImpl } from "../../src";
import { getFileLogger } from "./file-logger";

const logger = getFileLogger();

// Load .env.local from this example folder if present, else fall back to process env
loadEnv({
  path: path.resolve(process.cwd(), "examples/healthcare-insurance/.env.local"),
});
loadEnv(); // also load default .env if present

type Role = "admin" | "practitioner" | "patient";

interface Participant {
  userId: string;
  role: Role;
  displayName?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
}

interface CaseRecord {
  caseId: string;
  participants: string[];
  metadata?: Record<string, unknown>;
}

const app = express();

// Enable CORS for frontend
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

const chatRepo = getChatRepositoryImpl();

const users = new Map<string, Participant>();
const cases = new Map<string, CaseRecord>();
// Lock to prevent concurrent case creation
const caseCreationLocks = new Map<
  string,
  Promise<{ caseId: string; roomJid: string; participants: Participant[] }>
>();

/**
 * Generate random user data based on role
 */
function generateRandomUserData(role: Role): {
  firstName: string;
  lastName: string;
  email: string;
} {
  const roleData: Record<Role, { firstNames: string[]; lastNames: string[] }> =
    {
      admin: {
        firstNames: ["Sarah", "Michael", "Jennifer", "David", "Emily"],
        lastNames: ["Johnson", "Williams", "Brown", "Jones", "Garcia"],
      },
      practitioner: {
        firstNames: [
          "Dr. James",
          "Dr. Maria",
          "Dr. Robert",
          "Dr. Lisa",
          "Dr. John",
        ],
        lastNames: ["Smith", "Martinez", "Anderson", "Taylor", "Thomas"],
      },
      patient: {
        firstNames: ["John", "Mary", "Robert", "Patricia", "William"],
        lastNames: ["Miller", "Davis", "Wilson", "Moore", "Jackson"],
      },
    };

  const data = roleData[role];
  const firstName =
    data.firstNames[Math.floor(Math.random() * data.firstNames.length)];
  const lastName =
    data.lastNames[Math.floor(Math.random() * data.lastNames.length)];
  const email = `${randomUUID()}@example.com`;

  return { firstName, lastName, email };
}

async function ensureUser(user: Participant) {
  // Get appId from chatRepo to check prefix
  const appId = (chatRepo as any).secrets.chatAppId;
  const prefixedUserId = user.userId.startsWith(appId)
    ? user.userId
    : `${appId}_${user.userId}`;

  // Always delete existing users (both prefixed and non-prefixed) to ensure fresh start
  logger.info(`Deleting existing user(s) before recreation: ${user.userId}`, {
    originalUserId: user.userId,
    prefixedUserId: prefixedUserId,
  });

  // Try to delete prefixed version
  try {
    await chatRepo.deleteUsers([prefixedUserId]);
    logger.debug(`Deleted existing user: ${prefixedUserId}`);
  } catch (error) {
    logger.debug(`User ${prefixedUserId} doesn't exist or already deleted`);
  }

  // Try to delete non-prefixed version if different
  if (prefixedUserId !== user.userId) {
    try {
      await chatRepo.deleteUsers([user.userId]);
      logger.debug(`Deleted existing user: ${user.userId}`);
    } catch (error) {
      logger.debug(`User ${user.userId} doesn't exist or already deleted`);
    }
  }

  // Remove from local cache to force recreation
  users.delete(user.userId);
  users.delete(prefixedUserId);

  logger.info(
    `Creating user: ${user.userId} (will be created as ${prefixedUserId})`,
    {
      role: user.role,
      displayName: user.displayName,
      originalUserId: user.userId,
      prefixedUserId: prefixedUserId,
    }
  );

  try {
    // Try to create user with provided data first
    const userData: Record<string, unknown> = {
      role: user.role,
    };

    // Add optional fields if provided
    if (user.displayName) {
      userData.displayName = user.displayName;
    }
    if (user.firstName) {
      userData.firstName = user.firstName;
    }
    // Ensure lastName is at least 2 characters (API requirement)
    if (user.lastName && user.lastName.length >= 2) {
      userData.lastName = user.lastName;
    } else if (user.lastName) {
      // If lastName is too short, use a default
      userData.lastName = "User";
      logger.warn(
        `lastName "${user.lastName}" is too short, using "User" instead`,
        {
          userId: user.userId,
          originalLastName: user.lastName,
        }
      );
    }
    if (user.password) {
      userData.password = user.password;
    }

    logger.debug(
      `Calling createUser for ${user.userId} (will create as ${prefixedUserId})`,
      {
        userData,
      }
    );
    // Create user - the SDK will automatically prefix the userId with appId
    await chatRepo.createUser(user.userId, userData);
    // Store both original and prefixed userId in cache
    users.set(user.userId, user);
    users.set(prefixedUserId, user);
    logger.success(
      `User ${user.userId} created successfully as ${prefixedUserId}`,
      {
        userId: user.userId,
        prefixedUserId: prefixedUserId,
        role: user.role,
      }
    );
  } catch (error) {
    // Check if user already exists
    if (axios.isAxiosError(error)) {
      const errorData = error.response?.data;
      const errorMessage =
        typeof errorData === "object" && errorData !== null
          ? (errorData as { error?: string }).error || ""
          : String(errorData || error.message);

      // If user already exists, just mark as existing and continue
      if (
        error.response?.status === 422 &&
        (errorMessage.includes("already exist") ||
          errorMessage.includes("already exists"))
      ) {
        logger.warn(`User ${user.userId} already exists, skipping creation`, {
          userId: user.userId,
        });
        users.set(user.userId, user);
        return; // User exists, continue without error
      }

      // If creation failed for other reasons, try with random data
      logger.warn(
        `Failed to create user ${user.userId} with provided data, trying with random data...`,
        { status: error.response?.status, errorData }
      );

      // Generate random user data based on role
      const randomData = generateRandomUserData(user.role);
      logger.info(`Retrying user creation with random data`, {
        userId: user.userId,
        randomData,
      });
      try {
        await chatRepo.createUser(user.userId, {
          firstName: randomData.firstName,
          lastName: randomData.lastName,
          email: randomData.email,
          displayName: `${randomData.firstName} ${randomData.lastName}`,
        });
        const updatedUser = {
          ...user,
          firstName: randomData.firstName,
          lastName: randomData.lastName,
          email: randomData.email,
          displayName: `${randomData.firstName} ${randomData.lastName}`,
        };
        users.set(user.userId, updatedUser);
        users.set(prefixedUserId, updatedUser);
        logger.success(
          `User ${user.userId} created with random data as ${prefixedUserId}`,
          {
            userId: user.userId,
            prefixedUserId: prefixedUserId,
            name: `${randomData.firstName} ${randomData.lastName}`,
            email: randomData.email,
          }
        );
      } catch (retryError) {
        // If still fails, check if it's "already exists" error
        if (axios.isAxiosError(retryError)) {
          const retryErrorData = retryError.response?.data;
          const retryErrorMessage =
            typeof retryErrorData === "object" && retryErrorData !== null
              ? (retryErrorData as { error?: string }).error || ""
              : String(retryErrorData || retryError.message);

          if (
            retryError.response?.status === 422 &&
            (retryErrorMessage.includes("already exist") ||
              retryErrorMessage.includes("already exists"))
          ) {
            logger.warn(
              `User ${user.userId} already exists, skipping creation`,
              { userId: user.userId }
            );
            users.set(user.userId, user);
            return; // User exists, continue without error
          }
        }
        // If it's a different error, log and re-throw
        logger.error(
          `Failed to create user ${user.userId} even with random data`,
          retryError,
          { userId: user.userId }
        );
        throw retryError;
      }
    } else {
      // Non-axios error, re-throw
      throw error;
    }
  }
}

async function grantAccess(caseId: string, userId: string) {
  logger.debug(`Granting access to user ${userId} for case ${caseId}`, {
    caseId,
    userId,
  });
  try {
    await chatRepo.grantUserAccessToChatRoom(caseId, userId);
    logger.success(`Access granted to user ${userId} for case ${caseId}`, {
      caseId,
      userId,
    });
  } catch (error) {
    // Handle grant access failures gracefully
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const errorData = error.response?.data;

      // If endpoint doesn't exist (404) or other errors, log and continue
      // Access might be granted automatically or the endpoint might not be needed
      if (status === 404) {
        logger.warn(
          `Grant access endpoint not found (404) for user ${userId}. Access might be granted automatically or endpoint may not exist.`,
          { caseId, userId, status }
        );
        return; // Continue without error
      }

      logger.error(`Failed to grant access to user ${userId}`, error, {
        caseId,
        userId,
        status,
        errorData,
      });

      // For other errors, still continue - don't block case creation
      logger.warn(`Continuing despite grant access error for user ${userId}`, {
        caseId,
        userId,
      });
      return;
    }

    // Non-axios error, log but continue
    logger.error(`Failed to grant access to user ${userId}`, error, {
      caseId,
      userId,
    });
    logger.warn(`Continuing despite grant access error for user ${userId}`, {
      caseId,
      userId,
    });
  }
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

/**
 * Create a case and provision chat + participants
 */
app.post("/cases", async (req: Request, res: Response) => {
  try {
    const {
      caseId,
      participants = [],
      metadata,
    } = req.body as {
      caseId: string;
      participants: Participant[];
      metadata?: Record<string, unknown>;
    };

    if (!caseId) {
      return res.status(400).json({ error: "caseId is required" });
    }

    // Idempotency check: if case already exists, return existing data
    if (cases.has(caseId)) {
      logger.info(`Case ${caseId} already exists, returning existing data`, {
        caseId,
        existingParticipants: cases.get(caseId)?.participants,
      });
      const roomJid = chatRepo.createChatName(caseId, true);
      return res.json({
        caseId,
        roomJid,
        participants:
          cases.get(caseId)?.participants.map((userId) => {
            const user = users.get(userId);
            return user
              ? { userId, role: user.role, displayName: user.displayName }
              : { userId };
          }) || [],
      });
    }

    // Prevent concurrent case creation for the same caseId
    if (caseCreationLocks.has(caseId)) {
      logger.info(`Case ${caseId} creation already in progress, waiting...`, {
        caseId,
      });
      await caseCreationLocks.get(caseId);
      // After waiting, check again if case exists
      if (cases.has(caseId)) {
        const roomJid = chatRepo.createChatName(caseId, true);
        return res.json({
          caseId,
          roomJid,
          participants:
            cases.get(caseId)?.participants.map((userId) => {
              const user = users.get(userId);
              return user
                ? { userId, role: user.role, displayName: user.displayName }
                : { userId };
            }) || [],
        });
      }
    }

    // Create a promise for this case creation and store it
    const creationPromise = (async () => {
      try {
        logger.info(`Starting case creation process`, {
          caseId,
          participantCount: participants.length,
        });

        // STEP 1: Create users first
        logger.step(1, "CREATE USER", {
          caseId,
          participants: participants.map((p) => ({
            userId: p.userId,
            role: p.role,
          })),
        });
        for (const participant of participants) {
          await ensureUser(participant);
        }
        logger.success(`All users created/verified`, {
          userIds: participants.map((p) => p.userId),
        });

        // STEP 2: Create chat room (idempotent - check if room already exists)
        logger.step(2, "CREATE CHAT ROOM", { caseId });
        try {
          const roomResult = await chatRepo.createChatRoom(caseId, {
            title: `Case ${caseId}`,
            uuid: caseId,
            type: "group",
          });
          logger.success(`Chat room created`, { caseId, result: roomResult });
        } catch (error) {
          // If room already exists, that's okay - continue
          if (axios.isAxiosError(error) && error.response?.status === 422) {
            const errorData = error.response?.data;
            const errorMessage =
              typeof errorData === "object" && errorData !== null
                ? (errorData as { error?: string }).error || ""
                : String(errorData || "");

            if (
              errorMessage.includes("already exist") ||
              errorMessage.includes("already exists")
            ) {
              logger.warn(
                `Chat room for case ${caseId} already exists, continuing...`,
                {
                  caseId,
                }
              );
            } else {
              logger.error(`Failed to create chat room`, error, { caseId });
              throw error;
            }
          } else {
            logger.error(`Failed to create chat room`, error, { caseId });
            throw error;
          }
        }

        // STEP 3: Grant user access to chat room
        logger.step(3, "GRANT USER ACCESS TO CHAT ROOM", {
          caseId,
          userIds: participants.map((p) => p.userId),
        });
        try {
          // Grant access to each participant individually (API might require this)
          const userIds = participants.map((p) => p.userId);
          for (const userId of userIds) {
            try {
              await chatRepo.grantUserAccessToChatRoom(caseId, userId);
              logger.debug(`Access granted to user ${userId}`, {
                caseId,
                userId,
              });
            } catch (userError) {
              if (axios.isAxiosError(userError)) {
                const errorData = userError.response?.data;
                const status = userError.response?.status;
                logger.warn(`Failed to grant access to user ${userId}`, {
                  caseId,
                  userId,
                  status,
                  errorData,
                });
              } else {
                logger.warn(`Failed to grant access to user ${userId}`, {
                  caseId,
                  userId,
                });
              }
              // Continue with other users even if one fails
            }
          }
          logger.success(
            `User access grant attempts completed for all participants`,
            {
              userIds: userIds,
            }
          );
        } catch (error) {
          logger.error(`Failed to grant user access`, error, { caseId });
          // Continue even if grant access fails - access might be granted automatically
          logger.warn(`Continuing despite grant access error`, { caseId });
        }

        // Save case early to prevent duplicates
        cases.set(caseId, {
          caseId,
          participants: participants.map((p) => p.userId),
          metadata,
        });

        const roomJid = chatRepo.createChatName(caseId, true);
        logger.info(`Case creation completed successfully`, {
          caseId,
          roomJid,
          participantCount: participants.length,
        });

        return { caseId, roomJid, participants };
      } finally {
        // Remove lock when done
        caseCreationLocks.delete(caseId);
      }
    })();

    // Store the promise to prevent concurrent creation
    caseCreationLocks.set(caseId, creationPromise);

    try {
      const result = await creationPromise;
      res.json(result);
    } catch (error) {
      // Remove lock on error
      caseCreationLocks.delete(caseId);
      logger.error("Failed to create case", error, { caseId });
      console.error("Failed to create case", error);

      // Provide detailed error information
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 500;
        const errorData = error.response?.data;
        const errorMessage = error.message;

        console.error("API Error Details:", {
          status,
          message: errorMessage,
          data: errorData,
          url: error.config?.url,
          method: error.config?.method,
        });

        return res.status(status).json({
          error: "Failed to create case",
          details: errorData || errorMessage,
          status,
        });
      }

      res.status(500).json({
        error: "Failed to create case",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    logger.error("Unexpected error in case creation", error);
    res.status(500).json({
      error: "Failed to create case",
      details: error instanceof Error ? error.message : String(error),
    });
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
      return res.status(400).json({ error: "userId and role are required" });
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

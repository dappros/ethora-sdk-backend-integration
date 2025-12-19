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
 *   npm install express cors dotenv ts-node @types/express @types/cors
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
import { getEthoraSDKService } from "../../src";
import { getSecrets } from "../../src/config/secrets";
import { createServerToken, createClientToken } from "../../src/utils/jwt";
import { getFileLogger } from "./file-logger";

// Load .env.local from this example folder if present, else fall back to process env
// IMPORTANT: Load env vars BEFORE calling getSecrets()
loadEnv({
  path: path.resolve(process.cwd(), "examples/healthcare-insurance/.env.local"),
});
loadEnv(); // also load default .env if present

const logger = getFileLogger();
const secrets = getSecrets();

type Role = "admin" | "practitioner" | "patient";

interface Participant {
  userId: string;
  role: Role;
  displayName?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  xmppUsername?: string;
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

const chatRepo = getEthoraSDKService();

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

/**
 * Create user directly via API with plain userId (no appId prefix)
 */
async function createUserDirect(
  userId: string,
  userData: Record<string, unknown>
): Promise<any> {
  const createUrl = `${secrets.chatApiUrl}/v1/users/batch`;

  const email = (userData?.email as string) || `${randomUUID()}@example.com`;
  const password = (userData?.password as string) || `password_${userId}`;

  let firstName: string;
  let lastName: string;

  if (userData?.firstName) {
    firstName = userData.firstName as string;
    lastName = (userData?.lastName as string) || "";
  } else if (userData?.displayName) {
    const displayName = userData.displayName as string;
    const nameParts = displayName.trim().split(/\s+/);
    firstName = nameParts[0] || "User";
    lastName = nameParts.slice(1).join(" ") || "";
  } else {
    firstName = "User";
    lastName = "";
  }

  if (!lastName || lastName.length < 2) {
    lastName = "User";
  }

  const payload = {
    bypassEmailConfirmation: true,
    usersList: [
      {
        uuid: userId, // Use plain userId without prefix
        email: email,
        firstName: firstName,
        lastName: lastName,
        password: password,
        ...(userData &&
          Object.fromEntries(
            Object.entries(userData).filter(
              ([key]) =>
                ![
                  "email",
                  "firstName",
                  "lastName",
                  "password",
                  "uuid",
                  "displayName",
                  "role",
                ].includes(key)
            )
          )),
      },
    ],
  };

  const response = await axios.post(createUrl, payload, {
    headers: {
      "Content-Type": "application/json",
      "x-custom-token": createServerToken(),
    },
    timeout: 30000,
  });

  return response.data;
}

/**
 * Grant user access directly via API with plain userId (no appId prefix)
 */
async function grantAccessDirect(
  workspaceId: string,
  userId: string
): Promise<any> {
  const grantUrl = `${secrets.chatApiUrl}/v1/chats/users-access`;
  const chatName = `${secrets.chatAppId}_${workspaceId}`; // Room name still needs appId prefix

  const payload = {
    chatName: chatName,
    members: [userId], // Use plain userId without prefix
  };

  const response = await axios.post(grantUrl, payload, {
    headers: {
      "Content-Type": "application/json",
      "x-custom-token": createServerToken(),
    },
    timeout: 30000,
  });

  return response.data;
}

async function ensureUser(
  user: Participant
): Promise<{ userId: string; xmppUsername: string }> {
  const cachedUser = users.get(user.userId);
  if (cachedUser?.xmppUsername) {
    logger.info(
      `User ${user.userId} already exists in cache, skipping creation`,
      {
        originalUserId: user.userId,
        cachedXmppUsername: cachedUser.xmppUsername,
      }
    );
    return {
      userId: user.userId,
      xmppUsername: cachedUser.xmppUsername || user.userId,
    };
  }

  logger.info(`Creating user: ${user.userId} (plain userId, no prefix)`, {
    role: user.role,
    displayName: user.displayName,
    userId: user.userId,
  });

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
      `Calling createUserDirect for ${user.userId} (plain userId, no prefix)`,
      {
        userData,
      }
    );
    const createUserResponse = await createUserDirect(user.userId, userData);

    // Log the full API response
    logger.info(`Ethora API response for user creation:`, {
      userId: user.userId,
      apiResponse: createUserResponse,
    });

    // Extract userId and xmppUsername from API response if present
    let actualUserId = user.userId;
    let xmppUsername = user.userId; // Default to plain userId if not in response

    if (createUserResponse && typeof createUserResponse === "object") {
      const response = createUserResponse as Record<string, unknown>;

      // Extract xmppUsername from results array (Ethora API returns it in results[0].xmppUsername)
      let responseXmppUsername: string | undefined;
      if (
        response.results &&
        Array.isArray(response.results) &&
        response.results.length > 0
      ) {
        const firstResult = response.results[0] as Record<string, unknown>;
        responseXmppUsername = firstResult.xmppUsername as string | undefined;
      }

      // Fallback: check top-level xmppUsername
      if (!responseXmppUsername) {
        responseXmppUsername = response.xmppUsername as string | undefined;
      }

      if (responseXmppUsername) {
        xmppUsername = responseXmppUsername;
        logger.info(`Using xmppUsername from API response: ${xmppUsername}`, {
          userId: user.userId,
          apiReturnedXmppUsername: xmppUsername,
        });
        // Always use plain userId, not the API response (which might be prefixed)
        actualUserId = user.userId;
      }

      // Extract userId (fallback if xmppUsername not available)
      const responseUserId = response.userId as string | undefined;
      if (responseUserId && !responseXmppUsername) {
        // Still use plain userId, not API response
        actualUserId = user.userId;
        logger.info(
          `API returned userId, but using plain userId: ${user.userId}`,
          {
            apiReturnedUserId: responseUserId,
            usingUserId: user.userId,
          }
        );
      }
    }

    // Store xmppUsername in user object for later use
    const userWithXmpp = { ...user, xmppUsername };

    // Store user in cache with plain userId only
    users.set(user.userId, userWithXmpp);

    logger.success(`User ${user.userId} created successfully (plain userId)`, {
      userId: user.userId,
      xmppUsername: xmppUsername,
      role: user.role,
      apiResponse: createUserResponse,
    });

    // Always return plain userId, not API response
    return { userId: user.userId, xmppUsername };
  } catch (error) {
    // Check if user already exists
    if (axios.isAxiosError(error)) {
      const errorData = error.response?.data;
      const errorMessage =
        typeof errorData === "object" && errorData !== null
          ? (errorData as { error?: string }).error || ""
          : String(errorData || error.message);

      // If user already exists, skip deletion and return existing user info
      if (
        error.response?.status === 422 &&
        (errorMessage.includes("already exist") ||
          errorMessage.includes("already exists"))
      ) {
        logger.info(`User ${user.userId} already exists, skipping creation`, {
          userId: user.userId,
        });

        // Check if we have cached xmppUsername
        const cachedUser = users.get(user.userId);
        if (cachedUser?.xmppUsername) {
          logger.info(
            `Using cached xmppUsername for existing user: ${cachedUser.xmppUsername}`,
            {
              userId: user.userId,
              xmppUsername: cachedUser.xmppUsername,
            }
          );
          return {
            userId: user.userId,
            xmppUsername: cachedUser.xmppUsername,
          };
        }

        // If not cached, store user and return plain userId as fallback
        users.set(user.userId, user);
        logger.warn(
          `No cached xmppUsername found, using plain userId as fallback`,
          {
            userId: user.userId,
          }
        );
        return { userId: user.userId, xmppUsername: user.userId };
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
        const retryResponse = await createUserDirect(user.userId, {
          firstName: randomData.firstName,
          lastName: randomData.lastName,
          email: randomData.email,
          displayName: `${randomData.firstName} ${randomData.lastName}`,
        });

        // Log the full API response
        logger.info(`Ethora API response for user creation (retry):`, {
          userId: user.userId,
          apiResponse: retryResponse,
        });

        // Extract userId and xmppUsername from API response if present
        let actualUserId = user.userId;
        let xmppUsername = user.userId; // Default to plain userId if not in response

        if (retryResponse && typeof retryResponse === "object") {
          const response = retryResponse as Record<string, unknown>;

          // Extract xmppUsername from results array (Ethora API returns it in results[0].xmppUsername)
          let responseXmppUsername: string | undefined;
          if (
            response.results &&
            Array.isArray(response.results) &&
            response.results.length > 0
          ) {
            const firstResult = response.results[0] as Record<string, unknown>;
            responseXmppUsername = firstResult.xmppUsername as
              | string
              | undefined;
          }

          // Fallback: check top-level xmppUsername
          if (!responseXmppUsername) {
            responseXmppUsername = response.xmppUsername as string | undefined;
          }

          if (responseXmppUsername) {
            xmppUsername = responseXmppUsername;
            logger.info(
              `Using xmppUsername from API response (retry): ${xmppUsername}`,
              {
                userId: user.userId,
                apiReturnedXmppUsername: xmppUsername,
              }
            );
            // Always use plain userId, not API response
            actualUserId = user.userId;
          }

          // Extract userId (fallback if xmppUsername not available)
          const responseUserId = response.userId as string | undefined;
          if (responseUserId && !responseXmppUsername) {
            // Still use plain userId
            actualUserId = user.userId;
            logger.info(
              `API returned userId, but using plain userId (retry): ${user.userId}`,
              {
                apiReturnedUserId: responseUserId,
                usingUserId: user.userId,
              }
            );
          }
        }

        const updatedUser = {
          ...user,
          firstName: randomData.firstName,
          lastName: randomData.lastName,
          email: randomData.email,
          displayName: `${randomData.firstName} ${randomData.lastName}`,
          xmppUsername, // Store xmppUsername from API response
        };
        users.set(user.userId, updatedUser);
        logger.success(
          `User ${user.userId} created with random data (plain userId)`,
          {
            userId: user.userId,
            xmppUsername: xmppUsername,
            name: `${randomData.firstName} ${randomData.lastName}`,
            email: randomData.email,
            apiResponse: retryResponse,
          }
        );
        // Always return plain userId
        return { userId: user.userId, xmppUsername };
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
            logger.info(
              `User ${user.userId} already exists, skipping creation`,
              { userId: user.userId }
            );

            // Check if we have cached xmppUsername
            const cachedUser = users.get(user.userId);
            if (cachedUser?.xmppUsername) {
              logger.info(
                `Using cached xmppUsername for existing user (retry): ${cachedUser.xmppUsername}`,
                {
                  userId: user.userId,
                  xmppUsername: cachedUser.xmppUsername,
                }
              );
              return {
                userId: user.userId,
                xmppUsername: cachedUser.xmppUsername,
              };
            }

            // If not cached, store user and return plain userId as fallback
            users.set(user.userId, user);
            logger.warn(
              `No cached xmppUsername found (retry), using plain userId as fallback`,
              {
                userId: user.userId,
              }
            );
            return { userId: user.userId, xmppUsername: user.userId };
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
    await grantAccessDirect(caseId, userId);
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
        const actualUserIds: string[] = [];
        for (const participant of participants) {
          const { userId: actualUserId, xmppUsername } = await ensureUser(
            participant
          );
          actualUserIds.push(actualUserId);
          // Keep original userId (don't overwrite with API response which might have prefix)
          // The API might return xmppUsername, but we want to use plain userId
          participant.userId = participant.userId; // Keep original plain userId
          // Store xmppUsername in participant for later use (from Ethora API response)
          participant.xmppUsername = xmppUsername;
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
          // Grant access to each participant individually using plain userId
          for (const participant of participants) {
            // Use plain userId (no prefix) for grant access
            const userIdToUse = participant.userId;
            try {
              await grantAccessDirect(caseId, userIdToUse);
              logger.debug(
                `Access granted using plain userId: ${userIdToUse}`,
                {
                  caseId,
                  userId: userIdToUse,
                }
              );
            } catch (userError) {
              if (axios.isAxiosError(userError)) {
                const errorData = userError.response?.data;
                const status = userError.response?.status;
                logger.warn(
                  `Failed to grant access using userId: ${userIdToUse}`,
                  {
                    caseId,
                    userId: userIdToUse,
                    status,
                    errorData,
                  }
                );
              } else {
                logger.warn(
                  `Failed to grant access using userId: ${userIdToUse}`,
                  {
                    caseId,
                    userId: userIdToUse,
                  }
                );
              }
              // Continue with other users even if one fails
            }
          }
          logger.success(
            `User access grant attempts completed for all participants`,
            {
              participants: participants.map((p) => ({
                userId: p.userId,
              })),
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

    const { userId: actualUserId, xmppUsername } = await ensureUser(
      participant
    );
    // Use plain userId for grant access (no prefix)
    await grantAccess(caseId, participant.userId);

    const record = cases.get(caseId)!;
    if (!record.participants.includes(participant.userId)) {
      record.participants.push(participant.userId);
    }

    const response = { caseId, userId: participant.userId };
    // Log the full response being sent to the client
    logger.info(`User creation endpoint response sent to client:`, {
      caseId,
      userId: participant.userId,
      fullResponse: response,
    });
    res.json(response);
  } catch (error) {
    logger.error("Failed to add participant", error, {
      caseId: req.params.caseId,
    });
    console.error("Failed to add participant", error);
    res.status(500).json({ error: "Failed to add participant" });
  }
});

/**
 * Get client token for a user (for embedding in chat component/snippet)
 * Uses xmppUsername from the user cache instead of userId
 */
app.get("/chat/token/:userId", (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Use plain userId for token creation (no prefix)
    const token = createClientToken(userId);
    logger.info(`Token generated for user: ${userId}`, {
      userId,
      tokenLength: token.length,
    });
    res.json({ userId, token });
  } catch (error) {
    logger.error("Failed to generate token", error, {
      userId: req.params.userId,
    });
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

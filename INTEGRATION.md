<!-- @format -->

# Integration Guide: Adding Ethora SDK to Your Node.js Backend

This guide will walk you through integrating the Ethora SDK into your existing Node.js backend application.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Basic Integration](#basic-integration)
- [Integration Patterns](#integration-patterns)
- [Common Use Cases](#common-use-cases)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18+ or higher
- TypeScript 5.0+ (for TypeScript projects)
- An existing Node.js backend application (Express, Fastify, NestJS, etc.)
- Ethora API credentials:
  - `ETHORA_CHAT_API_URL`
  - `ETHORA_CHAT_APP_ID`
  - `ETHORA_CHAT_APP_SECRET`
  - `ETHORA_CHAT_BOT_JID` (optional, for chatbot features)

## Installation

### Step 1: Install the Package

```bash
npm install @ethora/sdk-backend-integration
# or
yarn add @ethora/sdk-backend-integration
# or
pnpm add @ethora/sdk-backend-integration
```

### Step 2: Install Type Definitions (if using TypeScript)

The package includes TypeScript definitions, so no additional `@types` package is needed.

## Environment Configuration

### Step 1: Add Environment Variables

Add the following environment variables to your `.env` file or your environment configuration:

```bash
# Required
ETHORA_CHAT_API_URL=https://api.ethoradev.com
ETHORA_CHAT_APP_ID=your_app_id_here
ETHORA_CHAT_APP_SECRET=your_app_secret_here

# Optional (for chatbot features)
ETHORA_CHAT_BOT_JID=your_bot_jid@domain.com
```

### Step 2: Load Environment Variables

If you're using a `.env` file, ensure you have `dotenv` installed and configured:

```bash
npm install dotenv
```

In your main application file (e.g., `app.js`, `server.js`, or `index.ts`):

```typescript
import dotenv from "dotenv";

// Load environment variables
dotenv.config();
```

## Basic Integration

### Step 1: Import the SDK

```typescript
import { getEthoraSDKService } from "@ethora/sdk-backend-integration";
```

### Step 2: Initialize the Service

You can initialize the service in several ways:

#### Option A: Singleton Pattern (Recommended)

```typescript
// services/chatService.ts
import { getEthoraSDKService } from "@ethora/sdk-backend-integration";

// Get the singleton instance
const chatService = getEthoraSDKService();

export default chatService;
```

#### Option B: Direct Initialization

```typescript
// In your route handler or service
import { getEthoraSDKService } from "@ethora/sdk-backend-integration";

const chatService = getEthoraSDKService();
```

#### Option C: Dependency Injection (for frameworks like NestJS)

```typescript
// chat.service.ts
import { Injectable } from "@nestjs/common";
import { getEthoraSDKService } from "@ethora/sdk-backend-integration";

@Injectable()
export class ChatService {
  private readonly ethoraService = getEthoraSDKService();

  // Your methods here
}
```

## Integration Patterns

### Pattern 1: Express.js Integration

```typescript
// routes/chat.ts
import express, { Request, Response } from "express";
import { getEthoraSDKService } from "@ethora/sdk-backend-integration";
import axios from "axios";

const router = express.Router();
const chatService = getEthoraSDKService();

// Create a chat room for a workspace
router.post(
  "/workspaces/:workspaceId/chat",
  async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.params;
      const roomData = req.body;

      const response = await chatService.createChatRoom(workspaceId, {
        title: roomData.title || `Chat Room ${workspaceId}`,
        uuid: workspaceId,
        type: roomData.type || "group",
        ...roomData,
      });

      res.json({ success: true, data: response });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        res.status(error.response?.status || 500).json({
          error: "Failed to create chat room",
          details: error.response?.data,
        });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
);

// Create a user
router.post("/users/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const userData = req.body;

    const response = await chatService.createUser(userId, userData);
    res.json({ success: true, data: response });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      res.status(error.response?.status || 500).json({
        error: "Failed to create user",
        details: error.response?.data,
      });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Grant user access to chat room
router.post(
  "/workspaces/:workspaceId/chat/users/:userId",
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, userId } = req.params;

      await chatService.grantUserAccessToChatRoom(workspaceId, userId);
      res.json({ success: true, message: "Access granted" });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        res.status(error.response?.status || 500).json({
          error: "Failed to grant access",
          details: error.response?.data,
        });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
);

// Generate client JWT token
router.get("/users/:userId/chat-token", (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const token = chatService.createChatUserJwtToken(userId);
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate token" });
  }
});

export default router;
```

### Pattern 2: NestJS Integration

```typescript
// chat/chat.service.ts
import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { getEthoraSDKService } from "@ethora/sdk-backend-integration";
import axios from "axios";

@Injectable()
export class ChatService {
  private readonly ethoraService = getEthoraSDKService();

  async createChatRoom(workspaceId: string, roomData?: any) {
    try {
      return await this.ethoraService.createChatRoom(workspaceId, roomData);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new HttpException(
          {
            message: "Failed to create chat room",
            details: error.response?.data,
          },
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      throw error;
    }
  }

  async createUser(userId: string, userData?: any) {
    try {
      return await this.ethoraService.createUser(userId, userData);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new HttpException(
          {
            message: "Failed to create user",
            details: error.response?.data,
          },
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      throw error;
    }
  }

  generateClientToken(userId: string): string {
    return this.ethoraService.createChatUserJwtToken(userId);
  }
}

// chat/chat.controller.ts
import { Controller, Post, Get, Param, Body } from "@nestjs/common";
import { ChatService } from "./chat.service";

@Controller("chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post("workspaces/:workspaceId/rooms")
  async createChatRoom(
    @Param("workspaceId") workspaceId: string,
    @Body() roomData: any
  ) {
    return this.chatService.createChatRoom(workspaceId, roomData);
  }

  @Post("users/:userId")
  async createUser(@Param("userId") userId: string, @Body() userData: any) {
    return this.chatService.createUser(userId, userData);
  }

  @Get("users/:userId/token")
  getClientToken(@Param("userId") userId: string) {
    return { token: this.chatService.generateClientToken(userId) };
  }
}
```

### Pattern 3: Fastify Integration

```typescript
// routes/chat.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getEthoraSDKService } from "@ethora/sdk-backend-integration";

const chatService = getEthoraSDKService();

export async function chatRoutes(fastify: FastifyInstance) {
  // Create chat room
  fastify.post(
    "/workspaces/:workspaceId/chat",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const roomData = request.body as any;

      try {
        const response = await chatService.createChatRoom(
          workspaceId,
          roomData
        );
        return { success: true, data: response };
      } catch (error) {
        reply.code(500).send({ error: "Failed to create chat room" });
      }
    }
  );

  // Generate client token
  fastify.get(
    "/users/:userId/chat-token",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.params as { userId: string };
      const token = chatService.createChatUserJwtToken(userId);
      return { token };
    }
  );
}
```

## Common Use Cases

### Use Case 1: Workspace Setup Flow

When creating a new workspace, set up the chat room and initial users:

```typescript
async function setupWorkspaceChat(
  workspaceId: string,
  userIds: string[],
  adminUserId: string
) {
  const chatService = getEthoraSDKService();

  try {
    // 1. Create chat room
    await chatService.createChatRoom(workspaceId, {
      title: `Workspace ${workspaceId}`,
      uuid: workspaceId,
      type: "group",
    });

    // 2. Create users (if they don't exist)
    for (const userId of userIds) {
      try {
        await chatService.createUser(userId, {
          firstName: "User",
          lastName: "Name",
        });
      } catch (error) {
        // User might already exist, continue
        console.warn(`User ${userId} might already exist`);
      }
    }

    // 3. Grant access to all users
    await chatService.grantUserAccessToChatRoom(workspaceId, userIds);

    // 4. Grant chatbot access (if configured)
    try {
      await chatService.grantChatbotAccessToChatRoom(workspaceId);
    } catch (error) {
      console.warn("Chatbot access not configured or failed");
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to setup workspace chat:", error);
    throw error;
  }
}
```

### Use Case 2: User Onboarding

When a new user joins your platform:

```typescript
async function onboardNewUser(
  userId: string,
  userData: { firstName: string; lastName: string; email: string }
) {
  const chatService = getEthoraSDKService();

  try {
    // Create user in chat service
    await chatService.createUser(userId, {
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      displayName: `${userData.firstName} ${userData.lastName}`,
    });

    // Generate client token for frontend
    const clientToken = chatService.createChatUserJwtToken(userId);

    return {
      success: true,
      chatToken: clientToken,
    };
  } catch (error) {
    console.error("Failed to onboard user:", error);
    throw error;
  }
}
```

### Use Case 3: Adding User to Existing Workspace

When adding a user to an existing workspace:

```typescript
async function addUserToWorkspace(workspaceId: string, userId: string) {
  const chatService = getEthoraSDKService();

  try {
    // Ensure user exists
    try {
      await chatService.createUser(userId);
    } catch (error) {
      // User might already exist, continue
    }

    // Grant access to workspace chat room
    await chatService.grantUserAccessToChatRoom(workspaceId, userId);

    return { success: true };
  } catch (error) {
    console.error("Failed to add user to workspace:", error);
    throw error;
  }
}
```

### Use Case 4: Cleanup on Workspace Deletion

When deleting a workspace:

```typescript
async function cleanupWorkspaceChat(workspaceId: string, userIds: string[]) {
  const chatService = getEthoraSDKService();

  try {
    // Delete chat room (handles non-existent gracefully)
    await chatService.deleteChatRoom(workspaceId);

    // Optionally delete users (if they're no longer needed)
    if (userIds.length > 0) {
      try {
        await chatService.deleteUsers(userIds);
      } catch (error) {
        console.warn("Some users might not exist:", error);
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to cleanup workspace chat:", error);
    throw error;
  }
}
```

## Error Handling

### Handling API Errors

The SDK uses Axios for HTTP requests, so errors are AxiosError instances:

```typescript
import axios from "axios";
import { getEthoraSDKService } from "@ethora/sdk-backend-integration";

const chatService = getEthoraSDKService();

async function createChatRoomSafely(workspaceId: string) {
  try {
    return await chatService.createChatRoom(workspaceId);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const errorData = error.response?.data;

      // Handle specific error cases
      if (status === 422) {
        // Validation error
        console.error("Validation error:", errorData);
      } else if (status === 401) {
        // Authentication error
        console.error("Authentication failed - check your credentials");
      } else if (status === 404) {
        // Resource not found
        console.error("Resource not found");
      } else {
        // Other HTTP errors
        console.error(`HTTP error ${status}:`, errorData);
      }
    } else {
      // Non-HTTP errors
      console.error("Unexpected error:", error);
    }
    throw error;
  }
}
```

### Graceful Error Handling for Idempotent Operations

Some operations are idempotent and can be safely retried:

```typescript
async function ensureChatRoomExists(workspaceId: string) {
  const chatService = getEthoraSDKService();

  try {
    await chatService.createChatRoom(workspaceId);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorData = error.response?.data;
      const errorMessage =
        typeof errorData === "object" && errorData !== null
          ? (errorData as { error?: string }).error || ""
          : String(errorData || "");

      // If room already exists, that's okay
      if (
        error.response?.status === 422 &&
        (errorMessage.includes("already exist") ||
          errorMessage.includes("already exists"))
      ) {
        console.log("Chat room already exists, continuing...");
        return; // Success - room exists
      }
    }
    // Re-throw if it's a different error
    throw error;
  }
}
```

## Best Practices

### 1. Use Singleton Pattern

The SDK provides a singleton instance. Reuse it rather than creating multiple instances:

```typescript
// Good
const chatService = getEthoraSDKService();

// Avoid
const chatService1 = getEthoraSDKService();
const chatService2 = getEthoraSDKService(); // Unnecessary
```

### 2. Centralize Chat Service

Create a service wrapper in your application:

```typescript
// services/chatService.ts
import { getEthoraSDKService } from "@ethora/sdk-backend-integration";
import type { ChatRepository } from "@ethora/sdk-backend-integration";

class ChatServiceWrapper {
  private service: ChatRepository;

  constructor() {
    this.service = getEthoraSDKService();
  }

  async setupWorkspace(workspaceId: string, userIds: string[]) {
    // Your custom logic here
    await this.service.createChatRoom(workspaceId);
    // ... more setup logic
  }

  // Expose other methods as needed
  getService() {
    return this.service;
  }
}

export default new ChatServiceWrapper();
```

### 3. Environment Variable Validation

Validate environment variables on application startup:

```typescript
// config/validateEnv.ts
function validateEthoraConfig() {
  const required = [
    "ETHORA_CHAT_API_URL",
    "ETHORA_CHAT_APP_ID",
    "ETHORA_CHAT_APP_SECRET",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required Ethora environment variables: ${missing.join(", ")}`
    );
  }
}

// Call on startup
validateEthoraConfig();
```

### 4. Logging Integration

Integrate with your existing logging system:

```typescript
import { getEthoraSDKService } from "@ethora/sdk-backend-integration";
import { logger } from "./utils/logger"; // Your logger

const chatService = getEthoraSDKService();

async function createChatRoomWithLogging(workspaceId: string) {
  logger.info(`Creating chat room for workspace: ${workspaceId}`);
  try {
    const result = await chatService.createChatRoom(workspaceId);
    logger.info(`Chat room created successfully: ${workspaceId}`);
    return result;
  } catch (error) {
    logger.error(`Failed to create chat room: ${workspaceId}`, error);
    throw error;
  }
}
```

### 5. Type Safety

Use TypeScript types from the SDK:

```typescript
import type { UUID, ApiResponse } from "@ethora/sdk-backend-integration";

async function createUserTyped(
  userId: UUID,
  userData: {
    firstName: string;
    lastName: string;
    email: string;
  }
): Promise<ApiResponse> {
  const chatService = getEthoraSDKService();
  return await chatService.createUser(userId, userData);
}
```

## Troubleshooting

### Issue: "Missing required environment variables"

**Solution:** Ensure all required environment variables are set:

```bash
ETHORA_CHAT_API_URL=https://api.ethoradev.com
ETHORA_CHAT_APP_ID=your_app_id
ETHORA_CHAT_APP_SECRET=your_app_secret
```

### Issue: "Authentication failed" (401 errors)

**Solution:** Verify your `ETHORA_CHAT_APP_SECRET` is correct and matches your app ID.

### Issue: "User already exists" errors

**Solution:** Handle idempotent operations gracefully:

```typescript
try {
  await chatService.createUser(userId);
} catch (error) {
  if (axios.isAxiosError(error) && error.response?.status === 422) {
    // User already exists, continue
    console.log("User already exists");
  } else {
    throw error;
  }
}
```

### Issue: "Chat room not found" during deletion

**Solution:** The SDK handles this gracefully. The `deleteChatRoom` method returns `{ ok: false, reason: "Chat room not found" }` if the room doesn't exist, which is safe to ignore.

### Issue: TypeScript compilation errors

**Solution:** Ensure you're using TypeScript 5.0+ and have proper type definitions:

```bash
npm install --save-dev typescript@^5.0.0
```

## Next Steps

- Review the [API Reference](../README.md#api-reference) for detailed method documentation
- Check out the [Examples](../examples/) directory for complete integration examples
- See the [Healthcare Insurance Demo](../examples/healthcare-insurance/) for a real-world use case

## Support

For issues, questions, or contributions, please refer to the main [README.md](../README.md) file.

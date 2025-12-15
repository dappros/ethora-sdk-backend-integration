<!-- @format -->

# Ethora SDK - Backend Integration

TypeScript/Node.js SDK for integrating your backend with the Ethora chat service platform. This SDK provides a clean, type-safe interface for managing chat rooms, users, and authentication tokens.

## Installation

```bash
npm install @ethora/sdk-backend
# or
yarn add @ethora/sdk-backend
```

## Quick Start

### 1. Set Environment Variables

```bash
ETHORA_CHAT_API_URL=https://api.ethoradev.com
ETHORA_CHAT_APP_ID=your_app_id
ETHORA_CHAT_APP_SECRET=your_app_secret
ETHORA_CHAT_BOT_JID=your_bot_jid@domain.com  # Optional
```

### 2. Basic Usage

```typescript
import { getEthoraSDKService } from "@ethora/sdk-backend";

// Get repository instance
const chatRepo = getEthoraSDKService();

// Create a chat room for a workspace
const workspaceId = "case-123";
await chatRepo.createChatRoom(workspaceId, {
  title: "Case Chat Room",
  uuid: workspaceId,
  type: "group",
});

// Create a user
const userId = "user-123";
await chatRepo.createUser(userId, {
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
});

// Grant user access to chat room
await chatRepo.grantUserAccessToChatRoom(workspaceId, userId);

// Grant access to multiple users at once
await chatRepo.grantUserAccessToChatRoom(workspaceId, [
  "user-1",
  "user-2",
  "user-3",
]);

// Generate client JWT token for frontend
const clientToken = chatRepo.createChatUserJwtToken(userId);
```

## API Reference

### ChatRepository Interface

#### `createChatName(workspaceId: UUID, full?: boolean): string`

Generates a fully-qualified chat room JID from a workspace ID.

**Parameters:**

- `workspaceId` (UUID): The unique identifier of the workspace
- `full` (boolean, optional): Whether to include the full JID domain. Default: `true`

**Returns:** The fully-qualified JID string for the chat room

**Example:**

```typescript
const chatName = chatRepo.createChatName(workspaceId, true);
// Returns: "appId_workspaceId@conference.xmpp.ethoradev.com"
```

#### `createChatUserJwtToken(userId: UUID): string`

Creates a client-side JWT token for a specific user ID.

**Parameters:**

- `userId` (UUID): The unique identifier of the user

**Returns:** The encoded JWT token for client-side authentication

#### `createUser(userId: UUID, userData?: Record<string, unknown>): Promise<ApiResponse>`

Creates a user in the chat service. The userId will be automatically prefixed with your appId.

**Parameters:**

- `userId` (UUID): The unique identifier of the user
- `userData` (optional): Additional user data (firstName, lastName, email, password, displayName)

**Returns:** Promise resolving to the API response

**Example:**

```typescript
await chatRepo.createUser("user-123", {
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  displayName: "John Doe",
});
```

#### `createChatRoom(workspaceId: UUID, roomData?: Record<string, unknown>): Promise<ApiResponse>`

Creates a chat room for a workspace.

**Parameters:**

- `workspaceId` (UUID): The unique identifier of the workspace
- `roomData` (optional): Room data including `title`, `uuid`, `type` (defaults to "group")

**Returns:** Promise resolving to the API response

**Example:**

```typescript
await chatRepo.createChatRoom(workspaceId, {
  title: "Case Chat Room",
  uuid: workspaceId,
  type: "group",
});
```

#### `grantUserAccessToChatRoom(workspaceId: UUID, userId: UUID | UUID[]): Promise<ApiResponse>`

Grants user(s) access to a chat room. Can accept a single userId or an array of userIds.

**Parameters:**

- `workspaceId` (UUID): The unique identifier of the workspace
- `userId` (UUID | UUID[]): Single user ID or array of user IDs

**Returns:** Promise resolving to the API response

**Example:**

```typescript
// Grant access to a single user
await chatRepo.grantUserAccessToChatRoom(workspaceId, "user-123");

// Grant access to multiple users at once
await chatRepo.grantUserAccessToChatRoom(workspaceId, [
  "user-1",
  "user-2",
  "user-3",
]);
```

#### `grantChatbotAccessToChatRoom(workspaceId: UUID): Promise<ApiResponse>`

Grants chatbot access to a chat room. Requires `ETHORA_CHAT_BOT_JID` environment variable.

**Parameters:**

- `workspaceId` (UUID): The unique identifier of the workspace

**Returns:** Promise resolving to the API response

#### `deleteUsers(userIds: UUID[]): Promise<ApiResponse>`

Deletes users from the chat service.

**Parameters:**

- `userIds` (UUID[]): Array of user IDs to delete

**Returns:** Promise resolving to the API response

#### `deleteChatRoom(workspaceId: UUID): Promise<ApiResponse>`

Deletes a chat room by workspace ID.

**Parameters:**

- `workspaceId` (UUID): The unique identifier of the workspace

**Returns:** Promise resolving to the API response

## Complete Example

```typescript
import { getEthoraSDKService } from "@ethora/sdk-backend";

const chatRepo = getEthoraSDKService();
const workspaceId = "case-123";
const userIds = ["admin-1", "practitioner-1", "patient-1"];

// Step 1: Create users
for (const userId of userIds) {
  await chatRepo.createUser(userId, {
    firstName: "User",
    lastName: "Name",
    email: `${userId}@example.com`,
  });
}

// Step 2: Create chat room
await chatRepo.createChatRoom(workspaceId, {
  title: `Case ${workspaceId}`,
  uuid: workspaceId,
  type: "group",
});

// Step 3: Grant access to all users
await chatRepo.grantUserAccessToChatRoom(workspaceId, userIds);

// Step 4: Generate client tokens
const tokens = userIds.map((userId) => ({
  userId,
  token: chatRepo.createChatUserJwtToken(userId),
}));

// Step 5: Get room JID for frontend
const roomJid = chatRepo.createChatName(workspaceId, true);
```

## Error Handling

All methods throw errors that can be caught and handled:

```typescript
try {
  await chatRepo.createUser(userId, userData);
} catch (error) {
  if (axios.isAxiosError(error)) {
    console.error("API Error:", error.response?.status, error.response?.data);
  } else {
    console.error("Unexpected error:", error);
  }
}
```

## Notes

- User IDs are automatically prefixed with your `appId` when creating users
- When granting access, user IDs are also automatically prefixed if needed
- Chat room names follow the format: `{appId}_{workspaceId}`
- Full JID format: `{appId}_{workspaceId}@conference.xmpp.ethoradev.com`

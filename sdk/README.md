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

Creates a user in the chat service. The userId is used as-is without any prefixing.

**Parameters:**

- `userId` (UUID): The unique identifier of the user (used as-is, no prefixing)
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

#### `getUsers(params?: GetUsersQueryParams): Promise<ApiResponse>`

Gets users from the chat service. Supports multiple query modes.

**Parameters:**

- `params` (GetUsersQueryParams, optional): Query parameters for filtering users
  - `chatName` (string, optional): Chat name to filter users
    - For group chats: use `appId_uuId` format
    - For 1-on-1 chats: use `xmppUsernameA-xmppUsernameB` format
  - `xmppUsername` (string, optional): XMPP username to get a specific user

**Returns:** Promise resolving to the API response with users array

**Query Modes:**

- **No parameters**: Returns all users of the app
- **With `chatName`**: Returns all users of the specified chat
- **With `xmppUsername`**: Returns a specific user by XMPP username (may not be supported by API yet)

**Example:**

```typescript
// Get all users
const allUsers = await chatRepo.getUsers();

// Get users by chat name (group chat)
const groupChatUsers = await chatRepo.getUsers({
  chatName: "appId_workspaceId",
});

// Get users by chat name (1-on-1 chat)
const oneOnOneUsers = await chatRepo.getUsers({
  chatName: "userA-userB",
});

// Get specific user by XMPP username
const user = await chatRepo.getUsers({
  xmppUsername: "appId_userId",
});
```

#### `updateUsers(users: UpdateUserData[]): Promise<ApiResponse>`

Updates multiple users in the chat service using a PATCH request. Only provided fields will be updated.

**Parameters:**

- `users` (UpdateUserData[]): Array of user data to update (1-100 users)
  - `xmppUsername` (string, required): XMPP username to identify the user
  - `firstName` (string, optional): First name
  - `lastName` (string, optional): Last name
  - `username` (string, optional): Username
  - `profileImage` (string, optional): Profile image URL

**Returns:** Promise resolving to the API response with results array containing status for each user:
- `updated`: User was successfully updated (includes updated user data)
- `not-found`: User was not found
- `skipped`: User update was skipped

**Limits:** 1-100 users per request

**Note:** The API only accepts `xmppUsername`, `firstName`, `lastName`, `username`, and `profileImage` fields. Other fields will be automatically filtered out.

**Example:**

```typescript
// Update multiple users
const response = await chatRepo.updateUsers([
  {
    xmppUsername: "appId_user1",
    firstName: "John",
    lastName: "Doe",
    username: "johndoe",
    profileImage: "https://example.com/avatar1.jpg",
  },
  {
    xmppUsername: "appId_user2",
    firstName: "Jane",
    lastName: "Smith",
    username: "janesmith",
  },
]);

// Response structure:
// {
//   results: [
//     {
//       xmppUsername: "appId_user1",
//       status: "updated",
//       user: { /* updated user data */ }
//     },
//     {
//       xmppUsername: "appId_user2",
//       status: "updated",
//       user: { /* updated user data */ }
//     }
//   ]
// }
```

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

- User IDs are used as-is without any prefixing (e.g., `"user-123"` stays `"user-123"`)
- When granting access, user IDs are used as-is without prefixing
- Chat room names follow the format: `{appId}_{workspaceId}` (only room names are prefixed, not user IDs)
- Full JID format: `{appId}_{workspaceId}@conference.xmpp.ethoradev.com`

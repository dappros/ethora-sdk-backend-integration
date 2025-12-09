# Ethora SDK - Backend Integration

TypeScript/Node.js SDK for integrating your backend with the Ethora chat service platform. This SDK provides a clean, type-safe interface for managing chat rooms, users, and authentication tokens.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Architecture](#architecture)
- [Error Handling](#error-handling)
- [Contributing](#contributing)

## Installation

```bash
npm install @ethora/sdk-backend-integration
# or
yarn add @ethora/sdk-backend-integration
```

### Prerequisites

- Node.js 18+ or higher
- TypeScript 5.0+ (for TypeScript projects)

## Quick Start

### 1. Set Environment Variables

Create a `.env` file or set the following environment variables:

```bash
ETHORA_CHAT_API_URL=https://api.ethoradev.com
ETHORA_CHAT_APP_ID=your_app_id
ETHORA_CHAT_APP_SECRET=your_app_secret
```

### 2. Basic Usage

```typescript
import { getChatRepositoryImpl } from '@ethora/sdk-backend-integration';

// Get repository instance
const chatRepo = getChatRepositoryImpl();

// Create a chat room for a workspace
const workspaceId = '123e4567-e89b-12d3-a456-426614174000';
await chatRepo.createChatRoom(workspaceId);

// Create a user
const userId = 'user-123';
await chatRepo.createUser(userId);

// Grant user access to chat room
await chatRepo.grantUserAccessToChatRoom(workspaceId, userId);

// Generate client JWT token for frontend
const clientToken = chatRepo.createChatUserJwtToken(userId);
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ETHORA_CHAT_API_URL` | Base URL for Ethora chat API | Yes |
| `ETHORA_CHAT_APP_ID` | Your Ethora application ID | Yes |
| `ETHORA_CHAT_APP_SECRET` | Secret key for JWT token generation | Yes |

### Custom Configuration

You can also provide custom configuration by implementing your own secrets provider:

```typescript
import { getSecrets } from '@ethora/sdk-backend-integration';

// The SDK uses environment variables by default
// You can override getSecrets() to use a secrets manager
```

## API Reference

### ChatRepository Interface

The main interface for interacting with the Ethora chat service.

#### Methods

##### `createChatName(workspaceId: UUID, full?: boolean): string`

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

##### `createChatUserJwtToken(userId: UUID): string`

Creates a client-side JWT token for a specific user ID. This token can be used for client-side authentication with the chat service.

**Parameters:**
- `userId` (UUID): The unique identifier of the user

**Returns:** The encoded JWT token for client-side authentication

**Example:**
```typescript
const token = chatRepo.createChatUserJwtToken(userId);
// Use this token in your frontend application
```

##### `createUser(userId: UUID, userData?: Record<string, unknown>): Promise<ApiResponse>`

Creates a user in the chat service.

**Parameters:**
- `userId` (UUID): The unique identifier of the user
- `userData` (optional): Additional user data to include

**Returns:** Promise resolving to the API response

**Example:**
```typescript
const response = await chatRepo.createUser(userId, {
  displayName: 'John Doe',
  email: 'john@example.com'
});
```

##### `createChatRoom(workspaceId: UUID, roomData?: Record<string, unknown>): Promise<ApiResponse>`

Creates a chat room for a workspace.

**Parameters:**
- `workspaceId` (UUID): The unique identifier of the workspace
- `roomData` (optional): Additional room configuration data

**Returns:** Promise resolving to the API response

**Example:**
```typescript
const response = await chatRepo.createChatRoom(workspaceId, {
  description: 'Workspace chat room',
  isPublic: false
});
```

##### `grantUserAccessToChatRoom(workspaceId: UUID, userId: UUID): Promise<ApiResponse>`

Grants a user access to a specific chat room.

**Parameters:**
- `workspaceId` (UUID): The unique identifier of the workspace
- `userId` (UUID): The unique identifier of the user

**Returns:** Promise resolving to the API response

**Example:**
```typescript
await chatRepo.grantUserAccessToChatRoom(workspaceId, userId);
```

##### `grantChatbotAccessToChatRoom(workspaceId: UUID): Promise<ApiResponse>`

Grants chatbot access to a chat room.

**Parameters:**
- `workspaceId` (UUID): The unique identifier of the workspace

**Returns:** Promise resolving to the API response

**Example:**
```typescript
await chatRepo.grantChatbotAccessToChatRoom(workspaceId);
```

##### `deleteUsers(userIds: UUID[]): Promise<ApiResponse>`

Deletes multiple users from the chat service.

**Parameters:**
- `userIds` (UUID[]): Array of user IDs to delete

**Returns:** Promise resolving to the API response

**Example:**
```typescript
await chatRepo.deleteUsers([userId1, userId2, userId3]);
```

##### `deleteChatRoom(workspaceId: UUID): Promise<ApiResponse>`

Deletes a chat room from the chat service. Gracefully handles the case where the chat room doesn't exist.

**Parameters:**
- `workspaceId` (UUID): The unique identifier of the workspace

**Returns:** Promise resolving to the API response

**Example:**
```typescript
const response = await chatRepo.deleteChatRoom(workspaceId);
// Returns { ok: false, reason: "Chat room not found" } if room doesn't exist
```

## Examples

See the `examples/` directory for complete working examples:
- `basic-usage.ts` - Basic SDK usage patterns
- `express-integration.ts` - Express.js API integration

### Complete Workspace Setup

```typescript
import { getChatRepositoryImpl } from '@ethora/sdk-backend-integration';

async function setupWorkspaceChat(workspaceId: string, userIds: string[]) {
  const chatRepo = getChatRepositoryImpl();

  try {
    // 1. Create chat room
    await chatRepo.createChatRoom(workspaceId);
    console.log('Chat room created');

    // 2. Create users
    for (const userId of userIds) {
      await chatRepo.createUser(userId);
      console.log(`User ${userId} created`);
    }

    // 3. Grant users access to chat room
    for (const userId of userIds) {
      await chatRepo.grantUserAccessToChatRoom(workspaceId, userId);
      console.log(`Access granted to user ${userId}`);
    }

    // 4. Grant chatbot access
    await chatRepo.grantChatbotAccessToChatRoom(workspaceId);
    console.log('Chatbot access granted');

    return { success: true };
  } catch (error) {
    console.error('Error setting up workspace chat:', error);
    throw error;
  }
}
```

### Generate Client Tokens for Frontend

```typescript
import { getChatRepositoryImpl } from '@ethora/sdk-backend-integration';

function generateClientTokens(userIds: string[]): Record<string, string> {
  const chatRepo = getChatRepositoryImpl();
  const tokens: Record<string, string> = {};

  for (const userId of userIds) {
    tokens[userId] = chatRepo.createChatUserJwtToken(userId);
  }

  return tokens;
}

// Usage in API endpoint
app.get('/api/chat/tokens/:userId', (req, res) => {
  const { userId } = req.params;
  const token = chatRepo.createChatUserJwtToken(userId);
  res.json({ token });
});
```

### Cleanup on Workspace Deletion

```typescript
async function cleanupWorkspace(workspaceId: string, userIds: string[]) {
  const chatRepo = getChatRepositoryImpl();

  try {
    // Delete chat room (handles non-existent rooms gracefully)
    await chatRepo.deleteChatRoom(workspaceId);
    console.log('Chat room deleted');

    // Delete users
    if (userIds.length > 0) {
      await chatRepo.deleteUsers(userIds);
      console.log('Users deleted');
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}
```

### Using with Express.js

```typescript
import express from 'express';
import { getChatRepositoryImpl } from '@ethora/sdk-backend-integration';

const app = express();
const chatRepo = getChatRepositoryImpl();

app.post('/workspaces/:workspaceId/chat', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const response = await chatRepo.createChatRoom(workspaceId);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create chat room' });
  }
});

app.post('/workspaces/:workspaceId/chat/users/:userId', async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;
    await chatRepo.grantUserAccessToChatRoom(workspaceId, userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to grant access' });
  }
});
```

## Architecture

### Project Structure

```
src/
├── types/              # TypeScript type definitions
│   └── index.ts
├── config/            # Configuration management
│   └── secrets.ts
├── utils/             # Utility functions
│   ├── logger.ts      # Logging utilities
│   └── jwt.ts         # JWT token utilities
├── repositories/      # Repository implementations
│   └── ChatRepositoryImpl.ts
└── index.ts           # Main entry point
```

### Key Components

1. **Types** (`src/types/`): TypeScript interfaces and type definitions
2. **Configuration** (`src/config/`): Secrets and configuration management
3. **Utilities** (`src/utils/`): 
   - Logger: Structured logging with different log levels
   - JWT: Token creation and verification utilities
4. **Repositories** (`src/repositories/`): Concrete implementations of repository interfaces

### Design Patterns

- **Repository Pattern**: Abstracts data access logic
- **Singleton Pattern**: Repository instance management
- **Dependency Injection**: Configurable dependencies
- **Factory Pattern**: Instance creation functions

## Error Handling

The SDK uses Axios for HTTP requests and throws `AxiosError` for API-related errors. Always wrap SDK calls in try-catch blocks:

```typescript
try {
  await chatRepo.createChatRoom(workspaceId);
} catch (error) {
  if (axios.isAxiosError(error)) {
    console.error('API Error:', error.response?.status, error.response?.data);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Special Error Handling

The `deleteChatRoom` method gracefully handles non-existent rooms:

```typescript
const response = await chatRepo.deleteChatRoom(workspaceId);
if (response.reason === 'Chat room not found') {
  // Room was already deleted or never existed
  console.log('Room not found, continuing...');
}
```

## Security Considerations

1. **JWT Tokens**: Never expose your `ETHORA_CHAT_APP_SECRET` in client-side code
2. **Environment Variables**: Use a secrets manager in production
3. **Token Validation**: Always validate tokens on the server side
4. **HTTPS**: Always use HTTPS in production environments

## Development

### Building

```bash
npm run build
```

### Watch Mode

```bash
npm run build:watch
```

### TypeScript Configuration

The project uses strict TypeScript settings. See `tsconfig.json` for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT

## Support

For issues and questions, please open an issue on the GitHub repository.

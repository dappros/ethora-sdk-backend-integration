<!-- @format -->

# Quick Start Guide

## Installation

```bash
cd sdk
npm install
npm run build
```

## Environment Setup

Create a `.env` file or set the following environment variables:

```bash
ETHORA_CHAT_API_URL=https://api.ethoradev.com
ETHORA_CHAT_APP_ID=your_app_id
ETHORA_CHAT_APP_SECRET=your_app_secret
ETHORA_CHAT_BOT_JID=your_bot_jid@domain.com
```

## Basic Usage

```typescript
import { getEthoraSDKService } from "./src";

const chatRepo = getEthoraSDKService();

// Create a user, username shoud start with appid then "-" or "_" and then id you want.
await chatRepo.createUser("user-123", {
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
});

// Create a chat room
await chatRepo.createChatRoom("workspace-123", {
  title: "My Chat Room",
  uuid: "workspace-123",
  type: "group",
});

// Grant user access
await chatRepo.grantUserAccessToChatRoom("workspace-123", "user-123");

// Generate client token
const token = chatRepo.createChatUserJwtToken("user-123");
```

## Running Examples

```bash
# Set environment variables first
export ETHORA_CHAT_API_URL=...
export ETHORA_CHAT_APP_ID=...
export ETHORA_CHAT_APP_SECRET=...

# Run basic example
npx ts-node examples/basic-usage.ts
```

## Publishing

To publish this SDK as an npm package:

```bash
npm run build
npm publish
```

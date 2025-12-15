/**
 * Basic usage examples for the Ethora SDK
 * 
 * This file demonstrates common use cases for the SDK.
 */

import { getEthoraSDKService } from '../src/index';

/**
 * Example: Complete workspace chat setup
 */
export async function setupWorkspaceChatExample() {
  const chatRepo = getEthoraSDKService();
  const workspaceId = '123e4567-e89b-12d3-a456-426614174000';
  const userIds = ['user-1', 'user-2', 'user-3'];

  try {
    // 1. Create chat room
    console.log('Creating chat room...');
    await chatRepo.createChatRoom(workspaceId);
    console.log('✓ Chat room created');

    // 2. Create users
    console.log('Creating users...');
    for (const userId of userIds) {
      await chatRepo.createUser(userId, {
        displayName: `User ${userId}`,
      });
      console.log(`✓ User ${userId} created`);
    }

    // 3. Grant users access
    console.log('Granting user access...');
    for (const userId of userIds) {
      await chatRepo.grantUserAccessToChatRoom(workspaceId, userId);
      console.log(`✓ Access granted to ${userId}`);
    }

    // 4. Grant chatbot access
    console.log('Granting chatbot access...');
    await chatRepo.grantChatbotAccessToChatRoom(workspaceId);
    console.log('✓ Chatbot access granted');

    return { success: true };
  } catch (error) {
    console.error('Error setting up workspace chat:', error);
    throw error;
  }
}

/**
 * Example: Generate client tokens for frontend
 */
export function generateClientTokensExample(userIds: string[]): Record<string, string> {
  const chatRepo = getEthoraSDKService();
  const tokens: Record<string, string> = {};

  for (const userId of userIds) {
    tokens[userId] = chatRepo.createChatUserJwtToken(userId);
    console.log(`Generated token for user: ${userId}`);
  }

  return tokens;
}

/**
 * Example: Cleanup workspace
 */
export async function cleanupWorkspaceExample(workspaceId: string, userIds: string[]) {
  const chatRepo = getEthoraSDKService();

  try {
    // Delete chat room (handles non-existent gracefully)
    console.log('Deleting chat room...');
    const deleteResponse = await chatRepo.deleteChatRoom(workspaceId);
    if (deleteResponse.reason === 'Chat room not found') {
      console.log('⚠ Chat room was already deleted');
    } else {
      console.log('✓ Chat room deleted');
    }

    // Delete users
    if (userIds.length > 0) {
      console.log('Deleting users...');
      await chatRepo.deleteUsers(userIds);
      console.log('✓ Users deleted');
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}

/**
 * Example: Get chat room name
 */
export function getChatRoomNameExample(workspaceId: string) {
  const chatRepo = getEthoraSDKService();

  // Full JID format
  const fullJid = chatRepo.createChatName(workspaceId, true);
  console.log('Full JID:', fullJid);
  // Output: "appId_workspaceId@conference.xmpp.ethoradev.com"

  // Short name format
  const shortName = chatRepo.createChatName(workspaceId, false);
  console.log('Short name:', shortName);
  // Output: "appId_workspaceId"

  return { fullJid, shortName };
}

// Run examples (uncomment to test)
// async function main() {
//   const workspaceId = '123e4567-e89b-12d3-a456-426614174000';
//   const userIds = ['user-1', 'user-2'];
//
//   // Setup
//   await setupWorkspaceChatExample();
//
//   // Generate tokens
//   const tokens = generateClientTokensExample(userIds);
//   console.log('Tokens:', tokens);
//
//   // Get chat room name
//   getChatRoomNameExample(workspaceId);
//
//   // Cleanup (uncomment when ready)
//   // await cleanupWorkspaceExample(workspaceId, userIds);
// }
//
// main().catch(console.error);




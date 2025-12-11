/**
 * Basic usage example for Ethora SDK
 *
 * This example demonstrates how to:
 * - Create users
 * - Create chat rooms
 * - Grant user access
 * - Generate client tokens
 */

import { getChatRepositoryImpl } from "../src";

async function main() {
  // Get repository instance
  const chatRepo = getChatRepositoryImpl();

  const workspaceId = "workspace-123";
  const userIds = ["user-1", "user-2", "user-3"];

  try {
    // Step 1: Create users
    console.log("Step 1: Creating users...");
    for (const userId of userIds) {
      await chatRepo.createUser(userId, {
        firstName: "User",
        lastName: "Name",
        email: `${userId}@example.com`,
        displayName: `User ${userId}`,
      });
      console.log(`✓ User ${userId} created`);
    }

    // Step 2: Create chat room
    console.log("\nStep 2: Creating chat room...");
    await chatRepo.createChatRoom(workspaceId, {
      title: `Workspace ${workspaceId}`,
      uuid: workspaceId,
      type: "group",
    });
    console.log(`✓ Chat room created for workspace ${workspaceId}`);

    // Step 3: Grant access to all users
    console.log("\nStep 3: Granting user access...");
    await chatRepo.grantUserAccessToChatRoom(workspaceId, userIds);
    console.log(`✓ Access granted to all users`);

    // Step 4: Generate client tokens
    console.log("\nStep 4: Generating client tokens...");
    const tokens = userIds.map((userId) => ({
      userId,
      token: chatRepo.createChatUserJwtToken(userId),
    }));
    console.log("✓ Client tokens generated");

    // Step 5: Get room JID
    const roomJid = chatRepo.createChatName(workspaceId, true);
    console.log(`\nRoom JID: ${roomJid}`);

    console.log("\n✅ Setup complete!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run example if executed directly
if (require.main === module) {
  main();
}



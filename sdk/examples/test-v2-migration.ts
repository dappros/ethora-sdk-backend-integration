/**
 * Test script for V2 migration and new users-access delete functionality
 *
 * This script demonstrates:
 * 1. Creating users (v2 endpoint)
 * 2. Creating a chat room (v2 endpoint)
 * 3. Granting access (v2 endpoint)
 * 4. Removing access (new v2 endpoint)
 * 5. Cleaning up (deleting users and chat room)
 */

import { getEthoraSDKService } from "../src";
import { randomUUID } from "crypto";
import nock from "nock";
import { getSecrets } from "../src/config/secrets";

async function main() {
  const secrets = getSecrets();
  const baseUrl = secrets.chatApiUrl;
  
  console.log(`Starting V2 Migration Test (Run ID: ${randomUUID().substring(0, 8)})`);
  console.log(`Base URL: ${baseUrl}`);
  console.log("------------------------------------------------");

  // Setup Nock Interceptors
  const scope = nock(baseUrl);

  // 1. Mock createUser (POST /v2/users/batch)
  scope
    .post("/v2/users/batch")
    .reply(200, { ok: true, users: [] });

  // 2. Mock createChatRoom (POST /v2/chats)
  scope
    .post("/v2/chats")
    .reply(200, { ok: true, room: {} });

  // 3. Mock grantUserAccessToChatRoom (POST /v2/chats/users-access)
  scope
    .post("/v2/chats/users-access")
    .reply(200, { ok: true });

  // 4. Mock removeUserAccessFromChatRoom (DELETE /v2/chats/users-access)
  scope
    .delete("/v2/chats/users-access")
    .reply(200, { ok: true });

  // 5. Mock updateUsers (PATCH /v2/chats/users)
  scope
    .patch("/v2/chats/users")
    .reply(200, { ok: true, results: [] });

  // 6. Mock getUsers (GET /v2/chats/users)
  scope
    .get("/v2/chats/users")
    .query(true) // match any query params
    .reply(200, { ok: true, users: [] });

  // 7. Mock deleteChatRoom (DELETE /v1/chats)
  scope
    .delete("/v1/chats")
    .reply(200, { ok: true });

  scope
    .delete("/v1/users/batch")
    .reply(200, { ok: true });

  const chatRepo = getEthoraSDKService();
  const runId = randomUUID().substring(0, 8);
  const chatId = `test-group-${runId}`;
  const userId = `test-user-${runId}`;
  
  console.log(`Starting V2 Migration Test (Run ID: ${runId})`);
  console.log("------------------------------------------------");

  try {
    // 1. Create User (V2)
    console.log(`\n1. Testing createUser (V2)...`);
    const userResult = await chatRepo.createUser(userId, {
      firstName: "Test",
      lastName: "User",
      email: `${userId}@example.com`,
      displayName: `Test User ${runId}`
    });
    console.log(`✓ createUser result:`, JSON.stringify(userResult, null, 2));

    // 2. Create Chat Room (V2)
    console.log(`\n2. Testing createChatRoom (V2)...`);
    const roomResult = await chatRepo.createChatRoom(chatId, {
      title: `Test Room ${runId}`,
      uuid: chatId,
      type: "group"
    });
    console.log(`✓ createChatRoom result:`, JSON.stringify(roomResult, null, 2));

    // 3. Grant Access (V2)
    console.log(`\n3. Testing grantUserAccessToChatRoom (V2)...`);
    const grantResult = await chatRepo.grantUserAccessToChatRoom(chatId, userId);
    console.log(`✓ grantUserAccessToChatRoom result:`, JSON.stringify(grantResult, null, 2));

    // 4. Remove Access (New V2 DELETE)
    console.log(`\n4. Testing removeUserAccessFromChatRoom (V2 DELETE)...`);
    const revokeResult = await chatRepo.removeUserAccessFromChatRoom(chatId, userId);
    console.log(`✓ removeUserAccessFromChatRoom result:`, JSON.stringify(revokeResult, null, 2));

    // 5. Update Users (V2 PATCH)
    console.log(`\n5. Testing updateUsers (V2 PATCH)...`);
    const updateResult = await chatRepo.updateUsers([{
      userId: userId,
      firstName: "Updated",
      lastName: "User"
    }]);
    console.log(`✓ updateUsers result:`, JSON.stringify(updateResult, null, 2));

    // 6. Get Users (V2 GET)
    console.log(`\n6. Testing getUsers (V2 GET)...`);
    const fnResult = await chatRepo.getUsers({ chatName: chatId });
    console.log(`✓ getUsers result:`, JSON.stringify(fnResult, null, 2));

    // 7. Cleanup (V1)
    console.log(`\n7. Cleanup (V1)...`);
    
    // Delete Chat Room
    console.log(`- Deleting chat room...`);
    await chatRepo.deleteChatRoom(chatId);
    console.log(`✓ Chat room deleted`);

    // Delete User
    console.log(`- Deleting user...`);
    await chatRepo.deleteUsers([userId]);
    console.log(`✓ User deleted`);

    console.log("\n✅ Test execution completed successfully!");
    console.log("\nPending mocks (should be empty):", scope.pendingMocks());

  } catch (error) {
    console.error("❌ Error running test:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

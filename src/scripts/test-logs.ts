import 'dotenv/config';
import { randomUUID } from 'crypto';
import { getEthoraSDKService, getSecrets } from '../index';
import type { ApiResponse } from '../types';

type StepResult = {
  name: string;
  response: ApiResponse;
};

function logHeader(message: string): void {
  console.log(`\n=== ${message} ===`);
}

function logStepResult(result: StepResult): void {
  console.log(`${result.name} -> ${JSON.stringify(result.response, null, 2)}`);
}

function assertResponseOk(result: StepResult): void {
  if (typeof result.response.ok === 'boolean' && !result.response.ok) {
    throw new Error(`${result.name} returned ok=false`);
  }
}

async function main(): Promise<void> {
  const runId = randomUUID().substring(0, 8);
  const chatId = `test-room-${runId}`;
  const userId = `test-user-${runId}`;

  const secrets = getSecrets();
  const xmppUsername = `${secrets.chatAppId}_${userId}`;

  const chatRepo = getEthoraSDKService();

  logHeader(`Ethora Requests Test (runId: ${runId})`);
  console.log(`Base URL: ${secrets.chatApiUrl}`);
  console.log(`Chat ID: ${chatId}`);
  console.log(`User ID: ${userId}`);
  console.log(`XMPP Username: ${xmppUsername}`);

  const results: StepResult[] = [];

  // 1. Create user
  logHeader('1. createUser');
  const createUserResult = await chatRepo.createUser(userId, {
    firstName: 'Test',
    lastName: 'User',
    email: `${userId}@example.com`,
    displayName: `Test User ${runId}`,
  });
  results.push({ name: 'createUser', response: createUserResult });
  logStepResult(results[results.length - 1]);
  assertResponseOk(results[results.length - 1]);

  // 2. Create room
  logHeader('2. createChatRoom');
  const createRoomResult = await chatRepo.createChatRoom(chatId, {
    title: `Test Room ${runId}`,
    uuid: chatId,
    type: 'group',
  });
  results.push({ name: 'createChatRoom', response: createRoomResult });
  logStepResult(results[results.length - 1]);
  assertResponseOk(results[results.length - 1]);

  // 3. Add user to room
  logHeader('3. grantUserAccessToChatRoom');
  const grantResult = await chatRepo.grantUserAccessToChatRoom(chatId, userId);
  results.push({ name: 'grantUserAccessToChatRoom', response: grantResult });
  logStepResult(results[results.length - 1]);
  assertResponseOk(results[results.length - 1]);

  // 4. Remove user from room
  logHeader('4. removeUserAccessFromChatRoom');
  const removeResult = await chatRepo.removeUserAccessFromChatRoom(
    chatId,
    userId,
  );
  results.push({ name: 'removeUserAccessFromChatRoom', response: removeResult });
  logStepResult(results[results.length - 1]);
  assertResponseOk(results[results.length - 1]);

  // 5. Delete room
  logHeader('5. deleteChatRoom');
  const deleteRoomResult = await chatRepo.deleteChatRoom(chatId);
  results.push({ name: 'deleteChatRoom', response: deleteRoomResult });
  logStepResult(results[results.length - 1]);
  assertResponseOk(results[results.length - 1]);

  // 6. Get user
  logHeader('6. getUsers (by xmppUsername)');
  const getUserResult = await chatRepo.getUsers({ xmppUsername });
  results.push({ name: 'getUsers(xmppUsername)', response: getUserResult });
  logStepResult(results[results.length - 1]);
  assertResponseOk(results[results.length - 1]);

  // 7. Get users
  logHeader('7. getUsers (all)');
  const getUsersResult = await chatRepo.getUsers();
  results.push({ name: 'getUsers(all)', response: getUsersResult });
  logStepResult(results[results.length - 1]);
  assertResponseOk(results[results.length - 1]);

  // 8. Delete user
  logHeader('8. deleteUsers');
  const deleteUserResult = await chatRepo.deleteUsers([userId]);
  results.push({ name: 'deleteUsers', response: deleteUserResult });
  logStepResult(results[results.length - 1]);
  assertResponseOk(results[results.length - 1]);

  logHeader('Done');
  console.log('All requests completed in sequence.');
}

main().catch((error) => {
  console.error(`\n❌ Test run failed: ${error.message || error}`);
  process.exit(1);
});

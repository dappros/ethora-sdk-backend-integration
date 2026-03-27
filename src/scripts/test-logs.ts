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

async function runStep(
  name: string,
  request: () => Promise<ApiResponse>,
  results: StepResult[],
): Promise<ApiResponse> {
  logHeader(name);
  const response = await request();
  const result = { name, response };
  results.push(result);
  logStepResult(result);
  assertResponseOk(result);
  return response;
}

async function runReadOnlyChecks(results: StepResult[]): Promise<void> {
  const secrets = getSecrets();
  const chatRepo = getEthoraSDKService();

  await runStep('GET /v2/apps', () => chatRepo.listApps({ limit: 5, offset: 0 }), results);
  await runStep(`GET /v2/apps/${secrets.chatAppId}`, () => chatRepo.getApp(secrets.chatAppId), results);
  await runStep(
    `GET /v2/apps/${secrets.chatAppId}/tokens`,
    () => chatRepo.listAppTokens(secrets.chatAppId),
    results,
  );
  await runStep(
    `GET /v2/apps/${secrets.chatAppId}/bot`,
    () => chatRepo.getAppBot(secrets.chatAppId),
    results,
  );
  await runStep(
    `GET /v2/apps/${secrets.chatAppId}/chats`,
    () => chatRepo.listChatsInApp(secrets.chatAppId, { limit: 5, offset: 0, includeMembers: false }),
    results,
  );
  await runStep('GET /v2/chats/users', () => chatRepo.getUsers({ limit: 5, offset: 0 }), results);
}

async function runFullCycle(results: StepResult[]): Promise<void> {
  const secrets = getSecrets();
  const chatRepo = getEthoraSDKService();
  const runId = randomUUID().substring(0, 8);
  const appUserId = `sdk-user-${runId}`;
  const chatId = `sdk-chat-${runId}`;
  const targetAppId = secrets.chatAppId;
  const xmppUsername = `${targetAppId}_${appUserId}`;

  try {
    await runStep(
      `POST /v2/apps/${targetAppId}/users/batch`,
      () =>
        chatRepo.createUsersInApp(targetAppId, {
          bypassEmailConfirmation: true,
          usersList: [
            {
              email: `${appUserId}@example.com`,
              firstName: 'SDK',
              lastName: 'User',
              uuid: appUserId,
            },
          ],
        }),
      results,
    );

    await runStep(
      `POST /v2/apps/${targetAppId}/chats`,
      () =>
        chatRepo.createChatRoomInApp(targetAppId, chatId, {
          title: `SDK Room ${runId}`,
          type: 'group',
        }),
      results,
    );

    await runStep(
      `POST /v2/apps/${targetAppId}/chats/users-access`,
      () => chatRepo.grantUserAccessToChatRoomInApp(targetAppId, chatId, appUserId),
      results,
    );

    await runStep(
      'PATCH /v2/chats/users',
      () =>
        chatRepo.updateUsers([
          {
            xmppUsername,
            firstName: 'SDK',
            lastName: `Updated${runId}`,
          },
        ]),
      results,
    );

    await runStep(
      `GET /v2/apps/${targetAppId}/users/${appUserId}/chats`,
      () => chatRepo.getUserChats(appUserId, { limit: 5, offset: 0, includeMembers: true }),
      results,
    );

    await runStep(
      `PATCH /v2/apps/${targetAppId}/chats/{chatId}`,
      () => chatRepo.updateChatRoomInApp(targetAppId, chatId, { title: `SDK Updated ${runId}` }),
      results,
    );

    await runStep(
      `DELETE /v2/apps/${targetAppId}/chats/users-access`,
      () => chatRepo.removeUserAccessFromChatRoomInApp(targetAppId, chatId, appUserId),
      results,
    );

    await runStep(
      `DELETE /v2/apps/${targetAppId}/users/batch`,
      () => chatRepo.deleteUsersInApp(targetAppId, [appUserId]),
      results,
    );

    await runStep(
      `DELETE /v2/apps/${targetAppId}/chats`,
      () => chatRepo.deleteChatRoomInApp(targetAppId, chatId),
      results,
    );
  } catch (error) {
    console.error('Full-cycle mode failed before cleanup completion:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  const fullCycle =
    String(process.env.ETHORA_TEST_LOGS_FULL_CYCLE || '').toLowerCase() === 'true';

  const secrets = getSecrets();
  const runId = randomUUID().substring(0, 8);

  logHeader(`Ethora B2B Requests Test (runId: ${runId})`);
  console.log(`Base URL: ${secrets.chatApiUrl}`);
  console.log(`App ID: ${secrets.chatAppId}`);
  console.log(`Mode: ${fullCycle ? 'full-cycle' : 'read-only'}`);

  const results: StepResult[] = [];

  await runReadOnlyChecks(results);

  if (fullCycle) {
    await runFullCycle(results);
  }

  logHeader('Done');
  console.log(`All requests completed (${results.length} steps).`);
}

main().catch((error) => {
  console.error(`\n❌ Test run failed: ${error.message || error}`);
  process.exit(1);
});

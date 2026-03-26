import { getEthoraSDKService } from '../src/index';

async function run() {
  const sdk = getEthoraSDKService();

  const app = await sdk.createApp({
    displayName: `SDK Tenant Demo ${Date.now()}`,
  });

  const createdAppId =
    String((app as any)?.app?._id || (app as any)?.result?._id || (app as any)?._id || '');
  if (!createdAppId) {
    throw new Error(`Missing app id in response: ${JSON.stringify(app, null, 2)}`);
  }

  const chatId = `workspace-${Date.now()}`;
  const userA = `user-a-${Date.now()}`;
  const userB = `user-b-${Date.now()}`;

  try {
    const batch = await sdk.createUsersInApp(createdAppId, {
      bypassEmailConfirmation: true,
      usersList: [
        { uuid: userA, email: `${userA}@example.com`, firstName: 'User', lastName: 'Alpha', password: 'Pass-Alpha-123' },
        { uuid: userB, email: `${userB}@example.com`, firstName: 'User', lastName: 'Beta', password: 'Pass-Beta-123' },
      ],
    });
    console.log('createUsersInApp =>', batch);

    await sdk.createChatRoomInApp(createdAppId, chatId, {
      title: 'Tenant-admin room',
      uuid: chatId,
      type: 'public',
    });

    await sdk.grantUserAccessToChatRoomInApp(createdAppId, chatId, [userA, userB]);
    await sdk.updateChatRoomInApp(createdAppId, chatId, { title: 'Tenant-admin room updated' });
    console.log('App-scoped B2B flow completed');
  } finally {
    await sdk.removeUserAccessFromChatRoomInApp(createdAppId, chatId, [userA, userB]).catch(() => {});
    await sdk.deleteChatRoomInApp(createdAppId, chatId).catch(() => {});
    await sdk.deleteUsersInApp(createdAppId, [userA, userB]).catch(() => {});
    await sdk.deleteApp(createdAppId).catch(() => {});
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

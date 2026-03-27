/** @format */

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ETHORA_CHAT_API_URL = 'https://api.messenger-dev.vitall.com';
process.env.ETHORA_CHAT_APP_ID = 'app123';
process.env.ETHORA_CHAT_APP_SECRET = 'secret123';

const { EthoraSDKService } = require('../dist/repositories/EthoraSDKService');

function okResponse(data = { ok: true }) {
  return Promise.resolve({ data });
}

function axiosError(status, data) {
  const error = new Error(`HTTP ${status}`);
  error.isAxiosError = true;
  error.response = { status, data };
  return error;
}

test('createChatName returns short and full chat names', () => {
  const service = new EthoraSDKService();

  const shortName = service.createChatName('room-1', false);
  const fullName = service.createChatName('room-1', true);

  assert.equal(shortName, 'app123_room-1');
  assert.equal(fullName, 'app123_room-1@conference.xmpp.ethoradev.com');
});

test('createUser sends v2 request and keeps uuid as provided', async () => {
  const service = new EthoraSDKService();
  let captured;

  service.httpClient.request = async (config) => {
    captured = config;
    return okResponse({ ok: true });
  };

  await service.createUser('user-1', {
    firstName: 'A',
    lastName: 'B',
    role: 'admin',
  });

  assert.equal(captured.method, 'POST');
  assert.equal(
    captured.url,
    'https://api.messenger-dev.vitall.com/v2/users/batch',
  );
  assert.equal(captured.data.usersList[0].uuid, 'user-1');
  assert.equal(captured.data.usersList[0].lastName, 'User');
  assert.equal(captured.data.usersList[0].role, undefined);
});

test('all requests include Authorization Bearer and x-custom-token headers', async () => {
  const service = new EthoraSDKService();
  let captured;

  service.httpClient.request = async (config) => {
    captured = config;
    return okResponse();
  };

  await service.getUsers();

  assert.equal(typeof captured.headers.Authorization, 'string');
  assert.equal(captured.headers.Authorization.startsWith('Bearer '), true);
  assert.equal(typeof captured.headers['x-custom-token'], 'string');
  assert.ok(captured.headers['x-custom-token'].length > 10);
});

test('grantUserAccessToChatRoom normalizes raw and prefixed members', async () => {
  const service = new EthoraSDKService();
  const captures = [];

  service.httpClient.request = async (config) => {
    captures.push(config);
    return okResponse();
  };

  await service.grantUserAccessToChatRoom('room-3', 'u1');
  await service.grantUserAccessToChatRoom('room-3', ['u1', 'app123_u2']);

  assert.equal(
    captures[0].url,
    'https://api.messenger-dev.vitall.com/v2/chats/users-access',
  );
  assert.deepEqual(captures[0].data.members, ['app123_u1']);
  assert.equal(captures[0].data.chatName, 'app123_room-3');

  assert.deepEqual(captures[1].data.members, ['app123_u1', 'app123_u2']);
});

test('removeUserAccessFromChatRoom uses v2 users-access endpoint', async () => {
  const service = new EthoraSDKService();
  let captured;

  service.httpClient.request = async (config) => {
    captured = config;
    return okResponse();
  };

  await service.removeUserAccessFromChatRoom('room-5', ['u1', 'app123_u2']);

  assert.equal(captured.method, 'DELETE');
  assert.equal(
    captured.url,
    'https://api.messenger-dev.vitall.com/v2/chats/users-access',
  );
  assert.deepEqual(captured.data.members, ['app123_u1', 'app123_u2']);
});

test('deleteUsers uses v1 endpoint and handles not-found 422 gracefully', async () => {
  const service = new EthoraSDKService();

  service.httpClient.request = async (config) => {
    assert.equal(
      config.url,
      'https://api.messenger-dev.vitall.com/v1/users/batch',
    );
    assert.deepEqual(config.data, { usersIdList: ['u1'] });
    throw axiosError(422, 'User not found');
  };

  const result = await service.deleteUsers(['u1']);
  assert.deepEqual(result, { ok: false });
});

test('deleteChatRoom uses v1 endpoint and handles not-found 422 gracefully', async () => {
  const service = new EthoraSDKService();

  service.httpClient.request = async (config) => {
    assert.equal(config.url, 'https://api.messenger-dev.vitall.com/v1/chats');
    assert.equal(config.method, 'DELETE');
    assert.deepEqual(config.data, { name: 'app123_room-7' });
    throw axiosError(422, 'Room not found');
  };

  const result = await service.deleteChatRoom('room-7');
  assert.deepEqual(result, { ok: false, reason: 'Chat room not found' });
});

test('updateUsers validates limits and filters unsupported fields', async () => {
  const service = new EthoraSDKService();
  let captured;

  service.httpClient.request = async (config) => {
    captured = config;
    return okResponse();
  };

  await assert.rejects(() => service.updateUsers([]), /At least 1 user/);
  await assert.rejects(
    () =>
      service.updateUsers(
        Array.from({ length: 101 }, () => ({ xmppUsername: 'x' })),
      ),
    /Maximum 100 users/,
  );

  await service.updateUsers([
    {
      userId: 'u1',
      xmppUsername: 'app123_u1',
      firstName: 'John',
      lastName: 'Doe',
      profileImage: 'https://cdn/p.png',
      email: 'drop-this@example.com',
      roles: ['admin'],
    },
  ]);

  assert.equal(captured.method, 'PATCH');
  assert.equal(
    captured.url,
    'https://api.messenger-dev.vitall.com/v2/chats/users',
  );
  assert.deepEqual(captured.data.users, [
    {
      xmppUsername: 'app123_u1',
      firstName: 'John',
      lastName: 'Doe',
      profileImage: 'https://cdn/p.png',
    },
  ]);
});

test('getUsers builds correct v2 query params for no/partial/full/encoded variants', async () => {
  const service = new EthoraSDKService();
  const urls = [];

  service.httpClient.request = async (config) => {
    urls.push(config.url);
    return okResponse({ ok: true });
  };

  await service.getUsers();
  await service.getUsers({ chatName: 'app123_room-8' });
  await service.getUsers({ xmppUsername: 'app123_u8' });
  await service.getUsers({ chatName: 'a b', xmppUsername: 'u+1' });
  await service.getUsers({
    chatName: 'app123_room-9',
    xmppUsername: 'app123_u9',
    userId: 'mongo-id-9',
    limit: 25,
    offset: 50,
  });

  assert.equal(urls[0], 'https://api.messenger-dev.vitall.com/v2/chats/users');
  assert.equal(
    urls[1],
    'https://api.messenger-dev.vitall.com/v2/chats/users?chatName=app123_room-8',
  );
  assert.equal(
    urls[2],
    'https://api.messenger-dev.vitall.com/v2/chats/users?xmppUsername=app123_u8',
  );
  assert.equal(
    urls[3],
    'https://api.messenger-dev.vitall.com/v2/chats/users?chatName=a%20b&xmppUsername=u%2B1',
  );
  assert.equal(
    urls[4],
    'https://api.messenger-dev.vitall.com/v2/chats/users?chatName=app123_room-9&xmppUsername=app123_u9&userId=mongo-id-9&limit=25&offset=50',
  );
});

test('getUserChats constructs correct v2 URL for user chats', async () => {
  const service = new EthoraSDKService();
  const urls = [];

  service.httpClient.request = async (config) => {
    urls.push(config.url);
    return okResponse({ ok: true });
  };

  await service.getUserChats('u1');
  await service.getUserChats('u2', {
    limit: 10,
    offset: 5,
    includeMembers: true,
  });

  assert.equal(
    urls[0],
    'https://api.messenger-dev.vitall.com/v2/apps/app123/users/u1/chats',
  );
  assert.equal(
    urls[1],
    'https://api.messenger-dev.vitall.com/v2/apps/app123/users/u2/chats?limit=10&offset=5&includeMembers=true',
  );
});

test('updateChatRoom constructs correct v2 URL and payload', async () => {
  const service = new EthoraSDKService();
  const captures = [];

  service.httpClient.request = async (config) => {
    captures.push(config);
    return okResponse({ ok: true });
  };

  await service.updateChatRoom('room-1', { title: 'New Room 1' });
  await service.updateChatRoom('app123_room-2', { description: 'Desc 2' });
  await service.updateChatRoom('app123_room-3@conference.domain.com', {
    title: 'New Room 3',
  });

  assert.equal(captures[0].method, 'PATCH');
  assert.equal(
    captures[0].url,
    'https://api.messenger-dev.vitall.com/v2/apps/app123/chats/app123_room-1',
  );
  assert.deepEqual(captures[0].data, { title: 'New Room 1' });

  assert.equal(
    captures[1].url,
    'https://api.messenger-dev.vitall.com/v2/apps/app123/chats/app123_room-2',
  );

  assert.equal(
    captures[2].url,
    'https://api.messenger-dev.vitall.com/v2/apps/app123/chats/app123_room-3@conference.domain.com',
  );
});

test('app-level endpoints cover no/partial/full query and payload variants', async () => {
  const service = new EthoraSDKService();
  const calls = [];

  service.httpClient.request = async (config) => {
    calls.push(config);
    return okResponse({ ok: true });
  };

  await service.listApps();
  await service.listApps({ limit: 10 });
  await service.listApps({ limit: 10, offset: 5, order: 'desc', orderBy: 'createdAt' });
  await service.getApp('app-1');

  await service.listAppTokens('app-1');
  await service.createAppToken('app-1');
  await service.createAppToken('app-1', { label: 'Primary token' });
  await service.revokeAppToken('app-1', 'token-1');
  await service.rotateAppToken('app-1', 'token-1');
  await service.rotateAppToken('app-1', 'token-1', { label: 'Rotated' });

  await service.provisionApp('app-1');
  await service.provisionApp('app-1', { rooms: [{ title: 'General', pinned: true }] });

  await service.getAppBot('app-1');
  await service.getAppBroadcastJob('app-1', 'job-1');

  await service.getAppUserByXmppUsername('app-1_user+1@example');

  await service.createUsersInApp('app-1', {
    usersList: [
      {
        email: 'u1@example.com',
        firstName: 'U',
        lastName: 'One',
      },
    ],
  });
  await service.getUsersBatchJob('app-1', 'job-2');
  await service.deleteUsersInApp('app-1', ['u1', 'u2']);

  await service.listChatsInApp('app-1');
  await service.listChatsInApp('app-1', { limit: 20, offset: 10, includeMembers: true });
  await service.createChatRoomInApp('app-1', 'room-1', { title: 'Room 1' });
  await service.deleteChatRoomInApp('app-1', 'room-1');

  await service.grantUserAccessToChatRoomInApp('app-1', 'room-1', 'u1');
  await service.grantUserAccessToChatRoomInApp('app-1', 'app-1_room-1', ['u1', 'app-1_u2']);
  await service.removeUserAccessFromChatRoomInApp('app-1', 'room-1', ['u1', 'app-1_u2']);

  await service.getUserChatsInApp('app-1', 'u1', { limit: 5, offset: 1, includeMembers: false });
  await service.updateChatRoomInApp('app-1', 'room-1', { title: 'Updated' });

  assert.equal(calls[0].url, 'https://api.messenger-dev.vitall.com/v2/apps');
  assert.equal(calls[1].url, 'https://api.messenger-dev.vitall.com/v2/apps?limit=10');
  assert.equal(
    calls[2].url,
    'https://api.messenger-dev.vitall.com/v2/apps?limit=10&offset=5&order=desc&orderBy=createdAt',
  );

  assert.equal(calls.find((c) => c.url.includes('/tokens') && c.method === 'POST').data.label, undefined);
  assert.equal(
    calls.find((c) => c.url.endsWith('/tokens') && c.method === 'POST' && c.data.label === 'Primary token').data.label,
    'Primary token',
  );

  const encodedLookup = calls.find((c) => c.url.includes('/v1/apps/users/'));
  assert.equal(
    encodedLookup.url,
    'https://api.messenger-dev.vitall.com/v1/apps/users/app-1_user%2B1%40example',
  );

  const listChatsFull = calls.find(
    (c) =>
      c.method === 'GET' &&
      c.url ===
        'https://api.messenger-dev.vitall.com/v2/apps/app-1/chats?limit=20&offset=10&includeMembers=true',
  );
  assert.ok(listChatsFull);

  const grantInApp = calls.find(
    (c) =>
      c.method === 'POST' &&
      c.url === 'https://api.messenger-dev.vitall.com/v2/apps/app-1/chats/users-access' &&
      c.data.chatName === 'app-1_room-1' &&
      c.data.members.length === 1,
  );
  assert.deepEqual(grantInApp.data.members, ['app-1_u1']);

  const grantInAppPrefixed = calls.find(
    (c) =>
      c.method === 'POST' &&
      c.url === 'https://api.messenger-dev.vitall.com/v2/apps/app-1/chats/users-access' &&
      c.data.members.length === 2,
  );
  assert.deepEqual(grantInAppPrefixed.data.members, ['app-1_u1', 'app-1_u2']);
});

test('grantChatbotAccessToChatRoom is removed from public service API', () => {
  const service = new EthoraSDKService();
  assert.equal(typeof service.grantChatbotAccessToChatRoom, 'undefined');
});

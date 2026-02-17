/** @format */

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ETHORA_CHAT_API_URL = 'https://api.messenger-dev.vitall.com';
process.env.ETHORA_CHAT_APP_ID = 'app123';
process.env.ETHORA_CHAT_APP_SECRET = 'secret123';
process.env.ETHORA_CHAT_BOT_JID = 'chatbot@xmpp.ethoradev.com';

const { EthoraSDKService } = require('../dist/repositories/EthoraSDKService');

function okResponse(data = { ok: true }) {
  return Promise.resolve({ data });
}

function axiosError(status, data) {
  return {
    isAxiosError: true,
    response: {
      status,
      data,
    },
  };
}

test('createChatName returns short and full chat names', () => {
  const service = new EthoraSDKService();

  const shortName = service.createChatName('room-1', false);
  const fullName = service.createChatName('room-1', true);

  assert.equal(shortName, 'app123_room-1');
  assert.equal(fullName, 'app123_room-1@conference.xmpp.ethoradev.com');
});

test('createUser sends v2 request and prefixes user uuid with appId', async () => {
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
  assert.equal(captured.data.usersList[0].uuid, 'app123_user-1');
  assert.equal(captured.data.usersList[0].lastName, 'User');
  assert.equal(captured.data.usersList[0].role, undefined);
});

test('createChatRoom sends v2 payload', async () => {
  const service = new EthoraSDKService();
  let captured;

  service.httpClient.request = async (config) => {
    captured = config;
    return okResponse();
  };

  await service.createChatRoom('room-2', { title: 'Room 2', type: 'group' });

  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, 'https://api.messenger-dev.vitall.com/v2/chats');
  assert.equal(captured.data.uuid, 'room-2');
  assert.equal(captured.data.title, 'Room 2');
});

test('grantUserAccessToChatRoom sends prefixed members to v2 endpoint', async () => {
  const service = new EthoraSDKService();
  let captured;

  service.httpClient.request = async (config) => {
    captured = config;
    return okResponse();
  };

  await service.grantUserAccessToChatRoom('room-3', ['u1', 'app123_u2']);

  assert.equal(captured.method, 'POST');
  assert.equal(
    captured.url,
    'https://api.messenger-dev.vitall.com/v2/chats/users-access',
  );
  assert.deepEqual(captured.data.members, ['app123_u1', 'app123_u2']);
  assert.equal(captured.data.chatName, 'app123_room-3');
});

test('grantChatbotAccessToChatRoom uses chatbot jid username', async () => {
  const service = new EthoraSDKService();
  let captured;

  service.httpClient.request = async (config) => {
    captured = config;
    return okResponse();
  };

  await service.grantChatbotAccessToChatRoom('room-4');

  assert.equal(captured.method, 'POST');
  assert.equal(
    captured.url,
    'https://api.messenger-dev.vitall.com/v2/chats/users-access',
  );
  assert.deepEqual(captured.data.members, ['app123_chatbot']);
});

test('grantChatbotAccessToChatRoom throws if chatbot jid is not configured', async () => {
  const service = new EthoraSDKService();
  service.secrets.chatBotJid = undefined;

  await assert.rejects(
    () => service.grantChatbotAccessToChatRoom('room-4'),
    /Chatbot JID not configured/,
  );
});

test('removeUserAccessFromChatRoom uses primary v2 usersAccess/remove endpoint', async () => {
  const service = new EthoraSDKService();
  let captured;

  service.httpClient.request = async (config) => {
    captured = config;
    return okResponse();
  };

  await service.removeUserAccessFromChatRoom('room-5', 'u1');

  assert.equal(captured.method, 'DELETE');
  assert.equal(
    captured.url,
    'https://api.messenger-dev.vitall.com/v2/chats/usersAccess/remove',
  );
  assert.deepEqual(captured.data.members, ['app123_u1']);
});

test('removeUserAccessFromChatRoom falls back to legacy endpoint on 404/405', async () => {
  const service = new EthoraSDKService();
  const calls = [];

  service.httpClient.request = async (config) => {
    calls.push(config);

    if (calls.length === 1) {
      throw axiosError(404, { ok: false });
    }

    return okResponse({ ok: true, fallback: true });
  };

  const result = await service.removeUserAccessFromChatRoom('room-6', 'u2');

  assert.equal(calls.length, 2);
  assert.equal(
    calls[0].url,
    'https://api.messenger-dev.vitall.com/v2/chats/usersAccess/remove',
  );
  assert.equal(
    calls[1].url,
    'https://api.messenger-dev.vitall.com/v2/chats/users-access',
  );
  assert.deepEqual(result, { ok: true, fallback: true });
});

test('deleteUsers uses v1 endpoint and handles not-found 422 gracefully', async () => {
  const service = new EthoraSDKService();
  let callCount = 0;

  service.httpClient.request = async (config) => {
    callCount += 1;

    if (callCount === 1) {
      assert.equal(
        config.url,
        'https://api.messenger-dev.vitall.com/v1/users/batch',
      );
      assert.deepEqual(config.data, { usersIdList: ['app123_u1'] });
      throw axiosError(422, 'User not found');
    }

    return okResponse();
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

test('getUsers builds correct v2 query params', async () => {
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
});

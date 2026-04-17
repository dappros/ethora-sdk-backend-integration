/**
 * Concrete implementation of the ChatRepository using the Ethora API
 *
 * This class handles chat operations in the Ethora chat service. It manages
 * JWT authentication tokens for server-to-server communication and uses
 * HTTP clients to make asynchronous API calls.
 *
 * @format
 */

import { randomUUID } from 'crypto';
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import type {
  UUID,
  ChatRepository,
  ApiResponse,
  CreateChatRoomRequest,
  DeleteChatRoomRequest,
  GrantAccessRequest,
  UpdateUserData,
  UpdateUsersRequest,
  GetUsersQueryParams,
  GetUserChatsQueryParams,
  CreateAppRequest,
  ListAppsQueryParams,
  BatchCreateUsersRequest,
  CreateAppTokenRequest,
  RotateAppTokenRequest,
  ProvisionAppRequest,
  UpdateAppBotRequest,
  CreateAppBroadcastRequest,
  ListAppChatsQueryParams,
} from '../types';
import {
  getSecrets,
  Secrets,
  DEFAULT_TIMEOUT,
  ETHORA_JID_DOMAIN,
} from '../config/secrets';
import { createServerToken, createClientToken } from '../utils/jwt';
import { getLogger } from '../utils/logger';

const logger = getLogger('EthoraSDKService');

/**
 * EthoraSDKService - Concrete implementation of ChatRepository
 */
export class EthoraSDKService implements ChatRepository {
  private readonly baseEthoraUrl: string;
  private readonly secrets: Secrets;
  private readonly httpClient: AxiosInstance;

  constructor(config?: { chatAppId?: string; chatAppSecret?: string }) {
    this.secrets = getSecrets(config);
    this.baseEthoraUrl = this.secrets.chatApiUrl;

    // Create axios instance with default configuration
    this.httpClient = axios.create({
      timeout: DEFAULT_TIMEOUT.total,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.debug('EthoraSDKService instance initialized');
  }

  /**
   * Generates a fully-qualified chat room JID from a chat ID
   *
   * The JID is constructed in the format `<appId>_<chat_id>@conference.xmpp.chat.ethora.com`.
   * This method uses a static JID domain to provide a unique identifier for a chat room.
   *
   * @param chatId - The unique identifier of the chat
   * @param full - Whether to include the full JID domain
   * @returns The fully-qualified JID string for the chat room
   */
  createChatName(chatId: UUID, full: boolean = true): string {
    logger.debug(`Creating chat room name (JID) for chat ID: ${chatId}`);

    const chatName = full
      ? `${this.secrets.chatAppId}_${chatId}${ETHORA_JID_DOMAIN}`
      : `${this.secrets.chatAppId}_${chatId}`;

    logger.info(`Chat room name created: '${chatName}'`);
    return chatName;
  }

  /**
   * Creates a client-side JWT token for a specific user ID
   *
   * This method generates a JWT token for a user that can be used for client-side
   * authentication with the chat service. The token payload includes the
   * user's ID and the app ID.
   *
   * @param userId - The unique identifier of the user
   * @returns The encoded JWT token for client-side authentication
   */
  createChatUserJwtToken(userId: UUID): string {
    logger.debug(`Creating a client-side JWT token for user ID: ${userId}`);
    return createClientToken(userId, this.secrets);
  }

  /**
   * Creates the necessary headers for an API call with a JWT token
   *
   * @returns The headers dictionary containing the `x-custom-token` field
   */
  private getHeaders(): Record<string, string> {
    logger.debug('Retrieving headers for a server-to-server API call');
    const serverToken = createServerToken(this.secrets);
    return {
      Authorization: `Bearer ${serverToken}`,
      'x-custom-token': serverToken,
    };
  }

  private createScopedChatName(appId: UUID, chatId: UUID): string {
    const appIdStr = String(appId);
    const chatIdStr = String(chatId);
    if (chatIdStr.includes('@') || chatIdStr.startsWith(`${appIdStr}_`)) {
      return chatIdStr;
    }
    return `${appIdStr}_${chatIdStr}`;
  }

  private createScopedMembers(appId: UUID, userId: UUID | UUID[]): string[] {
    const appIdStr = String(appId);
    const normalize = (value: UUID) => {
      const userIdStr = String(value);
      return userIdStr.startsWith(`${appIdStr}_`) ? userIdStr : `${appIdStr}_${userIdStr}`;
    };
    return Array.isArray(userId) ? userId.map(normalize) : [normalize(userId)];
  }

  private buildQueryString(params?: object): string {
    if (!params) {
      return '';
    }

    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) {
        continue;
      }
      query.set(key, String(value));
    }

    const encoded = query.toString();
    return encoded ? `?${encoded}` : '';
  }

  /**
   * Makes an HTTP request with error handling
   *
   * @param config - Axios request configuration
   * @returns The API response
   */
  private async makeRequest<T = ApiResponse>(
    config: AxiosRequestConfig,
  ): Promise<T> {
    const headers: Record<string, any> = {
      ...this.getHeaders(),
      ...config.headers,
    };
    const token = headers['x-custom-token'];
    const method = config.method?.toUpperCase() || 'UNKNOWN';
    const url = config.url || '';

    try {
      const response = await this.httpClient.request<T>({
        ...config,
        headers,
        timeout: DEFAULT_TIMEOUT.total,
      });

      logger.debug(`✅ [${method}] ${url} success. Token: ${token}`);
      
      // Return data with URL attached for observability
      const data = response.data;
      if (data && typeof data === 'object') {
        (data as any).url = url;
      }
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status || 'No Status';
        const resData = axiosError.response?.data;
        const formattedRes = JSON.stringify(resData, null, 2);

        const prettyMessage = 
          `❌ [${method}] ${url} failed with status ${status}.\n` +
          `Token: ${token}\n` +
          `Response: ${formattedRes}`;

        logger.error(prettyMessage);
        
        // Wrap in a new error with the pretty message so the consumer see it too
        const enhancedError = new Error(prettyMessage);
        (enhancedError as any).status = status;
        (enhancedError as any).url = url;
        (enhancedError as any).response = axiosError.response;
        (enhancedError as any).config = axiosError.config;
        throw enhancedError;
      }
      logger.error('An unexpected error occurred during API call', error);
      throw error;
    }
  }

  /**
   * Creates a user in the chat service
   *
   * Uses the batch API endpoint to create a single user. The API expects:
   * - bypassEmailConfirmation: true
   * - usersList: array with user objects containing email, firstName, lastName, password, uuid
   *
   * @param userId - The unique identifier of the user (used as uuid)
   * @param userData - Additional user data (optional) - can include email, firstName, lastName, password, etc.
   * @returns The API response
   */
  async createUser(
    userId: UUID,
    userData?: Record<string, unknown>,
  ): Promise<ApiResponse> {
    logger.info(`Attempting to create user with ID: ${userId}`);
    const createUrl = `${this.baseEthoraUrl}/v2/users/batch`;

    // Extract user fields from userData or use defaults
    // Generate unique email using UUID if not provided
    const email = (userData?.email as string) || `${randomUUID()}@example.com`;
    const password = (userData?.password as string) || `password_${userId}`;

    // Handle firstName and lastName - split displayName if provided
    // API requires lastName to be at least 2 characters and not empty
    let firstName: string;
    let lastName: string;

    if (userData?.firstName) {
      firstName = userData.firstName as string;
      lastName = (userData?.lastName as string) || '';
    } else if (userData?.displayName) {
      const displayName = userData.displayName as string;
      const nameParts = displayName.trim().split(/\s+/);
      firstName = nameParts[0] || 'User';
      lastName = nameParts.slice(1).join(' ') || '';
    } else {
      firstName = 'User';
      lastName = '';
    }

    // Ensure lastName meets API requirements: at least 2 characters, not empty
    if (!lastName || lastName.length < 2) {
      // Use a default lastName if empty or too short
      lastName = 'User';
    }

    // Use plain userId without prefixing
    const userIdStr = String(userId);

    const payload = {
      bypassEmailConfirmation: true,
      usersList: [
        {
          uuid: userIdStr,
          email: email,
          firstName: firstName,
          lastName: lastName,
          password: password,
          ...(userData &&
            Object.fromEntries(
              Object.entries(userData).filter(
                ([key]) =>
                  ![
                    'email',
                    'firstName',
                    'lastName',
                    'password',
                    'uuid',
                    'displayName',
                    'role',
                  ].includes(key),
              ),
            )),
        },
      ],
    };

    logger.debug(`Chat service API URL: ${createUrl}`);
    logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    return this.makeRequest<ApiResponse>({
      method: 'POST',
      url: createUrl,
      data: payload,
    });
  }

  /**
   * Creates a chat room
   *
   * @param chatId - The unique identifier of the chat
   * @param roomData - Additional room data (optional)
   * @returns The API response
   */
  async createChatRoom(
    chatId: UUID,
    roomData?: Record<string, unknown>,
  ): Promise<ApiResponse> {
    logger.info(`Attempting to create chat room with ID: ${chatId}`);
    const createUrl = `${this.baseEthoraUrl}/v2/chats`;

    // Create chat room - API expects title, uuid, and type
    const payload: CreateChatRoomRequest = {
      title: (roomData?.title as string) || `Chat Room ${chatId}`,
      uuid: String(chatId), // Use chatId as uuid
      type: (roomData?.type as string) || 'group',
      ...roomData, // Allow roomData to override fields if provided
    };

    logger.debug(`Chat service API URL: ${createUrl}`);
    logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    return this.makeRequest<ApiResponse>({
      method: 'POST',
      url: createUrl,
      data: payload,
    });
  }

  /**
   * Grants a user access to a chat room
   *
   * @param chatId - The unique identifier of the chat
   * @param userId - The unique identifier of the user (or array of user IDs)
   * @returns The API response
   */
  async grantUserAccessToChatRoom(
    chatId: UUID,
    userId: UUID | UUID[],
  ): Promise<ApiResponse> {
    logger.info(`Granting user(s) access to chat room ${chatId}`);

    const chatName = this.createChatName(chatId, false);
    // Use /v2/chats/users-access endpoint with chatName and members array
    const grantUrl = `${this.baseEthoraUrl}/v2/chats/users-access`;

    // Convert single userId to array if needed
    // API requires usernames to start with appId, so prefix them
    const members = Array.isArray(userId)
      ? userId.map((id) => {
          const userIdStr = String(id);
          // If userId doesn't start with appId, prefix it
          return userIdStr.startsWith(this.secrets.chatAppId)
            ? userIdStr
            : `${this.secrets.chatAppId}_${userIdStr}`;
        })
      : [
          (() => {
            const userIdStr = String(userId);
            return userIdStr.startsWith(this.secrets.chatAppId)
              ? userIdStr
              : `${this.secrets.chatAppId}_${userIdStr}`;
          })(),
        ];

    const payload: GrantAccessRequest = {
      chatName: chatName,
      members: members,
    };

    logger.debug(`Chat service API URL: ${grantUrl}`);
    logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    return await this.makeRequest<ApiResponse>({
      method: 'POST',
      url: grantUrl,
      data: payload,
    });
  }

  /**
   * Removes a user's access to a chat room
   *
   * @param chatId - The unique identifier of the chat
   * @param userId - The unique identifier of the user (or array of user IDs)
   * @returns The API response
   */
  async removeUserAccessFromChatRoom(
    chatId: UUID,
    userId: UUID | UUID[],
  ): Promise<ApiResponse> {
    logger.info(`Removing user(s) access from chat room ${chatId}`);

    const chatName = this.createChatName(chatId, false);
    // Use /v2/chats/usersAccess/remove DELETE endpoint (fallback to legacy /v2/chats/users-access)
    const revokeUrl = `${this.baseEthoraUrl}/v2/chats/users-access`;

    // Convert single userId to array if needed
    const members = Array.isArray(userId)
      ? userId.map((id) => {
          const userIdStr = String(id);
          return userIdStr.startsWith(this.secrets.chatAppId)
            ? userIdStr
            : `${this.secrets.chatAppId}_${userIdStr}`;
        })
      : [
          (() => {
            const userIdStr = String(userId);
            return userIdStr.startsWith(this.secrets.chatAppId)
              ? userIdStr
              : `${this.secrets.chatAppId}_${userIdStr}`;
          })(),
        ];

    const payload: GrantAccessRequest = {
      chatName: chatName,
      members: members,
    };

    logger.debug(`Chat service API URL: ${revokeUrl}`);
    logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    return await this.makeRequest<ApiResponse>({
      method: 'DELETE',
      url: revokeUrl,
      data: payload,
    });
  }

  /**
   * Deletes users from the chat service
   *
   * @param userIds - Array of user IDs to delete
   * @returns The API response
   */
  async deleteUsers(userIds: UUID[]): Promise<ApiResponse> {
    logger.info(`Attempting to delete users: ${userIds.join(', ')}`);
    const deleteUrl = `${this.baseEthoraUrl}/v1/users/batch`;

    const payload = {
      usersIdList: userIds.map((id) => String(id)),
    };

    logger.debug(`Chat service API URL: ${deleteUrl}`);
    logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    try {
      return await this.makeRequest<ApiResponse>({
        method: 'DELETE',
        url: deleteUrl,
        data: payload,
      });
    } catch (error) {
      const statusCode = (error as any)?.status;
      const responseText = (error as any)?.response?.data;

      // Handle the case where users don't exist (422 with "not found")
      if (
        statusCode === 422 &&
        typeof responseText === 'string' &&
        responseText.toLowerCase().includes('not found')
      ) {
        logger.info(
          'No users to delete from the chat service. The request contained non-existent users.',
        );
        return { ok: false };
      }
      throw error;
    }
  }

  /**
   * Deletes a chat room from the chat service by its chat ID
   *
   * This method sends a DELETE request to the Ethora API using the chat ID
   * to construct the chat name. It gracefully handles the case where the chat room
   * is already non-existent (422 Not Found).
   *
   * @param chatId - The unique identifier of the chat associated with the chat room
   * @returns The JSON response from the chat service upon successful deletion or a success status if not found
   */
  async deleteChatRoom(chatId: UUID): Promise<ApiResponse> {
    logger.info(`Attempting to delete chat room with ID: ${chatId}`);
    const deleteUrl = `${this.baseEthoraUrl}/v1/chats`;

    // We must use the short name when deleting the chat room
    const chatName = this.createChatName(chatId, false);
    const payload: DeleteChatRoomRequest = {
      name: chatName,
    };

    logger.debug(`Chat service API URL: ${deleteUrl}`);
    logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    try {
      const response = await this.makeRequest<ApiResponse>({
        method: 'DELETE',
        url: deleteUrl,
        data: payload,
      });

      logger.info(`Chat room '${chatName}' successfully deleted`);
      return response;
    } catch (error) {
      const statusCode = (error as any)?.status;
      const responseText = (error as any)?.response?.data;

      // Handle the case where the room does not exist (Ethora returns 422 with "not found" in body)
      if (
        statusCode === 422 &&
        typeof responseText === 'string' &&
        responseText.toLowerCase().includes('not found')
      ) {
        logger.warn(
          `Chat room '${chatName}' not found during deletion attempt (Ignored 422)`,
        );
        return { ok: false, reason: 'Chat room not found' };
      }

      // Re-throw if it's not a "not found" case
      throw error;
    }
  }

  /**
   * Updates multiple users in the chat service
   *
   * This method sends a PATCH request to update multiple users at once.
   * The endpoint accepts an array of user objects with userId and optional
   * fields. Only provided fields will be updated.
   *
   * Limits: 1-100 users per request
   * Response contains results array with status for each user:
   * - updated: user was successfully updated (includes updated user data)
   * - not-found: user was not found
   * - skipped: user update was skipped
   *
   * Note: The API only accepts xmppUsername, firstName, lastName, username, and profileImage fields.
   * Other fields will be filtered out automatically.
   *
   * @param users - Array of user data to update (1-100 users)
   * @returns The API response with results array containing status for each user
   */
  async updateUsers(users: UpdateUserData[]): Promise<ApiResponse> {
    // Validate user count limit
    if (users.length === 0) {
      throw new Error('At least 1 user is required for update');
    }
    if (users.length > 100) {
      throw new Error('Maximum 100 users allowed per update request');
    }

    logger.info(`Attempting to update ${users.length} user(s)`);

    const updateUrl = `${this.baseEthoraUrl}/v2/chats/users`;

    // Remove userId from payload if present, as API doesn't accept it
    // API expects xmppUsername or other identifier fields instead
    // Also filter to only include allowed fields: xmppUsername, firstName, lastName, username, profileImage
    const cleanedUsers = users.map((user) => {
      const { userId, ...rest } = user;
      const allowedFields: UpdateUserData = {};

      if (rest.xmppUsername) allowedFields.xmppUsername = rest.xmppUsername;
      if (rest.firstName) allowedFields.firstName = rest.firstName;
      if (rest.lastName) allowedFields.lastName = rest.lastName;
      if (rest.username) allowedFields.username = rest.username;
      if (rest.profileImage) allowedFields.profileImage = rest.profileImage;

      return allowedFields;
    });

    const payload: UpdateUsersRequest = {
      users: cleanedUsers,
    };

    logger.debug(`Chat service API URL: ${updateUrl}`);
    logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    return this.makeRequest<ApiResponse>({
      method: 'PATCH',
      url: updateUrl,
      data: payload,
    });
  }

  /**
   * Gets users from the chat service
   *
   * This method supports multiple query modes:
   * - No parameters: returns all users of the app
   * - chatName parameter: returns all users of the chat
   *   - For group chats: use appId_uuId format
   *   - For 1-on-1 chats: use xmppUsernameA-xmppUsernameB format
   * - xmppUsername parameter: returns a specific user by XMPP username
   *
   * Note: The xmppUsername query parameter may not be supported by the API yet.
   * In that case, you can get all users and filter client-side.
   *
   * @param params - Query parameters for filtering users (optional)
   * @returns The API response
   */
  async getUsers(params?: GetUsersQueryParams): Promise<ApiResponse> {
    const getUrl = `${this.baseEthoraUrl}/v2/chats/users`;

    // Build query parameters
    const queryParams: string[] = [];
    if (params?.chatName) {
      queryParams.push(`chatName=${encodeURIComponent(params.chatName)}`);
    }
    if (params?.xmppUsername) {
      queryParams.push(
        `xmppUsername=${encodeURIComponent(params.xmppUsername)}`,
      );
    }
    if (params?.userId) {
      queryParams.push(`userId=${encodeURIComponent(params.userId)}`);
    }
    if (params?.limit !== undefined) {
      queryParams.push(`limit=${params.limit}`);
    }
    if (params?.offset !== undefined) {
      queryParams.push(`offset=${params.offset}`);
    }

    const urlWithParams =
      queryParams.length > 0 ? `${getUrl}?${queryParams.join('&')}` : getUrl;

    logger.info(
      params
        ? `Getting users with params: ${JSON.stringify(params)}`
        : 'Getting all users of the app',
    );
    logger.debug(`Chat service API URL: ${urlWithParams}`);

    return this.makeRequest<ApiResponse>({
      method: 'GET',
      url: urlWithParams,
    });
  }
  /**
   * Gets chat rooms for a specific user
   *
   * Endpoint: GET /v2/apps/{appId}/users/{userId}/chats
   *
   * @param userId - The unique identifier of the user
   * @param params - Query parameters for pagination and including members
   * @returns The API response
   */
  async getUserChats(
    userId: UUID,
    params?: GetUserChatsQueryParams,
  ): Promise<ApiResponse> {
    return this.getUserChatsInApp(this.secrets.chatAppId, userId, params);
  }

  async getUserChatsInApp(
    appId: UUID,
    userId: UUID,
    params?: GetUserChatsQueryParams,
  ): Promise<ApiResponse> {
    const getUrl = `${this.baseEthoraUrl}/v2/apps/${appId}/users/${userId}/chats`;

    // Build query parameters
    const queryParams: string[] = [];
    if (params?.limit !== undefined) {
      queryParams.push(`limit=${params.limit}`);
    }
    if (params?.offset !== undefined) {
      queryParams.push(`offset=${params.offset}`);
    }
    if (params?.includeMembers !== undefined) {
      queryParams.push(`includeMembers=${params.includeMembers}`);
    }

    const urlWithParams =
      queryParams.length > 0 ? `${getUrl}?${queryParams.join('&')}` : getUrl;

    logger.info(`Getting chat rooms for user: ${userId}`);
    logger.debug(`Chat service API URL: ${urlWithParams}`);

    return this.makeRequest<ApiResponse>({
      method: 'GET',
      url: urlWithParams,
    });
  }

  /**
   * Updates chat room title or description
   *
   * Endpoint: PATCH /v2/apps/{appId}/chats/{chatId}
   *
   * @param chatId - The unique identifier of the chat (canonical room name or full JID)
   * @param updateData - Data to update (title, description)
   * @returns The API response
   */
  async updateChatRoom(
    chatId: UUID,
    updateData: { title?: string; description?: string },
  ): Promise<ApiResponse> {
    return this.updateChatRoomInApp(this.secrets.chatAppId, chatId, updateData);
  }

  async updateChatRoomInApp(
    appId: UUID,
    chatId: UUID,
    updateData: { title?: string; description?: string },
  ): Promise<ApiResponse> {
    const chatName = this.createScopedChatName(appId, chatId);
    const updateUrl = `${this.baseEthoraUrl}/v2/apps/${appId}/chats/${chatName}`;

    logger.info(`Updating chat room: ${chatName}`);
    logger.debug(`Chat service API URL: ${updateUrl}`);
    logger.debug(`Request payload: ${JSON.stringify(updateData)}`);

    return this.makeRequest<ApiResponse>({
      method: 'PATCH',
      url: updateUrl,
      data: updateData,
    });
  }

  async listApps(params?: ListAppsQueryParams): Promise<ApiResponse> {
    const url = `${this.baseEthoraUrl}/v2/apps${this.buildQueryString(params)}`;
    return this.makeRequest<ApiResponse>({ method: 'GET', url });
  }

  async getApp(appId: UUID): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'GET',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}`,
    });
  }

  async createApp(appData: CreateAppRequest): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'POST',
      url: `${this.baseEthoraUrl}/v2/apps`,
      data: appData,
    });
  }

  async deleteApp(appId: UUID): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'DELETE',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}`,
    });
  }

  async listAppTokens(appId: UUID): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'GET',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}/tokens`,
    });
  }

  async createAppToken(
    appId: UUID,
    payload?: CreateAppTokenRequest,
  ): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'POST',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}/tokens`,
      data: payload || {},
    });
  }

  async revokeAppToken(appId: UUID, tokenId: UUID): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'DELETE',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}/tokens/${tokenId}`,
    });
  }

  async rotateAppToken(
    appId: UUID,
    tokenId: UUID,
    payload?: RotateAppTokenRequest,
  ): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'POST',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}/tokens/${tokenId}/rotate`,
      data: payload || {},
    });
  }

  async provisionApp(appId: UUID, payload?: ProvisionAppRequest): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'POST',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}/provision`,
      data: payload || {},
    });
  }

  async getAppBot(appId: UUID): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'GET',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}/bot`,
    });
  }

  async updateAppBot(appId: UUID, payload: UpdateAppBotRequest): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'PUT',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}/bot`,
      data: payload,
    });
  }

  async broadcastToAppChats(
    appId: UUID,
    payload: CreateAppBroadcastRequest,
  ): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'POST',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}/chats/broadcast`,
      data: payload,
    });
  }

  async getAppBroadcastJob(appId: UUID, jobId: UUID): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'GET',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}/chats/broadcast/${jobId}`,
    });
  }

  async getAppUserByXmppUsername(xmppUsername: UUID): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'GET',
      url: `${this.baseEthoraUrl}/v1/apps/users/${encodeURIComponent(String(xmppUsername))}`,
    });
  }

  async createUsersInApp(appId: UUID, payload: BatchCreateUsersRequest): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'POST',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}/users/batch`,
      data: payload,
    });
  }

  async getUsersBatchJob(appId: UUID, jobId: UUID): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'GET',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}/users/batch/${jobId}`,
    });
  }

  async deleteUsersInApp(appId: UUID, userIds: UUID[]): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'DELETE',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}/users/batch`,
      data: { usersIdList: userIds.map((id) => String(id)) },
    });
  }

  async createChatRoomInApp(
    appId: UUID,
    chatId: UUID,
    roomData?: Record<string, unknown>,
  ): Promise<ApiResponse> {
    const payload: CreateChatRoomRequest = {
      title: (roomData?.title as string) || `Chat Room ${chatId}`,
      uuid: String(chatId),
      type: (roomData?.type as string) || 'group',
      ...roomData,
    };
    return this.makeRequest<ApiResponse>({
      method: 'POST',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}/chats`,
      data: payload,
    });
  }

  async listChatsInApp(
    appId: UUID,
    params?: ListAppChatsQueryParams,
  ): Promise<ApiResponse> {
    const query = this.buildQueryString(params);
    return this.makeRequest<ApiResponse>({
      method: 'GET',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}/chats${query}`,
    });
  }

  async deleteChatRoomInApp(appId: UUID, chatId: UUID): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'DELETE',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}/chats`,
      data: { name: this.createScopedChatName(appId, chatId) },
    });
  }

  async grantUserAccessToChatRoomInApp(
    appId: UUID,
    chatId: UUID,
    userId: UUID | UUID[],
  ): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'POST',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}/chats/users-access`,
      data: {
        chatName: this.createScopedChatName(appId, chatId),
        members: this.createScopedMembers(appId, userId),
      },
    });
  }

  async removeUserAccessFromChatRoomInApp(
    appId: UUID,
    chatId: UUID,
    userId: UUID | UUID[],
  ): Promise<ApiResponse> {
    return this.makeRequest<ApiResponse>({
      method: 'DELETE',
      url: `${this.baseEthoraUrl}/v2/apps/${appId}/chats/users-access`,
      data: {
        chatName: this.createScopedChatName(appId, chatId),
        members: this.createScopedMembers(appId, userId),
      },
    });
  }
}

/**
 * Provides a singleton instance of EthoraSDKService
 *
 * This dependency injection function is intended for use with a DI framework
 * or as a simple factory function. It creates and returns a single instance
 * of `EthoraSDKService`.
 *
 * @returns A singleton instance of the chat repository implementation
 */
let repositoryInstance: EthoraSDKService | null = null;

export function getEthoraSDKService(config?: {
  chatAppId?: string;
  chatAppSecret?: string;
}): EthoraSDKService {
  if (!repositoryInstance || config) {
    const newService = new EthoraSDKService(config);
    if (!repositoryInstance) {
      repositoryInstance = newService;
    }
    return newService;
  }
  return repositoryInstance;
}

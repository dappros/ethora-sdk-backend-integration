/**
 * Type definitions for the Ethora SDK
 */

/**
 * UUID type - can be a string or UUID object
 */
export type UUID = string;

/**
 * Chat room name format options
 */
export interface ChatNameOptions {
  /** Whether to include the full JID domain */
  full?: boolean;
}

/**
 * JWT token payload for server authentication
 */
export interface ServerTokenPayload {
  data: {
    appId: string;
    type: "server";
    tenantId?: string;
  };
}

/**
 * JWT token payload for client authentication
 */
export interface ClientTokenPayload {
  data: {
    type: "client";
    userId: string;
    appId: string;
  };
}

/**
 * API response structure
 */
export interface ApiResponse {
  ok?: boolean;
  reason?: string;
  url?: string;
  [key: string]: unknown;
}

export interface CreateAppRequest {
  displayName: string;
  domainName?: string;
  appTagline?: string;
  logoImage?: string;
  sublogoImage?: string;
  primaryColor?: string;
  bundleId?: string;
  [key: string]: unknown;
}

export interface ListAppsQueryParams {
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
  orderBy?: 'displayName' | 'createdAt';
}

export interface BatchCreateUsersRequest {
  bypassEmailConfirmation?: boolean;
  usersList: Array<{
    email: string;
    firstName: string;
    lastName: string;
    password?: string;
    uuid?: string;
    profileImage?: string;
    [key: string]: unknown;
  }>;
}

export interface CreateAppTokenRequest {
  label?: string;
}

export interface RotateAppTokenRequest {
  label?: string;
}

export interface ProvisionRoomRequest {
  title?: string;
  pinned?: boolean;
  [key: string]: unknown;
}

export interface ProvisionAppRequest {
  rooms?: ProvisionRoomRequest[];
  [key: string]: unknown;
}

export interface UpdateAppBotRequest {
  status?: string;
  trigger?: string;
  prompt?: string;
  greetingMessage?: string;
  chatId?: string;
  isRAG?: boolean;
  botFirstName?: string;
  botLastName?: string;
  [key: string]: unknown;
}

export interface CreateAppBroadcastRequest {
  text: string;
  allRooms?: boolean;
  chatNames?: string[];
  chatIds?: string[];
  metadata?: Record<string, unknown>;
  dryRun?: boolean;
  [key: string]: unknown;
}

export interface ListAppChatsQueryParams {
  limit?: number;
  offset?: number;
  includeMembers?: boolean;
}

/**
 * Chat room creation request payload
 */
export interface CreateChatRoomRequest {
  title: string; // Chat room title
  uuid: string; // Workspace ID
  type: string; // Room type (e.g., "group")
  [key: string]: unknown;
}

/**
 * Delete chat room request payload
 */
export interface DeleteChatRoomRequest {
  name: string;
}

/**
 * Grant access request payload
 */
export interface GrantAccessRequest {
  chatName: string; // Chat room name (short format: appId_workspaceId)
  members: string[]; // Array of user IDs to grant access
  [key: string]: unknown;
}

/**
 * User data for batch update
 */
export interface UpdateUserData {
  userId?: string; // User ID (optional - API might use xmppUsername instead)
  xmppUsername?: string; // XMPP username (optional - used to identify user)
  firstName?: string; // First name (optional)
  lastName?: string; // Last name (optional)
  username?: string; // Username (optional)
  profileImage?: string; // Profile image URL (optional)
  description?: string; // User description (optional)
  token?: string; // Token (optional)
  email?: string; // Email address (optional)
  appId?: string; // Application ID (optional)
  homeScreen?: string; // Home screen setting (optional)
  registrationChannelType?: string; // Registration channel type (optional)
  updatedAt?: string; // Last update timestamp (optional)
  authMethod?: string; // Authentication method (optional)
  resetPasswordExpires?: string; // Password reset expiration (optional)
  resetPasswordToken?: string; // Password reset token (optional)
  roles?: string[]; // User roles array (optional)
  tags?: string[]; // User tags array (optional)
  __v?: number; // Version number (optional)
  isProfileOpen?: boolean; // Profile visibility setting (optional)
  isAssetsOpen?: boolean; // Assets visibility setting (optional)
  isAgreeWithTerms?: boolean; // Terms agreement status (optional)
  // Allow additional string properties
  [key: string]: string | string[] | number | boolean | undefined;
}

/**
 * Batch update users request payload
 */
export interface UpdateUsersRequest {
  users: UpdateUserData[]; // Array of users to update
}

/**
 * Get users query parameters
 */
export interface GetUsersQueryParams {
  chatName?: string; // Chat name (appId_uuId for group chats, xmppUsernameA-xmppUsernameB for 1-on-1)
  xmppUsername?: string; // XMPP username for getting a specific user
  userId?: string; // User UUID or Mongo _id (backward-compatible single-user lookup)
  limit?: number; // Pagination limit (1-500)
  offset?: number; // Pagination offset (>= 0)
}

/**
 * Get user chats query parameters
 */
export interface GetUserChatsQueryParams {
  limit?: number;
  offset?: number;
  includeMembers?: boolean;
}

/**
 * Chat repository interface
 */
export interface ChatRepository {
  /**
   * Creates a fully-qualified chat room JID from a chat ID
   */
  createChatName(chatId: UUID, full?: boolean): string;

  /**
   * Creates a client-side JWT token for a specific user ID
   */
  createChatUserJwtToken(userId: UUID): string;

  /**
   * Creates a user in the chat service
   */
  createUser(
    userId: UUID,
    userData?: Record<string, unknown>
  ): Promise<ApiResponse>;

  /**
   * Creates a chat room for a workspace
   */
  createChatRoom(
    chatId: UUID,
    roomData?: Record<string, unknown>
  ): Promise<ApiResponse>;

  /**
   * Grants a user access to a chat room
   */
  grantUserAccessToChatRoom(
    chatId: UUID,
    userId: UUID | UUID[]
  ): Promise<ApiResponse>;

  /**
   * Removes a user's access to a chat room
   *
   * @param chatId - The unique identifier of the chat
   * @param userId - The unique identifier of the user (or users)
   */
  removeUserAccessFromChatRoom(
    chatId: UUID,
    userId: UUID | UUID[]
  ): Promise<ApiResponse>;

  /**
   * Deletes users from the chat service
   */
  deleteUsers(userIds: UUID[]): Promise<ApiResponse>;

  /**
   * Deletes a chat room by workspace ID
   */
  deleteChatRoom(chatId: UUID): Promise<ApiResponse>;

  /**
   * Updates multiple users in the chat service
   *
   * Sends PATCH request to /v2/chats/users with array of users.
   * Only provided fields will be updated.
   * Limits: 1-100 users per request.
   *
   * Response contains results array with status for each user:
   * - updated: user was successfully updated (includes updated user data)
   * - not-found: user was not found
   * - skipped: user update was skipped
   *
   * @param users - Array of user data to update (1-100 users)
   * @returns The API response with results array containing status for each user
   */
  updateUsers(users: UpdateUserData[]): Promise<ApiResponse>;

  /**
   * Gets users from the chat service
   *
   * Query parameters:
   * - No params: returns all users of the app
   * - chatName: returns all users of the chat (appId_uuId for group chats, xmppUsernameA-xmppUsernameB for 1-on-1)
   * - xmppUsername: returns a specific user by XMPP username
   *
   * @param params - Query parameters for filtering users
   * @returns The API response
   */
  getUsers(params?: GetUsersQueryParams): Promise<ApiResponse>;

  /**
   * Gets chat rooms for a specific user
   *
   * Endpoint: GET /v2/apps/{appId}/users/{userId}/chats
   *
   * @param userId - The unique identifier of the user
   * @param params - Query parameters for pagination and including members
   * @returns The API response
   */
  getUserChats(
    userId: UUID,
    params?: GetUserChatsQueryParams,
  ): Promise<ApiResponse>;

  /**
   * Updates chat room title or description
   *
   * Endpoint: PATCH /v2/apps/{appId}/chats/{chatId}
   *
   * @param chatId - The unique identifier of the chat (canonical room name or full JID)
   * @param updateData - Data to update (title, description)
   * @returns The API response
   */
  updateChatRoom(
    chatId: UUID,
    updateData: { title?: string; description?: string },
  ): Promise<ApiResponse>;

  listApps(params?: ListAppsQueryParams): Promise<ApiResponse>;

  getApp(appId: UUID): Promise<ApiResponse>;

  createApp(appData: CreateAppRequest): Promise<ApiResponse>;

  deleteApp(appId: UUID): Promise<ApiResponse>;

  listAppTokens(appId: UUID): Promise<ApiResponse>;

  createAppToken(appId: UUID, payload?: CreateAppTokenRequest): Promise<ApiResponse>;

  revokeAppToken(appId: UUID, tokenId: UUID): Promise<ApiResponse>;

  rotateAppToken(
    appId: UUID,
    tokenId: UUID,
    payload?: RotateAppTokenRequest,
  ): Promise<ApiResponse>;

  provisionApp(appId: UUID, payload?: ProvisionAppRequest): Promise<ApiResponse>;

  getAppBot(appId: UUID): Promise<ApiResponse>;

  updateAppBot(appId: UUID, payload: UpdateAppBotRequest): Promise<ApiResponse>;

  broadcastToAppChats(
    appId: UUID,
    payload: CreateAppBroadcastRequest,
  ): Promise<ApiResponse>;

  getAppBroadcastJob(appId: UUID, jobId: UUID): Promise<ApiResponse>;

  getAppUserByXmppUsername(xmppUsername: UUID): Promise<ApiResponse>;

  createUsersInApp(appId: UUID, payload: BatchCreateUsersRequest): Promise<ApiResponse>;

  getUsersBatchJob(appId: UUID, jobId: UUID): Promise<ApiResponse>;

  deleteUsersInApp(appId: UUID, userIds: UUID[]): Promise<ApiResponse>;

  createChatRoomInApp(
    appId: UUID,
    chatId: UUID,
    roomData?: Record<string, unknown>
  ): Promise<ApiResponse>;

  listChatsInApp(
    appId: UUID,
    params?: ListAppChatsQueryParams,
  ): Promise<ApiResponse>;

  deleteChatRoomInApp(appId: UUID, chatId: UUID): Promise<ApiResponse>;

  grantUserAccessToChatRoomInApp(
    appId: UUID,
    chatId: UUID,
    userId: UUID | UUID[]
  ): Promise<ApiResponse>;

  removeUserAccessFromChatRoomInApp(
    appId: UUID,
    chatId: UUID,
    userId: UUID | UUID[]
  ): Promise<ApiResponse>;

  getUserChatsInApp(
    appId: UUID,
    userId: UUID,
    params?: GetUserChatsQueryParams
  ): Promise<ApiResponse>;

  updateChatRoomInApp(
    appId: UUID,
    chatId: UUID,
    updateData: { title?: string; description?: string }
  ): Promise<ApiResponse>;
}

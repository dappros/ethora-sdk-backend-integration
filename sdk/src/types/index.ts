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
  [key: string]: unknown;
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
}

/**
 * Chat repository interface
 */
export interface ChatRepository {
  /**
   * Creates a fully-qualified chat room JID from a workspace ID
   */
  createChatName(workspaceId: UUID, full?: boolean): string;

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
    workspaceId: UUID,
    roomData?: Record<string, unknown>
  ): Promise<ApiResponse>;

  /**
   * Grants a user access to a chat room
   */
  grantUserAccessToChatRoom(
    workspaceId: UUID,
    userId: UUID | UUID[]
  ): Promise<ApiResponse>;

  /**
   * Grants chatbot access to a chat room
   */
  grantChatbotAccessToChatRoom(workspaceId: UUID): Promise<ApiResponse>;

  /**
   * Deletes users from the chat service
   */
  deleteUsers(userIds: UUID[]): Promise<ApiResponse>;

  /**
   * Deletes a chat room by workspace ID
   */
  deleteChatRoom(workspaceId: UUID): Promise<ApiResponse>;

  /**
   * Updates multiple users in the chat service
   *
   * Sends PATCH request to /v1/chats/users with array of users.
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
}

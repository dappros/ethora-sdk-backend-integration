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
  name: string;
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
  name: string;
  userId: string;
  [key: string]: unknown;
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
  createUser(userId: UUID, userData?: Record<string, unknown>): Promise<ApiResponse>;

  /**
   * Creates a chat room for a workspace
   */
  createChatRoom(workspaceId: UUID, roomData?: Record<string, unknown>): Promise<ApiResponse>;

  /**
   * Grants a user access to a chat room
   */
  grantUserAccessToChatRoom(workspaceId: UUID, userId: UUID): Promise<ApiResponse>;

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
}


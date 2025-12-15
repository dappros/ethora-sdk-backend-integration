/**
 * Concrete implementation of the ChatRepository using the Ethora API
 *
 * This class handles chat operations in the Ethora chat service. It manages
 * JWT authentication tokens for server-to-server communication and uses
 * HTTP clients to make asynchronous API calls.
 *
 * @format
 */

import { randomUUID } from "crypto";
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import type {
  UUID,
  ChatRepository,
  ApiResponse,
  CreateChatRoomRequest,
  DeleteChatRoomRequest,
  GrantAccessRequest,
} from "../types";
import {
  getSecrets,
  DEFAULT_TIMEOUT,
  ETHORA_JID_DOMAIN,
} from "../config/secrets";
import { createServerToken, createClientToken } from "../utils/jwt";
import { getLogger } from "../utils/logger";

const logger = getLogger("EthoraSDKService");

/**
 * EthoraSDKService - Concrete implementation of ChatRepository
 */
export class EthoraSDKService implements ChatRepository {
  private readonly baseEthoraUrl: string;
  private readonly secrets = getSecrets();
  private readonly httpClient: AxiosInstance;

  constructor() {
    this.baseEthoraUrl = this.secrets.chatApiUrl;

    // Create axios instance with default configuration
    this.httpClient = axios.create({
      timeout: DEFAULT_TIMEOUT.total,
      headers: {
        "Content-Type": "application/json",
      },
    });

    logger.debug("EthoraSDKService instance initialized");
  }

  /**
   * Generates a fully-qualified chat room JID from a workspace ID
   *
   * The JID is constructed in the format `<appId>_<workspace_id>@conference.xmpp.ethoradev.com`.
   * This method uses a static JID domain to provide a unique identifier for a chat room.
   *
   * @param workspaceId - The unique identifier of the workspace
   * @param full - Whether to include the full JID domain
   * @returns The fully-qualified JID string for the chat room
   */
  createChatName(workspaceId: UUID, full: boolean = true): string {
    logger.debug(
      `Creating chat room name (JID) for workspace ID: ${workspaceId}`
    );

    const chatName = full
      ? `${this.secrets.chatAppId}_${workspaceId}${ETHORA_JID_DOMAIN}`
      : `${this.secrets.chatAppId}_${workspaceId}`;

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
    return createClientToken(userId);
  }

  /**
   * Creates the necessary headers for an API call with a JWT token
   *
   * @returns The headers dictionary containing the `x-custom-token` field
   */
  private getHeaders(): Record<string, string> {
    logger.debug("Retrieving headers for a server-to-server API call");
    return {
      "x-custom-token": createServerToken(),
    };
  }

  /**
   * Makes an HTTP request with error handling
   *
   * @param config - Axios request configuration
   * @returns The API response
   */
  private async makeRequest<T = ApiResponse>(
    config: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response = await this.httpClient.request<T>({
        ...config,
        headers: {
          ...this.getHeaders(),
          ...config.headers,
        },
        timeout: DEFAULT_TIMEOUT.total,
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        logger.error(
          `API call failed with status code: ${axiosError.response?.status}. ` +
            `Response: ${axiosError.response?.data}`,
          error
        );
        throw error;
      }
      logger.error("An unexpected error occurred during API call", error);
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
    userData?: Record<string, unknown>
  ): Promise<ApiResponse> {
    logger.info(`Attempting to create user with ID: ${userId}`);
    const createUrl = `${this.baseEthoraUrl}/v1/users/batch`;

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
      lastName = (userData?.lastName as string) || "";
    } else if (userData?.displayName) {
      const displayName = userData.displayName as string;
      const nameParts = displayName.trim().split(/\s+/);
      firstName = nameParts[0] || "User";
      lastName = nameParts.slice(1).join(" ") || "";
    } else {
      firstName = "User";
      lastName = "";
    }

    // Ensure lastName meets API requirements: at least 2 characters, not empty
    if (!lastName || lastName.length < 2) {
      // Use a default lastName if empty or too short
      lastName = "User";
    }

    // API requires uuid to start with appId for grant access to work
    // Prefix userId with appId if it doesn't already start with it
    const userIdStr = String(userId);
    const prefixedUserId = userIdStr.startsWith(this.secrets.chatAppId)
      ? userIdStr
      : `${this.secrets.chatAppId}_${userIdStr}`;

    const payload = {
      bypassEmailConfirmation: true,
      usersList: [
        {
          uuid: prefixedUserId,
          email: email,
          firstName: firstName,
          lastName: lastName,
          password: password,
          ...(userData &&
            Object.fromEntries(
              Object.entries(userData).filter(
                ([key]) =>
                  ![
                    "email",
                    "firstName",
                    "lastName",
                    "password",
                    "uuid",
                    "displayName",
                    "role", // Role is not allowed in user creation payload
                  ].includes(key)
              )
            )),
        },
      ],
    };

    logger.debug(`Chat service API URL: ${createUrl}`);
    logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    return this.makeRequest<ApiResponse>({
      method: "POST",
      url: createUrl,
      data: payload,
    });
  }

  /**
   * Creates a chat room for a workspace
   *
   * @param workspaceId - The unique identifier of the workspace
   * @param roomData - Additional room data (optional)
   * @returns The API response
   */
  async createChatRoom(
    workspaceId: UUID,
    roomData?: Record<string, unknown>
  ): Promise<ApiResponse> {
    logger.info(
      `Attempting to create chat room for workspace ID: ${workspaceId}`
    );
    const createUrl = `${this.baseEthoraUrl}/v1/chats`;

    // Create chat room - API expects title, uuid, and type
    const payload: CreateChatRoomRequest = {
      title: (roomData?.title as string) || `Chat Room ${workspaceId}`,
      uuid: String(workspaceId),
      type: (roomData?.type as string) || "group",
      ...roomData, // Allow roomData to override fields if provided
    };

    logger.debug(`Chat service API URL: ${createUrl}`);
    logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    return this.makeRequest<ApiResponse>({
      method: "POST",
      url: createUrl,
      data: payload,
    });
  }

  /**
   * Normalizes a user ID to XMPP username format (appId_userId)
   * This ensures consistency with how users are created in the system
   *
   * @param userId - The user ID to normalize
   * @returns The XMPP username in format appId_userId
   */
  private normalizeToXmppUsername(userId: UUID): string {
    const userIdStr = String(userId);
    // If userId already starts with appId, use it as-is
    // Otherwise, prefix it with appId to match the format used during user creation
    if (userIdStr.startsWith(this.secrets.chatAppId)) {
      return userIdStr;
    }
    return `${this.secrets.chatAppId}_${userIdStr}`;
  }

  /**
   * Grants a user access to a chat room
   *
   * The API expects XMPP usernames in the format: appId_userId
   * This matches the UUID format used when creating users (uuid: appId_userId)
   *
   * @param workspaceId - The unique identifier of the workspace
   * @param userId - The unique identifier of the user (or array of user IDs)
   * @returns The API response
   */
  async grantUserAccessToChatRoom(
    workspaceId: UUID,
    userId: UUID | UUID[]
  ): Promise<ApiResponse> {
    logger.info(
      `Granting user(s) access to chat room for workspace ${workspaceId}`
    );

    const chatName = this.createChatName(workspaceId, false);
    // Use /v1/chats/users-access endpoint with chatName and members array
    const grantUrl = `${this.baseEthoraUrl}/v1/chats/users-access`;

    // Convert single userId to array if needed
    // Normalize to XMPP username format (appId_userId) to match user creation format
    const members = Array.isArray(userId)
      ? userId.map((id) => this.normalizeToXmppUsername(id))
      : [this.normalizeToXmppUsername(userId)];

    const payload: GrantAccessRequest = {
      chatName: chatName,
      members: members,
    };

    logger.debug(`Chat service API URL: ${grantUrl}`);
    logger.debug(`Request payload: ${JSON.stringify(payload)}`);
    logger.debug(`Using XMPP usernames for members: ${members.join(", ")}`);

    try {
      return await this.makeRequest<ApiResponse>({
        method: "POST",
        url: grantUrl,
        data: payload,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        logger.error(
          `Failed to grant user access. Status: ${
            error.response?.status
          }, Response: ${JSON.stringify(errorData)}`,
          error
        );
        // Log the XMPP usernames that were attempted for debugging
        logger.debug(`Attempted XMPP usernames: ${members.join(", ")}`);
      }
      throw error;
    }
  }

  /**
   * Grants chatbot access to a chat room
   *
   * @param workspaceId - The unique identifier of the workspace
   * @returns The API response
   */
  async grantChatbotAccessToChatRoom(workspaceId: UUID): Promise<ApiResponse> {
    logger.info(
      `Granting chatbot access to chat room for workspace ${workspaceId}`
    );

    if (!this.secrets.chatBotJid) {
      const error = new Error(
        "Chatbot JID not configured. Set ETHORA_CHAT_BOT_JID environment variable."
      );
      logger.error("Cannot grant chatbot access", error);
      throw error;
    }

    // Extract username from JID (format: "username@domain" -> "username")
    const chatbotUsername = this.secrets.chatBotJid.split("@")[0];

    // Use the same grant access method with chatbot JID
    return this.grantUserAccessToChatRoom(workspaceId, chatbotUsername);
  }

  /**
   * Deletes users from the chat service
   *
   * @param userIds - Array of user IDs to delete
   * @returns The API response
   */
  async deleteUsers(userIds: UUID[]): Promise<ApiResponse> {
    logger.info(`Attempting to delete users: ${userIds.join(", ")}`);
    const deleteUrl = `${this.baseEthoraUrl}/v1/users/batch`;

    const payload = {
      usersIdList: userIds.map((id) => String(id)),
    };

    logger.debug(`Chat service API URL: ${deleteUrl}`);
    logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    try {
      return await this.makeRequest<ApiResponse>({
        method: "DELETE",
        url: deleteUrl,
        data: payload,
      });
    } catch (error) {
      // Handle the case where users don't exist (422 with "not found")
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 422 &&
        typeof error.response.data === "string" &&
        error.response.data.includes("not found")
      ) {
        logger.info(
          "No users to delete from the chat service. The request contained non-existent users."
        );
        return { ok: false };
      }
      throw error;
    }
  }

  /**
   * Deletes a chat room from the chat service by its workspace ID
   *
   * This method sends a DELETE request to the Ethora API using the workspace ID
   * to construct the chat name. It gracefully handles the case where the chat room
   * is already non-existent (422 Not Found).
   *
   * @param workspaceId - The unique identifier of the workspace associated with the chat room
   * @returns The JSON response from the chat service upon successful deletion or a success status if not found
   */
  async deleteChatRoom(workspaceId: UUID): Promise<ApiResponse> {
    logger.info(
      `Attempting to delete chat room for workspace ID: ${workspaceId}`
    );
    const deleteUrl = `${this.baseEthoraUrl}/v1/chats`;

    // We must use the short name when deleting the chat room
    const chatName = this.createChatName(workspaceId, false);
    const payload: DeleteChatRoomRequest = {
      name: chatName,
    };

    logger.debug(`Chat service API URL: ${deleteUrl}`);
    logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    try {
      const response = await this.makeRequest<ApiResponse>({
        method: "DELETE",
        url: deleteUrl,
        data: payload,
      });

      logger.info(`Chat room '${chatName}' successfully deleted`);
      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const statusCode = axiosError.response?.status;
        const responseText = axiosError.response?.data;

        // Handle the case where the room does not exist (Ethora returns 422 with "not found" in body)
        if (
          statusCode === 422 &&
          typeof responseText === "string" &&
          responseText.toLowerCase().includes("not found")
        ) {
          logger.warn(
            `Chat room '${chatName}' not found during deletion attempt (Ignored 422)`
          );
          return { ok: false, reason: "Chat room not found" };
        }
      }

      // Re-throw if it's not a "not found" case
      throw error;
    }
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

export function getEthoraSDKService(): EthoraSDKService {
  if (!repositoryInstance) {
    logger.debug("Creating new EthoraSDKService instance");
    repositoryInstance = new EthoraSDKService();
  }
  return repositoryInstance;
}

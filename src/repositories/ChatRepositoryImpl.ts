/**
 * Concrete implementation of the ChatRepository using the Ethora API
 * 
 * This class handles chat operations in the Ethora chat service. It manages
 * JWT authentication tokens for server-to-server communication and uses
 * HTTP clients to make asynchronous API calls.
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import type {
  UUID,
  ChatRepository,
  ApiResponse,
  CreateChatRoomRequest,
  DeleteChatRoomRequest,
  GrantAccessRequest,
} from "../types";
import { getSecrets, DEFAULT_TIMEOUT, ETHORA_JID_DOMAIN } from "../config/secrets";
import { createServerToken, createClientToken } from "../utils/jwt";
import { getLogger } from "../utils/logger";

const logger = getLogger("ChatRepositoryImpl");

/**
 * ChatRepositoryImpl - Concrete implementation of ChatRepository
 */
export class ChatRepositoryImpl implements ChatRepository {
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

    logger.debug("ChatRepositoryImpl instance initialized");
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
    logger.debug(`Creating chat room name (JID) for workspace ID: ${workspaceId}`);
    
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
   * @param userId - The unique identifier of the user
   * @param userData - Additional user data (optional)
   * @returns The API response
   */
  async createUser(userId: UUID, userData?: Record<string, unknown>): Promise<ApiResponse> {
    logger.info(`Attempting to create user with ID: ${userId}`);
    const createUrl = `${this.baseEthoraUrl}/users`;
    
    const payload = {
      userId: String(userId),
      ...userData,
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
    logger.info(`Attempting to create chat room for workspace ID: ${workspaceId}`);
    const createUrl = `${this.baseEthoraUrl}/chats`;
    
    // Use short name when creating the chat room
    const chatName = this.createChatName(workspaceId, false);
    const payload: CreateChatRoomRequest = {
      name: chatName,
      ...roomData,
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
   * Grants a user access to a chat room
   * 
   * @param workspaceId - The unique identifier of the workspace
   * @param userId - The unique identifier of the user
   * @returns The API response
   */
  async grantUserAccessToChatRoom(
    workspaceId: UUID,
    userId: UUID
  ): Promise<ApiResponse> {
    logger.info(
      `Granting user ${userId} access to chat room for workspace ${workspaceId}`
    );
    const grantUrl = `${this.baseEthoraUrl}/chats/grant`;
    
    const chatName = this.createChatName(workspaceId, false);
    const payload: GrantAccessRequest = {
      name: chatName,
      userId: String(userId),
    };

    logger.debug(`Chat service API URL: ${grantUrl}`);
    logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    return this.makeRequest<ApiResponse>({
      method: "POST",
      url: grantUrl,
      data: payload,
    });
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
    const grantUrl = `${this.baseEthoraUrl}/chats/grant`;
    
    const chatName = this.createChatName(workspaceId, false);
    const payload = {
      name: chatName,
    };

    logger.debug(`Chat service API URL: ${grantUrl}`);
    logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    return this.makeRequest<ApiResponse>({
      method: "POST",
      url: grantUrl,
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
    logger.info(`Attempting to delete users: ${userIds.join(", ")}`);
    const deleteUrl = `${this.baseEthoraUrl}/users`;
    
    const payload = {
      userIds: userIds.map((id) => String(id)),
    };

    logger.debug(`Chat service API URL: ${deleteUrl}`);
    logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    return this.makeRequest<ApiResponse>({
      method: "DELETE",
      url: deleteUrl,
      data: payload,
    });
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
    logger.info(`Attempting to delete chat room for workspace ID: ${workspaceId}`);
    const deleteUrl = `${this.baseEthoraUrl}/chats`;

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
 * Provides a singleton instance of ChatRepositoryImpl
 * 
 * This dependency injection function is intended for use with a DI framework
 * or as a simple factory function. It creates and returns a single instance
 * of `ChatRepositoryImpl`.
 * 
 * @returns A singleton instance of the chat repository implementation
 */
let repositoryInstance: ChatRepositoryImpl | null = null;

export function getChatRepositoryImpl(): ChatRepositoryImpl {
  if (!repositoryInstance) {
    logger.debug("Creating new ChatRepositoryImpl instance");
    repositoryInstance = new ChatRepositoryImpl();
  }
  return repositoryInstance;
}


/**
 * Ethora SDK - Main entry point
 *
 * This SDK provides a TypeScript/Node.js implementation for integrating
 * with the Ethora chat service backend API.
 *
 * import { getEthoraSDKService } from '@ethora/sdk-backend';
 *
 * const chatRepo = getEthoraSDKService();
 *
 * // Create a chat room
 * await chatRepo.createChatRoom('workspace-123', {
 *   title: 'My Chat Room',
 *   uuid: 'workspace-123',
 *   type: 'group'
 * });
 *
 * // Create a user
 * await chatRepo.createUser('user-123', {
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   email: 'john@example.com'
 * });
 *
 * // Grant access
 * await chatRepo.grantUserAccessToChatRoom('workspace-123', 'user-123');
 *
 * // Generate client token
 * const token = chatRepo.createChatUserJwtToken('user-123');
 * ```
 *
 * @format
 * @example ```typescript
 */

// Export types
export * from "./types";

// Export configuration
export * from "./config/secrets";

// Export utilities
export * from "./utils/logger";
export * from "./utils/jwt";

// Export repositories
export {
  EthoraSDKService,
  getEthoraSDKService,
} from "./repositories/ChatRepositoryImpl";
export type { ChatRepository } from "./types";

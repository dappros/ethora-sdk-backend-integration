/**
 * Configuration and secrets management for Ethora SDK
 */

/**
 * Secrets configuration interface
 */
export interface Secrets {
  /** Base URL for the Ethora chat API */
  chatApiUrl: string;
  /** Application ID for the Ethora chat service */
  chatAppId: string;
  /** Secret key for JWT token generation */
  chatAppSecret: string;
}

/**
 * Default timeout configuration
 */
export interface TimeoutConfig {
  /** Total request timeout in milliseconds */
  total: number;
  /** Connection timeout in milliseconds */
  connect: number;
}

/**
 * Default timeout values
 */
export const DEFAULT_TIMEOUT: TimeoutConfig = {
  total: 30000, // 30 seconds
  connect: 5000, // 5 seconds
};

/**
 * JID domain for Ethora chat rooms
 */
export const ETHORA_JID_DOMAIN = "@conference.xmpp.ethoradev.com";

/**
 * Gets secrets configuration
 * 
 * In a real implementation, this would read from environment variables,
 * a secrets manager, or a configuration file.
 * 
 * @returns Secrets configuration object
 * @throws Error if required secrets are not configured
 */
export function getSecretsSync(): Secrets {
  const chatApiUrl = process.env.ETHORA_CHAT_API_URL;
  const chatAppId = process.env.ETHORA_CHAT_APP_ID;
  const chatAppSecret = process.env.ETHORA_CHAT_APP_SECRET;

  if (!chatApiUrl || !chatAppId || !chatAppSecret) {
    throw new Error(
      "Missing required Ethora configuration. Please set the following environment variables:\n" +
      "- ETHORA_CHAT_API_URL\n" +
      "- ETHORA_CHAT_APP_ID\n" +
      "- ETHORA_CHAT_APP_SECRET"
    );
  }

  return {
    chatApiUrl,
    chatAppId,
    chatAppSecret,
  };
}

/**
 * Singleton instance of secrets
 */
let secretsInstance: Secrets | null = null;

/**
 * Gets or creates a singleton instance of secrets
 * 
 * @returns Secrets configuration object
 */
export function getSecrets(): Secrets {
  if (!secretsInstance) {
    secretsInstance = getSecretsSync();
  }
  return secretsInstance;
}


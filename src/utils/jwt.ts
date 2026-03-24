/**
 * JWT token utilities for Ethora SDK
 */

import jwt from "jsonwebtoken";
import type { ServerTokenPayload, ClientTokenPayload } from "../types";
import { getSecrets, Secrets } from "../config/secrets";
import { getLogger } from "./logger";

const logger = getLogger("jwt-utils");

/**
 * Creates a JWT token from the given payload using the chat application's secret
 * 
 * @param payload - The payload to be encoded in the JWT
 * @returns The encoded JWT token
 */
export function createJwtToken(payload: ServerTokenPayload | ClientTokenPayload, customSecrets?: Secrets): string {
  logger.debug("Creating a new JWT token");
  const secrets = customSecrets || getSecrets();
  
  return jwt.sign(
    payload,
    secrets.chatAppSecret,
    {
      algorithm: "HS256",
    }
  );
}

/**
 * Creates a server-to-server JWT token
 * 
 * @returns The encoded JWT token for server authentication
 */
export function createServerToken(
  customSecrets?: Secrets,
  options?: { appId?: string; tenantId?: string },
): string {
  logger.debug("Creating server-to-server JWT token");
  const secrets = customSecrets || getSecrets();
  
  const payload: ServerTokenPayload = {
    data: {
      appId: options?.appId || secrets.chatAppId,
      type: "server",
      ...(options?.tenantId ? { tenantId: options.tenantId } : {}),
    },
  };
  
  return createJwtToken(payload, secrets);
}

/**
 * Creates a client-side JWT token for a specific user ID
 * 
 * @param userId - The unique identifier of the user
 * @returns The encoded JWT token for client-side authentication
 */
export function createClientToken(userId: string, customSecrets?: Secrets): string {
  logger.debug(`Creating a client-side JWT token for user ID: ${userId}`);
  const secrets = customSecrets || getSecrets();
  
  const payload: ClientTokenPayload = {
    data: {
      type: "client",
      userId: String(userId),
      appId: secrets.chatAppId,
    },
  };
  
  const token = createJwtToken(payload, secrets);
  logger.info(`Client JWT token created for user ID: ${userId}`);
  return token;
}

/**
 * Verifies a JWT token
 * 
 * @param token - The JWT token to verify
 * @returns The decoded token payload
 * @throws Error if token is invalid
 */
export function verifyJwtToken(token: string): jwt.JwtPayload {
  logger.debug("Verifying JWT token");
  const secrets = getSecrets();
  
  try {
    return jwt.verify(token, secrets.chatAppSecret, {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;
  } catch (error) {
    logger.error("JWT token verification failed", error);
    throw new Error("Invalid JWT token");
  }
}




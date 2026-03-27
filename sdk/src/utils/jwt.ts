/**
 * JWT token utilities for Ethora SDK
 */

import jwt from "jsonwebtoken";
import type { ServerTokenPayload, ClientTokenPayload } from "../types";
import { getSecrets, Secrets } from "../config/secrets";
import { getLogger } from "./logger";

const logger = getLogger("jwt-utils");

function deriveScopedSecret(secret: string, purpose: string): string {
  return require("crypto")
    .createHmac("sha256", String(secret))
    .update(`ethora:${purpose}:v1`)
    .digest("hex");
}

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

function createScopedJwtToken(
  payload: ServerTokenPayload | ClientTokenPayload,
  purpose: "server" | "client",
  customSecrets?: Secrets
): string {
  const secrets = customSecrets || getSecrets();
  return jwt.sign(
    payload,
    deriveScopedSecret(secrets.chatAppSecret, purpose),
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
  
  return createScopedJwtToken(payload, "server", secrets);
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
  
  const token = createScopedJwtToken(payload, "client", secrets);
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
  const decoded = jwt.decode(token) as jwt.JwtPayload | null;
  const tokenType = String((decoded as any)?.data?.type || "");
  const purpose =
    tokenType === "server" ? "server" :
    tokenType === "client" ? "client" :
    "";
  
  try {
    return jwt.verify(token, purpose ? deriveScopedSecret(secrets.chatAppSecret, purpose) : secrets.chatAppSecret, {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;
  } catch (error) {
    try {
      // TODO(auth-cleanup): remove raw-secret fallback after all callers use purpose-scoped tokens.
      return jwt.verify(token, secrets.chatAppSecret, {
        algorithms: ["HS256"],
      }) as jwt.JwtPayload;
    } catch (fallbackError) {
      logger.error("JWT token verification failed", fallbackError);
      throw new Error("Invalid JWT token");
    }
  }
}




// Client
export { OIDCClient, createClient } from "./client";
export { BindNativeSessionError } from "./bind";

// Authorization Details
export {
  buildAuthorizationDetails,
  parseAuthorizationDetails,
  isAuthorizationDetail,
} from "./authorization-details";
export type {
  AuthorizationDetail,
  AuthorizationDetailInput,
  ResourceAction,
} from "./authorization-details";

// Resources
export { Resources } from "./resources";
export type { ResourceAlias } from "./resources";

// ACR
export { AcrValues, allAcrValues, buildAcrValues } from "./acr";
export type { AcrValue } from "./acr";

// Scope
export { Scopes, allScopes, buildScope } from "./scope";
export type { Scope } from "./scope";

// Prompt
export { Prompts, allPrompts, buildPrompt } from "./prompt";
export type { Prompt } from "./prompt";

// Grant Management
export { GrantManagementActions } from "./grant-management";
export type { GrantManagementAction } from "./grant-management";

// ID Token Claims
export type { IDTokenClaims } from "./id-token-claims";

// Types
export type {
  ClientConfig,
  AuthorizeOptions,
  AuthorizationSession,
  BindNativeSessionResult,
  TokenSet,
} from "./types";

// DPoP
export { createDPoPFetch } from "./dpop";
export type { CreateDPoPFetchOptions, DPoPFetch, DPoPKeyStore, DPoPOptions } from "./dpop";

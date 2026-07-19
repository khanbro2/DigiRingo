/**
 * Telnyx integration config.
 *
 * IMPORTANT: the Telnyx API key is a SECRET and must never live in this app.
 * In "live" mode the app talks to YOUR backend proxy (API_BASE), and the
 * proxy injects `Authorization: Bearer <TELNYX_API_KEY>` server-side.
 *
 * Set these in a `.env` file (see .env.example):
 *   VITE_TELNYX_MODE = "mock" | "live"      (default: mock)
 *   VITE_API_BASE    = "/api/telnyx"        (your backend proxy base path)
 */
import { API_ORIGIN } from "../origin";

type Env = Record<string, string | undefined>;
const env: Env = (import.meta as unknown as { env: Env }).env ?? {};

export const TELNYX_MODE: "mock" | "live" =
  env.VITE_TELNYX_MODE === "live" ? "live" : "mock";

// On native builds API_ORIGIN is the absolute server; on web it's "" (same-origin).
export const API_BASE: string = API_ORIGIN + (env.VITE_API_BASE ?? "/api/telnyx");

/** The messaging profile / brand used by the workspace (set after onboarding). */
export const DEFAULT_MESSAGING_PROFILE_ID = env.VITE_TELNYX_MESSAGING_PROFILE_ID ?? "mp_digiringo_default";
export const DEFAULT_CONNECTION_ID = env.VITE_TELNYX_CONNECTION_ID ?? "conn_digiringo_default";

import { ref, computed } from "vue";
import * as authService from "../services/authService.js";
import { useEditorStore } from "./useEditorStore.js";

const USER_KEY = "auth_user";

// Cookie helpers, its fun

function setCookie(name, value, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  return document.cookie.split("; ").reduce((r, v) => {
    const parts = v.split("=");
    return parts[0] === name ? decodeURIComponent(parts.slice(1).join("=")) : r;
  }, null);
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
}

// Module-level singleton so auth state is shared across all components
const token = ref(getCookie("session") || null);
const user = ref(JSON.parse(localStorage.getItem(USER_KEY) || "null"));

// Resolved once the initial /whoami check finishes
let _initialCheckDone = null;
const initialAuthCheck = new Promise((resolve) => {
  _initialCheckDone = resolve;
});

export function useAuth() {
  const isAuthenticated = computed(() => !!token.value);

  /** Attach the bearer token to a headers object use this in api.js calls. */
  function authHeaders() {
    if (!token.value) return {};
    return { Authorization: `Bearer ${token.value}` };
  }

  /**
   * Register then automatically log the user in.
   * Throws on error caller should catch and display the message.
   */
  async function register(username, email, password) {
    await authService.register(username, email, password);
  }

  /**
   * Log in, persist the token, and fetch user info.
   * Throws on error — caller should catch and display the message.
   */
  async function login(username, password) {
    const data = await authService.login(username, password);
    token.value = data.token;
    setCookie("session", data.token);
    // Store username immediately so it's available without a whoami call
    user.value = { username, NAME: username };
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({ username, NAME: username }),
    );
    // Try to enrich with full user info from server (non-blocking)
    fetchUser();
  }

  /** Clear the session — expires the cookie and removes user info. */
  function logout() {
    token.value = null;
    user.value = null;
    deleteCookie("session");
    localStorage.removeItem(USER_KEY);
    useEditorStore().reset();
  }

  /** Populate `user` from the /whoami endpoint. Safe to call on app boot. */
  async function fetchUser() {
    if (!token.value) {
      _initialCheckDone();
      return;
    }
    try {
      const data = await authService.whoami(token.value);
      user.value = data;
      localStorage.setItem(USER_KEY, JSON.stringify(data));
    } catch {
      // Token is invalid or expired clear session
      logout();
    } finally {
      _initialCheckDone();
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    initialAuthCheck,
    authHeaders,
    register,
    login,
    logout,
    fetchUser,
  };
}

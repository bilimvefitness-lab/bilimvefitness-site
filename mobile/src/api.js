// src/api.js
import { Platform } from "react-native";
import * as Device from "expo-device";

const getFallbackBaseUrl = () => {
    if (Platform.OS === 'web') {
        // Web preview — backend and frontend share the same machine
        return "http://127.0.0.1:8001/api/v1";
    }
    if (Platform.OS === 'android') {
        // Android emulator: 10.0.2.2 is the special alias that routes to the host machine
        return "http://10.0.2.2:8001/api/v1";
    }
    // iOS simulator — localhost resolves to the Mac running the simulator
    // Physical device — must set EXPO_PUBLIC_API_BASE_URL to LAN IP (e.g. http://192.168.1.5:8001/api/v1)
    return "http://localhost:8001/api/v1";
};

const fallbackBaseUrl = getFallbackBaseUrl();
const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

let resolvedBaseUrl = (envBaseUrl || fallbackBaseUrl).trim();
// Force loopback on Web if the env specifies a local network IP for mobile testing
if (Platform.OS === 'web' && (resolvedBaseUrl.includes("192.168.") || resolvedBaseUrl.includes("10.0.") || resolvedBaseUrl.includes("localhost") || resolvedBaseUrl.includes("127.0.0.1"))) {
    resolvedBaseUrl = "http://127.0.0.1:8001/api/v1";
}

export const API_BASE_URL = resolvedBaseUrl;
export const API_BASE_SOURCE = envBaseUrl
  ? ".env / EXPO_PUBLIC_API_BASE_URL"
  : "mobile/src/api.js fallback";

/**
 * True when running on a real physical device (not a simulator/emulator) and
 * EXPO_PUBLIC_API_BASE_URL has not been configured, leaving the fallback URL active.
 *
 * On a physical iOS device   → localhost resolves to the device itself, not the Mac.
 * On a physical Android device → 10.0.2.2 is an emulator-only loopback alias; it
 *   is unreachable from a real Android device.
 *
 * Device.isDevice (expo-device) is the authoritative physical/emulator flag:
 *   true  → real hardware (iPhone, iPad, Android phone/tablet)
 *   false → simulator or emulator
 *
 * Fallback: isDevice is treated as `true` when the value is unavailable so that
 * the guard is conservative (may false-positive on unusual setups, never hides a
 * real misconfiguration).
 */
const _isPhysical = Device.isDevice ?? true;

export const IS_PHYSICAL_DEVICE_MISSING_CONFIG =
  !envBaseUrl &&
  _isPhysical &&
  (
    (Platform.OS === 'ios'     && API_BASE_URL.includes('localhost')) ||
    (Platform.OS === 'android' && (API_BASE_URL.includes('10.0.2.2') || API_BASE_URL.includes('localhost')))
  );

/**
 * Returns true when the resolved API base URL uses plain HTTP against a remote
 * (non-loopback, non-LAN-simulator) host — a signal that transport is insecure.
 */
export function isInsecureTransport() {
  const url = API_BASE_URL;
  return (
    url.startsWith('http://') &&
    !url.includes('localhost') &&
    !url.includes('127.0.0.1') &&
    !url.includes('10.0.2.2')
  );
}

const apiDebugListeners = new Set();
const apiDebugState = {
  baseUrl: API_BASE_URL,
  source: API_BASE_SOURCE,
  lastEvent: "startup",
  lastMethod: null,
  lastPath: null,
  lastRequestUrl: null,
  lastStatus: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  timestamp: new Date().toISOString(),
};

export function buildApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function emitApiDebug(patch) {
  Object.assign(apiDebugState, patch, {
    timestamp: new Date().toISOString(),
  });
  for (const listener of apiDebugListeners) {
    listener({ ...apiDebugState });
  }
}

export function getApiDebugState() {
  return { ...apiDebugState };
}

export function subscribeApiDebug(listener) {
  apiDebugListeners.add(listener);
  listener({ ...apiDebugState });
  return () => {
    apiDebugListeners.delete(listener);
  };
}

function isLikelyWrongDeviceUrl(value) {
  try {
    const url = new URL(value);
    return ["127.0.0.1", "localhost", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}

function createConnectionError(path, code, message, cause) {
  const error = new Error(message);
  error.code = code;
  error.category = "network";
  error.apiBaseUrl = API_BASE_URL;
  error.requestUrl = buildApiUrl(path);
  error.cause = cause;
  return error;
}

function formatBackendMessage(detail, status) {
  if (Array.isArray(detail)) {
    const parts = detail
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return String(entry || "").trim();
        }
        const location = Array.isArray(entry.loc)
          ? entry.loc.filter((piece) => piece !== "body").join(".")
          : "";
        const message = String(entry.msg || entry.message || "").trim();
        if (location && message) {
          return `${location}: ${message}`;
        }
        return message || JSON.stringify(entry);
      })
      .filter(Boolean);
    if (parts.length) {
      return parts.join(" | ");
    }
  }

  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  if (detail && typeof detail === "object") {
    const nested =
      detail.message ||
      detail.detail ||
      detail.error ||
      null;
    if (typeof nested === "string" && nested.trim()) {
      return nested.trim();
    }
  }

  return `İstek ${status} hatası döndü.`;
}

export async function apiRequest(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  const method = (options.method || "GET").toUpperCase();
  const requestUrl = buildApiUrl(path);

  emitApiDebug({
    lastEvent: "request_start",
    lastMethod: method,
    lastPath: path,
    lastRequestUrl: requestUrl,
    lastStatus: null,
    lastErrorCode: null,
    lastErrorMessage: null,
  });
  console.info(`[mobile-api] ${method} ${requestUrl}`);

  let response;
  try {
    response = await fetch(requestUrl, {
      ...options,
      signal: options.signal || controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error?.name === "AbortError") {
      const connectionError = createConnectionError(
        path,
        "network_timeout",
        "Sunucu zamanında yanıt vermedi.",
        error
      );
      emitApiDebug({
        lastEvent: "request_error",
        lastMethod: method,
        lastPath: path,
        lastRequestUrl: requestUrl,
        lastErrorCode: connectionError.code,
        lastErrorMessage: connectionError.message,
      });
      console.warn(`[mobile-api] ${connectionError.code} ${requestUrl}`);
      throw connectionError;
    }
    if (isLikelyWrongDeviceUrl(API_BASE_URL)) {
      const errorMsg = Platform.OS === 'web' 
        ? "API adresi (localhost) ulaşılamaz görünüyor. Backend çalışıyor mu?" 
        : `DİKKAT: Mobil cihazda 'localhost' kullanıyorsun. Bilgisayarının LAN IP adresini (örn. 192.168.1.5) kullanman gerekir.`;
        
      const connectionError = createConnectionError(
        path,
        "wrong_api_base_url",
        errorMsg,
        error
      );
      emitApiDebug({
        lastEvent: "request_error",
        lastMethod: method,
        lastPath: path,
        lastRequestUrl: requestUrl,
        lastErrorCode: connectionError.code,
        lastErrorMessage: connectionError.message,
      });
      console.warn(`[mobile-api] ${connectionError.code} ${requestUrl}`);
      throw connectionError;
    }
    const connectionError = createConnectionError(
      path,
      "backend_unreachable",
      "Sunucuya ulaşılamadı.",
      error
    );
    emitApiDebug({
      lastEvent: "request_error",
      lastMethod: method,
      lastPath: path,
      lastRequestUrl: requestUrl,
      lastErrorCode: connectionError.code,
      lastErrorMessage: connectionError.message,
    });
    console.warn(`[mobile-api] ${connectionError.code} ${requestUrl}`);
    throw connectionError;
  } finally {
    clearTimeout(timeoutId);
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const detail = payload?.detail ?? payload?.message ?? payload;
    const message = formatBackendMessage(detail, response.status);
    const error = new Error(message);
    error.status = response.status;
    error.apiBaseUrl = API_BASE_URL;
    error.requestUrl = requestUrl;
    error.code =
      response.status === 422
        ? "validation_error"
        : response.status >= 500
          ? "backend_server_error"
          : "backend_error";
    error.category = response.status === 422 ? "validation" : "backend";
    error.backendDetail = detail;
    emitApiDebug({
      lastEvent: "request_http_error",
      lastMethod: method,
      lastPath: path,
      lastRequestUrl: requestUrl,
      lastStatus: response.status,
      lastErrorCode: error.code,
      lastErrorMessage: message,
    });
    console.warn(`[mobile-api] ${error.code} ${response.status} ${requestUrl} :: ${message}`);
    throw error;
  }

  emitApiDebug({
    lastEvent: "request_success",
    lastMethod: method,
    lastPath: path,
    lastRequestUrl: requestUrl,
    lastStatus: response.status,
    lastErrorCode: null,
    lastErrorMessage: null,
  });
  console.info(`[mobile-api] ok ${response.status} ${requestUrl}`);
  return payload;
}

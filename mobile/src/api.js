const fallbackBaseUrl = "http://192.168.1.111:8000/api/v1";
const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

export const API_BASE_URL = (envBaseUrl || fallbackBaseUrl).trim();
export const API_BASE_SOURCE = envBaseUrl
  ? ".env / EXPO_PUBLIC_API_BASE_URL"
  : "mobile/src/api.js fallback";

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
      const connectionError = createConnectionError(
        path,
        "wrong_api_base_url",
        "API adresi telefondan erişilemez görünüyor.",
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

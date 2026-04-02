const stepDebugListeners = new Set();
const stepDebugState = {
  lastEvent: "idle",
  provider: null,
  permissionStatus: null,
  lastSyncAt: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  timestamp: new Date().toISOString(),
};

function emitStepDebug(patch) {
  Object.assign(stepDebugState, patch, {
    timestamp: new Date().toISOString(),
  });

  for (const listener of stepDebugListeners) {
    listener({ ...stepDebugState });
  }
}

export function getStepDebugState() {
  return { ...stepDebugState };
}

export function subscribeStepDebug(listener) {
  stepDebugListeners.add(listener);
  listener({ ...stepDebugState });
  return () => {
    stepDebugListeners.delete(listener);
  };
}

export function stepInfo(event, patch = {}) {
  console.info(`[mobile-steps] ${event}`);
  emitStepDebug({
    lastEvent: event,
    ...patch,
  });
}

export function stepWarn(event, patch = {}) {
  console.warn(`[mobile-steps] ${event}`);
  emitStepDebug({
    lastEvent: event,
    ...patch,
  });
}

export function createStepError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  error.category = "steps";
  Object.assign(error, extra);
  return error;
}

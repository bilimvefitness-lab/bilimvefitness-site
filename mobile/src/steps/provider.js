import { Linking, Platform } from "react-native";
import { Pedometer } from "expo-sensors";

import { createStepError, stepInfo, stepWarn } from "./debug";

function toStartOfDay(dateKey) {
  return new Date(`${dateKey}T00:00:00`);
}

function toEndOfDay(dateKey) {
  return new Date(`${dateKey}T23:59:59.999`);
}

function buildDateKeys(count) {
  const dates = [];
  const today = new Date();
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const current = new Date(today);
    current.setHours(12, 0, 0, 0);
    current.setDate(today.getDate() - offset);
    dates.push(current.toISOString().slice(0, 10));
  }
  return dates;
}

function buildHourlySteps(dateKey, resolver = () => ({ stepCount: 0, available: false })) {
  return Array.from({ length: 24 }, (_, hour) => {
    const resolved = resolver(hour) || {};
    return {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      stepCount: Math.max(Number(resolved.stepCount || 0), 0),
      available: resolved.available !== false,
    };
  });
}

function normalizePermissionState({
  status,
  provider,
  reason = "",
  canAskAgain = true,
}) {
  return {
    status,
    provider,
    reason,
    canAskAgain,
  };
}

function normalizeDayRecord(dateKey, stepCount, source, available = true) {
  return {
    date: dateKey,
    stepCount: Math.max(Number(stepCount || 0), 0),
    source,
    available,
  };
}

function mapExpoPermission(permission, provider) {
  if (permission?.granted) {
    return normalizePermissionState({
      status: "granted",
      provider,
      canAskAgain: Boolean(permission?.canAskAgain),
    });
  }

  if (permission?.status === "denied") {
    return normalizePermissionState({
      status: "denied",
      provider,
      reason: "Hareket verisi izni reddedildi.",
      canAskAgain: Boolean(permission?.canAskAgain),
    });
  }

  return normalizePermissionState({
    status: "pending",
    provider,
    reason: "Adım verisini okuyabilmek için izin gerekli.",
    canAskAgain: true,
  });
}

async function loadAndroidHealthConnect() {
  return require("react-native-health-connect");
}

async function getIosPermissionState() {
  const isAvailable = await Pedometer.isAvailableAsync();
  if (!isAvailable) {
    return normalizePermissionState({
      status: "unavailable",
      provider: "ios_pedometer",
      reason: "Bu cihazda pedometre verisi kullanılamıyor.",
      canAskAgain: false,
    });
  }

  const permission = await Pedometer.getPermissionsAsync();
  return mapExpoPermission(permission, "ios_pedometer");
}

async function requestIosPermission() {
  const isAvailable = await Pedometer.isAvailableAsync();
  if (!isAvailable) {
    return normalizePermissionState({
      status: "unavailable",
      provider: "ios_pedometer",
      reason: "Bu cihazda pedometre verisi kullanılamıyor.",
      canAskAgain: false,
    });
  }

  const permission = await Pedometer.requestPermissionsAsync();
  return mapExpoPermission(permission, "ios_pedometer");
}

async function ensureAndroidPermissionState() {
  let healthConnect;
  try {
    healthConnect = await loadAndroidHealthConnect();
  } catch (error) {
    throw createStepError("step_android_module_missing", "Health Connect modülü yüklenemedi.", {
      cause: error,
    });
  }

  try {
    const sdkStatus = await healthConnect.getSdkStatus();
    if (sdkStatus === healthConnect.SdkAvailabilityStatus.SDK_UNAVAILABLE) {
      return {
        permission: normalizePermissionState({
          status: "unavailable",
          provider: "android_health_connect",
          reason: "Health Connect bu cihazda kullanılamıyor ya da development build gerekli.",
          canAskAgain: false,
        }),
        healthConnect,
      };
    }
    if (sdkStatus === healthConnect.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return {
        permission: normalizePermissionState({
          status: "unavailable",
          provider: "android_health_connect",
          reason: "Health Connect güncellemesi gerekli.",
          canAskAgain: false,
        }),
        healthConnect,
      };
    }

    const initialized = await healthConnect.initialize();
    if (!initialized) {
      return {
        permission: normalizePermissionState({
          status: "unavailable",
          provider: "android_health_connect",
          reason: "Health Connect başlatılamadı.",
          canAskAgain: false,
        }),
        healthConnect,
      };
    }

    const grantedPermissions = await healthConnect.getGrantedPermissions();
    const hasStepsReadPermission = grantedPermissions.some(
      (item) => item?.accessType === "read" && item?.recordType === "Steps"
    );
    return {
      permission: normalizePermissionState({
        status: hasStepsReadPermission ? "granted" : "pending",
        provider: "android_health_connect",
        reason: hasStepsReadPermission ? "" : "Health Connect erişimi gerekli.",
        canAskAgain: true,
      }),
      healthConnect,
    };
  } catch (error) {
    const message = String(error?.message || "");
    if (message.includes("Expo Go") || message.includes("linked")) {
      return {
        permission: normalizePermissionState({
          status: "unavailable",
          provider: "android_health_connect",
          reason: "Android otomatik adım verisi için development build ve Health Connect gerekiyor.",
          canAskAgain: false,
        }),
        healthConnect,
      };
    }
    throw createStepError("step_android_provider_error", "Health Connect durumu okunamadı.", {
      cause: error,
    });
  }
}

const iosProvider = {
  name: "ios_pedometer",
  async getPermissionState() {
    const state = await getIosPermissionState();
    stepInfo("ios_permission_state", {
      provider: this.name,
      permissionStatus: state.status,
    });
    return state;
  },
  async requestPermission() {
    const state = await requestIosPermission();
    stepInfo("ios_permission_request", {
      provider: this.name,
      permissionStatus: state.status,
    });
    return state;
  },
  async getDaySteps(dateKey) {
    const permission = await this.getPermissionState();
    if (permission.status !== "granted") {
      throw createStepError("step_permission_missing", permission.reason || "Pedometer izni gerekli.", {
        permission,
      });
    }

    const result = await Pedometer.getStepCountAsync(toStartOfDay(dateKey), toEndOfDay(dateKey));
    return normalizeDayRecord(dateKey, result?.steps ?? 0, this.name, true);
  },
  async getLast7DaysSteps() {
    const dates = buildDateKeys(7);
    const result = await Promise.all(dates.map((dateKey) => this.getDaySteps(dateKey)));
    stepInfo("ios_last_7_days_loaded", {
      provider: this.name,
      permissionStatus: "granted",
    });
    return result;
  },
  async getHourlySteps(dateKey) {
    const permission = await this.getPermissionState();
    if (permission.status !== "granted") {
      throw createStepError("step_permission_missing", permission.reason || "Pedometer izni gerekli.", {
        permission,
      });
    }

    const todayDateKey = buildDateKeys(1)[0];
    const now = new Date();
    const result = await Promise.all(
      buildHourlySteps(dateKey).map(async ({ hour }) => {
        const start = new Date(`${dateKey}T${String(hour).padStart(2, "0")}:00:00`);
        const end = new Date(start);
        end.setHours(start.getHours() + 1, 0, 0, 0);

        if (dateKey === todayDateKey && start >= now) {
          return {
            hour,
            label: `${String(hour).padStart(2, "0")}:00`,
            stepCount: 0,
            available: false,
          };
        }

        const rangeEnd = dateKey === todayDateKey && end > now ? now : end;
        const stepResult = await Pedometer.getStepCountAsync(start, rangeEnd);
        return {
          hour,
          label: `${String(hour).padStart(2, "0")}:00`,
          stepCount: stepResult?.steps ?? 0,
          available: true,
        };
      })
    );

    stepInfo("ios_hourly_steps_loaded", {
      provider: this.name,
      permissionStatus: "granted",
    });
    return result;
  },
  async openSettings() {
    await Linking.openSettings();
  },
};

const androidProvider = {
  name: "android_health_connect",
  async getPermissionState() {
    const { permission } = await ensureAndroidPermissionState();
    stepInfo("android_permission_state", {
      provider: this.name,
      permissionStatus: permission.status,
    });
    return permission;
  },
  async requestPermission() {
    const { permission, healthConnect } = await ensureAndroidPermissionState();
    if (permission.status === "unavailable") {
      return permission;
    }

    try {
      const grantedPermissions = await healthConnect.requestPermission([
        {
          accessType: "read",
          recordType: "Steps",
        },
      ]);
      const granted = grantedPermissions.some(
        (item) => item?.accessType === "read" && item?.recordType === "Steps"
      );
      const result = normalizePermissionState({
        status: granted ? "granted" : "denied",
        provider: this.name,
        reason: granted ? "" : "Health Connect adım izni reddedildi.",
        canAskAgain: !granted,
      });
      stepInfo("android_permission_request", {
        provider: this.name,
        permissionStatus: result.status,
      });
      return result;
    } catch (error) {
      throw createStepError("step_permission_request_failed", "Health Connect izni istenemedi.", {
        cause: error,
      });
    }
  },
  async getDaySteps(dateKey) {
    const { permission, healthConnect } = await ensureAndroidPermissionState();
    if (permission.status !== "granted") {
      throw createStepError("step_permission_missing", permission.reason || "Health Connect erişimi gerekli.", {
        permission,
      });
    }

    const result = await healthConnect.aggregateRecord({
      recordType: "Steps",
      timeRangeFilter: {
        operator: "between",
        startTime: toStartOfDay(dateKey).toISOString(),
        endTime: toEndOfDay(dateKey).toISOString(),
      },
    });

    return normalizeDayRecord(dateKey, result?.COUNT_TOTAL ?? 0, this.name, true);
  },
  async getLast7DaysSteps() {
    const dates = buildDateKeys(7);
    const result = await Promise.all(dates.map((dateKey) => this.getDaySteps(dateKey)));
    stepInfo("android_last_7_days_loaded", {
      provider: this.name,
      permissionStatus: "granted",
    });
    return result;
  },
  async getHourlySteps(dateKey) {
    const { permission, healthConnect } = await ensureAndroidPermissionState();
    if (permission.status !== "granted") {
      throw createStepError("step_permission_missing", permission.reason || "Health Connect erisimi gerekli.", {
        permission,
      });
    }

    const startTime = new Date(`${dateKey}T00:00:00`);
    const endTime = new Date(`${dateKey}T23:59:59.999`);
    const grouped = await healthConnect.aggregateGroupByDuration({
      recordType: "Steps",
      timeRangeFilter: {
        operator: "between",
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
      timeRangeSlicer: {
        duration: "HOURS",
        length: 1,
      },
    });

    const hourlyMap = new Map(
      (grouped || []).map((item) => [
        new Date(item?.startTime).getHours(),
        {
          stepCount: item?.result?.COUNT_TOTAL ?? 0,
          available: true,
        },
      ])
    );

    const result = buildHourlySteps(dateKey, (hour) => hourlyMap.get(hour));
    stepInfo("android_hourly_steps_loaded", {
      provider: this.name,
      permissionStatus: "granted",
    });
    return result;
  },
  async openSettings() {
    try {
      const healthConnect = await loadAndroidHealthConnect();
      healthConnect.openHealthConnectSettings();
    } catch (error) {
      stepWarn("android_open_settings_failed", {
        provider: this.name,
        lastErrorCode: "step_open_settings_failed",
        lastErrorMessage: String(error?.message || error),
      });
      await Linking.openSettings();
    }
  },
};

const unsupportedProvider = {
  name: "unsupported",
  async getPermissionState() {
    return normalizePermissionState({
      status: "unavailable",
      provider: "unsupported",
      reason: "Bu platformda adım verisi desteklenmiyor.",
      canAskAgain: false,
    });
  },
  async requestPermission() {
    return this.getPermissionState();
  },
  async getDaySteps(dateKey) {
    return normalizeDayRecord(dateKey, 0, "unknown", false);
  },
  async getLast7DaysSteps() {
    return buildDateKeys(7).map((dateKey) => normalizeDayRecord(dateKey, 0, "unknown", false));
  },
  async getHourlySteps(dateKey) {
    return buildHourlySteps(dateKey);
  },
  async openSettings() {},
};

export function createStepProvider() {
  if (Platform.OS === "ios") {
    return iosProvider;
  }
  if (Platform.OS === "android") {
    return androidProvider;
  }
  return unsupportedProvider;
}

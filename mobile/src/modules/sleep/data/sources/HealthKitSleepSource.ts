import { Linking, Platform } from "react-native";

import { SleepSource } from "../../domain/models/SleepRawSegment";
import {
  SleepPermissionStatus,
  SleepSourceReadStatus,
  type SleepPermissionState,
  type SleepSourceReadResult,
} from "../../domain/models/SleepSession";
import { normalizeHealthKitSamples } from "../../domain/services/SleepNormalizer";

type SleepReadWindow = {
  startDate: string;
  endDate: string;
};

let lastKnownHealthKitPermission: SleepPermissionState | null = null;

function createPermissionState(
  status: (typeof SleepPermissionStatus)[keyof typeof SleepPermissionStatus],
  reason: string,
  canAskAgain: boolean
): SleepPermissionState {
  return {
    status,
    source: SleepSource.APPLE_HEALTH,
    reason,
    canAskAgain,
  };
}

function createReadResult(
  status: (typeof SleepSourceReadStatus)[keyof typeof SleepSourceReadStatus],
  permission: SleepPermissionState,
  message: string,
  rawSegments: SleepSourceReadResult["rawSegments"] = [],
  sessions: SleepSourceReadResult["sessions"] = [],
  errorCode?: string
): SleepSourceReadResult {
  return {
    status,
    source: SleepSource.APPLE_HEALTH,
    rawSegments,
    sessions,
    permission,
    message,
    errorCode,
  };
}

function loadHealthKitModule() {
  const moduleValue = require("react-native-health");
  return moduleValue?.default || moduleValue;
}

function healthKitPermissions(AppleHealthKit: any) {
  return {
    permissions: {
      read: [AppleHealthKit.Constants.Permissions.SleepAnalysis],
      write: [],
    },
  };
}

function callbackToPromise<T>(executor: (callback: (error: any, result: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    executor((error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });
}

function isPermissionError(error: unknown) {
  const message = String((error as any)?.message || error || "").toLowerCase();
  return (
    message.includes("authorization") ||
    message.includes("not authorized") ||
    message.includes("denied") ||
    message.includes("permission")
  );
}

export class HealthKitSleepSource {
  readonly source = SleepSource.APPLE_HEALTH;

  async getPermissionState(): Promise<SleepPermissionState> {
    if (Platform.OS !== "ios") {
      return createPermissionState(
        SleepPermissionStatus.UNAVAILABLE,
        "Apple Health sadece iOS cihazlarda kullanilabilir.",
        false
      );
    }

    let AppleHealthKit;
    try {
      AppleHealthKit = loadHealthKitModule();
    } catch {
      return createPermissionState(
        SleepPermissionStatus.UNAVAILABLE,
        "Apple Health uyku entegrasyonu bu buildde hazir degil.",
        false
      );
    }

    const available = await callbackToPromise<boolean>((callback) => AppleHealthKit.isAvailable(callback)).catch(() => false);
    if (!available) {
      return createPermissionState(
        SleepPermissionStatus.UNAVAILABLE,
        "Bu cihazda Apple Health kullanilamiyor.",
        false
      );
    }

    if (lastKnownHealthKitPermission) {
      return lastKnownHealthKitPermission;
    }

    return createPermissionState(
      SleepPermissionStatus.PENDING,
      "iOS okuma izni dogrudan sorgulanamadigi icin ilk okuma veya izin akisi gerekli.",
      true
    );
  }

  async requestPermission(): Promise<SleepPermissionState> {
    const currentState = await this.getPermissionState();
    if (currentState.status === SleepPermissionStatus.UNAVAILABLE) {
      return currentState;
    }

    try {
      const AppleHealthKit = loadHealthKitModule();
      await callbackToPromise((callback) =>
        AppleHealthKit.initHealthKit(healthKitPermissions(AppleHealthKit), callback)
      );
      lastKnownHealthKitPermission = createPermissionState(SleepPermissionStatus.GRANTED, "", true);
      return lastKnownHealthKitPermission;
    } catch {
      lastKnownHealthKitPermission = createPermissionState(
        SleepPermissionStatus.DENIED,
        "Apple Health uyku izni reddedildi.",
        true
      );
      return lastKnownHealthKitPermission;
    }
  }

  async openSettings() {
    await Linking.openSettings();
  }

  async read(window: SleepReadWindow): Promise<SleepSourceReadResult> {
    const permission = await this.getPermissionState();
    if (permission.status === SleepPermissionStatus.UNAVAILABLE) {
      return createReadResult(
        SleepSourceReadStatus.SOURCE_NOT_AVAILABLE,
        permission,
        permission.reason,
        [],
        [],
        "healthkit_unavailable"
      );
    }

    try {
      const AppleHealthKit = loadHealthKitModule();
      const samples = await callbackToPromise<any[]>((callback) =>
        AppleHealthKit.getSleepSamples(
          {
            startDate: window.startDate,
            endDate: window.endDate,
            ascending: true,
            limit: 500,
          },
          callback
        )
      );

      lastKnownHealthKitPermission = createPermissionState(SleepPermissionStatus.GRANTED, "", true);
      const normalized = normalizeHealthKitSamples(samples || []);
      if (!normalized.sessions.length) {
        return createReadResult(
          SleepSourceReadStatus.NO_DATA,
          lastKnownHealthKitPermission,
          "Bu aralikta Apple Health uyku verisi bulunamadi."
        );
      }

      const hasStageData = normalized.sessions.some((session) => session.isStageDataAvailable);
      return createReadResult(
        hasStageData ? SleepSourceReadStatus.SUCCESS : SleepSourceReadStatus.PARTIAL_DATA,
        lastKnownHealthKitPermission,
        hasStageData
          ? "Apple Health uyku verisi guncellendi."
          : "Toplam uyku verisi bulundu ancak stage verisi mevcut degil.",
        normalized.rawSegments,
        normalized.sessions
      );
    } catch (error) {
      if (isPermissionError(error)) {
        lastKnownHealthKitPermission = createPermissionState(
          SleepPermissionStatus.DENIED,
          "Apple Health uyku izni verilmedi.",
          true
        );
        return createReadResult(
          SleepSourceReadStatus.PERMISSION_DENIED,
          lastKnownHealthKitPermission,
          lastKnownHealthKitPermission.reason,
          [],
          [],
          "healthkit_permission_denied"
        );
      }

      return createReadResult(
        SleepSourceReadStatus.SOURCE_NOT_AVAILABLE,
        permission,
        "Apple Health uyku verisi okunamadi.",
        [],
        [],
        "healthkit_read_failed"
      );
    }
  }
}

import { Linking, Platform } from "react-native";

import { SleepSource } from "../../domain/models/SleepRawSegment";
import {
  SleepPermissionStatus,
  SleepSourceReadStatus,
  type SleepPermissionState,
  type SleepSourceReadResult,
} from "../../domain/models/SleepSession";
import { normalizeHealthConnectRecords } from "../../domain/services/SleepNormalizer";

type SleepReadWindow = {
  startDate: string;
  endDate: string;
};

function createPermissionState(
  status: (typeof SleepPermissionStatus)[keyof typeof SleepPermissionStatus],
  reason: string,
  canAskAgain: boolean
): SleepPermissionState {
  return {
    status,
    source: SleepSource.HEALTH_CONNECT,
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
    source: SleepSource.HEALTH_CONNECT,
    rawSegments,
    sessions,
    permission,
    message,
    errorCode,
  };
}

function mapProviderStatus(healthConnect: any, sdkStatus: number) {
  if (sdkStatus === healthConnect?.SdkAvailabilityStatus?.SDK_AVAILABLE) {
    return null;
  }
  if (sdkStatus === healthConnect?.SdkAvailabilityStatus?.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return createPermissionState(
      SleepPermissionStatus.NOT_INSTALLED,
      "Health Connect kurulu degil veya guncel degil.",
      true
    );
  }
  return createPermissionState(
    SleepPermissionStatus.UNAVAILABLE,
    "Bu cihazda Health Connect uyku verisi kullanilamiyor.",
    false
  );
}

async function loadHealthConnectModule() {
  return require("react-native-health-connect");
}

export class HealthConnectSleepSource {
  readonly source = SleepSource.HEALTH_CONNECT;

  async getPermissionState(): Promise<SleepPermissionState> {
    if (Platform.OS !== "android") {
      return createPermissionState(
        SleepPermissionStatus.UNAVAILABLE,
        "Health Connect sadece Android cihazlarda kullanilabilir.",
        false
      );
    }

    let healthConnect;
    try {
      healthConnect = await loadHealthConnectModule();
    } catch {
      return createPermissionState(
        SleepPermissionStatus.UNAVAILABLE,
        "Android uyku entegrasyonu bu buildde hazir degil.",
        false
      );
    }

    try {
      const sdkStatus = await healthConnect.getSdkStatus();
      const providerState = mapProviderStatus(healthConnect, sdkStatus);
      if (providerState) {
        return providerState;
      }

      const initialized = await healthConnect.initialize();
      if (!initialized) {
        return createPermissionState(
          SleepPermissionStatus.UNAVAILABLE,
          "Health Connect baslatilamadi.",
          false
        );
      }

      const grantedPermissions = await healthConnect.getGrantedPermissions();
      const hasPermission = grantedPermissions.some(
        (item: any) => item?.accessType === "read" && item?.recordType === "SleepSession"
      );
      if (hasPermission) {
        return createPermissionState(SleepPermissionStatus.GRANTED, "", true);
      }

      return createPermissionState(
        SleepPermissionStatus.PENDING,
        "Uyku verisini okuyabilmek icin Health Connect erisimi gerekli.",
        true
      );
    } catch {
      return createPermissionState(
        SleepPermissionStatus.UNAVAILABLE,
        "Health Connect durumu okunamadi.",
        false
      );
    }
  }

  async requestPermission(): Promise<SleepPermissionState> {
    const currentState = await this.getPermissionState();
    if (currentState.status === SleepPermissionStatus.UNAVAILABLE) {
      return currentState;
    }
    if (currentState.status === SleepPermissionStatus.NOT_INSTALLED) {
      return currentState;
    }

    try {
      const healthConnect = await loadHealthConnectModule();
      const grantedPermissions = await healthConnect.requestPermission([
        {
          accessType: "read",
          recordType: "SleepSession",
        },
      ]);
      const granted = grantedPermissions.some(
        (item: any) => item?.accessType === "read" && item?.recordType === "SleepSession"
      );
      return createPermissionState(
        granted ? SleepPermissionStatus.GRANTED : SleepPermissionStatus.DENIED,
        granted ? "" : "Health Connect uyku izni reddedildi.",
        !granted
      );
    } catch {
      return createPermissionState(
        SleepPermissionStatus.DENIED,
        "Health Connect uyku izni istenemedi.",
        true
      );
    }
  }

  async openSettings() {
    try {
      const healthConnect = await loadHealthConnectModule();
      healthConnect.openHealthConnectSettings();
    } catch {
      await Linking.openSettings();
    }
  }

  async read(window: SleepReadWindow): Promise<SleepSourceReadResult> {
    const permission = await this.getPermissionState();
    if (permission.status === SleepPermissionStatus.DENIED) {
      return createReadResult(
        SleepSourceReadStatus.PERMISSION_DENIED,
        permission,
        "Uyku verisine erisim izni verilmedi.",
        [],
        [],
        "health_connect_permission_denied"
      );
    }
    if (permission.status === SleepPermissionStatus.UNAVAILABLE) {
      return createReadResult(
        SleepSourceReadStatus.SOURCE_NOT_AVAILABLE,
        permission,
        permission.reason,
        [],
        [],
        "health_connect_unavailable"
      );
    }
    if (permission.status === SleepPermissionStatus.NOT_INSTALLED) {
      return createReadResult(
        SleepSourceReadStatus.SOURCE_NOT_INSTALLED,
        permission,
        permission.reason,
        [],
        [],
        "health_connect_not_installed"
      );
    }
    if (permission.status !== SleepPermissionStatus.GRANTED) {
      return createReadResult(
        SleepSourceReadStatus.PERMISSION_DENIED,
        permission,
        "Uyku verisi okumasi icin izin gerekli.",
        [],
        [],
        "health_connect_permission_missing"
      );
    }

    try {
      const healthConnect = await loadHealthConnectModule();
      const records: any[] = [];
      let pageToken: string | undefined;

      do {
        const response = await healthConnect.readRecords("SleepSession", {
          timeRangeFilter: {
            operator: "between",
            startTime: window.startDate,
            endTime: window.endDate,
          },
          ascendingOrder: true,
          pageSize: 200,
          pageToken,
        });
        records.push(...(response?.records || []));
        pageToken = response?.pageToken;
      } while (pageToken);

      const normalized = normalizeHealthConnectRecords(records);
      if (!normalized.sessions.length) {
        return createReadResult(
          SleepSourceReadStatus.NO_DATA,
          permission,
          "Bu aralikta Health Connect uyku verisi bulunamadi."
        );
      }

      const hasStageData = normalized.sessions.some((session) => session.isStageDataAvailable);
      return createReadResult(
        hasStageData ? SleepSourceReadStatus.SUCCESS : SleepSourceReadStatus.PARTIAL_DATA,
        permission,
        hasStageData
          ? "Health Connect uyku verisi guncellendi."
          : "Toplam uyku verisi bulundu ancak stage verisi mevcut degil.",
        normalized.rawSegments,
        normalized.sessions
      );
    } catch {
      return createReadResult(
        SleepSourceReadStatus.SOURCE_NOT_AVAILABLE,
        permission,
        "Health Connect uyku verisi okunamadi.",
        [],
        [],
        "health_connect_read_failed"
      );
    }
  }
}

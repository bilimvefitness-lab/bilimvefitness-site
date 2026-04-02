import { Platform } from "react-native";

import { SleepPermissionStatus, type SleepPermissionState } from "../../domain/models/SleepSession";
import { SleepSource } from "../../domain/models/SleepRawSegment";
import { HealthConnectSleepSource } from "../sources/HealthConnectSleepSource";
import { HealthKitSleepSource } from "../sources/HealthKitSleepSource";

type PermissionCapableSource = {
  getPermissionState: () => Promise<SleepPermissionState>;
  requestPermission: () => Promise<SleepPermissionState>;
  openSettings: () => Promise<void> | void;
};

function unsupportedState(reason: string): SleepPermissionState {
  return {
    status: SleepPermissionStatus.UNAVAILABLE,
    source: "unknown",
    reason,
    canAskAgain: false,
  };
}

export class SleepPermissionService {
  constructor(
    private readonly healthKitSource: PermissionCapableSource = new HealthKitSleepSource(),
    private readonly healthConnectSource: PermissionCapableSource = new HealthConnectSleepSource()
  ) {}

  private getActiveSource(): PermissionCapableSource | null {
    if (Platform.OS === "ios") {
      return this.healthKitSource;
    }
    if (Platform.OS === "android") {
      return this.healthConnectSource;
    }
    return null;
  }

  async getPermissionState() {
    const source = this.getActiveSource();
    if (!source) {
      return unsupportedState("Bu cihazda otomatik uyku entegrasyonu desteklenmiyor.");
    }
    return source.getPermissionState();
  }

  async requestPermission() {
    const source = this.getActiveSource();
    if (!source) {
      return unsupportedState("Bu cihazda otomatik uyku entegrasyonu desteklenmiyor.");
    }
    return source.requestPermission();
  }

  async openSettings() {
    const source = this.getActiveSource();
    if (!source) {
      return;
    }
    await source.openSettings();
  }

  getPreferredSource() {
    if (Platform.OS === "ios") {
      return SleepSource.APPLE_HEALTH;
    }
    if (Platform.OS === "android") {
      return SleepSource.HEALTH_CONNECT;
    }
    return null;
  }
}

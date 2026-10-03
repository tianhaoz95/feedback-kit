import { TurboModuleRegistry, type TurboModule, type CodegenTypes } from 'react-native';

/**
 * The native module's codegen spec. Objects cross as plain maps in the shapes
 * `FeedbackKitBridge` (Swift and Kotlin SDKs) produces; `index.tsx` types them.
 */
export interface Spec extends TurboModule {
  configure(configuration: CodegenTypes.UnsafeObject | null): void;
  isConfigured(): boolean;
  setCurrentScreen(name: string | null): void;
  setTheme(theme: CodegenTypes.UnsafeObject | null): void;
  setUser(user: CodegenTypes.UnsafeObject | null): void;
  setDefaultProductKey(key: string | null): void;
  getReporterId(): string;

  present(): Promise<CodegenTypes.UnsafeObject | null>;
  presentAndSubmit(): Promise<CodegenTypes.UnsafeObject | null>;
  presentAndSubmitIfConfigured(): Promise<CodegenTypes.UnsafeObject | null>;

  showFloatingTriggerButton(): void;
  hideFloatingTriggerButton(): void;
  enableShakeToReport(): void;
  disableShakeToReport(): void;
  enableFixVerification(): void;
  disableFixVerification(): void;
  presentFixUpdatesIfNeeded(): void;

  /** Submissions that finish natively, including ones from the floating button or a shake. */
  readonly onSubmissionResult: CodegenTypes.EventEmitter<CodegenTypes.UnsafeObject>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('FeedbackKit');

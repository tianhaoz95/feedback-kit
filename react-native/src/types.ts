/** Configuration for the optional hosted-dashboard submission path. */
export interface FeedbackKitConfiguration {
  /** e.g. `https://<project>.supabase.co/functions/v1/ingest-feedback`. */
  endpointUrl: string;
  /** The project key from the dashboard — a routing key, safe to ship in the app. */
  projectKey: string;
  /** Products of this project. Empty fetches them from the backend. */
  products?: FeedbackProduct[];
  /** The default product for this app target (e.g. `"react-native"`). */
  defaultProductKey?: string | null;
  /** Where fix updates come from; omitted derives it from `endpointUrl`. */
  reporterUpdatesUrl?: string | null;
}

export interface FeedbackProduct {
  key: string;
  name: string;
  description?: string;
  isDefault?: boolean;
}

/** Hex colors like `"#7C3AED"`. Primary: send button, selected tool. Secondary: Cancel, attach. */
export interface FeedbackTheme {
  primaryColorHex: string;
  secondaryColorHex: string;
}

export interface FeedbackUser {
  id?: string | null;
  email?: string | null;
  name?: string | null;
}

export type FeedbackAnnotationKind = 'rectangle' | 'arrow' | 'freehand' | 'text';

/** A markup shape. Points are `[x, y]`, normalized to 0...1 of the screenshot. */
export interface FeedbackAnnotation {
  kind: FeedbackAnnotationKind;
  points: [number, number][];
  colorHex: string;
  label?: string;
  scale: number;
  rotation: number;
}

export interface FeedbackAttachment {
  filename: string;
  mimeType: string;
  /** Base64. */
  data: string;
}

/** The native SDK's environment (`osName` is "iOS"/"iPadOS" or "Android"). */
export interface FeedbackEnvironment {
  osName: string;
  osVersion: string;
  deviceModel: string;
  appVersion: string;
  appBuild: string;
  bundleIdentifier: string;
  screenName?: string | null;
  locale: string;
  screenWidthPoints: number;
  screenHeightPoints: number;
  screenScale: number;
}

/** The finished report. Binary fields are base64 strings. */
export interface FeedbackReport {
  id: string;
  /** ISO 8601. */
  createdAt: string;
  text: string;
  /** Raw capture, base64 PNG. Absent if the reporter turned "Include Screenshot" off. */
  screenshotRawPng?: string | null;
  /** The capture with annotations burned in, base64 PNG. */
  screenshotAnnotatedPng?: string | null;
  annotations: FeedbackAnnotation[];
  environment: FeedbackEnvironment;
  attachment?: FeedbackAttachment | null;
  products: FeedbackProduct[];
  notifyReporter: boolean;
}

export type FeedbackSubmissionResult =
  | { status: 'success'; report: FeedbackReport }
  | { status: 'failure'; error: string };

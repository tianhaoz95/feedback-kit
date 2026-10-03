import { useSyncExternalStore } from 'react';
import { FeedbackKit, type FeedbackTheme } from 'feedbackkit-react-native';

export const DEFAULT_ENDPOINT = 'https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback';

/** The brand presets in Settings > Branding — the same as the native demos. */
export const BRANDINGS: { id: string; name: string; theme: FeedbackTheme | null }[] = [
  { id: 'system', name: 'System Blue', theme: null },
  { id: 'sunset', name: 'Sunset', theme: { primaryColorHex: '#7C3AED', secondaryColorHex: '#F97316' } },
  { id: 'ocean', name: 'Ocean', theme: { primaryColorHex: '#0EA5E9', secondaryColorHex: '#14B8A6' } },
  { id: 'forest', name: 'Forest', theme: { primaryColorHex: '#16A34A', secondaryColorHex: '#CA8A04' } },
];

interface State {
  apiKey: string;
  endpointUrl: string;
  branding: string;
}

/**
 * The project key + endpoint from Settings. Unlike the native demos this
 * isn't persisted across launches, to keep the example free of extra native
 * dependencies; paste the key again after a restart.
 */
let state: State = { apiKey: '', endpointUrl: DEFAULT_ENDPOINT, branding: 'sunset' };
const listeners = new Set<() => void>();

function apply() {
  const key = state.apiKey.trim();
  const endpoint = state.endpointUrl.trim() || DEFAULT_ENDPOINT;
  FeedbackKit.configure(key ? { endpointUrl: endpoint, projectKey: key } : null);
  FeedbackKit.setTheme(BRANDINGS.find((b) => b.id === state.branding)?.theme ?? null);
}

export const DemoSettings = {
  update(patch: Partial<State>) {
    state = { ...state, ...patch };
    apply();
    listeners.forEach((listener) => listener());
  },
  start() {
    apply();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useDemoSettings(): State {
  return useSyncExternalStore(DemoSettings.subscribe, () => state);
}

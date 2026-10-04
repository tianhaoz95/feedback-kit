import { jest, it, expect, beforeEach } from '@jest/globals';

const mockNative = {
  configure: jest.fn(),
  isConfigured: jest.fn(() => true),
  setCurrentScreen: jest.fn(),
  setTheme: jest.fn(),
  present: jest.fn(async () => ({ id: 'A', text: 'broken', annotations: [], products: [], notifyReporter: false })),
  presentAndSubmit: jest.fn(async () => ({ status: 'failure', error: 'not configured' })),
  onSubmissionResult: jest.fn((listener: (value: unknown) => void) => {
    listener({ status: 'success', report: { id: 'B' } });
    return { remove: jest.fn() };
  }),
};

jest.mock('../NativeFeedbackKit', () => ({
  __esModule: true,
  get default() {
    return mockNative;
  },
}));

// eslint-disable-next-line import/first
import { FeedbackKit } from '../index';

beforeEach(() => {
  jest.clearAllMocks();
});

it('forwards configuration and settings to the mockNative module', () => {
  FeedbackKit.configure({ endpointUrl: 'https://x/functions/v1/ingest-feedback', projectKey: 'pk' });
  expect(mockNative.configure).toHaveBeenCalledWith({ endpointUrl: 'https://x/functions/v1/ingest-feedback', projectKey: 'pk' });
  FeedbackKit.setTheme({ primaryColorHex: '#7C3AED', secondaryColorHex: '#F97316' });
  expect(mockNative.setTheme).toHaveBeenCalled();
  FeedbackKit.setCurrentScreen('Cart');
  expect(mockNative.setCurrentScreen).toHaveBeenCalledWith('Cart');
  expect(FeedbackKit.isConfigured).toBe(true);
});

it('resolves reports and submission results', async () => {
  expect((await FeedbackKit.present())?.text).toBe('broken');
  expect(await FeedbackKit.presentAndSubmit()).toEqual({ status: 'failure', error: 'not configured' });
});

it('delivers submission events and unsubscribes', () => {
  const listener = jest.fn();
  const unsubscribe = FeedbackKit.onSubmissionResult(listener);
  expect(listener).toHaveBeenCalledWith({ status: 'success', report: { id: 'B' } });
  unsubscribe();
});

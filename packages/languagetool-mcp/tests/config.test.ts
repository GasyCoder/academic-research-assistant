import { describe, expect, it } from 'vitest';

import { ConfigError, DEFAULT_BASE_URL, DEFAULT_TIMEOUT_MS, loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('uses defaults when no variable is set', () => {
    expect(loadConfig({})).toEqual({ baseUrl: DEFAULT_BASE_URL, timeoutMs: DEFAULT_TIMEOUT_MS });
    expect(DEFAULT_BASE_URL).toBe('http://127.0.0.1:8081');
    expect(DEFAULT_TIMEOUT_MS).toBe(10_000);
  });

  it('treats empty values as unset', () => {
    expect(loadConfig({ LANGUAGETOOL_BASE_URL: '  ', LANGUAGETOOL_TIMEOUT_MS: '' })).toEqual({
      baseUrl: DEFAULT_BASE_URL,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
  });

  it('accepts custom values and strips trailing slashes', () => {
    expect(
      loadConfig({ LANGUAGETOOL_BASE_URL: 'https://lt.example.org:8010/', LANGUAGETOOL_TIMEOUT_MS: '2500' }),
    ).toEqual({ baseUrl: 'https://lt.example.org:8010', timeoutMs: 2500 });
  });

  it('keeps a path prefix for reverse-proxied instances', () => {
    expect(loadConfig({ LANGUAGETOOL_BASE_URL: 'http://localhost/languagetool//' }).baseUrl).toBe(
      'http://localhost/languagetool',
    );
  });

  it.each(['not a url', 'ftp://127.0.0.1:8081', 'http://user:pass@127.0.0.1:8081', 'http://127.0.0.1:8081/?a=1'])(
    'rejects invalid LANGUAGETOOL_BASE_URL %s',
    (value) => {
      expect(() => loadConfig({ LANGUAGETOOL_BASE_URL: value })).toThrow(ConfigError);
      expect(() => loadConfig({ LANGUAGETOOL_BASE_URL: value })).toThrow(/LANGUAGETOOL_BASE_URL/);
    },
  );

  it.each(['0', '-5', '1.5', 'abc', '10s', '300001'])('rejects invalid LANGUAGETOOL_TIMEOUT_MS %s', (value) => {
    expect(() => loadConfig({ LANGUAGETOOL_TIMEOUT_MS: value })).toThrow(/LANGUAGETOOL_TIMEOUT_MS/);
  });
});

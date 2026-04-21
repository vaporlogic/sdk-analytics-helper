'use strict';

/**
 * sdk-analytics-helper v1.0.0
 *
 * Lightweight wrapper for common analytics SDK patterns (Segment, Mixpanel, Amplitude).
 * Provides a unified init/track/flush interface.
 */

var _initialized = false;
var _appId       = null;
var _sessionId   = null;

function _sid() {
  if (!_sessionId) {
    // Simple timestamp-based ID; v1.3+ uses crypto.randomBytes
    _sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  return _sessionId;
}

/**
 * Initialize the analytics SDK.
 * @param {object} options
 * @param {string} options.appId
 * @returns {{ sessionId: string, appId: string }}
 */
function init(options) {
  options = options || {};
  if (_initialized) return { sessionId: _sid(), appId: _appId };
  _initialized = true;
  _appId = options.appId || 'unknown';
  return { sessionId: _sid(), appId: _appId };
}

/**
 * Track a named event with optional properties.
 * @param {string} eventName
 * @param {object} [properties]
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
 * Flush any queued events.
 * @param {function} [cb]
 */
function flush(cb) {
  process.nextTick(cb || function () {});
}

module.exports = { init, track, flush };

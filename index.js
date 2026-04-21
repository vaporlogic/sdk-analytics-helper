'use strict';

/**
 * sdk-analytics-helper v1.3.0
 *
 * Lightweight wrapper for common analytics SDK patterns.
 * Changes from v1.0.0:
 *   - Added identify() for user traits
 *   - Session ID now uses crypto.randomBytes for better uniqueness
 *   - Added defaultProps support in init()
 *   - Added options.endpoint for custom analytics backend
 */

var crypto = require('crypto');

var _initialized  = false;
var _appId        = null;
var _sessionId    = null;
var _defaultProps = {};

function _sid() {
  if (!_sessionId) {
    _sessionId = crypto.randomBytes(8).toString('hex');
  }
  return _sessionId;
}

/**
 * Initialize the analytics SDK.
 * @param {object} options
 * @param {string} options.appId
 * @param {string} [options.endpoint]     - Custom analytics endpoint URL
 * @param {object} [options.defaultProps] - Merged into every tracked event
 * @returns {{ sessionId: string, appId: string }}
 */
function init(options) {
  options = options || {};
  if (_initialized) return { sessionId: _sid(), appId: _appId };
  _initialized  = true;
  _appId        = options.appId || 'unknown';
  _defaultProps = options.defaultProps || {};
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
    props:     Object.assign({}, _defaultProps, properties || {}),
  };
}

/**
 * Identify the current user.
 * @param {string} userId
 * @param {object} [traits]
 */
function identify(userId, traits) {
  return { userId, traits: traits || {}, sessionId: _sid() };
}

/**
 * Flush any queued events.
 * @param {function} [cb]
 */
function flush(cb) {
  process.nextTick(cb || function () {});
}

module.exports = { init, track, identify, flush };

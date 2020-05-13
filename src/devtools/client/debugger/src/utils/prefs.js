/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

const asyncStore = {
  pendingBreakpoints: [],
  tabs: [],
  xhrBreakpoints: new Promise(resolve => resolve([])),
  eventListenerBreakpoints: [],
};

function verifyPrefSchema() {
}

const prefs = {
  expressions: [],
  projectDirectoryRoot: "http://example.com",
  startPanelSize: 300,
  endPanelSize: 300,
  scopesVisible: true,
  callStackVisible: true,
  breakpointsVisible: true,
};

const features = {
};

module.exports = {
  asyncStore,
  verifyPrefSchema,
  prefs,
  features,
};

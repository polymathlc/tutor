'use strict';

const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getAppCheck } = require('firebase-admin/app-check');
const { getFirestore } = require('firebase-admin/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const WebSocket = require('ws');
const { createLiveService } = require('./live-service');
const { createRepository } = require('./live-repository');
const { createProvider } = require('./live-provider');
const { createGameService } = require('./gamification-service');
const { createGameRepository } = require('./gamification-repository');
const { createGameProvider } = require('./gamification-provider');
const { createTeachService } = require('./fast-tutor-service');
const { createTeachRepository } = require('./fast-tutor-repository');
const { createTeachProvider } = require('./fast-tutor-provider');
const { createCentreService } = require('./centre-admin-service');
const { createCentreRepository } = require('./centre-admin-repository');

initializeApp();
const openaiKey = defineSecret('OPENAI_API_KEY');
const service = createLiveService({
  auth: getAuth(), appCheck: getAppCheck(), repository: createRepository(getFirestore()),
  provider: createProvider({ apiKey: () => openaiKey.value(), connect: (url, options) => new WebSocket(url, options) }),
  report: code => logger.warn(code)
});

exports.studyBuddyLive = onRequest({
  region: 'us-central1', secrets: [openaiKey], timeoutSeconds: 60,
  maxInstances: 5, concurrency: 20, memory: '256MiB', invoker: 'public'
}, service.handler);

// Browser timers are for the UI only. This separate server sweep also ends
// abandoned calls, with up to a scheduler interval of normal timing slack.
// Both functions must be deployed together. A failed close is retried.
exports.studyBuddyLiveCleanup = onSchedule({
  region: 'us-central1', secrets: [openaiKey], schedule: 'every 1 minutes',
  timeZone: 'Asia/Singapore', timeoutSeconds: 180, maxInstances: 1,
  memory: '256MiB', retryCount: 3, minBackoffSeconds: 10, maxBackoffSeconds: 60
}, service.sweep);

const gameService = createGameService({
  auth: getAuth(), appCheck: getAppCheck(), repository: createGameRepository(getFirestore()),
  provider: createGameProvider({ apiKey: () => openaiKey.value() }),
  report: code => logger.warn(code)
});
exports.studyBuddyGame = onRequest({
  region: 'us-central1', secrets: [openaiKey], timeoutSeconds: 60,
  maxInstances: 5, concurrency: 20, memory: '256MiB', invoker: 'public'
}, gameService.handler);

const teachService = createTeachService({
  auth: getAuth(), appCheck: getAppCheck(), repository: createTeachRepository(getFirestore()),
  provider: createTeachProvider({ apiKey: () => openaiKey.value() }),
  report: code => logger.warn(code)
});
exports.studyBuddyTeach = onRequest({
  region: 'us-central1', secrets: [openaiKey], timeoutSeconds: 180,
  minInstances: 1, maxInstances: 5, concurrency: 20, memory: '512MiB', invoker: 'public'
}, teachService.handler);

const centreService = createCentreService({
  auth: getAuth(), appCheck: getAppCheck(), repository: createCentreRepository(getFirestore(), getAuth()),
  report: code => logger.warn(code)
});
exports.studyBuddyCentre = onRequest({
  region: 'us-central1', timeoutSeconds: 60,
  maxInstances: 3, concurrency: 10, memory: '256MiB', invoker: 'public'
}, centreService.handler);

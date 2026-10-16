'use strict';

const os = require('os');

class SystemMonitor {
  constructor() {
    this.maxLogSize = 100;
    this.recentErrors = [];
    this.failedRequests = [];
    this.authLogs = [];
    this.totalRequests = 0;
    this.requestsThisMinute = 0;
    this.blockedRequests = 0;
    this.startTime = Date.now();
    this.rateLimitPerMin = 500;

    // Reset minute counter every 60s
    setInterval(() => {
      this.requestsThisMinute = 0;
    }, 60000);
  }

  recordRequest(req, res, responseTimeMs = 0) {
    this.totalRequests += 1;
    this.requestsThisMinute += 1;

    const statusCode = res.statusCode || 200;
    if (statusCode >= 400) {
      const entry = {
        id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        status: statusCode,
        method: req.method,
        path: req.originalUrl || req.path || req.url,
        ip: req.ip || req.connection?.remoteAddress || '127.0.0.1',
        responseTimeMs,
        userAgent: req.headers['user-agent'] || 'Unknown',
        user: req.user?.email || req.user?.name || 'Anonymous'
      };

      this.failedRequests.unshift(entry);
      if (this.failedRequests.length > this.maxLogSize) {
        this.failedRequests.pop();
      }
    }
  }

  recordError(err, req = null) {
    const entry = {
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      message: err.message || String(err),
      stack: err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : '',
      method: req ? req.method : 'INTERNAL',
      endpoint: req ? (req.originalUrl || req.path || req.url) : 'System Background',
      ip: req ? (req.ip || req.connection?.remoteAddress || '127.0.0.1') : '127.0.0.1',
      user: req?.user?.email || req?.user?.name || 'System'
    };

    this.recentErrors.unshift(entry);
    if (this.recentErrors.length > this.maxLogSize) {
      this.recentErrors.pop();
    }
  }

  recordAuth(action, email, role, success, ip = '127.0.0.1', details = {}) {
    const entry = {
      id: `auth-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      action,
      email: email || 'unknown',
      role: role || 'guest',
      success: !!success,
      ip,
      details
    };

    this.authLogs.unshift(entry);
    if (this.authLogs.length > this.maxLogSize) {
      this.authLogs.pop();
    }
  }

  getMetrics() {
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;
    const uptimeFormatted = `${days > 0 ? days + 'd ' : ''}${hours}h ${minutes}m ${seconds}s`;

    const mem = process.memoryUsage();

    return {
      status: 'online',
      uptimeSec,
      uptimeFormatted,
      nodeVersion: process.version,
      platform: `${process.platform} (${process.arch})`,
      pid: process.pid,
      osLoad: os.loadavg ? os.loadavg() : [0, 0, 0],
      totalRequests: this.totalRequests,
      requestsThisMinute: this.requestsThisMinute,
      rateLimitMaxPerMin: this.rateLimitPerMin,
      rateLimitStatus: this.requestsThisMinute > this.rateLimitPerMin ? 'throttled' : 'healthy',
      blockedRequests: this.blockedRequests,
      memory: {
        rssMb: (mem.rss / 1024 / 1024).toFixed(1),
        heapTotalMb: (mem.heapTotal / 1024 / 1024).toFixed(1),
        heapUsedMb: (mem.heapUsed / 1024 / 1024).toFixed(1),
        heapPercent: Math.round((mem.heapUsed / mem.heapTotal) * 100)
      }
    };
  }

  getRecentErrors() {
    return this.recentErrors;
  }

  getRecentFailedRequests() {
    return this.failedRequests;
  }

  getRecentAuthLogs() {
    return this.authLogs;
  }
}

const systemMonitor = new SystemMonitor();
module.exports = systemMonitor;

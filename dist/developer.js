// PrintFlow SaaS Developer Admin Console
// Platform Developer & Super Admin Portal
(function () {
  'use strict';

  const { useState, useEffect, useMemo, useCallback, createElement: h } = React;

  // ─────────────────────────────────────────────────────────────
  // SVG ICONS
  // ─────────────────────────────────────────────────────────────
  const Icon = ({ name, className = 'w-5 h-5' }) => {
    const paths = {
      dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
      clients: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      audit: '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>',
      support: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1e-2a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
      search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
      plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
      trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
      eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
      key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
      check: '<polyline points="20 6 9 17 4 12"/>',
      alert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
      refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
      externalLink: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>',
      bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
      lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
      logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
      copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
      x: '<line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>',
      shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
      userCheck: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>',
      userX: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="17" x2="22" y1="8" y2="13"/><line x1="22" x2="17" y1="8" y2="13"/>',
      moreVertical: '<circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="5" r="2" fill="currentColor"/><circle cx="12" cy="19" r="2" fill="currentColor"/>',
      database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>',
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
      upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
      clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
      cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
      send: '<line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
      file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>',
      sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>',
      play: '<polygon points="5 3 19 12 5 21 5 3"/>',
      bug: '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
      calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
      menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>'
    };

    return h('svg', {
      className,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      dangerouslySetInnerHTML: { __html: paths[name] || paths.dashboard },
    });
  };

  // ─────────────────────────────────────────────────────────────
  // MODAL WRAPPER COMPONENT
  // ─────────────────────────────────────────────────────────────
  const Modal = ({ title, isOpen, onClose, children, maxWidth = 'max-w-xl' }) => {
    if (!isOpen) return null;
    return h(
      'div',
      { className: 'fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in' },
      h(
        'div',
        { className: 'bg-white rounded-3xl shadow-2xl border border-slate-200 w-full ' + maxWidth + ' overflow-hidden transform transition-all' },
        h(
          'div',
          { className: 'flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50' },
          h('h3', { className: 'text-base font-black text-slate-900' }, title),
          h(
            'button',
            {
              onClick: onClose,
              className: 'p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors cursor-pointer',
            },
            h(Icon, { name: 'x', className: 'w-5 h-5' })
          )
        ),
        h('div', { className: 'p-6 max-h-[80vh] overflow-y-auto' }, children)
      )
    );
  };

  // ─────────────────────────────────────────────────────────────
  // TOAST NOTIFICATIONS CONTAINER
  // ─────────────────────────────────────────────────────────────
  const ToastContainer = ({ toasts, removeToast }) => {
    return h(
      'div',
      { className: 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none' },
      toasts.map((toast) =>
        h(
          'div',
          {
            key: toast.id,
            className: 'pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border text-xs font-bold transition-all ' +
              (toast.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-slate-900 text-white border-slate-800'),
          },
          h(Icon, {
            name: toast.type === 'error' ? 'alert' : toast.type === 'success' ? 'check' : 'shield',
            className: 'w-4 h-4 mt-0.5 shrink-0 ' + (toast.type === 'error' ? 'text-rose-600' : toast.type === 'success' ? 'text-emerald-600' : 'text-indigo-400')
          }),
          h('div', { className: 'flex-1 leading-snug' }, toast.message),
          h(
            'button',
            {
              onClick: () => removeToast(toast.id),
              className: 'text-slate-400 hover:text-slate-600 cursor-pointer',
            },
            h(Icon, { name: 'x', className: 'w-4 h-4' })
          )
        )
      )
    );
  };

  // ─────────────────────────────────────────────────────────────
  // REUSABLE PAGINATION COMPONENT
  // ─────────────────────────────────────────────────────────────
  function Pagination({ total = 0, page = 1, pageSize = 20, onPageChange, onPageSizeChange }) {
    const totalRecords = Number(total || 0);
    if (totalRecords === 0) return null;
    const curSize = Number(pageSize) || 20;
    const curPage = Math.max(1, Number(page) || 1);
    const totalPages = Math.max(1, Math.ceil(totalRecords / curSize));
    if (totalPages <= 1) return null;

    const generatePages = (cur, tot) => {
      if (tot <= 1) return [1];
      if (tot <= 7) return Array.from({ length: tot }, (_, i) => i + 1);
      if (cur <= 3) return [1, 2, 3, 4, '...', tot];
      if (cur >= tot - 2) return [1, '...', tot - 3, tot - 2, tot - 1, tot];
      return [1, '...', cur - 1, cur, cur + 1, '...', tot];
    };

    const pages = generatePages(curPage, totalPages);

    return h('div', { className: 'flex items-center justify-end gap-1 border-t border-slate-200 bg-slate-50/70 px-4 py-3 text-xs select-none flex-wrap' },
      h('button', {
        type: 'button',
        disabled: curPage <= 1,
        onClick: () => onPageChange && onPageChange(Math.max(1, curPage - 1)),
        className: 'inline-flex h-8 px-2.5 items-center justify-center rounded-xl border border-slate-200 text-xs font-bold shadow-2xs transition-colors ' +
          (curPage <= 1 ? 'bg-slate-50 text-slate-300 opacity-40 cursor-not-allowed' : 'bg-white text-slate-600 hover:bg-slate-100 cursor-pointer')
      }, '← Prev'),
        pages.map((p, idx) => {
          if (p === '...') {
            return h('span', { key: 'el-' + idx, className: 'px-1.5 text-xs font-bold text-slate-400 select-none' }, '…');
          }
          const isCurrent = p === curPage;
          return h('button', {
            key: 'page-' + p,
            type: 'button',
            onClick: () => onPageChange && onPageChange(p),
            className: 'h-8 min-w-8 px-2 rounded-xl text-xs font-black shadow-2xs transition-colors cursor-pointer select-none ' +
              (isCurrent ? 'bg-indigo-600 text-white shadow-2xs' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100')
          }, p);
        }),
        h('button', {
          type: 'button',
          disabled: curPage >= totalPages,
          onClick: () => onPageChange && onPageChange(Math.min(totalPages, curPage + 1)),
          className: 'inline-flex h-8 px-2.5 items-center justify-center rounded-xl border border-slate-200 text-xs font-bold shadow-2xs transition-colors ' +
            (curPage >= totalPages ? 'bg-slate-50 text-slate-300 opacity-40 cursor-not-allowed' : 'bg-white text-slate-600 hover:bg-slate-100 cursor-pointer')
        }, 'Next →')
    );
  }

  // ─────────────────────────────────────────────────────────────
  // MAIN DEVELOPER APP COMPONENT
  // ─────────────────────────────────────────────────────────────
  function DeveloperApp() {
    const [token, setToken] = useState(() => localStorage.getItem('printflow_dev_token') || '');
    const [devUser, setDevUser] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem('printflow_dev_user') || 'null');
      } catch {
        return null;
      }
    });

    const [loginEmail, setLoginEmail] = useState('dev@printghar.com');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginApiKey, setLoginApiKey] = useState('');
    const [loginTab, setLoginTab] = useState('credentials');
    const [loginLoading, setLoginLoading] = useState(false);
    const [mfaSession, setMfaSession] = useState(null);
    const [mfaCode, setMfaCode] = useState('');

    // Active Navigation Tab: 'server' | 'database' | 'security' | 'settings' | 'support' | 'clients'
    const [activeTab, setActiveTab] = useState('server');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Toasts
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((message, type = 'info') => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    }, []);
    const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

    // Universal API caller with Dev Auth
    const fetchApi = useCallback(
      async (url, options = {}) => {
        const headers = {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        };
        if (token) {
          headers['Authorization'] = 'Bearer ' + token;
        }
        const res = await fetch(url, { ...options, headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            if (token) addToast(data.error || 'Access restricted to Platform Developer.', 'error');
          }
          throw new Error(data.error || ('HTTP error ' + res.status));
        }
        return data;
      },
      [token, addToast]
    );

    // Data States
    const [serverStatus, setServerStatus] = useState(null);
    const [logsData, setLogsData] = useState(null);
    const [dbHealth, setDbHealth] = useState(null);
    const [securityData, setSecurityData] = useState(null);
    const [systemSettings, setSystemSettings] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [clients, setClients] = useState([]);
    const [stats, setStats] = useState(null);
    const [automatedBackups, setAutomatedBackups] = useState([]);
    const [schedulerStatus, setSchedulerStatus] = useState(null);
    const [errorLogs, setErrorLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activityDataReady, setActivityDataReady] = useState(false);

    // Filter states
    const [logFilter, setLogFilter] = useState('errors');
    const [logSearch, setLogSearch] = useState('');
    const [ticketFilter, setTicketFilter] = useState('all');
    const [clientSearch, setClientSearch] = useState('');
    const [clientStatusFilter, setClientStatusFilter] = useState('all');

    // Modals
    const [modalRestoreDb, setModalRestoreDb] = useState(false);
    const [modalNewTicket, setModalNewTicket] = useState(false);
    const [modalAddClient, setModalAddClient] = useState(false);
    const [modalEditClient, setModalEditClient] = useState(null);
    const [modalClientDetails, setModalClientDetails] = useState(null);
    const [modalTicketReply, setModalTicketReply] = useState(null);
    const [modalSubscriptionClient, setModalSubscriptionClient] = useState(null);
    const [modalInspectError, setModalInspectError] = useState(null);
    const [modalInspectAudit, setModalInspectAudit] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);

    // ─────────────────────────────────────────────────────────
    // DATA LOADERS
    // ─────────────────────────────────────────────────────────
    const loadAllData = useCallback(async () => {
      if (!token) return;
      setLoading(true);
      try {
        const [statusRes, logsRes, dbRes, secRes, setRes, tixRes, clientsRes, statsRes, autoBRes, errRes] = await Promise.all([
          fetchApi('/api/developer/server-status').catch(() => null),
          fetchApi('/api/developer/logs').catch(() => null),
          fetchApi('/api/developer/database/health').catch(() => null),
          fetchApi('/api/developer/security/overview').catch(() => null),
          fetchApi('/api/developer/system-settings').catch(() => null),
          fetchApi('/api/developer/support/tickets').catch(() => null),
          fetchApi('/api/developer/clients').catch(() => null),
          fetchApi('/api/developer/stats').catch(() => null),
          fetchApi('/api/developer/database/automated-backups').catch(() => null),
          fetchApi('/api/developer/errors').catch(() => null),
        ]);

        if (statusRes?.server) setServerStatus(statusRes);
        if (logsRes?.ok) setLogsData(logsRes);
        if (dbRes?.health) setDbHealth(dbRes.health);
        if (secRes?.security) setSecurityData(secRes.security);
        if (setRes?.settings) setSystemSettings(setRes.settings);
        if (tixRes?.tickets) setTickets(tixRes.tickets);
        if (clientsRes?.clients) setClients(clientsRes.clients);
        if (statsRes?.stats) setStats(statsRes.stats);
        if (autoBRes?.ok) {
          setAutomatedBackups(autoBRes.backups || []);
          setSchedulerStatus(autoBRes.scheduler || null);
        }
        if (errRes?.ok) {
          setErrorLogs(errRes.errors || []);
        }
      } catch (err) {
        addToast('Error loading developer telemetry: ' + err.message, 'error');
      } finally {
        setLoading(false);
        setActivityDataReady(true);
      }
    }, [token, fetchApi, addToast]);

    useEffect(() => {
      if (token) {
        loadAllData();
      }
    }, [token, loadAllData]);

    // ─────────────────────────────────────────────────────────
    // SIDEBAR "NEW" COUNTERS
    // Counts items added or updated since each tab was last opened.
    // Last-opened markers are kept in this browser's localStorage.
    // ─────────────────────────────────────────────────────────
    const SEEN_STORAGE_KEY = 'printflow_dev_seen_tabs_v1';
    const [seenAt, setSeenAt] = useState(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(SEEN_STORAGE_KEY) || 'null');
        if (saved && typeof saved === 'object') return saved;
      } catch (_) {}
      return {};
    });

    useEffect(() => {
      try { localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(seenAt)); } catch (_) {}
    }, [seenAt]);

    const activityTimes = useMemo(() => {
      const ms = (v) => {
        const t = v ? new Date(v).getTime() : 0;
        return Number.isFinite(t) ? t : 0;
      };
      return {
        server: (errorLogs || []).map((e) => ms(e.created_at || e.createdAt)),
        database: (automatedBackups || []).map((b) => ms(b.createdAt)),
        security: (securityData?.loginLogs || []).map((l) => ms(l.created_at)),
        support: (tickets || []).map((t) => Math.max(ms(t.created_at), ms(t.updated_at))),
        // A client login also bumps updated_at, so a login alone is not counted as an edit.
        clients: (clients || []).map((c) => {
          const updated = ms(c.updated_at);
          const loginOnly = Math.abs(updated - ms(c.last_login_at)) < 5000;
          return Math.max(ms(c.created_at), loginOnly ? 0 : updated);
        }),
        // Sub-tabs inside API & Server Status
        'log:crashes': (errorLogs || []).map((e) => ms(e.created_at || e.createdAt)),
        'log:errors': (logsData?.errorLogs || []).map((e) => ms(e.timestamp || e.created_at)),
        'log:failed': (logsData?.failedRequests || []).map((r) => ms(r.timestamp || r.created_at)),
        'log:auth': (logsData?.authLogs || []).map((a) => ms(a.created_at || a.timestamp)),
        'log:activity': (logsData?.recentActivity || []).map((a) => ms(a.created_at || a.timestamp)),
      };
    }, [errorLogs, automatedBackups, securityData, tickets, clients, logsData]);

    // Marks tabs as seen up to now, or up to their newest item if the server clock runs ahead.
    const markTabsSeen = useCallback((tabIds) => {
      setSeenAt((prev) => {
        const next = { ...prev };
        for (const id of tabIds) {
          const times = activityTimes[id];
          if (!times) continue;
          next[id] = times.reduce((max, t) => (t > max ? t : max), Date.now());
        }
        return next;
      });
    }, [activityTimes]);

    // First use in this browser: treat existing data as already seen.
    useEffect(() => {
      if (!activityDataReady) return;
      const unknown = Object.keys(activityTimes).filter((id) => seenAt[id] === undefined);
      if (unknown.length) markTabsSeen(unknown);
    }, [activityDataReady]); // eslint-disable-line react-hooks/exhaustive-deps

    // The open tab (and the open log sub-tab) is always seen, including items that arrive while it is open.
    useEffect(() => {
      if (!activityDataReady) return;
      const openIds = [activeTab];
      if (activeTab === 'server') openIds.push('log:' + logFilter);
      markTabsSeen(openIds.filter((id) => activityTimes[id]));
    }, [activeTab, logFilter, activityTimes, activityDataReady, markTabsSeen]);

    const newCounts = useMemo(() => {
      const out = {};
      for (const [id, times] of Object.entries(activityTimes)) {
        const since = seenAt[id];
        out[id] = since === undefined ? 0 : times.filter((t) => t > since).length;
      }
      return out;
    }, [activityTimes, seenAt]);

    // Light background check for new activity once a minute while the console is visible.
    useEffect(() => {
      if (!token) return undefined;
      const refreshActivity = async () => {
        if (document.visibilityState !== 'visible') return;
        const [secRes, tixRes, clientsRes, autoBRes, errRes, logsRes] = await Promise.all([
          fetchApi('/api/developer/security/overview').catch(() => null),
          fetchApi('/api/developer/support/tickets').catch(() => null),
          fetchApi('/api/developer/clients').catch(() => null),
          fetchApi('/api/developer/database/automated-backups').catch(() => null),
          fetchApi('/api/developer/errors').catch(() => null),
          fetchApi('/api/developer/logs').catch(() => null),
        ]);
        if (logsRes?.ok) setLogsData(logsRes);
        if (secRes?.security) setSecurityData(secRes.security);
        if (tixRes?.tickets) setTickets(tixRes.tickets);
        if (clientsRes?.clients) setClients(clientsRes.clients);
        if (autoBRes?.ok) {
          setAutomatedBackups(autoBRes.backups || []);
          setSchedulerStatus(autoBRes.scheduler || null);
        }
        if (errRes?.ok) setErrorLogs(errRes.errors || []);
      };
      const timer = setInterval(refreshActivity, 60000);
      return () => clearInterval(timer);
    }, [token, fetchApi]);

    // Export Database Backup JSON
    const exportFullBackup = useCallback(async () => {
      try {
        addToast('Generating full database backup JSON...', 'info');
        const data = await fetchApi('/api/developer/database/backup');
        const payload = data.backup || data;
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `printflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast('Database backup downloaded successfully.', 'success');
      } catch (err) {
        addToast(err.message || 'Failed to download database backup.', 'error');
      }
    }, [fetchApi, addToast]);

    // Handle Login
    const handleLogin = async (e) => {
      e.preventDefault();
      setLoginLoading(true);
      try {
        const payload = loginTab === 'apikey'
          ? { apiKey: loginApiKey.trim() }
          : { email: loginEmail.trim(), password: loginPassword };

        const res = await fetch('/api/developer/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Developer authentication failed.');
        }

        // Two-factor authentication required
        if (data.requiresMfa) {
          setMfaSession({
            sessionId: data.sessionId,
            email: loginEmail,
          });
          addToast(data.message || 'MFA required: Enter the 6-digit verification code.', 'info');
          return;
        }

        localStorage.setItem('printflow_dev_token', data.token);
        localStorage.setItem('printflow_dev_user', JSON.stringify(data.developer || data.user || { name: 'Platform Developer', email: loginEmail }));
        setToken(data.token);
        setDevUser(data.developer || data.user || { name: 'Platform Developer', email: loginEmail });
        addToast('Developer authentication granted. Welcome back!', 'success');
      } catch (err) {
        addToast(err.message, 'error');
      } finally {
        setLoginLoading(false);
      }
    };

    // Handle MFA Verification
    const handleVerifyMfa = async (e) => {
      e.preventDefault();
      setLoginLoading(true);
      try {
        const res = await fetch('/api/developer/auth/verify-mfa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: mfaSession.sessionId,
            code: mfaCode.trim(),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Invalid 6-digit verification code.');
        }

        localStorage.setItem('printflow_dev_token', data.token);
        localStorage.setItem('printflow_dev_user', JSON.stringify(data.developer || { name: 'Platform Developer', email: mfaSession.email }));
        setToken(data.token);
        setDevUser(data.developer || { name: 'Platform Developer', email: mfaSession.email });
        setMfaSession(null);
        setMfaCode('');
        addToast('Developer MFA verified. Welcome back!', 'success');
      } catch (err) {
        addToast(err.message, 'error');
      } finally {
        setLoginLoading(false);
      }
    };

    const handleLogout = () => {
      localStorage.removeItem('printflow_dev_token');
      localStorage.removeItem('printflow_dev_user');
      setToken('');
      setDevUser(null);
      setMfaSession(null);
      setMfaCode('');
      addToast('You have signed out of Developer Console.', 'info');
    };

    // ─────────────────────────────────────────────────────────
    // LOGIN SCREEN
    // ─────────────────────────────────────────────────────────
    if (!token) {
      return h(
        'div',
        { className: 'min-h-screen h-full w-full bg-slate-950 flex flex-col justify-center items-center p-6 text-slate-100 font-sans overflow-y-auto' },
        h(ToastContainer, { toasts, removeToast }),
        h(
          'div',
          { className: 'w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden' },
          h('div', { className: 'absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none' }),
          h('div', { className: 'absolute -bottom-24 -right-24 w-48 h-48 bg-sky-500/20 rounded-full blur-3xl pointer-events-none' }),

          h(
            'div',
            { className: 'text-center mb-8 relative z-10' },
            h(
              'div',
              { className: 'inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white mb-4 shadow-lg shadow-indigo-600/30' },
              h(Icon, { name: 'terminal', className: 'w-7 h-7' })
            ),
            h('h1', { className: 'text-2xl font-black tracking-tight text-white' }, 'PrintFlow Developer Console'),
            h('p', { className: 'text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold' }, 'Platform Developer & Super Admin Portal'),
            h(
              'div',
              { className: 'inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' },
              'Restricted Developer Access Only'
            )
          ),

          mfaSession
            ? h(
                'form',
                { onSubmit: handleVerifyMfa, className: 'space-y-4 relative z-10' },
                h(
                  'div',
                  { className: 'p-4 rounded-2xl bg-indigo-950/70 border border-indigo-500/30 text-indigo-200 text-xs text-center space-y-1' },
                  h('p', { className: 'font-black text-indigo-100 text-sm' }, 'Two-Factor Authentication Required'),
                  h('p', { className: 'text-[11px] text-indigo-300' }, 'Enter the 6-digit verification code sent to the developer email.')
                ),
                h(
                  'div',
                  null,
                  h('label', { className: 'block text-xs font-bold text-slate-300 mb-1.5 uppercase text-center' }, '6-Digit Verification Code'),
                  h('input', {
                    type: 'text',
                    required: true,
                    maxLength: 6,
                    autoFocus: true,
                    value: mfaCode,
                    onChange: (e) => setMfaCode(e.target.value.replace(/[^0-9]/g, '')),
                    className: 'w-full px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-center text-2xl font-mono tracking-widest focus:outline-none focus:border-indigo-500 transition-colors',
                    placeholder: '123456',
                  })
                ),
                h(
                  'button',
                  {
                    type: 'submit',
                    disabled: loginLoading || mfaCode.length < 6,
                    className: 'w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer',
                  },
                  loginLoading ? 'Verifying Code...' : 'Verify Code & Enter Console'
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => { setMfaSession(null); setMfaCode(''); },
                    className: 'w-full py-2 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer',
                  },
                  '← Cancel & Return to Login'
                )
              )
            : [
                h(
                  'div',
                  { key: 'login-tabs', className: 'flex rounded-xl bg-slate-800/80 p-1 mb-6 text-xs font-semibold border border-slate-700/50' },
                  h(
                    'button',
                    {
                      type: 'button',
                      onClick: () => setLoginTab('credentials'),
                      className: 'flex-1 py-2 rounded-lg transition-all ' + (loginTab === 'credentials' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'),
                    },
                    'Email & Password'
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      onClick: () => setLoginTab('apikey'),
                      className: 'flex-1 py-2 rounded-lg transition-all ' + (loginTab === 'apikey' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'),
                    },
                    'Master API Key'
                  )
                ),

                h(
                  'form',
                  { key: 'login-form', onSubmit: handleLogin, className: 'space-y-4 relative z-10' },
                  loginTab === 'credentials'
                    ? [
                        h(
                          'div',
                          { key: 'email-field' },
                          h('label', { className: 'block text-xs font-bold text-slate-300 mb-1.5 uppercase' }, 'Developer Email'),
                          h('input', {
                            type: 'email',
                            required: true,
                            value: loginEmail,
                            onChange: (e) => setLoginEmail(e.target.value),
                            className: 'w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors',
                            placeholder: 'dev@printghar.com',
                          })
                        ),
                        h(
                          'div',
                          { key: 'pass-field' },
                          h('label', { className: 'block text-xs font-bold text-slate-300 mb-1.5 uppercase' }, 'Developer Password'),
                          h('input', {
                            type: 'password',
                            required: true,
                            value: loginPassword,
                            onChange: (e) => setLoginPassword(e.target.value),
                            className: 'w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors',
                            placeholder: '••••••••••••',
                          })
                        ),
                      ]
                    : h(
                        'div',
                        null,
                        h('label', { className: 'block text-xs font-bold text-slate-300 mb-1.5 uppercase' }, 'Platform Secret Key (API_SECRET_KEY)'),
                        h('input', {
                          type: 'password',
                          required: true,
                          value: loginApiKey,
                          onChange: (e) => setLoginApiKey(e.target.value),
                          className: 'w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-indigo-500 transition-colors',
                          placeholder: 'Enter API_SECRET_KEY...',
                        })
                      ),

                  h(
                    'button',
                    {
                      type: 'submit',
                      disabled: loginLoading,
                      className: 'w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer',
                    },
                    loginLoading ? 'Authenticating...' : 'Sign In as Platform Developer'
                  )
                )
              ],

          h(
            'div',
            { className: 'mt-6 text-center text-xs text-slate-500' },
            h('span', null, 'Not a platform developer? '),
            h(
              'a',
              { href: '/', className: 'text-indigo-400 hover:text-indigo-300 font-semibold underline' },
              'Go to Client Storefront / Login'
            )
          )
        )
      );
    }

    // ─────────────────────────────────────────────────────────
    // NAVIGATION ITEMS (All 5 Required Developer Categories + Clients)
    // ─────────────────────────────────────────────────────────
    const navItems = [
      { id: 'server', label: 'API & Server Status', icon: 'dashboard', badge: logsData?.errorLogs?.length ? (logsData.errorLogs.length + ' err') : 'Live' },
      { id: 'database', label: 'Database / Data', icon: 'database', badge: dbHealth?.totalSize || '21 Tables' },
      { id: 'security', label: 'Security & Auth', icon: 'shield', badge: securityData?.totalActiveSessions ? (securityData.totalActiveSessions + ' active') : null },
      { id: 'settings', label: 'System Settings', icon: 'settings' },
      { id: 'support', label: 'Support & Broadcast', icon: 'support', badge: tickets?.filter(t => t.status === 'open').length || 0 },
      { id: 'clients', label: 'SaaS Clients', icon: 'clients', badge: clients?.length || 0 },
    ].map((item) => ({ ...item, newCount: newCounts[item.id] || 0 }));

    const isMaintenance = serverStatus?.maintenanceMode?.enabled || false;

    // ─────────────────────────────────────────────────────────
    // MAIN AUTHENTICATED DEVELOPER LAYOUT
    // ─────────────────────────────────────────────────────────
    return h(
      'div',
      { className: 'h-screen max-h-screen w-full bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans overflow-hidden' },
      h(ToastContainer, { toasts, removeToast }),

      // ── SIDEBAR (Dark Navy - Fixed / Sticky Viewport Height) ──
      h(
        'aside',
        {
          className: 'w-full md:w-64 md:h-screen md:max-h-screen bg-slate-900 text-white flex flex-col border-r border-slate-800 shrink-0 select-none z-20 md:sticky md:top-0 md:left-0' +
            (mobileMenuOpen ? ' fixed inset-0 z-50 md:relative md:inset-auto h-screen' : ''),
        },
        // Sidebar Brand Header
        h(
          'div',
          { className: 'p-4 sm:p-5 md:p-6 border-b border-slate-800/80 flex items-center justify-between shrink-0' },
          h(
            'div',
            { className: 'flex items-center gap-3' },
            h(
              'div',
              { className: 'w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white shadow-md shrink-0' },
              h(Icon, { name: 'terminal', className: 'w-5 h-5' })
            ),
            h(
              'div',
              null,
              h('div', { className: 'font-bold text-sm text-white tracking-tight leading-tight' }, 'PrintFlow Admin'),
              h('div', { className: 'text-[11px] text-sky-400 font-semibold tracking-wider uppercase leading-tight' }, 'Developer Console')
            )
          ),
          // Mobile Close Button
          h(
            'button',
            {
              type: 'button',
              onClick: () => setMobileMenuOpen(false),
              className: 'md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer',
              'aria-label': 'Close Menu'
            },
            h(Icon, { name: 'x', className: 'w-5 h-5' })
          )
        ),

        // Sidebar Navigation (Independently scrollable)
        h(
          'nav',
          { className: (mobileMenuOpen ? 'flex' : 'hidden md:flex') + ' flex-col flex-1 min-h-0 p-3 space-y-1 overflow-y-auto overflow-x-hidden' },
          navItems.map((item) => {
            const isActive = activeTab === item.id;
            return h(
              'button',
              {
                key: item.id,
                onClick: () => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                },
                className: 'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ' +
                  (isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'),
              },
              h(
                'div',
                { className: 'flex items-center gap-3 min-w-0' },
                h(Icon, {
                  name: item.icon,
                  className: 'w-4 h-4 shrink-0 ' + (isActive ? 'text-white' : 'text-slate-400')
                }),
                h('span', { className: 'truncate' }, item.label)
              ),
              item.newCount > 0
                ? h(
                    'span',
                    {
                      className: 'min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold shrink-0 flex items-center justify-center',
                      title: item.newCount + ' new since you last opened this tab',
                    },
                    item.newCount > 99 ? '99+' : item.newCount
                  )
                : item.badge !== undefined && item.badge !== null
                ? h(
                    'span',
                    {
                      className: 'px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ' +
                        (isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'),
                    },
                    item.badge
                  )
                : null
            );
          })
        ),

        // Sidebar Footer & Profile (Properly anchored at bottom)
        h(
          'div',
          { className: (mobileMenuOpen ? 'block' : 'hidden md:block') + ' p-4 border-t border-slate-800/80 bg-slate-950/50 space-y-3 shrink-0' },
          h(
            'div',
            { className: 'flex items-center gap-3' },
            h(
              'div',
              { className: 'w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0' },
              'DEV'
            ),
            h(
              'div',
              { className: 'flex-1 min-w-0' },
              h('p', { className: 'text-xs font-bold text-white truncate' }, devUser?.name || 'Platform Developer'),
              h('p', { className: 'text-[11px] text-slate-400 truncate' }, devUser?.email || 'dev@printghar.com')
            ),
            h(
              'button',
              {
                onClick: handleLogout,
                title: 'Log out',
                className: 'p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer shrink-0',
              },
              h(Icon, { name: 'logout', className: 'w-4 h-4' })
            )
          ),
          h(
            'a',
            {
              href: '/',
              target: '_blank',
              className: 'flex items-center justify-center gap-2 w-full py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-[11px] font-bold border border-slate-700/60 transition-colors'
            },
            h(Icon, { name: 'externalLink', className: 'w-3.5 h-3.5' }),
            'Open Client Storefront'
          )
        )
      ),

      // ── MAIN CONTENT AREA (Scrolls independently on the right) ──
      h(
        'div',
        { className: 'flex-1 flex flex-col min-w-0 h-full md:h-screen overflow-y-auto overflow-x-hidden' },
        // Top Header (Sticky at top of content area)
        h(
          'header',
          { className: 'h-16 px-4 sm:px-6 bg-white border-b border-slate-200/80 flex items-center justify-between sticky top-0 z-10 shrink-0 shadow-2xs' },
          h(
            'div',
            { className: 'flex items-center gap-2.5 sm:gap-3 min-w-0' },
            // Mobile Menu Hamburger Button
            h(
              'button',
              {
                type: 'button',
                onClick: () => setMobileMenuOpen(true),
                className: 'md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition cursor-pointer shrink-0',
                'aria-label': 'Open Navigation Menu'
              },
              h(Icon, { name: 'menu', className: 'w-5 h-5' })
            ),
            h('h2', { className: 'text-sm sm:text-base font-black text-slate-900 capitalize truncate' },
              navItems.find((n) => n.id === activeTab)?.label || 'Developer Console'
            ),
            isMaintenance && h('span', { className: 'px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse shrink-0 hidden sm:inline-block' }, 'Maintenance Mode ON')
          ),
          h(
            'div',
            { className: 'flex items-center gap-2 sm:gap-3 shrink-0' },
            h(
              'button',
              {
                onClick: loadAllData,
                disabled: loading,
                className: 'px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50',
              },
              h(Icon, { name: 'refresh', className: 'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '') }),
              h('span', { className: 'hidden sm:inline' }, loading ? 'Refreshing...' : 'Refresh')
            ),
            h(
              'button',
              {
                onClick: exportFullBackup,
                className: 'px-3 sm:px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm',
              },
              h(Icon, { name: 'download', className: 'w-3.5 h-3.5' }),
              h('span', { className: 'hidden sm:inline' }, 'Export Backup'),
              h('span', { className: 'sm:hidden' }, 'Backup')
            )
          )
        ),

        // Page Views Switcher
        h(
          'main',
          { className: 'p-6 max-w-7xl mx-auto w-full space-y-6' },

          // TAB 1: API / SERVER STATUS & LOGS
          activeTab === 'server' && h(ServerStatusView, {
            serverStatus,
            logsData,
            errorLogs,
            logNewCounts: {
              crashes: newCounts['log:crashes'] || 0,
              errors: newCounts['log:errors'] || 0,
              failed: newCounts['log:failed'] || 0,
              auth: newCounts['log:auth'] || 0,
              activity: newCounts['log:activity'] || 0,
            },
            onInspectError: (err) => setModalInspectError(err),
            onInspectAudit: (log) => setModalInspectAudit(log),
            logFilter,
            setLogFilter,
            logSearch,
            setLogSearch,
            loading,
            reload: loadAllData,
            fetchApi,
            addToast
          }),

          // TAB 2: DATABASE / DATA (HEALTH, BACKUP, RESTORE, MIGRATIONS, SQL PLAYGROUND)
          activeTab === 'database' && h(DatabaseView, {
            dbHealth,
            setModalRestoreDb,
            automatedBackups,
            schedulerStatus,
            fetchApi,
            addToast,
            reload: loadAllData,
            exportFullBackup
          }),

          // TAB 3: SECURITY & AUTH
          activeTab === 'security' && h(SecurityView, {
            securityData,
            fetchApi,
            addToast,
            reload: loadAllData,
            setConfirmAction
          }),

          // TAB 4: SYSTEM SETTINGS
          activeTab === 'settings' && h(SettingsView, {
            systemSettings,
            fetchApi,
            addToast,
            reload: loadAllData
          }),

          // TAB 5: SUPPORT & ANNOUNCEMENTS
          activeTab === 'support' && h(SupportView, {
            tickets,
            ticketFilter,
            setTicketFilter,
            setModalNewTicket,
            openReply: (t) => setModalTicketReply(t),
            fetchApi,
            addToast,
            reload: loadAllData
          }),

          // TAB 6: SAAS CLIENTS
          activeTab === 'clients' && h(ClientsView, {
            clients,
            clientsLoading: loading,
            search: clientSearch,
            setSearch: setClientSearch,
            statusFilter: clientStatusFilter,
            setStatusFilter: setClientStatusFilter,
            reload: loadAllData,
            openAdd: () => setModalAddClient(true),
            openEdit: (c) => setModalEditClient(c),
            openDetails: (c) => setModalClientDetails(c),
            openSubscription: (c) => setModalSubscriptionClient(c),
            setConfirmAction,
            fetchApi,
            addToast,
          })
        )
      ),

      // ── MODALS ──
      modalRestoreDb && h(RestoreDbModal, {
        isOpen: true,
        onClose: () => setModalRestoreDb(false),
        fetchApi,
        addToast,
        onRestored: () => { setModalRestoreDb(false); loadAllData(); }
      }),

      modalNewTicket && h(CreateTicketModal, {
        isOpen: true,
        onClose: () => setModalNewTicket(false),
        fetchApi,
        addToast,
        onCreated: () => { setModalNewTicket(false); loadAllData(); }
      }),

      modalAddClient && h(AddClientModal, {
        isOpen: true,
        onClose: () => setModalAddClient(false),
        onCreated: () => { setModalAddClient(false); loadAllData(); },
        fetchApi,
        addToast,
      }),

      modalEditClient && h(EditClientModal, {
        client: modalEditClient,
        onClose: () => setModalEditClient(null),
        onUpdated: () => { setModalEditClient(null); loadAllData(); },
        fetchApi,
        addToast,
      }),

      modalClientDetails && h(ClientDetailsModal, {
        clientId: modalClientDetails.id,
        onClose: () => setModalClientDetails(null),
        fetchApi,
        addToast,
      }),

      modalTicketReply && h(SupportTicketReplyModal, {
        ticket: modalTicketReply,
        onClose: () => setModalTicketReply(null),
        onUpdated: () => { setModalTicketReply(null); loadAllData(); },
        fetchApi,
        addToast,
      }),

      modalSubscriptionClient && h(SubscriptionModal, {
        client: modalSubscriptionClient,
        onClose: () => setModalSubscriptionClient(null),
        onUpdated: () => { setModalSubscriptionClient(null); loadAllData(); },
        fetchApi,
        addToast,
      }),

      modalInspectError && h(ErrorDetailModal, {
        error: modalInspectError,
        onClose: () => setModalInspectError(null),
        onResolved: () => { setModalInspectError(null); loadAllData(); },
        fetchApi,
        addToast,
      }),

      modalInspectAudit && h(AuditDetailModal, {
        log: modalInspectAudit,
        onClose: () => setModalInspectAudit(null),
        addToast,
      }),

      confirmAction && h(ConfirmModal, {
        action: confirmAction,
        onClose: () => setConfirmAction(null),
      })
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 1. API / SERVER STATUS & LOGS VIEW
  // ─────────────────────────────────────────────────────────────
  function ServerStatusView({ serverStatus, logsData, errorLogs, logNewCounts = {}, onInspectError, onInspectAudit, logFilter, setLogFilter, logSearch, setLogSearch, loading, reload, fetchApi, addToast }) {
    const s = serverStatus?.server;
    const db = serverStatus?.database;
    const rl = serverStatus?.rateLimit;

    const cards = [
      {
        title: 'API / Backend Status',
        badge: s?.status === 'online' ? 'ONLINE' : 'ONLINE',
        badgeColor: 'bg-emerald-100 text-emerald-800',
        main: 'API: Port ' + (s?.port || 3001),
        sub: 'Web Portal: Port ' + (typeof window !== 'undefined' && window.location?.port ? window.location.port : '3000'),
        details: [
          ['Web Portal (UI)', 'Port ' + (typeof window !== 'undefined' && window.location?.port ? window.location.port : '3000')],
          ['API Backend', 'Port ' + (s?.port || 3001)],
          ['Node Version', s?.nodeVersion || 'v22.18.0'],
          ['Platform', s?.platform || 'win32 (x64)'],
          ['Process PID', s?.pid || 'Active'],
          ['Uptime', s?.uptimeFormatted || '0s'],
        ]
      },
      {
        title: 'Memory Footprint',
        badge: (s?.memory?.heapPercent || 40) + '% Used',
        badgeColor: 'bg-indigo-100 text-indigo-800',
        main: (s?.memory?.heapUsedMb || 45) + ' MB',
        barPercent: Math.min(100, s?.memory?.heapPercent || 40),
        details: [
          ['Heap Total', (s?.memory?.heapTotalMb || 60) + ' MB'],
          ['RSS Memory', (s?.memory?.rssMb || 95) + ' MB'],
        ]
      },
      {
        title: 'PostgreSQL Engine Status',
        badge: (db?.latencyMs || 1) + 'ms Ping',
        badgeColor: 'bg-emerald-100 text-emerald-800',
        main: db?.status === 'connected' ? 'Connected' : 'Online',
        details: [
          ['Database', db?.dbName || 'printflow'],
          ['Engine Version', String(db?.serverVersion || 'PostgreSQL 17').slice(0, 15)],
          ['Active Conns', db?.activeConnections || 1],
          ['Pool Idle/Total', (db?.pool?.idleCount || 2) + ' / ' + (db?.pool?.totalCount || 2)],
        ]
      },
      {
        title: 'Traffic & Rate-Limit',
        badge: rl?.status || 'HEALTHY',
        badgeColor: 'bg-cyan-100 text-cyan-800',
        main: (rl?.requestsThisMinute || 0) + ' req/m',
        details: [
          ['Limit Threshold', (rl?.maxPerMinute || 500) + ' req/min'],
          ['Total Requests', s?.totalRequests || 0],
          ['Blocked Reqs', rl?.blockedRequests || 0],
        ]
      }
    ];

    const currentLogs = useMemo(() => {
      let list = [];
      if (logFilter === 'errors') list = logsData?.errorLogs || [];
      else if (logFilter === 'crashes') list = errorLogs || [];
      else if (logFilter === 'failed') list = logsData?.failedRequests || [];
      else if (logFilter === 'auth') list = logsData?.authLogs || [];
      else if (logFilter === 'activity') list = logsData?.recentActivity || [];

      if (!logSearch) return list;
      const q = logSearch.toLowerCase();
      return list.filter(item => JSON.stringify(item).toLowerCase().includes(q));
    }, [logsData, errorLogs, logFilter, logSearch]);

    const [logPage, setLogPage] = useState(1);
    const [logPageSize, setLogPageSize] = useState(20);

    useEffect(() => {
      setLogPage(1);
    }, [logFilter, logSearch, logPageSize]);

    const totalLogs = currentLogs.length;
    const pagedLogs = useMemo(() => {
      const start = (logPage - 1) * logPageSize;
      return currentLogs.slice(start, start + logPageSize);
    }, [currentLogs, logPage, logPageSize]);

    return h('div', { className: 'space-y-6' },
      // Top 4 Metric Cards
      h('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4' },
        cards.map((c, i) => h('div', { key: i, className: 'bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3' },
          h('div', { className: 'flex items-center justify-between' },
            h('span', { className: 'text-xs font-black uppercase tracking-wider text-slate-400' }, c.title),
            h('span', { className: 'px-2 py-0.5 rounded-full text-[10px] font-black ' + c.badgeColor }, c.badge)
          ),
          h('div', { className: 'text-2xl font-black font-mono text-slate-900' }, c.main),
          c.sub && h('div', { className: 'text-[11px] font-semibold text-slate-500 -mt-1' }, c.sub),
          c.barPercent !== undefined && h('div', { className: 'w-full bg-slate-100 rounded-full h-2 overflow-hidden' },
            h('div', { className: 'bg-indigo-600 h-full rounded-full transition-all', style: { width: c.barPercent + '%' } })
          ),
          h('div', { className: 'space-y-1 text-xs text-slate-600 font-semibold' },
            c.details.map(([k, v], j) => h('div', { key: j, className: 'flex justify-between' },
              h('span', {}, k + ':'),
              h('span', { className: 'font-mono font-bold text-slate-800' }, String(v))
            ))
          )
        ))
      ),

      // Logs & Activity Container
      h('div', { className: 'bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden' },
        // Log Filter Bar
        h('div', { className: 'p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/60' },
          h('div', { className: 'flex items-center gap-1.5 flex-wrap' },
            [
              { id: 'crashes', label: 'Mini-Sentry Crash Traces', count: (errorLogs || []).filter(e => !e.resolved).length, isHighlight: (errorLogs || []).some(e => !e.resolved) },
              { id: 'errors', label: 'Error Logs', count: logsData?.errorLogs?.length || 0 },
              { id: 'failed', label: 'Failed Requests (4xx/5xx)', count: logsData?.failedRequests?.length || 0 },
              { id: 'auth', label: 'Authentication Logs', count: logsData?.authLogs?.length || 0 },
              { id: 'activity', label: 'Recent System Activity', count: logsData?.recentActivity?.length || 0 },
            ].map(tab => {
              const active = logFilter === tab.id;
              const hasAlert = tab.isHighlight;
              return h('button', {
                key: tab.id,
                onClick: () => setLogFilter(tab.id),
                className: 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ' +
                  (active ? 'bg-slate-900 text-white shadow-xs' : hasAlert ? 'bg-rose-50 border border-rose-300 text-rose-800 hover:bg-rose-100' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'),
              },
              h('span', null, tab.label),
              logNewCounts[tab.id] > 0
                ? h('span', {
                    className: 'min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center',
                    title: logNewCounts[tab.id] + ' new since you last opened this list',
                  }, logNewCounts[tab.id] > 99 ? '99+' : logNewCounts[tab.id])
                : h('span', { className: 'px-1.5 py-0.5 rounded-md text-[10px] font-mono ' + (active ? 'bg-white/20 text-white' : hasAlert ? 'bg-rose-200 text-rose-900 font-bold' : 'bg-slate-100 text-slate-600') }, tab.count)
              );
            })
          ),
          h('div', { className: 'w-full sm:w-64' },
            h('input', {
              type: 'text',
              placeholder: 'Search log entries...',
              value: logSearch,
              onChange: (e) => setLogSearch(e.target.value),
              className: 'w-full px-3.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500'
            })
          )
        ),

        // Mini-Sentry banner if in crashes view
        logFilter === 'crashes' && h('div', { className: 'p-4 bg-rose-50/80 border-b border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs' },
          h('div', { className: 'flex items-center gap-2 text-rose-900 font-bold' },
            h(Icon, { name: 'bug', className: 'w-4 h-4 text-rose-600 shrink-0' }),
            h('span', null, 'Mini-Sentry Live Error Interceptor — Real-time crash monitoring, tenant attribution, and stack traces.'),
            h('span', { className: 'text-[11px] font-mono px-2 py-0.5 rounded bg-white text-rose-700 border border-rose-200' },
              ((errorLogs || []).filter(e => !e.resolved).length) + ' Unresolved'
            )
          ),
          h('div', { className: 'flex items-center gap-2' },
            h('button', {
              onClick: async () => {
                try {
                  const res = await fetchApi('/api/developer/errors/resolved', { method: 'DELETE' });
                  addToast(res.message || 'Resolved errors cleared.', 'success');
                  reload();
                } catch (err) {
                  addToast(err.message, 'error');
                }
              },
              className: 'px-3 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-100 text-rose-800 font-bold text-[11px] cursor-pointer'
            }, 'Clear Resolved')
          )
        ),

        // Logs Table
        h('div', { className: 'overflow-x-auto' },
          !currentLogs.length
            ? h('div', { className: 'p-12 text-center text-slate-400 text-xs' }, 'No log records found for this view.')
            : h('table', { className: 'w-full text-left text-xs' },
                h('thead', { className: 'bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100' },
                  h('tr', null,
                    h('th', { className: 'px-4 py-3' }, 'Timestamp'),
                    logFilter === 'crashes' && [
                      h('th', { key: 'status', className: 'px-4 py-3' }, 'Status'),
                      h('th', { key: 'route', className: 'px-4 py-3' }, 'Method / Path'),
                      h('th', { key: 'err', className: 'px-4 py-3' }, 'Exception Message'),
                      h('th', { key: 'tenant', className: 'px-4 py-3' }, 'Tenant / User'),
                      h('th', { key: 'res', className: 'px-4 py-3 text-right' }, 'Action'),
                    ],
                    logFilter === 'errors' && [
                      h('th', { key: 'm', className: 'px-4 py-3' }, 'Method'),
                      h('th', { key: 'e', className: 'px-4 py-3' }, 'Endpoint'),
                      h('th', { key: 'msg', className: 'px-4 py-3' }, 'Error Message'),
                      h('th', { key: 'u', className: 'px-4 py-3' }, 'Client IP / User'),
                    ],
                    logFilter === 'failed' && [
                      h('th', { key: 's', className: 'px-4 py-3' }, 'Status'),
                      h('th', { key: 'p', className: 'px-4 py-3' }, 'Endpoint Path'),
                      h('th', { key: 'ip', className: 'px-4 py-3' }, 'Client IP'),
                      h('th', { key: 'lat', className: 'px-4 py-3 text-right' }, 'Latency'),
                    ],
                    logFilter === 'auth' && [
                      h('th', { key: 'act', className: 'px-4 py-3' }, 'Action'),
                      h('th', { key: 'usr', className: 'px-4 py-3' }, 'User / Email'),
                      h('th', { key: 'role', className: 'px-4 py-3' }, 'Role'),
                      h('th', { key: 'ip', className: 'px-4 py-3' }, 'IP Address'),
                      h('th', { key: 'res', className: 'px-4 py-3 text-right' }, 'Status'),
                      h('th', { key: 'actbtn', className: 'px-4 py-3 text-right' }, 'Action'),
                    ],
                    logFilter === 'activity' && [
                      h('th', { key: 'act', className: 'px-4 py-3' }, 'Action'),
                      h('th', { key: 'per', className: 'px-4 py-3' }, 'Performed By'),
                      h('th', { key: 'cli', className: 'px-4 py-3' }, 'Tenant / Client'),
                      h('th', { key: 'det', className: 'px-4 py-3' }, 'Audit Details'),
                      h('th', { key: 'actbtn', className: 'px-4 py-3 text-right' }, 'Action'),
                    ]
                  )
                ),
                h('tbody', { className: 'divide-y divide-slate-100 font-mono text-[11px]' },
                  pagedLogs.map((l, idx) => {
                    const time = l.timestamp || l.created_at || new Date().toISOString();
                    const timeStr = new Date(time).toLocaleDateString() + ' ' + new Date(time).toLocaleTimeString();

                    return h('tr', { key: l.id || idx, className: 'hover:bg-slate-50' },
                      h('td', { className: 'px-4 py-3 text-slate-500 whitespace-nowrap' }, timeStr),
                      logFilter === 'crashes' && [
                        h('td', { key: 'status', className: 'px-4 py-3' },
                          h('span', { className: 'px-2 py-0.5 rounded text-[10px] font-black ' + (l.status_code >= 500 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800') }, (l.status_code || 500))
                        ),
                        h('td', { key: 'route', className: 'px-4 py-3 font-bold text-slate-800' },
                          h('span', { className: 'text-indigo-600 mr-1.5' }, l.method || 'GET'),
                          h('span', { className: 'max-w-[140px] truncate inline-block align-bottom font-mono' }, l.path || '/')
                        ),
                        h('td', { key: 'err', className: 'px-4 py-3 font-sans text-rose-900 font-semibold max-w-sm truncate', title: l.message }, l.message),
                        h('td', { key: 'tenant', className: 'px-4 py-3 text-slate-500' },
                          h('div', { className: 'font-bold text-slate-700' }, l.business_id || 'Global'),
                          h('div', { className: 'text-[10px] text-slate-400 truncate max-w-[120px]' }, l.user_email || l.ip_address || 'Anonymous')
                        ),
                        h('td', { key: 'res', className: 'px-4 py-3 text-right' },
                          h('div', { className: 'flex items-center justify-end gap-1.5' },
                            h('button', {
                              onClick: () => onInspectError(l),
                              className: 'px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] cursor-pointer'
                            }, 'Inspect Trace'),
                            !l.resolved ? h('button', {
                              onClick: async () => {
                                try {
                                  await fetchApi('/api/developer/errors/' + l.id + '/resolve', { method: 'PATCH' });
                                  addToast('Error marked as resolved.', 'success');
                                  reload();
                                } catch (err) {
                                  addToast(err.message, 'error');
                                }
                              },
                              className: 'px-2 py-1 rounded-lg bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-600 font-bold text-[10px] cursor-pointer'
                            }, 'Resolve') : h('span', { className: 'text-[10px] font-bold text-emerald-600 px-1' }, 'Resolved')
                          )
                        )
                      ],
                      logFilter === 'errors' && [
                        h('td', { key: 'm', className: 'px-4 py-3 font-bold text-rose-600' }, l.method),
                        h('td', { key: 'e', className: 'px-4 py-3 text-slate-800 font-bold' }, l.endpoint),
                        h('td', { key: 'msg', className: 'px-4 py-3 font-sans text-slate-700 max-w-md truncate', title: l.message }, l.message),
                        h('td', { key: 'u', className: 'px-4 py-3 text-slate-500' }, (l.ip || '127.0.0.1') + ' (' + (l.user || 'system') + ')'),
                      ],
                      logFilter === 'failed' && [
                        h('td', { key: 's', className: 'px-4 py-3' }, h('span', { className: 'px-2 py-0.5 rounded text-[10px] font-black ' + (l.status >= 500 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800') }, l.status + ' ' + l.method)),
                        h('td', { key: 'p', className: 'px-4 py-3 text-slate-800 font-bold max-w-xs truncate' }, l.path),
                        h('td', { key: 'ip', className: 'px-4 py-3 text-slate-500' }, l.ip + ' (' + l.user + ')'),
                        h('td', { key: 'lat', className: 'px-4 py-3 text-right font-black text-slate-700' }, l.responseTimeMs + 'ms'),
                      ],
                      logFilter === 'auth' && [
                        h('td', { key: 'act', className: 'px-4 py-3 font-bold text-slate-900 font-sans' }, l.action),
                        h('td', { key: 'usr', className: 'px-4 py-3 text-slate-700 font-sans' }, l.performed_by || l.email || 'N/A'),
                        h('td', { key: 'role', className: 'px-4 py-3 uppercase text-[10px] text-slate-600 font-bold' }, l.performer_role || l.role || 'user'),
                        h('td', { key: 'ip', className: 'px-4 py-3 text-slate-500' }, l.ip_address || l.ip || '127.0.0.1'),
                        h('td', { key: 'res', className: 'px-4 py-3 text-right' },
                          h('span', { className: 'px-2 py-0.5 rounded text-[10px] font-black ' + (l.success !== false && !l.action?.toLowerCase().includes('failed') ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800') },
                            l.success !== false && !l.action?.toLowerCase().includes('failed') ? 'GRANTED' : 'DENIED'
                          )
                        ),
                        h('td', { key: 'btn', className: 'px-4 py-3 text-right whitespace-nowrap' },
                          h('button', {
                            type: 'button',
                            onClick: () => onInspectAudit && onInspectAudit(l),
                            className: 'px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] cursor-pointer inline-flex items-center gap-1 transition-colors'
                          },
                          h(Icon, { name: 'eye', className: 'w-3 h-3' }),
                          'Inspect'
                          )
                        ),
                      ],
                      logFilter === 'activity' && [
                        h('td', { key: 'act', className: 'px-4 py-3 font-black text-slate-900 font-sans' }, l.action),
                        h('td', { key: 'per', className: 'px-4 py-3 text-slate-700 font-sans' }, (l.performed_by || 'Admin') + ' (' + (l.performer_role || 'dev') + ')'),
                        h('td', { key: 'cli', className: 'px-4 py-3 text-slate-600 font-sans' }, l.client_company || 'Platform System'),
                        h('td', {
                          key: 'det',
                          className: 'px-4 py-3 text-slate-600 font-mono text-[10px] max-w-xs truncate cursor-pointer hover:text-indigo-600 hover:underline',
                          title: 'Click to view full audit details: ' + (typeof l.details === 'object' ? JSON.stringify(l.details) : String(l.details || '')),
                          onClick: () => onInspectAudit && onInspectAudit(l)
                        }, typeof l.details === 'object' ? JSON.stringify(l.details) : String(l.details || '')),
                        h('td', { key: 'btn', className: 'px-4 py-3 text-right whitespace-nowrap' },
                          h('button', {
                            type: 'button',
                            onClick: () => onInspectAudit && onInspectAudit(l),
                            className: 'px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] cursor-pointer inline-flex items-center gap-1 transition-colors'
                          },
                          h(Icon, { name: 'eye', className: 'w-3 h-3' }),
                          'View Full'
                          )
                        )
                      ]
                    );
                  })
                )
              )
        ),
        h(Pagination, {
          total: totalLogs,
          page: logPage,
          pageSize: logPageSize,
          onPageChange: setLogPage,
          onPageSizeChange: setLogPageSize
        })
      )
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. DATABASE / DATA (HEALTH, BACKUP, RESTORE, MIGRATIONS)
  // ─────────────────────────────────────────────────────────────
  function DatabaseView({ dbHealth, setModalRestoreDb, automatedBackups, schedulerStatus, fetchApi, addToast, reload, exportFullBackup }) {
    const [backupPage, setBackupPage] = useState(1);
    const [backupPageSize, setBackupPageSize] = useState(20);

    // Pagination & search for PostgreSQL Table Storage
    const [tableStoragePage, setTableStoragePage] = useState(1);
    const [tableStoragePageSize, setTableStoragePageSize] = useState(20);
    const [tableSearch, setTableSearch] = useState('');

    // Pagination & search for Multi-Tenant Business Data Consumption
    const [bizUsagePage, setBizUsagePage] = useState(1);
    const [bizUsagePageSize, setBizUsagePageSize] = useState(20);
    const [bizSearch, setBizSearch] = useState('');

    const totalBackups = automatedBackups?.length || 0;
    const pagedBackups = useMemo(() => {
      const start = (backupPage - 1) * backupPageSize;
      return (automatedBackups || []).slice(start, start + backupPageSize);
    }, [automatedBackups, backupPage, backupPageSize]);

    // Handle automated backup download
    const handleDownloadAutomated = async (filename) => {
      try {
        addToast(`Downloading ${filename}...`, 'info');
        const token = localStorage.getItem('printflow_dev_token') || '';
        const res = await fetch(`/api/developer/database/automated-backups/${encodeURIComponent(filename)}/download`, {
          headers: token ? { Authorization: 'Bearer ' + token } : {}
        });
        if (!res.ok) throw new Error('Download failed: HTTP ' + res.status);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast(`${filename} downloaded successfully.`, 'success');
      } catch (err) {
        addToast(err.message || 'Failed to download backup file.', 'error');
      }
    };

    const filteredTables = useMemo(() => {
      const list = dbHealth?.tables || [];
      if (!tableSearch.trim()) return list;
      const q = tableSearch.trim().toLowerCase();
      return list.filter(t => (t.table_name || '').toLowerCase().includes(q));
    }, [dbHealth?.tables, tableSearch]);

    const pagedTables = useMemo(() => {
      const start = (tableStoragePage - 1) * tableStoragePageSize;
      return filteredTables.slice(start, start + tableStoragePageSize);
    }, [filteredTables, tableStoragePage, tableStoragePageSize]);

    const filteredBusinesses = useMemo(() => {
      const list = dbHealth?.businessUsage || [];
      if (!bizSearch.trim()) return list;
      const q = bizSearch.trim().toLowerCase();
      return list.filter(b =>
        (b.name || '').toLowerCase().includes(q) ||
        (b.business_id || '').toLowerCase().includes(q) ||
        (b.subscription_plan || '').toLowerCase().includes(q)
      );
    }, [dbHealth?.businessUsage, bizSearch]);

    const pagedBusinesses = useMemo(() => {
      const start = (bizUsagePage - 1) * bizUsagePageSize;
      return filteredBusinesses.slice(start, start + bizUsagePageSize);
    }, [filteredBusinesses, bizUsagePage, bizUsagePageSize]);

    const runMigrations = async () => {
      try {
        const res = await fetchApi('/api/developer/database/run-migrations', { method: 'POST' });
        addToast(res.message || 'All migrations verified and active.', 'success');
        reload();
      } catch (err) {
        addToast('Migration check failed: ' + err.message, 'error');
      }
    };

    return h('div', { className: 'space-y-6' },
      // Overview & Operations Card
      h('div', { className: 'grid grid-cols-1 lg:grid-cols-3 gap-5' },
        h('div', { className: 'lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4' },
          h('div', { className: 'flex items-center justify-between' },
            h('div', null,
              h('h3', { className: 'text-base font-black text-slate-900 flex items-center gap-2' },
                h(Icon, { name: 'database', className: 'w-5 h-5 text-indigo-600' }),
                'PostgreSQL Database Health & Storage'
              ),
              h('p', { className: 'text-xs text-slate-500 mt-0.5' }, 'Instance storage allocation, relational health, and active table density.')
            ),
            h('span', { className: 'px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800' }, dbHealth?.status || 'Optimal')
          ),
          h('div', { className: 'grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2' },
            h('div', { className: 'bg-slate-50 rounded-2xl p-3 border border-slate-100' },
              h('span', { className: 'text-[10px] font-bold uppercase tracking-wider text-slate-400 block' }, 'Database Name'),
              h('span', { className: 'text-base font-black font-mono text-slate-900' }, dbHealth?.databaseName || 'printflow')
            ),
            h('div', { className: 'bg-slate-50 rounded-2xl p-3 border border-slate-100' },
              h('span', { className: 'text-[10px] font-bold uppercase tracking-wider text-slate-400 block' }, 'Total Disk Size'),
              h('span', { className: 'text-base font-black font-mono text-indigo-700' }, dbHealth?.totalSize || '12 MB')
            ),
            h('div', { className: 'bg-slate-50 rounded-2xl p-3 border border-slate-100' },
              h('span', { className: 'text-[10px] font-bold uppercase tracking-wider text-slate-400 block' }, 'Active Tables'),
              h('span', { className: 'text-base font-black font-mono text-slate-900' }, (dbHealth?.totalTables || 21) + ' Tables')
            ),
            h('div', { className: 'bg-slate-50 rounded-2xl p-3 border border-slate-100' },
              h('span', { className: 'text-[10px] font-bold uppercase tracking-wider text-slate-400 block' }, 'Estimated Records'),
              h('span', { className: 'text-base font-black font-mono text-emerald-700' }, '~' + (dbHealth?.totalRows || 0))
            )
          )
        ),

        // Action Toolbar
        h('div', { className: 'bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3' },
          h('div', null,
            h('h4', { className: 'text-sm font-black text-slate-900' }, 'Database Operations'),
            h('p', { className: 'text-xs text-slate-500 mt-1' }, 'Export full offline JSON snapshots, restore tables, or verify schemas.')
          ),
          h('div', { className: 'space-y-2' },
            h('button', {
              onClick: exportFullBackup,
              className: 'w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs'
            },
            h(Icon, { name: 'download', className: 'w-4 h-4' }),
            'Download Full Backup (.json)'
            ),
            h('button', {
              onClick: () => setModalRestoreDb(true),
              className: 'w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer'
            },
            h(Icon, { name: 'upload', className: 'w-4 h-4' }),
            'Restore Database from JSON'
            ),
            h('button', {
              onClick: runMigrations,
              className: 'w-full py-2 px-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer'
            },
            h(Icon, { name: 'check', className: 'w-4 h-4 text-emerald-600' }),
            'Verify & Run Migrations'
            )
          )
        )
      ),

      // Table Storage Breakdown (Paginated)
      h('div', { className: 'bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden' },
        h('div', { className: 'p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3' },
          h('div', null,
            h('h3', { className: 'text-sm font-black text-slate-900' }, 'PostgreSQL Table Storage & Disk Usage'),
            h('p', { className: 'text-xs text-slate-500' }, 'Storage breakdown by table relation size, index footprint, and record density.')
          ),
          h('div', { className: 'flex items-center gap-3' },
            h('div', { className: 'relative' },
              h('input', {
                type: 'text',
                placeholder: 'Filter table name...',
                value: tableSearch,
                onChange: (e) => {
                  setTableSearch(e.target.value);
                  setTableStoragePage(1);
                },
                className: 'pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44 sm:w-56'
              }),
              h(Icon, { name: 'search', className: 'w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5' })
            ),
            h('span', { className: 'text-xs font-mono font-bold text-slate-400 whitespace-nowrap' },
              filteredTables.length + ' tables registered'
            )
          )
        ),
        h('div', { className: 'overflow-x-auto' },
          h('table', { className: 'w-full text-left text-xs' },
            h('thead', { className: 'bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100' },
              h('tr', null,
                h('th', { className: 'px-4 py-3' }, 'Table Name'),
                h('th', { className: 'px-4 py-3 text-right' }, 'Estimated Rows'),
                h('th', { className: 'px-4 py-3 text-right' }, 'Data Size'),
                h('th', { className: 'px-4 py-3 text-right' }, 'Index Size'),
                h('th', { className: 'px-4 py-3 text-right' }, 'Total Size')
              )
            ),
            h('tbody', { className: 'divide-y divide-slate-100 font-mono text-[11px]' },
              pagedTables.length === 0
                ? h('tr', null,
                    h('td', { colSpan: 5, className: 'px-4 py-8 text-center text-xs font-sans text-slate-400' },
                      tableSearch ? `No tables matching "${tableSearch}"` : 'No database tables registered.'
                    )
                  )
                : pagedTables.map(t => h('tr', { key: t.table_name, className: 'hover:bg-slate-50' },
                    h('td', { className: 'px-4 py-3 font-bold text-slate-900 flex items-center gap-2' },
                      h(Icon, { name: 'database', className: 'w-3.5 h-3.5 text-indigo-500' }),
                      t.table_name
                    ),
                    h('td', { className: 'px-4 py-3 text-right font-bold text-slate-700' }, Number(t.estimated_rows).toLocaleString()),
                    h('td', { className: 'px-4 py-3 text-right text-slate-500' }, t.data_size),
                    h('td', { className: 'px-4 py-3 text-right text-slate-500' }, t.index_size),
                    h('td', { className: 'px-4 py-3 text-right font-black text-indigo-700' }, t.total_size)
                  ))
            )
          )
        ),
        h(Pagination, {
          total: filteredTables.length,
          page: tableStoragePage,
          pageSize: tableStoragePageSize,
          onPageChange: setTableStoragePage,
          onPageSizeChange: (s) => {
            setTableStoragePageSize(s);
            setTableStoragePage(1);
          }
        })
      ),

      // Multi-Tenant Business Data Usage (Paginated)
      h('div', { className: 'bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden' },
        h('div', { className: 'p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3' },
          h('div', null,
            h('h3', { className: 'text-sm font-black text-slate-900' }, 'Multi-Tenant Business Data Consumption'),
            h('p', { className: 'text-xs text-slate-500' }, 'Order volumes and client records per shop instance.')
          ),
          h('div', { className: 'flex items-center gap-3' },
            h('div', { className: 'relative' },
              h('input', {
                type: 'text',
                placeholder: 'Filter business or tenant...',
                value: bizSearch,
                onChange: (e) => {
                  setBizSearch(e.target.value);
                  setBizUsagePage(1);
                },
                className: 'pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44 sm:w-56'
              }),
              h(Icon, { name: 'search', className: 'w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5' })
            ),
            h('span', { className: 'text-xs font-mono font-bold text-slate-400 whitespace-nowrap' },
              filteredBusinesses.length + ' tenants'
            )
          )
        ),
        h('div', { className: 'overflow-x-auto' },
          h('table', { className: 'w-full text-left text-xs' },
            h('thead', { className: 'bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100' },
              h('tr', null,
                h('th', { className: 'px-4 py-3' }, 'Tenant / Business'),
                h('th', { className: 'px-4 py-3' }, 'Plan'),
                h('th', { className: 'px-4 py-3 text-right' }, 'Orders Count'),
                h('th', { className: 'px-4 py-3 text-right' }, 'Clients Count')
              )
            ),
            h('tbody', { className: 'divide-y divide-slate-100 text-xs' },
              pagedBusinesses.length === 0
                ? h('tr', null,
                    h('td', { colSpan: 4, className: 'px-4 py-8 text-center text-xs text-slate-400' },
                      bizSearch ? `No tenants matching "${bizSearch}"` : 'No tenant businesses recorded.'
                    )
                  )
                : pagedBusinesses.map(b => h('tr', { key: b.business_id, className: 'hover:bg-slate-50' },
                    h('td', { className: 'px-4 py-3' },
                      h('div', { className: 'font-black text-slate-900' }, b.name),
                      h('div', { className: 'text-[10px] font-mono text-slate-400' }, b.business_id)
                    ),
                    h('td', { className: 'px-4 py-3' }, h('span', { className: 'px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-700 uppercase' }, b.subscription_plan || 'Standard')),
                    h('td', { className: 'px-4 py-3 text-right font-mono font-bold text-slate-800' }, b.orders_count),
                    h('td', { className: 'px-4 py-3 text-right font-mono font-bold text-slate-800' }, b.customers_count)
                  ))
            )
          )
        ),
        h(Pagination, {
          total: filteredBusinesses.length,
          page: bizUsagePage,
          pageSize: bizUsagePageSize,
          onPageChange: setBizUsagePage,
          onPageSizeChange: (s) => {
            setBizUsagePageSize(s);
            setBizUsagePage(1);
          }
        })
      ),

      // Point 8: Automated Scheduled Backups Card
      h('div', { className: 'bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden' },
        h('div', { className: 'p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50' },
          h('div', null,
            h('h3', { className: 'text-sm font-black text-slate-900 flex items-center gap-2' },
              h(Icon, { name: 'clock', className: 'w-4 h-4 text-indigo-600' }),
              'Automated Scheduled Database Backups'
            ),
            h('p', { className: 'text-xs text-slate-500 mt-0.5' },
              'Automated snapshots trigger daily with rolling 7-day local disk retention. Old backups are automatically pruned.'
            )
          ),
          h('div', { className: 'flex items-center gap-2' },
            h('span', { className: 'px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800' },
              'Retention: ' + (schedulerStatus?.retentionDays || 7) + ' Days'
            ),
            h('button', {
              onClick: async () => {
                try {
                  addToast('Creating automated backup snapshot...', 'info');
                  const res = await fetchApi('/api/developer/database/automated-backups/run-now', { method: 'POST' });
                  addToast(res.message || 'Automated backup completed!', 'success');
                  reload();
                } catch (err) {
                  addToast('Backup failed: ' + err.message, 'error');
                }
              },
              className: 'px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs'
            },
            h(Icon, { name: 'refresh', className: 'w-3.5 h-3.5' }),
            'Run Backup Now'
            )
          )
        ),
        h('div', { className: 'p-4' },
          !automatedBackups?.length
            ? h('div', { className: 'p-8 text-center text-slate-400 text-xs' },
                'No automated backup snapshots found yet. Click "Run Backup Now" to create one immediately.'
              )
            : h('div', { className: 'overflow-x-auto' },
                h('table', { className: 'w-full text-left text-xs font-mono' },
                  h('thead', { className: 'bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100' },
                    h('tr', null,
                      h('th', { className: 'px-4 py-2.5' }, 'Snapshot Filename'),
                      h('th', { className: 'px-4 py-2.5' }, 'Size'),
                      h('th', { className: 'px-4 py-2.5' }, 'Created Date'),
                      h('th', { className: 'px-4 py-2.5' }, 'Age'),
                      h('th', { className: 'px-4 py-2.5 text-right' }, 'Action')
                    )
                  ),
                  h('tbody', { className: 'divide-y divide-slate-100 text-[11px]' },
                    pagedBackups.map((b) => h('tr', { key: b.filename, className: 'hover:bg-slate-50' },
                      h('td', { className: 'px-4 py-2.5 font-bold text-slate-900 flex items-center gap-2' },
                        h(Icon, { name: 'file', className: 'w-3.5 h-3.5 text-slate-400' }),
                        b.filename
                      ),
                      h('td', { className: 'px-4 py-2.5 text-slate-600' }, b.sizeFormatted || ((b.sizeBytes / 1024).toFixed(1) + ' KB')),
                      h('td', { className: 'px-4 py-2.5 text-slate-500' }, new Date(b.createdAt).toLocaleString()),
                      h('td', { className: 'px-4 py-2.5 text-slate-500' }, b.ageHours ? b.ageHours + 'h ago' : 'Recent'),
                      h('td', { className: 'px-4 py-2.5 text-right' },
                        h('button', {
                          type: 'button',
                          onClick: () => handleDownloadAutomated(b.filename),
                          className: 'inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs cursor-pointer'
                        },
                        h(Icon, { name: 'download', className: 'w-3 h-3' }),
                        'Download'
                        )
                      )
                    ))
                  )
                )
              ),
        h(Pagination, {
          total: totalBackups,
          page: backupPage,
          pageSize: backupPageSize,
          onPageChange: setBackupPage,
          onPageSizeChange: setBackupPageSize
        })
        )
      ),

      // Point 5: Safe SQL Query Playground
      h(SqlPlayground, { fetchApi, addToast })
    );
  }

  // ─────────────────────────────────────────────────────────────
  // SAFE SQL QUERY PLAYGROUND COMPONENT (Point 5)
  // ─────────────────────────────────────────────────────────────
  function SqlPlayground({ fetchApi, addToast }) {
    const [query, setQuery] = useState('SELECT id, name, email, subscription_plan, subscription_status, subscription_expires_at, created_at FROM saas_clients ORDER BY created_at DESC LIMIT 10;');
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [savedQueries, setSavedQueries] = useState([]);

    useEffect(() => {
      fetchApi('/api/developer/database/saved-queries')
        .then(res => { if (res.ok && res.queries) setSavedQueries(res.queries); })
        .catch(() => {});
    }, [fetchApi]);

    const handleRunQuery = async () => {
      if (!query.trim()) return;
      setRunning(true);
      setError(null);
      setResult(null);
      try {
        const res = await fetchApi('/api/developer/database/query', {
          method: 'POST',
          body: JSON.stringify({ query: query.trim() })
        });
        if (res.ok) {
          setResult(res);
          addToast(`Query completed in ${res.durationMs}ms (${res.rowCount} rows)`, 'success');
        } else {
          setError(res.error || 'Query execution failed');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setRunning(false);
      }
    };

    const handleExportCsv = () => {
      if (!result || !result.rows || !result.rows.length) return;
      const cols = result.columns || Object.keys(result.rows[0]);
      const csvRows = [
        cols.join(','),
        ...result.rows.map(r => cols.map(c => {
          let val = r[c];
          if (val === null || val === undefined) return '""';
          if (typeof val === 'object') val = JSON.stringify(val);
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(','))
      ];
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `query_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast('CSV exported successfully!', 'success');
    };

    return h('div', { className: 'bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-6' },
      // Header
      h('div', { className: 'flex flex-col sm:flex-row sm:items-center justify-between gap-3' },
        h('div', null,
          h('h3', { className: 'text-base font-black text-slate-900 flex items-center gap-2' },
            h(Icon, { name: 'terminal', className: 'w-5 h-5 text-indigo-600' }),
            'Safe SQL Query Playground & Database Inspector'
          ),
          h('p', { className: 'text-xs text-slate-500 mt-0.5' },
            'Execute read-only SQL queries directly against PostgreSQL with automated LIMIT 100 guard and execution timing.'
          )
        ),
        h('div', { className: 'flex items-center gap-2' },
          h('span', { className: 'px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 flex items-center gap-1' },
            h(Icon, { name: 'shield', className: 'w-3 h-3' }),
            'READ-ONLY GUARD ACTIVE'
          )
        )
      ),

      // Preset selector
      savedQueries.length > 0 && h('div', { className: 'flex items-center gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100' },
        h('span', { className: 'text-xs font-bold text-slate-500 whitespace-nowrap pl-2' }, 'Pre-Built Presets:'),
        h('select', {
          onChange: (e) => {
            const selected = savedQueries.find(q => q.name === e.target.value);
            if (selected) setQuery(selected.sql);
          },
          className: 'w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer'
        },
        savedQueries.map(q => h('option', { key: q.name, value: q.name }, `${q.name} - ${q.description}`))
        )
      ),

      // SQL Textarea
      h('div', { className: 'space-y-2' },
        h('div', { className: 'relative' },
          h('textarea', {
            rows: 5,
            value: query,
            onChange: (e) => setQuery(e.target.value),
            onKeyDown: (e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleRunQuery();
              }
            },
            placeholder: 'Write SELECT / EXPLAIN query here...',
            className: 'w-full p-4 font-mono text-xs bg-slate-950 text-indigo-300 rounded-2xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-y'
          }),
          h('div', { className: 'absolute right-3 bottom-3 text-[10px] font-mono text-slate-500 pointer-events-none' },
            'Press Ctrl + Enter to run'
          )
        ),
        h('div', { className: 'flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs' },
          h('div', { className: 'text-slate-500 text-[11px]' },
            'Only SELECT, EXPLAIN, and WITH statements allowed. Destructive actions are strictly blocked.'
          ),
          h('div', { className: 'flex items-center gap-2 shrink-0' },
            result && h('button', {
              onClick: handleExportCsv,
              className: 'px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs'
            },
            h(Icon, { name: 'download', className: 'w-3.5 h-3.5 text-slate-500' }),
            'Export CSV'
            ),
            h('button', {
              onClick: handleRunQuery,
              disabled: running,
              className: 'px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50'
            },
            h(Icon, { name: 'play', className: 'w-3.5 h-3.5' }),
            running ? 'Executing...' : 'Run Query'
            )
          )
        )
      ),

      // Error message display
      error && h('div', { className: 'p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono font-semibold flex items-center gap-2' },
        h(Icon, { name: 'alert', className: 'w-4 h-4 text-rose-600 shrink-0' }),
        h('span', null, error)
      ),

      // Query Result View
      result && h('div', { className: 'space-y-2 border-t border-slate-100 pt-4' },
        h('div', { className: 'flex items-center justify-between text-xs' },
          h('div', { className: 'flex items-center gap-3 font-mono text-[11px] text-slate-600' },
            h('span', { className: 'font-bold text-slate-900' }, result.rowCount + ' row(s) returned'),
            h('span', { className: 'text-slate-400' }, '•'),
            h('span', { className: 'text-emerald-700 font-bold' }, result.durationMs + ' ms execution time')
          ),
          h('span', { className: 'text-[11px] text-slate-400' }, 'Display capped at 100 rows maximum')
        ),
        h('div', { className: 'overflow-x-auto max-h-96 rounded-2xl border border-slate-200' },
          h('table', { className: 'w-full text-left text-xs font-mono' },
            h('thead', { className: 'bg-slate-100 text-[10px] uppercase font-bold text-slate-600 sticky top-0' },
              h('tr', null,
                (result.columns || []).map(col => h('th', { key: col, className: 'px-3 py-2 border-b border-slate-200 whitespace-nowrap' }, col))
              )
            ),
            h('tbody', { className: 'divide-y divide-slate-100 bg-white text-[11px]' },
              (result.rows || []).map((row, idx) => h('tr', { key: idx, className: 'hover:bg-indigo-50/40' },
                (result.columns || []).map(col => {
                  const val = row[col];
                  return h('td', { key: col, className: 'px-3 py-1.5 whitespace-nowrap max-w-xs truncate text-slate-700' },
                    val === null ? h('span', { className: 'text-slate-300 italic' }, 'NULL') :
                    typeof val === 'object' ? JSON.stringify(val) :
                    String(val)
                  );
                })
              ))
            )
          )
        )
      )
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. SECURITY & SESSIONS VIEW
  // ─────────────────────────────────────────────────────────────
  function SecurityView({ securityData, fetchApi, addToast, reload, setConfirmAction }) {
    const handleRevokeAll = () => {
      setConfirmAction({
        title: 'Revoke All Active Sessions',
        message: 'Are you sure you want to terminate all active sessions? All connected users and clients across all print shops will be logged out immediately.',
        confirmText: 'Revoke All Sessions',
        isDanger: true,
        onConfirm: async () => {
          try {
            const res = await fetchApi('/api/developer/security/revoke-sessions', { method: 'POST' });
            addToast(res.message || 'All sessions revoked.', 'success');
            reload();
          } catch (err) {
            addToast('Revocation failed: ' + err.message, 'error');
          }
        }
      });
    };

    const handleRevokeOne = (user) => {
      setConfirmAction({
        title: `Revoke Session for ${user.name}`,
        message: `Are you sure you want to terminate the active session for ${user.name}? This user will be immediately logged out.`,
        confirmText: 'Revoke Session',
        isDanger: true,
        onConfirm: async () => {
          try {
            const res = await fetchApi(`/api/developer/security/revoke-user-session/${user.id}`, { method: 'POST' });
            addToast(res.message || `Session revoked for ${user.name}.`, 'success');
            reload();
          } catch (err) {
            addToast('Revocation failed: ' + err.message, 'error');
          }
        }
      });
    };

    const handleSavePolicy = async (e) => {
      e.preventDefault();
      const f = e.target;
      const policy = {
        session_timeout_minutes: Number(f.timeout.value) || 120,
        max_failed_logins: Number(f.maxLogins.value) || 5,
        rate_limit_per_minute: Number(f.rateLimit.value) || 500,
        enforce_mfa_developer: f.enforceMfa.checked,
        ip_whitelist_enabled: f.ipWhitelistEnabled.checked,
        allowed_ips: f.allowedIps.value.split(',').map(s => s.trim()).filter(Boolean)
      };
      try {
        const res = await fetchApi('/api/developer/security/settings', {
          method: 'PUT',
          body: JSON.stringify(policy)
        });
        addToast(res.message || 'Security settings updated.', 'success');
        reload();
      } catch (err) {
        addToast('Failed: ' + err.message, 'error');
      }
    };

    return h('div', { className: 'space-y-6' },
      // Security KPIs
      h('div', { className: 'grid grid-cols-1 sm:grid-cols-3 gap-4' },
        h('div', { className: 'bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-1' },
          h('span', { className: 'text-[10px] font-bold uppercase tracking-wider text-slate-400' }, 'Active User Sessions'),
          h('div', { className: 'text-2xl font-black text-slate-900 font-mono' }, (securityData?.totalActiveSessions || 0) + ' Sessions'),
          h('p', { className: 'text-xs text-slate-500' }, 'Currently authenticated client/staff accounts')
        ),
        h('div', { className: 'bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-1' },
          h('span', { className: 'text-[10px] font-bold uppercase tracking-wider text-slate-400' }, 'Failed Login Attempts'),
          h('div', { className: 'text-2xl font-black text-rose-600 font-mono' }, (securityData?.failedLoginAttempts || 0) + ' Attempts'),
          h('p', { className: 'text-xs text-slate-500' }, 'Blocked authentication requests')
        ),
        h('div', { className: 'bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-1' },
          h('span', { className: 'text-[10px] font-bold uppercase tracking-wider text-slate-400' }, 'Emergency Session Revocation'),
          h('div', { className: 'text-2xl font-black text-indigo-700 font-mono' }, 'Armed & Ready'),
          h('p', { className: 'text-xs text-slate-500' }, 'One-click token invalidation enabled')
        )
      ),

      // Active Sessions Table & Revoke Button
      h('div', { className: 'bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden' },
        h('div', { className: 'p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4' },
          h('div', null,
            h('h3', { className: 'text-base font-black text-slate-900' }, 'Active User Sessions & Identity'),
            h('p', { className: 'text-xs text-slate-500' }, 'Inspect active team logins across branches and revoke tokens on security events.')
          ),
          h('button', {
            type: 'button',
            onClick: handleRevokeAll,
            className: 'px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs'
          },
          h(Icon, { name: 'trash', className: 'w-4 h-4' }),
          'Revoke All Active Sessions'
          )
        ),
        h('div', { className: 'overflow-x-auto' },
          h('table', { className: 'w-full text-left text-xs' },
            h('thead', { className: 'bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100' },
              h('tr', null,
                h('th', { className: 'px-4 py-3' }, 'User Name'),
                h('th', { className: 'px-4 py-3' }, 'Email'),
                h('th', { className: 'px-4 py-3' }, 'Role'),
                h('th', { className: 'px-4 py-3' }, 'Tenant / Business'),
                h('th', { className: 'px-4 py-3' }, 'Last Activity'),
                h('th', { className: 'px-4 py-3' }, 'Status'),
                h('th', { className: 'px-4 py-3 text-right' }, 'Action')
              )
            ),
            h('tbody', { className: 'divide-y divide-slate-100' },
              (securityData?.activeSessions || []).map(s => h('tr', { key: s.id, className: 'hover:bg-slate-50' },
                h('td', { className: 'px-4 py-3 font-black text-slate-900' }, s.name),
                h('td', { className: 'px-4 py-3 text-slate-600 font-mono text-[11px]' }, s.email || '—'),
                h('td', { className: 'px-4 py-3' }, h('span', { className: 'px-2 py-0.5 rounded text-[10px] font-black uppercase ' + (s.role === 'OWNER' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700') }, s.role)),
                h('td', { className: 'px-4 py-3 text-slate-500 font-mono text-[11px]' }, s.businessId),
                h('td', { className: 'px-4 py-3 text-slate-500 font-mono text-[11px]' }, new Date(s.lastActive).toLocaleDateString()),
                h('td', { className: 'px-4 py-3' },
                  s.isRevoked
                    ? h('span', { className: 'px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800' }, 'REVOKED')
                    : h('span', { className: 'px-2 py-0.5 rounded text-[10px] font-black ' + (s.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500') }, s.isActive ? 'ACTIVE' : 'OFFLINE')
                ),
                h('td', { className: 'px-4 py-3 text-right' },
                  s.isRevoked
                    ? h('span', { className: 'text-[11px] font-mono font-semibold text-slate-400' }, 'Terminated')
                    : h('button', {
                        type: 'button',
                        onClick: () => handleRevokeOne(s),
                        className: 'px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition'
                      },
                      h(Icon, { name: 'trash', className: 'w-3 h-3 text-rose-600' }),
                      'Revoke'
                    )
                )
              ))
            )
          )
        )
      ),

      // Security Settings Form
      h('div', { className: 'bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4' },
        h('div', null,
          h('h3', { className: 'text-base font-black text-slate-900' }, 'Security Policy & Protection Rules'),
          h('p', { className: 'text-xs text-slate-500' }, 'Configure session timeout thresholds, failed attempt limits, and IP whitelist rules.')
        ),
        h('form', { onSubmit: handleSavePolicy, className: 'space-y-4 pt-2' },
          h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' },
            h('div', { className: 'space-y-1.5' },
              h('label', { className: 'text-xs font-bold text-slate-700' }, 'Session Timeout (Minutes)'),
              h('input', {
                name: 'timeout',
                type: 'number',
                defaultValue: securityData?.securityPolicy?.session_timeout_minutes || 120,
                className: 'w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl'
              })
            ),
            h('div', { className: 'space-y-1.5' },
              h('label', { className: 'text-xs font-bold text-slate-700' }, 'Max Failed Logins Before Lockout'),
              h('input', {
                name: 'maxLogins',
                type: 'number',
                defaultValue: securityData?.securityPolicy?.max_failed_logins || 5,
                className: 'w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl'
              })
            ),
            h('div', { className: 'space-y-1.5' },
              h('label', { className: 'text-xs font-bold text-slate-700' }, 'API Rate Limit (Requests / Min)'),
              h('input', {
                name: 'rateLimit',
                type: 'number',
                defaultValue: securityData?.securityPolicy?.rate_limit_per_minute || 500,
                className: 'w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl'
              })
            )
          ),
          h('div', { className: 'space-y-1.5 pt-2' },
            h('label', { className: 'text-xs font-bold text-slate-700' }, 'Allowed IPs (Comma-separated for Whitelisting)'),
            h('input', {
              name: 'allowedIps',
              type: 'text',
              defaultValue: (securityData?.securityPolicy?.allowed_ips || ['127.0.0.1', '::1']).join(', '),
              className: 'w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl font-mono'
            })
          ),
          h('div', { className: 'flex items-center gap-6 pt-1 flex-wrap' },
            h('label', { className: 'flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700' },
              h('input', { name: 'enforceMfa', type: 'checkbox', defaultChecked: securityData?.securityPolicy?.enforce_mfa_developer || false, className: 'rounded text-indigo-600' }),
              'Enforce Multi-Factor Authentication for Developer Role'
            ),
            h('label', { className: 'flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700' },
              h('input', { name: 'ipWhitelistEnabled', type: 'checkbox', defaultChecked: securityData?.securityPolicy?.ip_whitelist_enabled || false, className: 'rounded text-indigo-600' }),
              'Enable IP Whitelist Restriction'
            )
          ),
          h('div', { className: 'pt-3 flex justify-end' },
            h('button', { type: 'submit', className: 'px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs cursor-pointer shadow-xs' },
              'Save Security Settings'
            )
          )
        )
      )
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 4. SYSTEM SETTINGS VIEW
  // ─────────────────────────────────────────────────────────────
  function SettingsView({ systemSettings, fetchApi, addToast, reload }) {
    const handleSaveCategory = async (category, value) => {
      try {
        const res = await fetchApi('/api/developer/system-settings', {
          method: 'PUT',
          body: JSON.stringify({ category, value })
        });
        addToast(res.message || 'Settings updated successfully.', 'success');
        reload();
      } catch (err) {
        addToast('Save failed: ' + err.message, 'error');
      }
    };

    const isMaint = systemSettings?.maintenanceMode?.enabled || false;

    return h('div', { className: 'space-y-6' },
      // Maintenance Mode
      h('div', { className: 'bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4' },
        h('div', { className: 'flex items-center justify-between' },
          h('div', null,
            h('h3', { className: 'text-base font-black text-slate-900' }, 'Maintenance Mode Control'),
            h('p', { className: 'text-xs text-slate-500' }, 'Take the storefront offline for client shops while keeping developer admin accessible.')
          ),
          h('span', { className: 'px-3 py-1 rounded-full text-xs font-black ' + (isMaint ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600') }, isMaint ? 'ACTIVE' : 'DISABLED')
        ),
        h('form', {
          onSubmit: (e) => {
            e.preventDefault();
            const f = e.target;
            handleSaveCategory('maintenanceMode', {
              enabled: f.maintEnabled.checked,
              message: f.maintMsg.value.trim()
            });
          },
          className: 'space-y-4'
        },
        h('div', { className: 'space-y-1.5' },
          h('label', { className: 'text-xs font-bold text-slate-700' }, 'Maintenance Display Message to Users'),
          h('textarea', {
            name: 'maintMsg',
            rows: 2,
            defaultValue: systemSettings?.maintenanceMode?.message || 'The system is undergoing scheduled maintenance. Please check back shortly.',
            className: 'w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl'
          })
        ),
        h('div', { className: 'flex items-center justify-between pt-1 flex-wrap gap-2' },
          h('label', { className: 'flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800' },
            h('input', { name: 'maintEnabled', type: 'checkbox', defaultChecked: isMaint, className: 'rounded text-amber-600' }),
            'Activate Maintenance Mode (Show maintenance message to non-developer users)'
          ),
          h('button', { type: 'submit', className: 'px-5 py-2 rounded-xl bg-slate-900 text-white font-black text-xs cursor-pointer' }, 'Update Maintenance Switch')
        )
        )
      )
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 5. SUPPORT & BROADCAST VIEW
  // ─────────────────────────────────────────────────────────────
  function SupportView({ tickets, ticketFilter, setTicketFilter, setModalNewTicket, openReply, fetchApi, addToast, reload }) {
    const [ticketPage, setTicketPage] = useState(1);
    const [ticketPageSize, setTicketPageSize] = useState(20);

    useEffect(() => {
      setTicketPage(1);
    }, [ticketFilter, ticketPageSize]);

    const filteredTickets = useMemo(() => {
      if (ticketFilter === 'all') return tickets;
      return tickets.filter(t => t.status === ticketFilter);
    }, [tickets, ticketFilter]);

    const totalTickets = filteredTickets.length;
    const pagedTickets = useMemo(() => {
      const start = (ticketPage - 1) * ticketPageSize;
      return filteredTickets.slice(start, start + ticketPageSize);
    }, [filteredTickets, ticketPage, ticketPageSize]);

    const handleBroadcast = async (e) => {
      e.preventDefault();
      const f = e.target;
      const title = f.broadcastTitle.value.trim();
      const message = f.broadcastMsg.value.trim();
      const targetRole = f.broadcastRole.value;
      if (!title || !message) { alert('Enter title and message'); return; }
      try {
        const res = await fetchApi('/api/developer/support/broadcast', {
          method: 'POST',
          body: JSON.stringify({ title, message, targetRole })
        });
        addToast('Notification broadcasted to all active ' + targetRole + ' users!', 'success');
        f.reset();
      } catch (err) {
        addToast('Broadcast failed: ' + err.message, 'error');
      }
    };

    return h('div', { className: 'space-y-6' },
      // Tickets List
      h('div', { className: 'bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden' },
        h('div', { className: 'p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4' },
          h('div', null,
            h('h3', { className: 'text-base font-black text-slate-900' }, 'Client Support Tickets & Issues'),
            h('p', { className: 'text-xs text-slate-500' }, 'Track inquiries, bug reports, and assistance requests from print shops.')
          ),
          h('div', { className: 'flex items-center gap-2' },
            h('div', { className: 'flex rounded-xl bg-slate-100 p-1 text-xs font-semibold' },
              ['all', 'open', 'in_progress', 'resolved'].map(f =>
                h('button', {
                  key: f,
                  onClick: () => setTicketFilter(f),
                  className: 'px-3 py-1 rounded-lg capitalize ' + (ticketFilter === f ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900')
                }, f.replace('_', ' '))
              )
            ),
            h('button', {
              onClick: () => setModalNewTicket(true),
              className: 'px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs'
            },
            h(Icon, { name: 'plus', className: 'w-3.5 h-3.5' }),
            'New Ticket'
            )
          )
        ),
        h('div', { className: 'divide-y divide-slate-100' },
          !filteredTickets.length
            ? h('div', { className: 'p-12 text-center text-slate-400 text-xs' }, 'No support tickets found.')
            : pagedTickets.map(t => h('div', { key: t.id, className: 'p-4 sm:p-5 hover:bg-slate-50 transition space-y-2' },
                h('div', { className: 'flex items-center justify-between gap-3 flex-wrap' },
                  h('div', { className: 'flex items-center gap-2.5' },
                    h('span', { className: 'px-2 py-0.5 rounded text-[10px] font-black uppercase ' + (t.priority === 'urgent' ? 'bg-rose-100 text-rose-800' : t.priority === 'high' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700') }, t.priority || 'medium'),
                    h('h4', { className: 'font-black text-sm text-slate-900' }, t.subject)
                  ),
                  h('div', { className: 'flex items-center gap-2' },
                    h('span', { className: 'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ' + (t.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : t.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800') }, t.status || 'open'),
                    t.status !== 'resolved' && h('button', {
                      onClick: async () => {
                        await fetchApi('/api/developer/support/tickets/' + t.id, {
                          method: 'PATCH',
                          body: JSON.stringify({ status: 'resolved' })
                        });
                        addToast('Ticket marked as resolved!', 'success');
                        reload();
                      },
                      className: 'px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black hover:bg-emerald-700 cursor-pointer'
                    }, 'Mark Resolved'),
                    h('button', {
                      onClick: () => openReply(t),
                      className: 'px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-[10px] font-black hover:bg-slate-50 cursor-pointer'
                    }, 'Reply')
                  )
                ),
                h('p', { className: 'text-xs text-slate-600 leading-relaxed' }, t.message),
                h('div', { className: 'text-[11px] text-slate-400 font-semibold flex items-center gap-3 pt-1' },
                  h('span', null, 'From: ' + t.client_name + ' (' + (t.company_name || 'Print Ghar') + ')'),
                  h('span', null, '•'),
                  h('span', { className: 'font-mono' }, t.client_email),
                  h('span', null, '•'),
                  h('span', null, new Date(t.created_at).toLocaleDateString())
                )
              ))
        ),
        h(Pagination, {
          total: totalTickets,
          page: ticketPage,
          pageSize: ticketPageSize,
          onPageChange: setTicketPage,
          onPageSizeChange: setTicketPageSize
        })
      ),

      // Broadcast System Notification Card
      h('div', { className: 'bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4' },
        h('div', { className: 'flex items-center justify-between' },
          h('div', null,
            h('h3', { className: 'text-base font-black text-slate-900 flex items-center gap-2' },
              h(Icon, { name: 'send', className: 'w-4 h-4 text-indigo-600' }),
              'Broadcast System Notification'
            ),
            h('p', { className: 'text-xs text-slate-500 mt-0.5' }, 'Dispatch instant maintenance or emergency alerts directly to the top bell icon of client apps in real time.')
          ),
          h('span', { className: 'px-3 py-1 rounded-full text-[11px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1.5' },
            h('span', { className: 'w-2 h-2 rounded-full bg-indigo-600 animate-pulse' }),
            'Live In-App Push'
          )
        ),
        h('form', { onSubmit: handleBroadcast, className: 'space-y-4 pt-1' },
          h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
            h('div', { className: 'space-y-1' },
              h('label', { className: 'text-xs font-bold text-slate-700' }, 'Notification Title *'),
              h('input', { name: 'broadcastTitle', required: true, placeholder: 'e.g. Scheduled platform upgrade tonight', className: 'w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl' })
            ),
            h('div', { className: 'space-y-1' },
              h('label', { className: 'text-xs font-bold text-slate-700' }, 'Target User Roles'),
              h('select', { name: 'broadcastRole', className: 'w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-white' },
                h('option', { value: 'all' }, 'All Users & Staff (Everyone)'),
                h('option', { value: 'owner' }, 'Shop Owners & Admins Only'),
                h('option', { value: 'designer' }, 'Designers Only'),
                h('option', { value: 'printer_finishing' }, 'Production Staff Only')
              )
            )
          ),
          h('div', { className: 'space-y-1' },
            h('label', { className: 'text-xs font-bold text-slate-700' }, 'Message Body *'),
            h('textarea', { name: 'broadcastMsg', required: true, rows: 3, placeholder: 'Details of the notification (e.g. Please save ongoing work, database maintenance at 11:00 PM)...', className: 'w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl' })
          ),
          h('div', { className: 'flex justify-end pt-1' },
            h('button', { type: 'submit', className: 'px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs cursor-pointer shadow-xs flex items-center gap-2 transition-all' },
              h(Icon, { name: 'send', className: 'w-3.5 h-3.5' }),
              'Dispatch Live Notification'
            )
          )
        )
      )
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 6. CLIENTS VIEW (Existing SaaS Clients Manager)
  // ─────────────────────────────────────────────────────────────
  function ClientsView({
    clients,
    clientsLoading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    reload,
    openAdd,
    openEdit,
    openDetails,
    openSubscription,
    setConfirmAction,
    fetchApi,
    addToast,
  }) {
    const handleToggleStatus = (client) => {
      const isCurrentlyActive = client.status === 'active';
      const actionVerb = isCurrentlyActive ? 'deactivate' : 'activate';
      setConfirmAction({
        title: (isCurrentlyActive ? 'Deactivate' : 'Activate') + ' Client: ' + client.name,
        message: 'Are you sure you want to ' + actionVerb + ' ' + client.name + '? ' +
          (isCurrentlyActive ? 'They will no longer be able to log in to their store.' : 'They will regain immediate access to their store.'),
        confirmText: isCurrentlyActive ? 'Deactivate Client' : 'Activate Client',
        isDanger: isCurrentlyActive,
        onConfirm: async () => {
          try {
            const res = await fetchApi('/api/developer/clients/' + client.id + '/status', {
              method: 'PATCH',
              body: JSON.stringify({ status: isCurrentlyActive ? 'deactivated' : 'active' }),
            });
            if (res.ok) {
              addToast('Client ' + client.name + ' has been ' + (isCurrentlyActive ? 'deactivated' : 'activated') + '.', 'success');
              reload();
            }
          } catch (err) {
            addToast(err.message, 'error');
          }
        },
      });
    };

    const handleUnlockJobNumbering = (client) => {
      setConfirmAction({
        title: 'Unlock Job Numbering: ' + client.name,
        message: client.name + ' will be able to change the job prefix and job starting number one more time. It locks again automatically after they save.',
        confirmText: 'Unlock Job Numbering',
        isDanger: false,
        onConfirm: async () => {
          try {
            const res = await fetchApi('/api/developer/clients/' + client.id + '/unlock-job-numbering', { method: 'POST' });
            if (res.ok) {
              addToast(res.message || 'Job numbering unlocked.', 'success');
              reload();
            }
          } catch (err) {
            addToast(err.message, 'error');
          }
        },
      });
    };

    const handleUnlockInvoiceNumbering = (client) => {
      setConfirmAction({
        title: 'Unlock Invoice Numbering: ' + client.name,
        message: client.name + ' will be able to change the invoice starting number one more time. It locks again automatically after they save.',
        confirmText: 'Unlock Invoice Numbering',
        isDanger: false,
        onConfirm: async () => {
          try {
            const res = await fetchApi('/api/developer/clients/' + client.id + '/unlock-invoice-numbering', { method: 'POST' });
            if (res.ok) {
              addToast(res.message || 'Invoice numbering unlocked.', 'success');
              reload();
            }
          } catch (err) {
            addToast(err.message, 'error');
          }
        },
      });
    };

    const handleDeleteClient = (client) => {
      setConfirmAction({
        title: 'Delete Client Account: ' + client.name,
        message: 'This will permanently delete the client account record. Are you sure you want to proceed?',
        confirmText: 'Delete Permanently',
        isDanger: true,
        onConfirm: async () => {
          try {
            const res = await fetchApi('/api/developer/clients/' + client.id, { method: 'DELETE' });
            if (res.ok) {
              addToast('Client ' + client.name + ' deleted.', 'success');
              reload();
            }
          } catch (err) {
            addToast(err.message, 'error');
          }
        },
      });
    };

    // Live online / offline presence (owner or staff active within the server's window), refreshed every 30s.
    const [presence, setPresence] = useState(null);
    useEffect(() => {
      let cancelled = false;
      const loadPresence = () => fetchApi('/api/developer/clients/presence')
        .then((data) => { if (!cancelled && data?.ok) setPresence(data); })
        .catch(() => {});
      loadPresence();
      const timer = setInterval(loadPresence, 30000);
      return () => { cancelled = true; clearInterval(timer); };
    }, [fetchApi]);

    const presenceFor = (c) => presence?.clients?.[c.id] || null;
    const formatLastSeen = (iso) => {
      if (!iso) return 'Not seen since server start';
      const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
      if (mins < 1) return 'Active just now';
      if (mins < 60) return 'Last seen ' + mins + ' min ago';
      const hrs = Math.floor(mins / 60);
      return 'Last seen ' + hrs + ' hr' + (hrs === 1 ? '' : 's') + ' ago';
    };

    const filteredClients = useMemo(() => {
      const q = (search || '').trim().toLowerCase();
      return (clients || []).filter((c) => {
        // 1. Search term filter
        if (q) {
          const name = String(c.name || '').toLowerCase();
          const email = String(c.email || '').toLowerCase();
          const phone = String(c.phone || '').toLowerCase();
          const biz = String(c.business_id || '').toLowerCase();
          const comp = String(c.company_name || '').toLowerCase();
          if (!name.includes(q) && !email.includes(q) && !phone.includes(q) && !biz.includes(q) && !comp.includes(q)) {
            return false;
          }
        }

        // 2. Status dropdown filter
        if (statusFilter === 'online' || statusFilter === 'offline') {
          const isOn = Boolean(presence?.clients?.[c.id]?.isOnline);
          if (statusFilter === 'online' ? !isOn : isOn) return false;
        } else if (statusFilter && statusFilter !== 'all') {
          const isExp = Boolean(c.is_expired || c.status === 'expired' || c.subscription_status === 'expired');
          const isDeact = Boolean(c.status === 'deactivated' || c.status === 'suspended' || c.subscription_status === 'suspended');
          const isGrace = Boolean(c.is_grace_period || c.subscription_status === 'grace_period');
          const isActive = !isExp && !isDeact && !isGrace;

          if (statusFilter === 'active' && !isActive) return false;
          if (statusFilter === 'expired' && !isExp) return false;
          if (statusFilter === 'deactivated' && !isDeact) return false;
          if (statusFilter === 'grace_period' && !isGrace) return false;
        }

        return true;
      });
    }, [clients, search, statusFilter, presence]);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    useEffect(() => {
      setPage(1);
    }, [search, statusFilter, pageSize]);

    const totalClients = filteredClients.length;
    const pagedClients = useMemo(() => {
      const start = (page - 1) * pageSize;
      return filteredClients.slice(start, start + pageSize);
    }, [filteredClients, page, pageSize]);

    return h('div', { className: 'space-y-4' },
      h('div', { className: 'bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3' },
        h('div', { className: 'flex items-center gap-3 flex-1 max-w-md' },
          h('div', { className: 'relative flex-1' },
            h(Icon, { name: 'search', className: 'w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2' }),
            h('input', {
              type: 'text',
              value: search,
              onChange: (e) => setSearch(e.target.value),
              placeholder: 'Search clients by name, email, phone...',
              className: 'w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500',
            })
          ),
          h('select', {
            value: statusFilter,
            onChange: (e) => setStatusFilter(e.target.value),
            className: 'px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700',
          },
          h('option', { value: 'all' }, 'All Statuses'),
          h('option', { value: 'active' }, 'Active'),
          h('option', { value: 'expired' }, 'Expired'),
          h('option', { value: 'grace_period' }, 'Grace Period'),
          h('option', { value: 'deactivated' }, 'Deactivated / Suspended'),
          h('option', { value: 'online' }, 'Online Now'),
          h('option', { value: 'offline' }, 'Offline')
          )
        ),
        h('button', {
          onClick: openAdd,
          className: 'px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer',
        },
        h(Icon, { name: 'plus', className: 'w-4 h-4' }),
        'Add New Client'
        )
      ),

      // Online / Offline summary
      h('div', { className: 'grid grid-cols-1 sm:grid-cols-3 gap-3' },
        h('button', {
          type: 'button',
          onClick: () => setStatusFilter(statusFilter === 'online' ? 'all' : 'online'),
          className: 'bg-white rounded-3xl p-5 border shadow-xs text-left cursor-pointer transition ' + (statusFilter === 'online' ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200/80 hover:border-emerald-300'),
        },
          h('div', { className: 'flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400' },
            h('span', { className: 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse' }), 'Online Now'),
          h('div', { className: 'mt-1 text-2xl font-black text-emerald-700' }, presence ? presence.online : '—')
        ),
        h('button', {
          type: 'button',
          onClick: () => setStatusFilter(statusFilter === 'offline' ? 'all' : 'offline'),
          className: 'bg-white rounded-3xl p-5 border shadow-xs text-left cursor-pointer transition ' + (statusFilter === 'offline' ? 'border-slate-400 ring-2 ring-slate-100' : 'border-slate-200/80 hover:border-slate-300'),
        },
          h('div', { className: 'flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400' },
            h('span', { className: 'w-2 h-2 rounded-full bg-slate-300' }), 'Offline'),
          h('div', { className: 'mt-1 text-2xl font-black text-slate-700' }, presence ? presence.offline : '—')
        ),
        h('div', { className: 'bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs' },
          h('div', { className: 'text-[10px] uppercase font-bold text-slate-400' }, 'Total Clients'),
          h('div', { className: 'mt-1 text-2xl font-black text-slate-900' }, presence ? presence.total : '—'),
          h('div', { className: 'mt-1 text-[11px] text-slate-400' },
            'Online = owner or staff active in the last ' + (presence?.onlineWindowMinutes || 5) + ' min · refreshes every 30s')
        )
      ),

      h('div', { className: 'bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden' },
        clientsLoading
          ? h('div', { className: 'p-12 text-center text-slate-400 text-xs' }, 'Loading clients...')
          : !filteredClients.length
          ? h('div', { className: 'p-12 text-center text-slate-400 text-xs' }, (search || statusFilter !== 'all') ? 'No clients match your search criteria.' : 'No client accounts found.')
          : h('div', { className: 'overflow-x-auto' },
              h('table', { className: 'w-full text-left text-xs' },
                h('thead', { className: 'bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100' },
                  h('tr', null,
                    h('th', { className: 'px-4 py-3' }, 'Client / Contact'),
                    h('th', { className: 'px-4 py-3' }, 'Status'),
                    h('th', { className: 'px-4 py-3' }, 'Online'),
                    h('th', { className: 'px-4 py-3' }, 'Plan & License Expiry'),
                    h('th', { className: 'px-4 py-3' }, 'Tenant ID'),
                    h('th', { className: 'px-4 py-3' }, 'Numbering'),
                    h('th', { className: 'px-4 py-3' }, 'Joined Date'),
                    h('th', { className: 'px-4 py-3 text-right' }, 'Actions')
                  )
                ),
                h('tbody', { className: 'divide-y divide-slate-100' },
                  pagedClients.map(c => h('tr', { key: c.id, className: 'hover:bg-slate-50' },
                    h('td', { className: 'px-4 py-3' },
                      h('div', { className: 'font-black text-slate-900' }, c.name),
                      h('div', { className: 'text-[11px] text-slate-500 font-mono' }, c.email),
                      c.phone && h('div', { className: 'text-[11px] text-slate-400' }, c.phone)
                    ),
                    h('td', { className: 'px-4 py-3' },
                      (c.is_expired || c.status === 'expired' || c.subscription_status === 'expired') ?
                        h('span', { className: 'px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-100 text-rose-800' }, 'EXPIRED') :
                      (c.status === 'deactivated' || c.status === 'suspended' || c.subscription_status === 'suspended') ?
                        h('span', { className: 'px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-100 text-rose-800' }, c.status || 'SUSPENDED') :
                      (c.is_grace_period || c.subscription_status === 'grace_period') ?
                        h('span', { className: 'px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800' }, 'GRACE PERIOD') :
                        h('span', { className: 'px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800' }, 'ACTIVE')
                    ),
                    h('td', { className: 'px-4 py-3' },
                      presenceFor(c)?.isOnline
                        ? h('span', { className: 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800' },
                            h('span', { className: 'w-1.5 h-1.5 rounded-full bg-emerald-500' }), 'Online')
                        : h('span', { className: 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-500' },
                            h('span', { className: 'w-1.5 h-1.5 rounded-full bg-slate-400' }), 'Offline'),
                      presence && h('div', { className: 'mt-1 text-[10px] text-slate-400' }, formatLastSeen(presenceFor(c)?.lastSeenAt))
                    ),
                    h('td', { className: 'px-4 py-3' },
                      h('div', { className: 'flex items-center gap-1.5' },
                        h('span', { className: 'px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-700 uppercase' }, c.subscription_plan || 'Standard'),
                        h('span', { className: 'text-[10px] font-semibold text-slate-500' }, c.plan_duration || 'monthly')
                      ),
                      h('div', { className: 'mt-1' },
                        c.is_expired ? h('span', { className: 'px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800' }, `Expired (${c.days_remaining !== null ? Math.abs(c.days_remaining) + 'd ago' : 'Locked'})`) :
                        c.is_grace_period ? h('span', { className: 'px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800' }, `Grace (${c.days_remaining}d left)`) :
                        h('span', { className: 'px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800' }, c.days_remaining !== null ? `${c.days_remaining}d left` : 'Lifetime')
                      )
                    ),
                    h('td', { className: 'px-4 py-3 font-mono text-[11px] text-slate-500' },
                      h('div', null, c.business_id || 'global_settings')
                    ),
                    // Where this shop's numbers start, the next numbers, and each one-time lock.
                    h('td', { className: 'px-4 py-3 text-[11px] text-slate-600 whitespace-nowrap' },
                      !c.numbering
                        ? h('span', { className: 'text-[10px] text-slate-400' }, 'No shop set up yet')
                        : h('div', { className: 'space-y-1.5' },
                            h('div', null,
                              h('div', { className: 'flex items-center gap-1.5' },
                                h('span', { className: 'font-bold text-slate-700' }, 'Job:'),
                                h('span', { className: 'font-mono' }, 'prefix ' + c.numbering.jobPrefix + ' · starts ' + c.numbering.jobStartNumber),
                                c.job_numbering_locked && h('button', {
                                  onClick: () => handleUnlockJobNumbering(c),
                                  title: 'Unlock job prefix and starting number',
                                  'aria-label': 'Unlock job prefix and starting number for ' + c.name,
                                  className: 'ml-1 px-1.5 py-0.5 rounded border border-amber-200 text-[10px] font-bold text-amber-700 hover:bg-amber-50 cursor-pointer'
                                }, 'Unlock')
                              ),
                              h('div', { className: 'text-[10px] ' + (c.job_numbering_locked ? 'text-slate-400' : 'text-emerald-700') },
                                (c.job_numbering_locked ? 'Locked' : 'Can be set') + ' · next ' + c.numbering.nextJobNumber)
                            ),
                            h('div', null,
                              h('div', { className: 'flex items-center gap-1.5' },
                                h('span', { className: 'font-bold text-slate-700' }, 'Invoice:'),
                                h('span', { className: 'font-mono' }, 'starts ' + c.numbering.invoiceStartNumber),
                                c.invoice_numbering_locked && h('button', {
                                  onClick: () => handleUnlockInvoiceNumbering(c),
                                  title: 'Unlock invoice starting number',
                                  'aria-label': 'Unlock invoice starting number for ' + c.name,
                                  className: 'ml-1 px-1.5 py-0.5 rounded border border-amber-200 text-[10px] font-bold text-amber-700 hover:bg-amber-50 cursor-pointer'
                                }, 'Unlock')
                              ),
                              h('div', { className: 'text-[10px] ' + (c.invoice_numbering_locked ? 'text-slate-400' : 'text-emerald-700') },
                                (c.invoice_numbering_locked ? 'Locked' : 'Can be set') + ' · next ' + c.numbering.nextInvoiceNumber)
                            )
                          )
                    ),
                    h('td', { className: 'px-4 py-3 text-slate-500 text-[11px]' }, new Date(c.created_at).toLocaleDateString()),
                    h('td', { className: 'px-4 py-3 text-right' },
                      h('div', { className: 'flex items-center justify-end gap-1.5' },
                        h('button', {
                          onClick: () => openSubscription(c),
                          title: 'Manage License & Subscription',
                          className: 'p-1.5 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 cursor-pointer'
                        }, h(Icon, { name: 'calendar', className: 'w-4 h-4' })),
                        h('button', {
                          onClick: () => openDetails(c),
                          title: 'View Details',
                          className: 'p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 cursor-pointer'
                        }, h(Icon, { name: 'eye', className: 'w-4 h-4' })),
                        h('button', {
                          onClick: () => openEdit(c),
                          title: 'Edit Client',
                          className: 'p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 cursor-pointer'
                        }, h(Icon, { name: 'edit', className: 'w-4 h-4' })),
                        h('button', {
                          onClick: () => handleToggleStatus(c),
                          title: c.status === 'active' ? 'Deactivate' : 'Activate',
                          className: 'p-1.5 rounded-lg ' + (c.status === 'active' ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50') + ' cursor-pointer'
                        }, h(Icon, { name: c.status === 'active' ? 'userX' : 'userCheck', className: 'w-4 h-4' })),
                        h('button', {
                          onClick: () => handleDeleteClient(c),
                          title: 'Delete Client',
                          className: 'p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                        }, h(Icon, { name: 'trash', className: 'w-4 h-4' }))
                      )
                    )
                  ))
                )
              )
          ),
        h(Pagination, {
          total: totalClients,
          page,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: setPageSize
        })
      )
    );
  }

  // ─────────────────────────────────────────────────────────────
  // MODALS IMPLEMENTATION
  // ─────────────────────────────────────────────────────────────

  // Restore DB Modal
  function RestoreDbModal({ isOpen, onClose, fetchApi, addToast, onRestored }) {
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      const file = e.target.backupFile.files[0];
      if (!file) { alert('Choose a .json backup file'); return; }
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          setLoading(true);
          const res = await fetchApi('/api/developer/database/restore', {
            method: 'POST',
            body: JSON.stringify(parsed)
          });
          addToast(res.message || 'Database restored successfully!', 'success');
          onRestored();
        } catch (err) {
          alert('Restore error: ' + err.message);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file);
    };

    return h(Modal, { title: 'Restore Database from JSON Backup', isOpen, onClose },
      h('div', { className: 'space-y-4' },
        h('div', { className: 'p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold leading-relaxed' },
          'Warning: Restoring will merge or update the database tables with records from the uploaded backup file. Ensure you have downloaded a current backup first.'
        ),
        h('form', { onSubmit: handleSubmit, className: 'space-y-4' },
          h('input', {
            type: 'file',
            name: 'backupFile',
            accept: '.json',
            className: 'w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer'
          }),
          h('div', { className: 'flex justify-end gap-2 pt-2' },
            h('button', { type: 'button', onClick: onClose, className: 'px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer' }, 'Cancel'),
            h('button', { type: 'submit', disabled: loading, className: 'px-5 py-2 text-xs font-black bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 cursor-pointer disabled:opacity-50' },
              loading ? 'Restoring...' : 'Execute Restore'
            )
          )
        )
      )
    );
  }

  // Create Ticket Modal
  function CreateTicketModal({ isOpen, onClose, fetchApi, addToast, onCreated }) {
    const handleSubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await fetchApi('/api/developer/support/tickets', {
          method: 'POST',
          body: JSON.stringify({
            subject: f.ticketSubject.value.trim(),
            message: f.ticketMessage.value.trim(),
            priority: f.ticketPriority.value,
            client_name: f.ticketClient.value.trim(),
            client_email: f.ticketEmail.value.trim()
          })
        });
        addToast('Support ticket created successfully!', 'success');
        onCreated();
      } catch (err) {
        addToast('Error creating ticket: ' + err.message, 'error');
      }
    };

    return h(Modal, { title: 'Create Support Ticket', isOpen, onClose },
      h('form', { onSubmit: handleSubmit, className: 'space-y-3' },
        h('div', { className: 'space-y-1' },
          h('label', { className: 'text-xs font-bold text-slate-700' }, 'Subject *'),
          h('input', { name: 'ticketSubject', required: true, className: 'w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl' })
        ),
        h('div', { className: 'grid grid-cols-2 gap-3' },
          h('div', { className: 'space-y-1' },
            h('label', { className: 'text-xs font-bold text-slate-700' }, 'Client Name'),
            h('input', { name: 'ticketClient', defaultValue: 'Print Ghar Client', className: 'w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl' })
          ),
          h('div', { className: 'space-y-1' },
            h('label', { className: 'text-xs font-bold text-slate-700' }, 'Priority'),
            h('select', { name: 'ticketPriority', className: 'w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white' },
              h('option', { value: 'medium' }, 'Medium'),
              h('option', { value: 'high' }, 'High'),
              h('option', { value: 'urgent' }, 'Urgent'),
              h('option', { value: 'low' }, 'Low')
            )
          )
        ),
        h('div', { className: 'space-y-1' },
          h('label', { className: 'text-xs font-bold text-slate-700' }, 'Client Email'),
          h('input', { name: 'ticketEmail', defaultValue: 'support@printghar.com', className: 'w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl' })
        ),
        h('div', { className: 'space-y-1' },
          h('label', { className: 'text-xs font-bold text-slate-700' }, 'Message Details *'),
          h('textarea', { name: 'ticketMessage', required: true, rows: 3, className: 'w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl' })
        ),
        h('div', { className: 'flex justify-end gap-2 pt-2' },
          h('button', { type: 'button', onClick: onClose, className: 'px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl' }, 'Cancel'),
          h('button', { type: 'submit', className: 'px-5 py-2 text-xs font-black bg-indigo-600 text-white rounded-xl hover:bg-indigo-700' }, 'Submit Ticket')
        )
      )
    );
  }


  // Add Client Modal
  function AddClientModal({ isOpen, onClose, onCreated, fetchApi, addToast }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [plan, setPlan] = useState('Standard');
    const [duration, setDuration] = useState('monthly');
    const [expiresAt, setExpiresAt] = useState(() => {
      const d = new Date(Date.now() + 30 * 86400000);
      return d.toISOString().slice(0, 10);
    });
    const [submitting, setSubmitting] = useState(false);

    const handleDurationChange = (val) => {
      setDuration(val);
      if (val === 'trial') {
        const d = new Date(Date.now() + 14 * 86400000);
        setExpiresAt(d.toISOString().slice(0, 10));
      } else if (val === 'monthly') {
        const d = new Date(Date.now() + 30 * 86400000);
        setExpiresAt(d.toISOString().slice(0, 10));
      } else if (val === 'quarterly') {
        const d = new Date(Date.now() + 90 * 86400000);
        setExpiresAt(d.toISOString().slice(0, 10));
      } else if (val === 'yearly') {
        const d = new Date(Date.now() + 365 * 86400000);
        setExpiresAt(d.toISOString().slice(0, 10));
      } else if (val === 'lifetime') {
        setExpiresAt('');
      }
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        const res = await fetchApi('/api/developer/clients', {
          method: 'POST',
          body: JSON.stringify({
            name,
            email,
            phone,
            notes,
            plan,
            duration,
            expiresAt: duration === 'lifetime' ? null : (expiresAt || null)
          }),
        });
        if (res.ok) {
          addToast('Client ' + name + ' created successfully.', 'success');
          onCreated();
        }
      } catch (err) {
        addToast(err.message, 'error');
      } finally {
        setSubmitting(false);
      }
    };

    return h(Modal, { title: 'Add New Client Account', isOpen, onClose },
      h('form', { onSubmit: handleSubmit, className: 'space-y-4' },
        h('div', null,
          h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Client Name *'),
          h('input', {
            type: 'text',
            required: true,
            value: name,
            onChange: (e) => setName(e.target.value),
            className: 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs',
            placeholder: 'e.g. Ramesh Shrestha',
          })
        ),
        h('div', null,
          h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Email Address *'),
          h('input', {
            type: 'email',
            required: true,
            value: email,
            onChange: (e) => setEmail(e.target.value),
            className: 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs',
            placeholder: 'e.g. ramesh@example.com',
          })
        ),
        h('div', null,
          h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Phone Number'),
          h('input', {
            type: 'text',
            value: phone,
            onChange: (e) => setPhone(e.target.value),
            className: 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs',
            placeholder: 'e.g. 9800000000',
          })
        ),

        // Subscription & License Setup
        h('div', { className: 'pt-3 border-t border-slate-100 space-y-3' },
          h('div', { className: 'flex items-center justify-between' },
            h('label', { className: 'text-xs font-bold text-slate-800' }, 'Subscription & License Setup'),
            h('span', { className: 'text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100' }, 'Standard Plan')
          ),
          h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
            h('div', null,
              h('label', { className: 'block text-[11px] font-bold text-slate-600 mb-1' }, 'Billing Duration'),
              h('select', {
                value: duration,
                onChange: (e) => handleDurationChange(e.target.value),
                className: 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold'
              },
                h('option', { value: 'monthly' }, 'Monthly (30 Days)'),
                h('option', { value: 'trial' }, '14-Day Free Trial'),
                h('option', { value: 'quarterly' }, 'Quarterly (90 Days)'),
                h('option', { value: 'yearly' }, 'Yearly (365 Days)'),
                h('option', { value: 'lifetime' }, 'Lifetime / Unlimited'),
                h('option', { value: 'custom' }, 'Custom Date')
              )
            ),
            h('div', null,
              h('label', { className: 'block text-[11px] font-bold text-slate-600 mb-1' }, 'Expiration Date'),
              h('input', {
                type: 'date',
                disabled: duration === 'lifetime',
                value: expiresAt,
                onChange: (e) => {
                  setExpiresAt(e.target.value);
                  setDuration('custom');
                },
                className: 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold disabled:opacity-50 disabled:cursor-not-allowed'
              })
            )
          ),
          h('div', { className: 'text-[11px] text-slate-400 font-medium' },
            duration === 'lifetime'
              ? 'This client will have permanent lifetime access with no expiration.'
              : expiresAt
                ? `Initial license active until ${new Date(expiresAt).toLocaleDateString()}.`
                : 'Choose a billing duration or expiration date.'
          )
        ),

        h('div', null,
          h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Notes / Contract Details'),
          h('textarea', {
            rows: 2,
            value: notes,
            onChange: (e) => setNotes(e.target.value),
            className: 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs',
            placeholder: 'Notes about subscription, billing terms, etc.',
          })
        ),
        h('div', { className: 'flex justify-end gap-3 pt-2 border-t border-slate-100' },
          h('button', { type: 'button', onClick: onClose, className: 'px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50' }, 'Cancel'),
          h('button', { type: 'submit', disabled: submitting, className: 'px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20' }, submitting ? 'Creating...' : 'Create Client')
        )
      )
    );
  }

  // Edit Client Modal
  function EditClientModal({ client, onClose, onUpdated, fetchApi, addToast }) {
    const [name, setName] = useState(client.name || '');
    const [phone, setPhone] = useState(client.phone || '');
    const [notes, setNotes] = useState(client.notes || '');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        const res = await fetchApi('/api/developer/clients/' + client.id, {
          method: 'PUT',
          body: JSON.stringify({ name, phone, notes }),
        });
        if (res.ok) {
          addToast('Client updated successfully.', 'success');
          onUpdated();
        }
      } catch (err) {
        addToast(err.message, 'error');
      } finally {
        setSubmitting(false);
      }
    };

    return h(Modal, { title: 'Edit Client: ' + client.name, isOpen: true, onClose },
      h('form', { onSubmit: handleSubmit, className: 'space-y-4' },
        h('div', null,
          h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Client Name *'),
          h('input', {
            type: 'text',
            required: true,
            value: name,
            onChange: (e) => setName(e.target.value),
            className: 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs',
          })
        ),
        h('div', null,
          h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Email Address'),
          h('input', {
            type: 'email',
            disabled: true,
            value: client.email,
            className: 'w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 cursor-not-allowed',
          })
        ),
        h('div', null,
          h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Phone Number'),
          h('input', {
            type: 'text',
            value: phone,
            onChange: (e) => setPhone(e.target.value),
            className: 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs',
          })
        ),
        h('div', null,
          h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Notes'),
          h('textarea', {
            rows: 3,
            value: notes,
            onChange: (e) => setNotes(e.target.value),
            className: 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs',
          })
        ),
        h('div', { className: 'flex justify-end gap-3 pt-2 border-t border-slate-100' },
          h('button', { type: 'button', onClick: onClose, className: 'px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50' }, 'Cancel'),
          h('button', { type: 'submit', disabled: submitting, className: 'px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold' }, submitting ? 'Saving...' : 'Save Changes')
        )
      )
    );
  }

  // Client Details Modal
  function ClientDetailsModal({ clientId, onClose, fetchApi, addToast }) {
    const [clientData, setClientData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      fetchApi('/api/developer/clients/' + clientId)
        .then((res) => {
          if (res.ok) setClientData(res);
        })
        .catch((err) => addToast(err.message, 'error'))
        .finally(() => setLoading(false));
    }, [clientId, fetchApi, addToast]);

    return h(Modal, { title: 'Client Account Details', isOpen: true, onClose, maxWidth: 'max-w-2xl' },
      loading
        ? h('div', { className: 'p-12 text-center text-slate-400 text-xs' }, 'Loading client account...')
        : !clientData
        ? h('div', { className: 'p-8 text-center text-rose-500 text-xs' }, 'Client account could not be found.')
        : h('div', { className: 'space-y-6' },
            h('div', { className: 'flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100' },
              h('div', { className: 'w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-bold text-lg' },
                clientData.client.name.charAt(0).toUpperCase()
              ),
              h('div', null,
                h('h4', { className: 'text-base font-bold text-slate-900' }, clientData.client.name),
                h('div', { className: 'text-xs text-slate-500 font-mono' }, clientData.client.email),
                h('div', { className: 'text-xs text-slate-400 mt-0.5' }, 'Status: ' + clientData.client.status)
              )
            ),
            h('div', { className: 'space-y-2' },
              h('h5', { className: 'text-xs font-bold text-slate-700 uppercase tracking-wider' }, 'Recent Account Activity'),
              !clientData.auditLogs?.length
                ? h('p', { className: 'text-xs text-slate-400' }, 'No recorded activity logs for this client.')
                : h('div', { className: 'border border-slate-100 rounded-xl divide-y divide-slate-100 text-xs' },
                    clientData.auditLogs.map((log) =>
                      h('div', { key: log.id, className: 'p-3 flex items-center justify-between' },
                        h('div', null,
                          h('span', { className: 'font-semibold text-slate-800' }, log.action),
                          h('span', { className: 'text-slate-400 text-[11px] ml-2' }, new Date(log.created_at).toLocaleString())
                        ),
                        h('span', { className: 'text-[11px] font-mono text-slate-500' }, log.performed_by)
                      )
                    )
                  )
            )
          )
    );
  }

  // Support Ticket Reply Modal
  function SupportTicketReplyModal({ ticket, onClose, onUpdated, fetchApi, addToast }) {
    const [replyText, setReplyText] = useState('');
    const [markResolved, setMarkResolved] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const handleSendReply = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        const res = await fetchApi('/api/developer/support/tickets/' + ticket.id, {
          method: 'PATCH',
          body: JSON.stringify({
            developer_reply: replyText,
            status: markResolved ? 'resolved' : 'in_progress',
          }),
        });
        if (res.ok) {
          addToast(markResolved ? 'Reply sent & ticket marked as Resolved!' : 'Reply sent to client.', 'success');
          onUpdated();
        }
      } catch (err) {
        addToast(err.message, 'error');
      } finally {
        setSubmitting(false);
      }
    };

    return h(Modal, { title: 'Reply to Ticket: ' + ticket.subject, isOpen: true, onClose },
      h('div', { className: 'space-y-4' },
        h('div', { className: 'bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-1' },
          h('div', { className: 'font-bold text-slate-700' }, 'Client: ' + ticket.client_name + ' (' + ticket.client_email + ')'),
          h('p', { className: 'text-slate-600 mt-1 leading-relaxed' }, ticket.message)
        ),
        h('form', { onSubmit: handleSendReply, className: 'space-y-3' },
          h('div', null,
            h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Developer Response'),
            h('textarea', {
              required: true,
              rows: 4,
              value: replyText,
              onChange: (e) => setReplyText(e.target.value),
              placeholder: 'Write resolution details or questions for the client...',
              className: 'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs',
            })
          ),
          h('div', { className: 'pt-1' },
            h('label', { className: 'flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer' },
              h('input', {
                type: 'checkbox',
                checked: markResolved,
                onChange: (e) => setMarkResolved(e.target.checked),
                className: 'rounded text-emerald-600'
              }),
              'Mark as Resolved & send in-app notification to client'
            )
          ),
          h('div', { className: 'flex justify-end gap-2 pt-2' },
            h('button', { type: 'button', onClick: onClose, className: 'px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50' }, 'Cancel'),
            h('button', { type: 'submit', disabled: submitting, className: 'px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold' }, submitting ? 'Sending...' : 'Send Reply')
          )
        )
      )
    );
  }

  // Subscription & License Expiry Modal (Point 3)
  function SubscriptionModal({ client, onClose, onUpdated, fetchApi, addToast }) {
    const [plan, setPlan] = useState(client.subscription_plan || 'Standard');
    const [duration, setDuration] = useState(client.plan_duration || 'monthly');
    const [status, setStatus] = useState(client.is_expired ? 'expired' : (client.subscription_status || 'active'));
    const initialExpiry = client.subscription_expires_at ? new Date(client.subscription_expires_at).toISOString().slice(0, 10) : '';
    const [expiresAt, setExpiresAt] = useState(initialExpiry);
    const [submitting, setSubmitting] = useState(false);

    const handleStatusChange = (newStatus) => {
      setStatus(newStatus);
      if (newStatus === 'expired') {
        const yest = new Date(Date.now() - 86400000);
        setExpiresAt(yest.toISOString().slice(0, 10));
      } else if (newStatus === 'active') {
        if (!expiresAt || new Date(expiresAt).getTime() < Date.now()) {
          const future = new Date(Date.now() + 30 * 86400000);
          setExpiresAt(future.toISOString().slice(0, 10));
        }
      } else if (newStatus === 'grace_period') {
        const grace = new Date(Date.now() + 5 * 86400000);
        setExpiresAt(grace.toISOString().slice(0, 10));
      }
    };

    const handleExpiryChange = (newDateStr) => {
      setExpiresAt(newDateStr);
      if (newDateStr) {
        const d = new Date(newDateStr);
        if (d.getTime() < Date.now()) {
          setStatus('expired');
        } else {
          const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (days <= 7) {
            setStatus('grace_period');
          } else if (status === 'expired') {
            setStatus('active');
          }
        }
      }
    };

    const handleDurationChange = (newDur) => {
      setDuration(newDur);
      if (newDur === 'monthly') {
        const d = new Date(Date.now() + 30 * 86400000);
        setExpiresAt(d.toISOString().slice(0, 10));
        setStatus('active');
      } else if (newDur === 'quarterly') {
        const d = new Date(Date.now() + 90 * 86400000);
        setExpiresAt(d.toISOString().slice(0, 10));
        setStatus('active');
      } else if (newDur === 'yearly') {
        const d = new Date(Date.now() + 365 * 86400000);
        setExpiresAt(d.toISOString().slice(0, 10));
        setStatus('active');
      } else if (newDur === 'lifetime') {
        setExpiresAt('');
        setStatus('active');
      }
    };

    const handleQuickExtend = (days) => {
      const baseDate = expiresAt && new Date(expiresAt) > new Date()
        ? new Date(expiresAt)
        : new Date();
      baseDate.setDate(baseDate.getDate() + days);
      setExpiresAt(baseDate.toISOString().slice(0, 10));
      setStatus('active');
    };

    const handleSave = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        const res = await fetchApi('/api/developer/clients/' + client.id + '/subscription', {
          method: 'PATCH',
          body: JSON.stringify({
            plan,
            duration,
            status,
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          })
        });
        if (res.ok) {
          addToast('Subscription updated for ' + client.name, 'success');
          onUpdated();
        } else {
          addToast(res.error || 'Failed to update subscription', 'error');
        }
      } catch (err) {
        addToast(err.message, 'error');
      } finally {
        setSubmitting(false);
      }
    };

    const nowTime = Date.now();
    const expiryTime = expiresAt ? new Date(expiresAt).getTime() : null;
    const liveDaysLeft = expiryTime ? Math.ceil((expiryTime - nowTime) / (1000 * 60 * 60 * 24)) : null;
    const isLiveExpired = status === 'expired' || (expiryTime !== null && expiryTime < nowTime);
    const isLiveGrace = !isLiveExpired && (status === 'grace_period' || (liveDaysLeft !== null && liveDaysLeft <= 7 && liveDaysLeft > 0));
    const liveDisplayStatus = isLiveExpired ? 'EXPIRED' : (isLiveGrace ? 'GRACE PERIOD' : (status === 'suspended' ? 'SUSPENDED' : 'ACTIVE'));

    return h(Modal, { title: 'Manage Subscription & License: ' + client.name, isOpen: true, onClose },
      h('form', { onSubmit: handleSave, className: 'space-y-5' },
        // Current status banner
        h('div', { className: 'p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs' },
          h('div', null,
            h('div', { className: 'font-black text-slate-900' }, client.name),
            h('div', { className: 'text-[11px] text-slate-500 font-mono' }, client.business_id || client.email)
          ),
          h('div', { className: 'text-right' },
            h('span', { className: 'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ' + (
              isLiveExpired ? 'bg-rose-100 text-rose-800' :
              isLiveGrace ? 'bg-amber-100 text-amber-800' :
              status === 'suspended' ? 'bg-rose-100 text-rose-800' :
              'bg-emerald-100 text-emerald-800'
            ) }, liveDisplayStatus),
            h('div', { className: 'text-[10px] text-slate-400 mt-1 font-semibold' },
              isLiveExpired ? 'Read-Only Locked' :
              liveDaysLeft !== null ? (liveDaysLeft >= 0 ? liveDaysLeft + ' days left' : 'Expired') : 'Lifetime'
            )
          )
        ),

        // Quick Extend shortcuts
        h('div', { className: 'space-y-1.5' },
          h('label', { className: 'block text-xs font-bold text-slate-700' }, 'Quick Extend Shortcuts'),
          h('div', { className: 'grid grid-cols-2 sm:grid-cols-4 gap-2' },
            [
              { label: '+30 Days', days: 30 },
              { label: '+90 Days', days: 90 },
              { label: '+1 Year', days: 365 },
              { label: 'Lifetime (10y)', days: 3650 },
            ].map(item => h('button', {
              key: item.label,
              type: 'button',
              onClick: () => handleQuickExtend(item.days),
              className: 'px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 cursor-pointer'
            }, item.label))
          )
        ),

        // Form Fields
        h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
          h('div', null,
            h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Subscription Plan'),
            h('div', { className: 'relative' },
              h('select', {
                value: 'Standard',
                disabled: true,
                className: 'w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-not-allowed appearance-none'
              },
                h('option', { value: 'Standard' }, 'Standard Plan (All Features Included)')
              ),
              h('span', { className: 'absolute right-2.5 top-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700' }, 'Single Plan')
            )
          ),
          h('div', null,
            h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Billing Duration'),
            h('select', {
              value: duration,
              onChange: (e) => handleDurationChange(e.target.value),
              className: 'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold'
            },
              h('option', { value: 'monthly' }, 'Monthly (30 Days)'),
              h('option', { value: 'quarterly' }, 'Quarterly (90 Days)'),
              h('option', { value: 'yearly' }, 'Yearly (365 Days)'),
              h('option', { value: 'lifetime' }, 'Lifetime / Unlimited')
            )
          ),
          h('div', null,
            h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'License Status'),
            h('select', {
              value: status,
              onChange: (e) => handleStatusChange(e.target.value),
              className: 'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold'
            },
              h('option', { value: 'active' }, 'Active (Full Access)'),
              h('option', { value: 'grace_period' }, 'Grace Period (Expiring Soon)'),
              h('option', { value: 'expired' }, 'Expired (Read-Only Order Lock)'),
              h('option', { value: 'suspended' }, 'Suspended (Access Blocked)')
            )
          ),
          h('div', null,
            h('label', { className: 'block text-xs font-bold text-slate-700 mb-1' }, 'Expiration Date'),
            h('input', {
              type: 'date',
              value: expiresAt,
              onChange: (e) => handleExpiryChange(e.target.value),
              className: 'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold'
            })
          )
        ),

        // Read-only Lock Notice
        (status === 'expired' || isLiveExpired) && h('div', { className: 'p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold' },
          'Setting status to Expired will activate Read-Only Order Lock. The client will be unable to record new orders until extended.'
        ),

        // Actions
        h('div', { className: 'flex justify-end gap-2 pt-2' },
          h('button', { type: 'button', onClick: onClose, className: 'px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer' }, 'Cancel'),
          h('button', { type: 'submit', disabled: submitting, className: 'px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black cursor-pointer' },
            submitting ? 'Saving...' : 'Update License'
          )
        )
      )
    );
  }

  // Real-Time Error Trace Detail Modal (Point 7)
  function ErrorDetailModal({ error, onClose, onResolved, fetchApi, addToast }) {
    const [resolving, setResolving] = useState(false);

    const handleCopyStack = () => {
      const text = `${error.message}\n\nStack:\n${error.stack || 'No stack trace available'}`;
      navigator.clipboard.writeText(text);
      addToast('Stack trace copied to clipboard!', 'info');
    };

    const handleResolve = async () => {
      setResolving(true);
      try {
        await fetchApi('/api/developer/errors/' + error.id + '/resolve', { method: 'PATCH' });
        addToast('Error marked as resolved!', 'success');
        onResolved();
      } catch (err) {
        addToast(err.message, 'error');
      } finally {
        setResolving(false);
      }
    };

    return h(Modal, { title: `Error Incident #${error.id}`, isOpen: true, onClose, maxWidth: 'max-w-2xl' },
      h('div', { className: 'space-y-4' },
        // Top status card
        h('div', { className: 'flex items-center justify-between p-3.5 rounded-2xl bg-rose-50 border border-rose-200' },
          h('div', { className: 'flex items-center gap-2' },
            h('span', { className: 'px-2 py-0.5 rounded text-xs font-black bg-rose-600 text-white font-mono' }, error.status_code || 500),
            h('span', { className: 'font-mono text-xs font-black text-rose-900' }, (error.method || 'GET') + ' ' + (error.path || '/'))
          ),
          h('span', { className: 'px-2.5 py-0.5 rounded-full text-[10px] font-black ' + (error.resolved ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-200 text-rose-900') },
            error.resolved ? 'RESOLVED' : 'UNRESOLVED'
          )
        ),

        // Metadata grid
        h('div', { className: 'grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs' },
          h('div', { className: 'p-2.5 rounded-xl bg-slate-50 border border-slate-100' },
            h('span', { className: 'text-[10px] text-slate-400 font-bold block uppercase' }, 'Tenant / Business'),
            h('span', { className: 'font-bold font-mono text-slate-800 text-[11px]' }, error.business_id || 'Global')
          ),
          h('div', { className: 'p-2.5 rounded-xl bg-slate-50 border border-slate-100' },
            h('span', { className: 'text-[10px] text-slate-400 font-bold block uppercase' }, 'User Account'),
            h('span', { className: 'font-bold text-slate-800 text-[11px] truncate block', title: error.user_email || 'Anonymous' }, error.user_email || error.user_id || 'Anonymous')
          ),
          h('div', { className: 'p-2.5 rounded-xl bg-slate-50 border border-slate-100' },
            h('span', { className: 'text-[10px] text-slate-400 font-bold block uppercase' }, 'IP Address'),
            h('span', { className: 'font-bold font-mono text-slate-800 text-[11px]' }, error.ip_address || '127.0.0.1')
          ),
          h('div', { className: 'p-2.5 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-3' },
            h('span', { className: 'text-[10px] text-slate-400 font-bold block uppercase' }, 'User-Agent'),
            h('span', { className: 'text-slate-600 font-mono text-[10px] break-all' }, error.user_agent || 'Unknown')
          )
        ),

        // Error message
        h('div', { className: 'p-3 rounded-xl bg-slate-900 text-rose-400 font-mono text-xs leading-relaxed font-bold' },
          error.message
        ),

        // Stack trace
        h('div', { className: 'space-y-1' },
          h('div', { className: 'flex items-center justify-between' },
            h('span', { className: 'text-xs font-bold text-slate-700' }, 'Exception Stack Trace'),
            h('button', {
              onClick: handleCopyStack,
              className: 'text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 cursor-pointer'
            },
            h(Icon, { name: 'copy', className: 'w-3 h-3' }),
            'Copy Trace'
            )
          ),
          h('pre', { className: 'p-4 rounded-2xl bg-slate-950 text-slate-300 font-mono text-[11px] leading-relaxed max-h-56 overflow-auto whitespace-pre border border-slate-800' },
            error.stack || 'No stack trace captured.'
          )
        ),

        // Footer buttons
        h('div', { className: 'flex justify-end gap-2 pt-2' },
          h('button', { type: 'button', onClick: onClose, className: 'px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer' }, 'Close'),
          !error.resolved && h('button', {
            type: 'button',
            onClick: handleResolve,
            disabled: resolving,
            className: 'px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black cursor-pointer'
          }, resolving ? 'Resolving...' : 'Mark as Resolved')
        )
      )
    );
  }

  // Audit Log Record Detail Modal
  function AuditDetailModal({ log, onClose, addToast }) {
    if (!log) return null;

    const [copied, setCopied] = useState(false);

    let parsedDetails = null;
    let formattedJson = '';
    try {
      if (typeof log.details === 'object' && log.details !== null) {
        parsedDetails = log.details;
        formattedJson = JSON.stringify(log.details, null, 2);
      } else if (typeof log.details === 'string') {
        parsedDetails = JSON.parse(log.details);
        formattedJson = JSON.stringify(parsedDetails, null, 2);
      } else {
        formattedJson = String(log.details || '');
      }
    } catch {
      formattedJson = String(log.details || '');
    }

    const handleCopy = () => {
      navigator.clipboard.writeText(formattedJson);
      setCopied(true);
      addToast('Audit payload copied to clipboard!', 'info');
      setTimeout(() => setCopied(false), 2000);
    };

    const isFailure = log.success === false ||
      (typeof log.action === 'string' && (log.action.toLowerCase().includes('fail') || log.action.toLowerCase().includes('denied')));

    const time = log.timestamp || log.created_at || new Date().toISOString();
    const formattedDate = new Date(time).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'medium'
    });

    return h(Modal, { title: 'Audit Trail Inspection', isOpen: true, onClose, maxWidth: 'max-w-2xl' },
      h('div', { className: 'space-y-4' },
        // Top status card
        h('div', { className: 'flex items-center justify-between p-3.5 rounded-2xl border ' + (isFailure ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200') },
          h('div', { className: 'flex items-center gap-2 overflow-hidden' },
            h('span', { className: 'px-2.5 py-1 rounded-lg text-xs font-mono font-black uppercase ' + (isFailure ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white') },
              log.action || 'ACTIVITY'
            ),
            h('span', { className: 'text-xs text-slate-500 font-semibold truncate' }, formattedDate)
          ),
          h('span', { className: 'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ' + (isFailure ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800') },
            isFailure ? 'FLAGGED / DENIED' : 'AUDITED / RECORDED'
          )
        ),

        // Metadata grid
        h('div', { className: 'grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs' },
          h('div', { className: 'p-3 rounded-xl bg-slate-50 border border-slate-100' },
            h('span', { className: 'text-[10px] text-slate-400 font-bold block uppercase' }, 'Performed By'),
            h('div', { className: 'font-bold text-slate-800 text-[11px] truncate', title: log.performed_by || log.email || 'Admin' }, log.performed_by || log.email || 'Admin'),
            h('span', { className: 'inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-200 text-slate-700' }, log.performer_role || log.role || 'DEV')
          ),
          h('div', { className: 'p-3 rounded-xl bg-slate-50 border border-slate-100' },
            h('span', { className: 'text-[10px] text-slate-400 font-bold block uppercase' }, 'Tenant / Client'),
            h('span', { className: 'font-bold font-mono text-slate-800 text-[11px] truncate block' }, log.client_company || 'Platform System')
          ),
          h('div', { className: 'p-3 rounded-xl bg-slate-50 border border-slate-100' },
            h('span', { className: 'text-[10px] text-slate-400 font-bold block uppercase' }, 'IP Address'),
            h('span', { className: 'font-bold font-mono text-slate-800 text-[11px]' }, log.ip_address || log.ip || '127.0.0.1')
          ),
          (log.target_type || log.target_id) && h('div', { className: 'p-3 rounded-xl bg-slate-50 border border-slate-100 col-span-2' },
            h('span', { className: 'text-[10px] text-slate-400 font-bold block uppercase' }, 'Audit Target'),
            h('span', { className: 'font-mono text-slate-700 text-[11px]' }, (log.target_type || 'Entity') + ': ' + (log.target_id || 'N/A'))
          ),
          log.device_info && h('div', { className: 'p-3 rounded-xl bg-slate-50 border border-slate-100 ' + ((log.target_type || log.target_id) ? 'col-span-1' : 'sm:col-span-3') },
            h('span', { className: 'text-[10px] text-slate-400 font-bold block uppercase' }, 'Device / Environment'),
            h('span', { className: 'text-slate-600 font-mono text-[10px] truncate block', title: log.device_info }, log.device_info)
          )
        ),

        // Payload section
        h('div', { className: 'space-y-1.5' },
          h('div', { className: 'flex items-center justify-between' },
            h('span', { className: 'text-xs font-bold text-slate-700 flex items-center gap-1.5' },
              h(Icon, { name: 'sparkles', className: 'w-3.5 h-3.5 text-indigo-500' }),
              'Full Audit Details Payload (JSON)'
            ),
            h('button', {
              type: 'button',
              onClick: handleCopy,
              className: 'text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer transition'
            },
            h(Icon, { name: 'copy', className: 'w-3.5 h-3.5' }),
            copied ? 'Copied!' : 'Copy JSON'
            )
          ),
          h('pre', { className: 'p-4 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-[11px] leading-relaxed max-h-72 overflow-auto whitespace-pre border border-slate-800 selection:bg-emerald-800 selection:text-white' },
            formattedJson || '(No extra payload stored)'
          )
        ),

        // Footer
        h('div', { className: 'flex justify-end gap-2 pt-2 border-t border-slate-100' },
          h('button', {
            type: 'button',
            onClick: onClose,
            className: 'px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer'
          }, 'Close')
        )
      )
    );
  }

  // Confirmation Action Dialog Modal
  function ConfirmModal({ action, onClose }) {
    if (!action) return null;
    return h(Modal, { title: action.title || 'Please Confirm', isOpen: true, onClose },
      h('div', { className: 'text-center p-2' },
        h('p', { className: 'text-xs text-slate-600 mb-6 leading-relaxed' }, action.message),
        h('div', { className: 'flex justify-center gap-3' },
          h('button', {
            onClick: onClose,
            className: 'px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer',
          }, 'Cancel'),
          h('button', {
            onClick: () => {
              action.onConfirm();
              onClose();
            },
            className: 'px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm cursor-pointer ' +
              (action.isDanger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'),
          }, action.confirmText || 'Confirm')
        )
      )
    );
  }

  // ─────────────────────────────────────────────────────────────
  // MOUNT REACT APP
  // ─────────────────────────────────────────────────────────────
  const container = document.getElementById('developer-root');
  if (container) {
    const root = ReactDOM.createRoot(container);
    root.render(h(DeveloperApp));
  }
})();

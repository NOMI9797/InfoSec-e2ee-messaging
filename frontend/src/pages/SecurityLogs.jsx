import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import './SecurityLogs.css';

const SecurityLogs = () => {
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [eventType, setEventType] = useState('All');
  const [severity, setSeverity] = useState('All');
  const [username, setUsername] = useState('');
  const [success, setSuccess] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params for filters
      const params = {};
      if (eventType !== 'All') params.eventType = eventType;
      if (severity !== 'All') params.severity = severity;
      if (username.trim()) params.username = username.trim();
      if (success !== 'All') params.success = success === 'true';
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const [logsRes, statsRes] = await Promise.all([
        api.get('/security-logs', { params }),
        api.get('/security-logs/stats', { params }),
      ]);

      setLogs(logsRes.data.logs || []);
      setStats(statsRes.data.stats || null);
    } catch (err) {
      console.error('Error loading security logs:', err);
      setError('Failed to load security logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Simple auth guard: redirect to login if no token
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetchData();
  }, []);

  const handleApplyFilters = (e) => {
    e.preventDefault();
    fetchData();
  };

  return (
    <div className="security-logs-page">
      <header className="security-logs-header">
        <h1 className="security-logs-title">Security Logs</h1>
        <button
          className="btn-back-to-chat"
          type="button"
          onClick={() => navigate('/chat')}
        >
          Back to Chat
        </button>
      </header>

      {error && <div className="alert error">{error}</div>}

      {stats && (
        <section className="stats-grid">
          <div className="stat-card">
            <h3>Event Types</h3>
            {Object.entries(stats.eventTypes || {}).map(([type, count]) => (
              <p key={type}>
                <strong>{type}</strong>: {count}
              </p>
            ))}
          </div>
          <div className="stat-card">
            <h3>Severity Levels</h3>
            {Object.entries(stats.severityLevels || {}).map(([level, count]) => (
              <p key={level}>
                <strong>{level}</strong>: {count}
              </p>
            ))}
          </div>
          <div className="stat-card">
            <h3>Success / Failure</h3>
            <p>
              <strong>Success:</strong> {stats.successCount || 0}
            </p>
            <p>
              <strong>Failure:</strong> {stats.failureCount || 0}
            </p>
          </div>
        </section>
      )}

      <section className="filters-card">
        <h2>Filters</h2>
        <form className="filters-grid" onSubmit={handleApplyFilters}>
          <div className="form-group">
            <label>Event Type</label>
            <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="All">All</option>
              <option value="AUTH_ATTEMPT">Auth Attempt</option>
              <option value="KEY_EXCHANGE_INITIATED">Key Exchange Initiated</option>
              <option value="KEY_EXCHANGE_COMPLETED">Key Exchange Completed</option>
              <option value="MESSAGE_SENT">Message Sent</option>
              <option value="MESSAGE_RECEIVED">Message Received</option>
              <option value="REPLAY_ATTACK_DETECTED">Replay Attack Detected</option>
              <option value="DECRYPTION_FAILED">Decryption Failed</option>
            </select>
          </div>

          <div className="form-group">
            <label>Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="All">All</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
            </select>
          </div>

          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              placeholder="Filter by username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Success</label>
            <select value={success} onChange={(e) => setSuccess(e.target.value)}>
              <option value="All">All</option>
              <option value="true">Success</option>
              <option value="false">Failure</option>
            </select>
          </div>

          <div className="form-group">
            <label>Start Date</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>End Date</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button className="btn-secondary" type="button" onClick={fetchData}>
              Refresh
            </button>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Loading...' : 'Apply Filters'}
            </button>
          </div>
        </form>
      </section>

      <section className="logs-card">
        <div className="logs-header">
          <h2>Logs ({logs.length} total)</h2>
        </div>

        <div className="logs-table-wrapper">
          <table className="logs-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event Type</th>
                <th>Severity</th>
                <th>User</th>
                <th>Success</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="empty-state">
                    No logs found for the selected filters.
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log._id}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>{log.eventType}</td>
                  <td>{log.severity}</td>
                  <td>{log.username || '—'}</td>
                  <td>{log.success ? '✔' : '✖'}</td>
                  <td>{log.ipAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default SecurityLogs;



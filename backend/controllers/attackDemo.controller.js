import { logSecurityEvent, extractRequestInfo } from '../utils/securityLogger.js';

/**
 * Log MITM attack demonstration
 */
export const logMITMAttack = async (req, res) => {
  try {
    const { scenario, success, logs } = req.body;
    const userId = req.userId || null;
    const username = req.username || 'demo';

    await logSecurityEvent({
      eventType: 'ATTACK_DEMO_MITM',
      severity: success ? 'ERROR' : 'INFO',
      userId,
      username,
      ...extractRequestInfo(req),
      success: !success, // Inverted: if attack succeeds, security fails
      details: {
        scenario,
        attackBlocked: !success,
        logs: logs || []
      }
    });

    res.json({
      success: true,
      message: 'MITM attack demonstration logged'
    });
  } catch (error) {
    console.error('Error logging MITM attack:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log MITM attack'
    });
  }
};

/**
 * Log replay attack demonstration
 */
export const logReplayAttack = async (req, res) => {
  try {
    const { messageId, blocked, logs } = req.body;
    const userId = req.userId || null;
    const username = req.username || 'demo';

    await logSecurityEvent({
      eventType: 'ATTACK_DEMO_REPLAY',
      severity: blocked ? 'INFO' : 'ERROR',
      userId,
      username,
      ...extractRequestInfo(req),
      success: blocked, // If blocked, security succeeded
      details: {
        messageId,
        attackBlocked: blocked,
        logs: logs || []
      }
    });

    res.json({
      success: true,
      message: 'Replay attack demonstration logged'
    });
  } catch (error) {
    console.error('Error logging replay attack:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log replay attack'
    });
  }
};



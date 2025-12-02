import SecurityLog from '../models/SecurityLog.model.js';
import mongoose from 'mongoose';
import { logSecurityEvent, extractRequestInfo } from '../utils/securityLogger.js';

/**
 * Get security logs with filtering and pagination
 */
export const getSecurityLogs = async (req, res) => {
  try {
    const {
      eventType,
      severity,
      userId,
      username,
      success,
      startDate,
      endDate,
      limit = 100,
      page = 1
    } = req.query;

    // Build query
    const query = {};

    if (eventType) {
      query.eventType = eventType;
    }

    if (severity) {
      query.severity = severity;
    }

    if (userId) {
      query.userId = mongoose.Types.ObjectId.isValid(userId) ? userId : null;
    }

    if (username) {
      query.username = { $regex: username, $options: 'i' };
    }

    if (success !== undefined) {
      query.success = success === 'true';
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get logs
    const logs = await SecurityLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('userId', 'username')
      .lean();

    // Get total count
    const total = await SecurityLog.countDocuments(query);

    res.json({
      success: true,
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get security logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security logs'
    });
  }
};

/**
 * Get security log statistics
 */
export const getSecurityLogStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.timestamp = {};
      if (startDate) {
        dateQuery.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        dateQuery.timestamp.$lte = new Date(endDate);
      }
    }

    // Get counts by event type
    const eventTypeStats = await SecurityLog.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get counts by severity
    const severityStats = await SecurityLog.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get success/failure counts
    const successStats = await SecurityLog.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$success',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent critical events
    const criticalQuery = { severity: 'CRITICAL' };
    if (dateQuery.timestamp) {
      criticalQuery.timestamp = dateQuery.timestamp;
    }
    const criticalEvents = await SecurityLog.find(criticalQuery)
      .sort({ timestamp: -1 })
      .limit(10)
      .populate('userId', 'username')
      .lean();

    res.json({
      success: true,
      stats: {
        eventTypeStats,
        severityStats,
        successStats,
        criticalEvents
      }
    });
  } catch (error) {
    console.error('Get security log stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security log statistics'
    });
  }
};

/**
 * Get a specific security log by ID
 */
export const getSecurityLog = async (req, res) => {
  try {
    const { logId } = req.params;

    const log = await SecurityLog.findById(logId)
      .populate('userId', 'username')
      .lean();

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Security log not found'
      });
    }

    res.json({
      success: true,
      log
    });
  } catch (error) {
    console.error('Get security log error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security log'
    });
  }
};

/**
 * Create a security log (for client-side logging)
 */
export const createSecurityLog = async (req, res) => {
  try {
    const logData = req.body;
    const { ipAddress, userAgent } = extractRequestInfo(req);

    await logSecurityEvent({
      ...logData,
      ipAddress: logData.ipAddress || ipAddress,
      userAgent: logData.userAgent || userAgent
    });

    res.json({
      success: true,
      message: 'Security log created'
    });
  } catch (error) {
    console.error('Create security log error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create security log'
    });
  }
};

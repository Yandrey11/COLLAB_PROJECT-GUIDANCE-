import mongoose from "mongoose";
import AdminCounselorMessage from "../models/AdminCounselorMessage.js";
import { createNotification } from "./admin/notificationController.js";
import { cacheInvalidate } from "../utils/cache.js";
import { decrypt } from "../utils/fieldCrypto.js";

const MAX_BODY_LEN = 4000;

const getCounselorId = (req) => req.user?._id || req.user?.id;

const getSenderName = (req) =>
  (req.user?.name && String(req.user.name).trim()) ||
  (req.user?.email && String(req.user.email).trim()) ||
  "Counselor";

/** GET /api/counselor/messages — paginated, oldest-first in each page for chat UI */
export const getCounselorMessages = async (req, res) => {
  try {
    const counselorId = getCounselorId(req);
    if (!counselorId) {
      return res.status(401).json({ success: false, message: "Not authenticated." });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const filter = { counselorId: new mongoose.Types.ObjectId(String(counselorId)) };
    const total = await AdminCounselorMessage.countDocuments(filter);

    const docs = await AdminCounselorMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const messages = docs.reverse().map((m) => ({
      id: m._id,
      counselorId: m.counselorId,
      senderRole: m.senderRole,
      senderUserId: m.senderUserId,
      senderName: decrypt(m.senderName),
      body: decrypt(m.body),
      readAt: m.readAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    res.json({
      success: true,
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error("getCounselorMessages:", err);
    res.status(500).json({ success: false, message: "Failed to load messages." });
  }
};

/** POST /api/counselor/messages */
export const postCounselorMessage = async (req, res) => {
  try {
    const counselorId = getCounselorId(req);
    if (!counselorId) {
      return res.status(401).json({ success: false, message: "Not authenticated." });
    }

    const raw = req.body?.body;
    if (raw == null || typeof raw !== "string") {
      return res.status(400).json({ success: false, message: "Message body is required." });
    }
    const body = raw.trim();
    if (!body) {
      return res.status(400).json({ success: false, message: "Message cannot be empty." });
    }
    if (body.length > MAX_BODY_LEN) {
      return res.status(400).json({
        success: false,
        message: `Message must be at most ${MAX_BODY_LEN} characters.`,
      });
    }

    const doc = await AdminCounselorMessage.create({
      counselorId,
      senderRole: "counselor",
      senderUserId: counselorId,
      senderName: getSenderName(req),
      body,
    });

    try {
      await createNotification({
        title: `Message from ${getSenderName(req)}`,
        description: body.length > 200 ? `${body.slice(0, 200)}…` : body,
        category: "Info",
        priority: "medium",
        metadata: {
          type: "counselor_message",
          counselorId: String(counselorId),
          messageId: String(doc._id),
        },
        relatedId: doc._id,
        relatedType: "counselor_message",
      });
    } catch (notifyErr) {
      console.error("Admin notification (counselor message) failed:", notifyErr);
    }

    cacheInvalidate("messages:");

    res.status(201).json({
      success: true,
      message: {
        id: doc._id,
        counselorId: doc.counselorId,
        senderRole: doc.senderRole,
        senderUserId: doc.senderUserId,
        senderName: doc.senderName,
        body: doc.body,
        readAt: doc.readAt,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (err) {
    console.error("postCounselorMessage:", err);
    res.status(500).json({ success: false, message: "Failed to send message." });
  }
};

/** POST /api/counselor/messages/mark-read — admin → counselor unread cleared */
export const markCounselorMessagesRead = async (req, res) => {
  try {
    const counselorId = getCounselorId(req);
    if (!counselorId) {
      return res.status(401).json({ success: false, message: "Not authenticated." });
    }

    const now = new Date();
    const result = await AdminCounselorMessage.updateMany(
      {
        counselorId,
        senderRole: "admin",
        $or: [{ readAt: null }, { readAt: { $exists: false } }],
      },
      { $set: { readAt: now } }
    );

    cacheInvalidate("messages:");
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error("markCounselorMessagesRead:", err);
    res.status(500).json({ success: false, message: "Failed to mark messages read." });
  }
};

/** GET /api/counselor/messages/unread-count — admin messages not yet read by counselor */
export const getCounselorUnreadMessageCount = async (req, res) => {
  try {
    const counselorId = getCounselorId(req);
    if (!counselorId) {
      return res.status(401).json({ success: false, unreadCount: 0 });
    }

    const unreadCount = await AdminCounselorMessage.countDocuments({
      counselorId,
      senderRole: "admin",
      $or: [{ readAt: null }, { readAt: { $exists: false } }],
    });

    res.json({ success: true, unreadCount });
  } catch (err) {
    console.error("getCounselorUnreadMessageCount:", err);
    res.status(500).json({ success: false, unreadCount: 0 });
  }
};

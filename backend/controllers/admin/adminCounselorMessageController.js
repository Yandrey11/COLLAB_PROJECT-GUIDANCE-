import mongoose from "mongoose";
import AdminCounselorMessage from "../../models/AdminCounselorMessage.js";
import Counselor from "../../models/Counselor.js";
import GoogleUser from "../../models/GoogleUser.js";
import { createCounselorNotification } from "../counselorNotificationController.js";
import { cacheInvalidate } from "../../utils/cache.js";
import { decrypt } from "../../utils/fieldCrypto.js";

const MAX_BODY_LEN = 4000;

/** Counselor model uses Mongo collection `users`; Google OAuth counselors use `googleusers`. */
async function resolveMessagingParticipant(counselorId) {
  if (!mongoose.Types.ObjectId.isValid(counselorId)) return null;
  const oid = new mongoose.Types.ObjectId(String(counselorId));
  const fromCounselor = await Counselor.findById(oid).select("_id name email").lean();
  if (fromCounselor) return fromCounselor;
  const fromGoogle = await GoogleUser.findById(oid).select("_id name email").lean();
  return fromGoogle || null;
}

/** GET /api/admin/messages/unread-total — counselor → admin messages not yet read */
export const getAdminUnreadMessageTotal = async (req, res) => {
  try {
    const unreadCount = await AdminCounselorMessage.countDocuments({
      senderRole: "counselor",
      $or: [{ readAt: null }, { readAt: { $exists: false } }],
    });
    res.json({ success: true, unreadCount });
  } catch (err) {
    console.error("getAdminUnreadMessageTotal:", err);
    res.status(500).json({ success: false, unreadCount: 0 });
  }
};

const getAdminId = (req) => req.admin?._id || req.admin?.id;

const getAdminName = (req) =>
  (req.admin?.name && String(req.admin.name).trim()) ||
  (req.admin?.email && String(req.admin.email).trim()) ||
  "Admin";

/** GET /api/admin/messages/threads */
export const getAdminMessageThreads = async (req, res) => {
  try {
    const pipeline = [
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: "$counselorId",
          lastMessageAt: { $last: "$createdAt" },
          lastBody: { $last: "$body" },
          lastSenderRole: { $last: "$senderRole" },
          lastSenderName: { $last: "$senderName" },
          unreadFromCounselor: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$senderRole", "counselor"] },
                    { $eq: [{ $ifNull: ["$readAt", false] }, false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { lastMessageAt: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "counselorUser",
        },
      },
      {
        $lookup: {
          from: "googleusers",
          localField: "_id",
          foreignField: "_id",
          as: "counselorGoogle",
        },
      },
      {
        $addFields: {
          counselorPerson: {
            $cond: [
              { $gt: [{ $size: "$counselorUser" }, 0] },
              { $arrayElemAt: ["$counselorUser", 0] },
              { $arrayElemAt: ["$counselorGoogle", 0] },
            ],
          },
        },
      },
      {
        $project: {
          counselorId: "$_id",
          counselorName: { $ifNull: ["$counselorPerson.name", "Unknown"] },
          counselorEmail: { $ifNull: ["$counselorPerson.email", ""] },
          lastMessageAt: 1,
          lastBody: { $ifNull: ["$lastBody", ""] },
          lastSenderRole: 1,
          lastSenderName: 1,
          unreadFromCounselor: 1,
        },
      },
    ];

    const threads = (await AdminCounselorMessage.aggregate(pipeline)).map((t) => {
      const body = decrypt(t.lastBody || "");
      const normalized = typeof body === "string" ? body : String(body || "");
      return {
        ...t,
        lastBody: normalized.length > 120 ? `${normalized.slice(0, 120)}…` : normalized,
      };
    });

    res.json({ success: true, threads });
  } catch (err) {
    console.error("getAdminMessageThreads:", err);
    res.status(500).json({ success: false, message: "Failed to load threads." });
  }
};

/** GET /api/admin/messages/counselor/:counselorId */
export const getAdminMessagesForCounselor = async (req, res) => {
  try {
    const { counselorId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(counselorId)) {
      return res.status(400).json({ success: false, message: "Invalid counselor id." });
    }

    const counselor = await resolveMessagingParticipant(counselorId);
    if (!counselor) {
      return res.status(404).json({ success: false, message: "Counselor not found." });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const filter = { counselorId: new mongoose.Types.ObjectId(counselorId) };
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
      counselor: { id: counselor._id, name: counselor.name, email: counselor.email },
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error("getAdminMessagesForCounselor:", err);
    res.status(500).json({ success: false, message: "Failed to load messages." });
  }
};

/** POST /api/admin/messages/counselor/:counselorId */
export const postAdminMessageToCounselor = async (req, res) => {
  try {
    const { counselorId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(counselorId)) {
      return res.status(400).json({ success: false, message: "Invalid counselor id." });
    }

    const counselor = await resolveMessagingParticipant(counselorId);
    if (!counselor) {
      return res.status(404).json({ success: false, message: "Counselor not found." });
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

    const adminId = getAdminId(req);
    const doc = await AdminCounselorMessage.create({
      counselorId: counselor._id,
      senderRole: "admin",
      senderUserId: adminId,
      senderName: getAdminName(req),
      body,
    });

    try {
      await createCounselorNotification({
        counselorId: counselor._id,
        counselorEmail: counselor.email,
        title: `Message from ${getAdminName(req)}`,
        description: body.length > 200 ? `${body.slice(0, 200)}…` : body,
        category: "Message",
        priority: "medium",
        metadata: {
          type: "admin_message",
          messageId: String(doc._id),
          adminName: getAdminName(req),
        },
        relatedId: doc._id,
        relatedType: "message",
      });
    } catch (notifyErr) {
      console.error("Counselor notification (admin message) failed:", notifyErr);
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
    console.error("postAdminMessageToCounselor:", err);
    res.status(500).json({ success: false, message: "Failed to send message." });
  }
};

/** POST /api/admin/messages/counselor/:counselorId/mark-read */
export const markAdminThreadRead = async (req, res) => {
  try {
    const { counselorId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(counselorId)) {
      return res.status(400).json({ success: false, message: "Invalid counselor id." });
    }

    const cid = new mongoose.Types.ObjectId(counselorId);
    const counselor = await resolveMessagingParticipant(cid);
    if (!counselor) {
      return res.status(404).json({ success: false, message: "Counselor not found." });
    }

    const now = new Date();
    const result = await AdminCounselorMessage.updateMany(
      {
        counselorId: cid,
        senderRole: "counselor",
        $or: [{ readAt: null }, { readAt: { $exists: false } }],
      },
      { $set: { readAt: now } }
    );

    cacheInvalidate("messages:");
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error("markAdminThreadRead:", err);
    res.status(500).json({ success: false, message: "Failed to mark thread read." });
  }
};

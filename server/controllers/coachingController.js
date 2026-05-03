import { run } from '../config/database.js';
import { uploadToR2 } from '../middleware/upload.js';
export const bookSession = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { coachId, date, time, note, bookingType, plan, level } = req.body;
        if (!coachId)
            return res.status(400).json({ message: 'coachId required' });
        const nowBodyPhoto = req.files?.nowBodyPhoto?.[0] ? await uploadToR2(req.files.nowBodyPhoto[0], 'coaching') : null;
        const dreamBodyPhoto = req.files?.dreamBodyPhoto?.[0] ? await uploadToR2(req.files.dreamBodyPhoto[0], 'coaching') : null;
        const { insertId } = await run("INSERT INTO coaching_bookings (user_id, coach_id, date, time, note, booking_type, plan, level, now_body_photo, dream_body_photo, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')", [userId, coachId, date || '', time || '', note || '', bookingType || 'session', plan || 'complete', level || '1', nowBodyPhoto, dreamBodyPhoto]);
        return res.json({ success: true, bookingId: insertId });
    }
    catch (err) {
        console.error('Booking error', err);
        return res.status(500).json({ message: 'Booking failed' });
    }
};
//# sourceMappingURL=coachingController.js.map
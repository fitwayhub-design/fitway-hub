import { run, get } from '../config/database.js';
export const UserModel = {
    create: async (email, passwordHash) => {
        const { insertId } = await run('INSERT INTO users (email, password, is_premium) VALUES (?, ?, 0)', [email, passwordHash]);
        return { id: insertId, email, created_at: new Date().toISOString() };
    },
    findByEmail: async (email) => get('SELECT * FROM users WHERE email = ?', [email]),
    findByUsername: async (username) => get('SELECT * FROM users WHERE email = ? OR name = ?', [username, username]),
    findById: async (id) => get('SELECT * FROM users WHERE id = ?', [id]),
    findByResetToken: async (token) => get('SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?', [token, Date.now()]),
    findByRememberToken: async (token) => get('SELECT * FROM users WHERE remember_token = ?', [token]),
    setResetToken: async (userId, token, expiresIn = 3600000) => run('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [token, Date.now() + expiresIn, userId]),
    setRememberToken: async (userId, token) => run('UPDATE users SET remember_token = ? WHERE id = ?', [token, userId]),
    updatePassword: async (userId, hashedPassword) => run('UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [hashedPassword, userId]),
    updatePremium: async (userId, isPremium) => {
        const u = await get('SELECT role FROM users WHERE id = ?', [userId]);
        if (!u)
            return null;
        // Only 'user' role may be granted premium status. Coaches use coach_membership_active instead.
        if (u.role !== 'user')
            return null;
        return run('UPDATE users SET is_premium = ? WHERE id = ?', [isPremium ? 1 : 0, userId]);
    },
    updateProfile: async (userId, fields) => {
        const updates = [];
        const params = [];
        if (fields.height !== undefined) {
            updates.push('height = ?');
            params.push(fields.height);
        }
        if (fields.weight !== undefined) {
            updates.push('weight = ?');
            params.push(fields.weight);
        }
        if (fields.gender !== undefined) {
            updates.push('gender = ?');
            params.push(fields.gender);
        }
        if (fields.name !== undefined) {
            updates.push('name = ?');
            params.push(fields.name);
        }
        if (fields.avatar !== undefined) {
            updates.push('avatar = ?');
            params.push(fields.avatar);
        }
        if (updates.length === 0)
            return null;
        params.push(userId);
        return run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    },
    setSecurityQuestion: async (userId, question, answerHash) => run('UPDATE users SET security_question = ?, security_answer = ? WHERE id = ?', [question, answerHash, userId]),
    addOfflineSteps: async (userId, steps) => run('UPDATE users SET offline_steps = offline_steps + ?, last_sync = NOW() WHERE id = ?', [steps, userId]),
};
//# sourceMappingURL=User.js.map
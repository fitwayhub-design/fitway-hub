import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { query, get, run } from '../config/database.js';
import { upload, optimizeImage, uploadToR2 } from '../middleware/upload.js';

const router = Router();

const adminOnly = (req: any, res: Response, next: any) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

// Sections that should always exist in the admin CMS for a given page, and
// the canonical default content for each. ensureRequiredSections() walks
// this list whenever an admin opens a page in the CMS and:
//   - inserts the row if it doesn't exist yet (so admins always see every
//     section that the website renders), and
//   - merges any default fields that are MISSING from an existing row
//     (so admins see editable fields for content that was originally
//     hardcoded on the page — without overwriting any field they've
//     already customised).
const REQUIRED_SECTIONS: Record<string, { type: string; label: string; content: any }[]> = {
  home: [
    {
      type: 'hero',
      label: 'Hero Section',
      content: {
        topMetaLeft: 'ELITE FITNESS PLATFORM · V.2026',
        topMetaLeft_ar: 'منصة لياقة النخبة · إصدار ٢٠٢٦',
        topMetaRight: '',
        topMetaRight_ar: '',
      },
    },
    {
      type: 'stats',
      label: 'Stats Section',
      content: {
        sectionLabel: '— Perfect Activity',
        sectionLabel_ar: '— نشاط مثالي',
        sectionMeta: 'Numbers tell the story',
        sectionMeta_ar: 'أرقام تحكي القصة',
        heading: 'Numbers that prove',
        heading_ar: 'أرقام تثبت',
        headingAccent: 'commitment.',
        headingAccent_ar: 'التزامنا.',
      },
    },
    {
      type: 'features',
      label: 'Features Section',
      content: {
        sectionMeta: 'Complete Proficiency',
        sectionMeta_ar: 'كفاءة شاملة',
        headingAccent: '',
        headingAccent_ar: '',
      },
    },
    {
      type: 'steps',
      label: 'How It Works',
      content: {
        sectionLabel: '— How It Works',
        sectionLabel_ar: '— كيف يعمل',
        sectionMeta: 'Start in simple steps',
        sectionMeta_ar: 'ابدأ في خطوات بسيطة',
        heading: 'Start in',
        heading_ar: 'ابدأ في',
        headingAccent: '4 simple steps.',
        headingAccent_ar: '٤ خطوات.',
      },
    },
    {
      type: 'testimonials',
      label: 'Testimonials Section',
      content: {
        sectionLabel: 'Real Results',
        sectionLabel_ar: 'نتائج حقيقية',
        sectionMeta: 'Athlete Stories',
        sectionMeta_ar: 'آراء الأعضاء',
        heading: 'Real people. Real transformations.',
        heading_ar: 'أشخاص حقيقيون. تحوّلات مذهلة.',
        headingAccent: '',
        headingAccent_ar: '',
      },
    },
    {
      type: 'portal_select',
      label: 'Portal Selector (Athlete / Coach)',
      content: {
        eyebrow: '— Choose Your Path',
        eyebrow_ar: '— اختر مسارك',
        heading: 'Athlete or Coach.',
        heading_ar: 'رياضي أم مدرب.',
        headingAccent: 'or',
        headingAccent_ar: 'أم',
        athleteLabel: "I'm an Athlete",
        athleteLabel_ar: 'أنا رياضي',
        athleteLink: '/auth/register?role=user',
        coachLabel: "I'm a Coach",
        coachLabel_ar: 'أنا مدرب',
        coachLink: '/auth/register?role=coach',
      },
    },
    {
      type: 'cta',
      label: 'Final CTA Banner',
      content: {
        sectionLabel: "Let's Begin Together",
        sectionLabel_ar: 'لنبدأ معاً',
        badge: '',
        badge_ar: '',
        heading: 'Start your transformation today.',
        heading_ar: 'ابدأ تحوّلك اليوم.',
        headingAccent: '',
        headingAccent_ar: '',
        subheading: 'Join thousands who already started. Your account is free with no strings attached.',
        subheading_ar: 'انضم للآلاف اللي بدأوا رحلتهم. حسابك مجاني ومافيش قيود.',
        btnText: "Let's Talk",
        btnText_ar: 'لنبدأ',
        btnLink: '/auth/register',
        widthMode: 'boxed',
      },
    },
  ],
  about: [
    {
      type: 'hero',
      label: 'About Hero',
      content: {
        topMetaLeft: 'ABOUT · V.2026',
        topMetaLeft_ar: 'من نحن · إصدار ٢٠٢٦',
        topMetaRight: 'Our Story',
        topMetaRight_ar: 'قصتنا',
        metaLeft: 'ABOUT · V.2026',
        metaLeft_ar: 'من نحن · إصدار ٢٠٢٦',
        metaRight: 'Our Story',
        metaRight_ar: 'قصتنا',
      },
    },
    {
      type: 'stats',
      label: 'About Stats',
      content: {
        sectionLabel: '— By the Numbers',
        sectionLabel_ar: '— بالأرقام',
        sectionMeta: 'Continuous activity',
        sectionMeta_ar: 'نشاط مستمر',
        heading: 'Numbers that',
        heading_ar: 'الأرقام',
        headingAccent: 'tell the story.',
        headingAccent_ar: 'تحكي القصة.',
        items: [
          { value: '10K+', label: 'Active members on the platform.', label_ar: 'عضو نشط على المنصة.' },
          { value: '50+',  label: 'Vetted certified coaches.',         label_ar: 'كوتش معتمد بشهادات موثقة.' },
          { value: '500+', label: 'Ready-made training programs.',     label_ar: 'برنامج تدريب جاهز.' },
          { value: '4.9★', label: 'App rating from athletes.',         label_ar: 'تقييم التطبيق.' },
        ],
      },
    },
    {
      type: 'mission',
      label: 'About Mission',
      content: {
        sectionLabel: 'Mission — 03',
        sectionLabel_ar: 'المهمة — ٠٣',
        sectionMeta: 'What we believe',
        sectionMeta_ar: 'ما نؤمن به',
        eyebrow: '— Our Mission',
        eyebrow_ar: '— مهمتنا',
        heading: 'Fitness for everyone,',
        heading_ar: 'اللياقة لكل الناس،',
        headingAccent: 'not just the privileged.',
        headingAccent_ar: 'مش بس الأثرياء.',
        body1: 'Fitway Hub was founded on one belief: everyone deserves access to expert fitness guidance. We bridge the gap between certified coaches and people who want to change their lives — regardless of budget, location, or experience level.',
        body1_ar: 'فيت واي هاب اتبنت على إيمان واحد: كل شخص يستحق وصول لتدريب احترافي. بنجسر الفجوة بين الكوتشات المعتمدين والناس اللي عايزين يغيروا حياتهم.',
        body2: 'From personalised plans built by certified coaches to live coaching sessions, every feature we build is designed to move you closer to your goal.',
        body2_ar: 'من خطط التمرين المخصصة من كوتشات معتمدين لجلسات الكوتشينج الحية، كل ميزة بنبنيها مصممة تقربك من هدفك.',
        bullets: [
          'Certified training by real experts',
          'Affordable for every budget',
          'Supportive community in Arabic & English',
        ],
        bullets_ar: [
          'تدريب معتمد من خبراء حقيقيين',
          'أسعار مناسبة لكل الميزانيات',
          'مجتمع داعم بالعربي والإنجليزي',
        ],
        snapshotEyebrow: 'At a glance / 03',
        snapshotEyebrow_ar: 'نظرة سريعة',
        snapshotTitle: 'Platform Snapshot',
        snapshotTitle_ar: 'ملخص المنصة',
        snapshotRows: [
          { emoji: '🏋️', title: 'Certified Workouts', title_ar: 'تمارين معتمدة', value: '500+', value_ar: '+٥٠٠' },
          { emoji: '🧠', title: 'Smart Insights',     title_ar: 'رؤى ذكية',      value: 'Daily', value_ar: 'يومياً' },
          { emoji: '👥', title: 'Real Coaches',       title_ar: 'كوتشات حقيقيين', value: '50+',  value_ar: '+٥٠' },
          { emoji: '📱', title: 'Platforms',          title_ar: 'أجهزة مدعومة',   value: 'iOS & Android', value_ar: 'iOS و Android' },
        ],
      },
    },
    {
      type: 'values',
      label: 'About Values',
      content: {
        sectionLabel: 'Values — 04',
        sectionLabel_ar: 'القيم — ٠٤',
        sectionMeta: 'What we stand for',
        sectionMeta_ar: 'ما يهمنا',
        eyebrow: '— Our Values',
        eyebrow_ar: '— قيمنا',
        heading: 'What we',
        heading_ar: 'ما',
        headingAccent: 'stand for.',
        headingAccent_ar: 'يهمنا.',
      },
    },
    {
      type: 'features',
      label: 'About Features',
      content: {
        sectionLabel: 'Features — 05',
        sectionLabel_ar: 'الميزات — ٠٥',
        sectionMeta: 'Everything you need',
        sectionMeta_ar: 'كل ما تحتاجه',
        eyebrow: '— Features',
        eyebrow_ar: '— الميزات',
        heading: 'Everything in',
        heading_ar: 'كل اللي محتاجه',
        headingAccent: 'one place.',
        headingAccent_ar: 'في مكان واحد.',
      },
    },
    {
      type: 'timeline',
      label: 'About Timeline',
      content: {
        sectionLabel: 'Journey — 06',
        sectionLabel_ar: 'الرحلة — ٠٦',
        sectionMeta: 'Our path',
        sectionMeta_ar: 'رحلتنا',
        eyebrow: '— Our Journey',
        eyebrow_ar: '— رحلتنا',
        heading: 'From idea',
        heading_ar: 'من فكرة',
        headingAccent: 'to platform.',
        headingAccent_ar: 'إلى منصة.',
      },
    },
    {
      type: 'team',
      label: 'About Team',
      content: {
        sectionLabel: 'Team — 07',
        sectionLabel_ar: 'الفريق — ٠٧',
        sectionMeta: 'The team',
        sectionMeta_ar: 'الفريق',
        eyebrow: '— Our Team',
        eyebrow_ar: '— فريقنا',
        heading: 'Built by',
        heading_ar: 'بُني بواسطة',
        headingAccent: 'fitness lovers.',
        headingAccent_ar: 'عشاق اللياقة.',
        subheading: "Our team of athletes, coaches, and engineers all believe in fitness's power to transform lives.",
        subheading_ar: 'فريقنا من الرياضيين والمدربين والمطورين كلهم بيؤمن بقوة اللياقة في تغيير الحياة.',
      },
    },
    {
      type: 'cta',
      label: 'About CTA',
      content: {
        sectionLabel: '— Start Now',
        sectionLabel_ar: '— ابدأ الآن',
        badge: '',
        badge_ar: '',
        heading: 'Ready to',
        heading_ar: 'مستعد',
        headingAccent: 'start your journey?',
        headingAccent_ar: 'تبدأ رحلتك؟',
        subheading: 'Join thousands of members already transforming their lives with Fitway Hub.',
        subheading_ar: 'انضم لآلاف من الأعضاء بيحولوا حياتهم مع فيت واي هاب.',
        btnText: 'Create Free Account',
        btnText_ar: 'أنشئ حساب مجاني',
        btnLink: '/auth/register',
        secondaryBtnText: 'Contact Us',
        secondaryBtnText_ar: 'تواصل معنا',
        secondaryBtnLink: '/contact',
        widthMode: 'boxed',
      },
    },
  ],
};

async function ensureRequiredSections(page: string) {
  const required = REQUIRED_SECTIONS[page];
  if (!required?.length) return;
  for (const r of required) {
    const existing: any = await get(
      'SELECT id, content FROM website_sections WHERE page = ? AND type = ? LIMIT 1',
      [page, r.type],
    );
    if (existing) {
      // Merge any default fields the row doesn't have yet — preserves
      // admin customisations but populates fields added in later releases.
      let existingContent: any = {};
      try {
        existingContent = typeof existing.content === 'string'
          ? JSON.parse(existing.content)
          : (existing.content || {});
      } catch { existingContent = {}; }
      let changed = false;
      for (const [key, value] of Object.entries(r.content)) {
        if (existingContent[key] === undefined) {
          existingContent[key] = value;
          changed = true;
        }
      }
      if (changed) {
        await run(
          'UPDATE website_sections SET content = ?, updated_at = NOW() WHERE id = ?',
          [JSON.stringify(existingContent), existing.id],
        );
      }
      continue;
    }
    const maxOrder: any = await get(
      'SELECT MAX(sort_order) as max FROM website_sections WHERE page = ?',
      [page],
    );
    await run(
      'INSERT INTO website_sections (page, type, label, content, sort_order) VALUES (?,?,?,?,?)',
      [page, r.type, r.label, JSON.stringify(r.content), (maxOrder?.max || 0) + 1],
    );
  }
}

// ── Public: get website translation overrides ────────────────────────────────
router.get('/translations', async (_req: any, res: Response) => {
  try {
    const rows = await query('SELECT text_key, text_ar FROM website_translations ORDER BY text_key');
    const translations: Record<string, string> = {};
    for (const r of rows as any[]) translations[r.text_key] = r.text_ar;
    res.json({ translations });
  } catch { res.json({ translations: {} }); }
});

// ── Public: get sections for a page ──────────────────────────────────────────
router.get('/sections/:page', async (req: any, res: Response) => {
  try {
    const { page } = req.params;
    const sections = await query(
      'SELECT * FROM website_sections WHERE page = ? AND is_visible = 1 ORDER BY sort_order ASC',
      [page]
    );
    const parsed = (sections as any[]).map(s => ({
      ...s,
      content: typeof s.content === 'string' ? JSON.parse(s.content) : s.content,
    }));
    res.json({ sections: parsed });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch sections' });
  }
});

// ── Admin: get ALL sections for a page (including hidden) ─────────────────────
router.get('/admin/sections/:page', authenticateToken, adminOnly, async (req: any, res: Response) => {
  try {
    const { page } = req.params;
    await ensureRequiredSections(page);
    const sections = await query(
      'SELECT * FROM website_sections WHERE page = ? ORDER BY sort_order ASC',
      [page]
    );
    const parsed = (sections as any[]).map(s => ({
      ...s,
      content: typeof s.content === 'string' ? JSON.parse(s.content) : s.content,
    }));
    res.json({ sections: parsed });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch sections' });
  }
});

// ── Admin: create section ─────────────────────────────────────────────────────
router.post('/admin/sections', authenticateToken, adminOnly, async (req: any, res: Response) => {
  const { page, type, label, content, sort_order } = req.body;
  if (!page || !type || !label) return res.status(400).json({ message: 'page, type, label required' });
  try {
    const maxOrder: any = await get('SELECT MAX(sort_order) as max FROM website_sections WHERE page = ?', [page]);
    const order = sort_order ?? ((maxOrder?.max || 0) + 1);
    const { insertId } = await run(
      'INSERT INTO website_sections (page, type, label, content, sort_order) VALUES (?,?,?,?,?)',
      [page, type, label, JSON.stringify(content || {}), order]
    );
    const section: any = await get('SELECT * FROM website_sections WHERE id = ?', [insertId]);
    res.json({ section: { ...section, content: JSON.parse(section.content) } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create section' });
  }
});

// ── Admin: update section content ─────────────────────────────────────────────
router.put('/admin/sections/:id', authenticateToken, adminOnly, async (req: any, res: Response) => {
  const { id } = req.params;
  const { label, content, is_visible, sort_order, type } = req.body;
  try {
    const fields: string[] = [];
    const values: any[] = [];
    if (label !== undefined)      { fields.push('label = ?');      values.push(label); }
    if (content !== undefined)    { fields.push('content = ?');    values.push(JSON.stringify(content)); }
    if (is_visible !== undefined) { fields.push('is_visible = ?'); values.push(is_visible ? 1 : 0); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(sort_order); }
    if (type !== undefined)       { fields.push('type = ?');       values.push(type); }
    if (fields.length === 0) return res.status(400).json({ message: 'No fields' });
    values.push(id);
    await run(`UPDATE website_sections SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
    const updated: any = await get('SELECT * FROM website_sections WHERE id = ?', [id]);
    res.json({ section: { ...updated, content: typeof updated.content === 'string' ? JSON.parse(updated.content) : updated.content } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update section' });
  }
});

// ── Admin: reorder sections ───────────────────────────────────────────────────
router.post('/admin/sections/reorder', authenticateToken, adminOnly, async (req: any, res: Response) => {
  const { orders } = req.body; // [{ id, sort_order }]
  if (!Array.isArray(orders)) return res.status(400).json({ message: 'orders array required' });
  try {
    for (const { id, sort_order } of orders) {
      await run('UPDATE website_sections SET sort_order = ? WHERE id = ?', [sort_order, id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reorder' });
  }
});

// ── Admin: delete section ─────────────────────────────────────────────────────
router.delete('/admin/sections/:id', authenticateToken, adminOnly, async (req: any, res: Response) => {
  try {
    await run('DELETE FROM website_sections WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete section' });
  }
});

// ── Admin: upload image for section ──────────────────────────────────────────
router.post('/admin/upload-image', authenticateToken, adminOnly, upload.single('image'), optimizeImage(), async (req: any, res: Response) => {
  if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
  res.json({ url: await uploadToR2(req.file, 'cms') });
});

export default router;

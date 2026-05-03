import { run, get } from './config/database.js';

/**
 * Seed the website CMS with baseline content.
 *
 * IMPORTANT: every text field has both an English (`field`) and an Arabic
 * (`field_ar`) variant. The website renderer prefers the language-matched
 * variant; without `_ar` populated, Arabic visitors see English text. This
 * is the root cause of the "many Arabic translations missing" report.
 *
 * NON-DESTRUCTIVE: previous version ran `DELETE FROM website_sections WHERE
 * page='home'/'about'` which would wipe any admin customisation in
 * production. We now check whether a (page, type) row already exists and
 * skip it if so. Pass `--force` to re-seed everything (dev only).
 */
const FORCE_RESEED = process.argv.includes('--force');

async function upsert(page: string, type: string, label: string, content: any, sortOrder: number) {
  const existing = await get<any>(
    'SELECT id FROM website_sections WHERE page = ? AND type = ? LIMIT 1',
    [page, type],
  );
  if (existing && !FORCE_RESEED) {
    console.log(`  · skip ${page}/${type} (already exists; pass --force to overwrite)`);
    return;
  }
  if (existing && FORCE_RESEED) {
    await run('DELETE FROM website_sections WHERE id = ?', [existing.id]);
  }
  await run(
    'INSERT INTO website_sections (page, type, label, content, sort_order) VALUES (?, ?, ?, ?, ?)',
    [page, type, label, JSON.stringify(content), sortOrder],
  );
  console.log(`  · seeded ${page}/${type}`);
}

async function seedCms() {
  if (FORCE_RESEED) {
    console.warn('⚠️  --force flag set: existing website_sections rows for home + about WILL be overwritten.');
  } else {
    console.log('Seeding only sections that do not already exist (use --force to re-seed everything).');
  }

  // ── HOME ────────────────────────────────────────────────────────────────
  const heroContent = {
    badge: "#1 fitness platform in egypt",
    badge_ar: "منصة لياقة #١ في مصر",
    heading: "Your fitness.",
    heading_ar: "لياقتك.",
    headingAccent: "Your way.",
    headingAccent_ar: "بطريقتك.",
    subheading: "A complete fitness platform combining certified workouts, smart analytics, and real coaches — all in one app.",
    subheading_ar: "منصة لياقة متكاملة تجمع التمارين المعتمدة، التحليلات الذكية، وكوتشات حقيقيين — كل ده في تطبيق واحد.",
    primaryBtnText: "Get Started Free",
    primaryBtnText_ar: "ابدأ مجاناً",
    primaryBtnLink: "/auth/register",
    secondaryBtnText: "Learn More",
    secondaryBtnText_ar: "اعرف أكتر",
    secondaryBtnLink: "/about",
    // Per-theme background images: admins upload these from /admin/website.
    backgroundImage: "",
    backgroundImageDark: "",
    backgroundImageLight: "",
  };
  await upsert('home', 'hero', 'Hero Section', heroContent, 1);

  const featuresContent = {
    sectionLabel: "What We Offer",
    sectionLabel_ar: "المميزات",
    heading: "Everything you need in one app.",
    heading_ar: "كل اللي محتاجه في تطبيق واحد.",
    intro: "Workouts, certified coaches, smart analytics, community — all in one place.",
    intro_ar: "من التمارين للكوتشات للتحليلات والمجتمع — كل أدواتك في مكان واحد.",
    items: [
      { icon: "Dumbbell", title: "Workouts",
        title_ar: "التمارين",
        desc: "Video-guided programs for every level with progress tracking and form tips.",
        desc_ar: "برامج بالفيديو لكل المستويات مع تتبع التقدم ونصائح الأداء.",
        imageUrl: "" },
      { icon: "Users", title: "Customized Coaching",
        title_ar: "كوتشينج مخصص",
        desc: "Plans built for your body, goals, and schedule by certified human coaches — no generic templates.",
        desc_ar: "خطط مبنية على جسمك وأهدافك وجدولك من كوتشات معتمدين — مفيش قوالب عامة.",
        imageUrl: "" },
      { icon: "BarChart", title: "Smart Analytics",
        title_ar: "تحليلات ذكية",
        desc: "Visual dashboards track every step, calorie, and personal milestone in real time.",
        desc_ar: "لوحات بصرية تتابع كل خطوة وسعرة حرارية وإنجاز شخصي لحظة بلحظة.",
        imageUrl: "" },
      { icon: "MessageCircle", title: "Community & Challenges",
        title_ar: "المجتمع والتحديات",
        desc: "Share progress, join challenges, and stay motivated with thousands of members.",
        desc_ar: "شارك تقدمك، انضم للتحديات، وابقَ متحمساً مع آلاف الأعضاء.",
        imageUrl: "" },
    ],
  };
  await upsert('home', 'features', 'Features Section', featuresContent, 2);

  // Real Results — bilingual testimonials with placeholder profile photos.
  const testimonialsContent = {
    sectionLabel: "Real Results",
    sectionLabel_ar: "نتائج حقيقية",
    heading: "Real people. Real transformations.",
    heading_ar: "أشخاص حقيقيون. تحوّلات مذهلة.",
    items: [
      { name: "Ahmed M.", name_ar: "أحمد محمد",
        meta: "−15kg · 3 months", meta_ar: "−15 كجم · 3 شهور",
        quote: "Completely changed my life. My coach helped me lose 15kg in 3 months.",
        quote_ar: "غيّر حياتي بشكل كامل. الكوتش ساعدني أنزل ١٥ كيلو في ٣ شهور.",
        imageUrl: "https://randomuser.me/api/portraits/men/32.jpg" },
      { name: "Sara A.", name_ar: "سارة أحمد",
        meta: "5★ review", meta_ar: "تقييم 5 نجوم",
        quote: "Best fitness app I've used. The analytics and tracking are unmatched.",
        quote_ar: "أفضل تطبيق لياقة استخدمته. التحليلات والمتابعة مش موجودة في أي تطبيق تاني.",
        imageUrl: "https://randomuser.me/api/portraits/women/44.jpg" },
      { name: "Omar K.", name_ar: "عمر خالد",
        meta: "Custom plan", meta_ar: "خطة مخصصة",
        quote: "The certified coaches really know their stuff. A plan built for me and incredible results.",
        quote_ar: "الكوتشات المعتمدين عندهم خبرة حقيقية. خطة مخصصة لي ونتائج خرافية.",
        imageUrl: "https://randomuser.me/api/portraits/men/67.jpg" },
    ],
  };
  await upsert('home', 'testimonials', 'Testimonials Section', testimonialsContent, 3);

  // ── ABOUT ───────────────────────────────────────────────────────────────
  const aboutHero = {
    badge: "— Who We Are",
    badge_ar: "— من نحن",
    heading: "Building Egypt's fittest generation.",
    heading_ar: "نبني أفضل جيل رياضي في العالم العربي.",
    headingAccent: "",
    headingAccent_ar: "",
    subheading: "Fitway Hub is a complete digital fitness ecosystem combining certified training, smart analytics, and real human coaching — all in one app.",
    subheading_ar: "فيت واي هاب منصة لياقة رقمية متكاملة تجمع التدريب المعتمد، التحليلات الذكية، وكوتشات حقيقيين — كل ذلك في تطبيق واحد.",
    primaryBtnText: "Start Free Today",
    primaryBtnText_ar: "ابدأ مجاناً",
    primaryBtnLink: "/auth/register",
    secondaryBtnText: "Read the Blog",
    secondaryBtnText_ar: "اقرأ المدونة",
    secondaryBtnLink: "/blogs",
  };
  await upsert('about', 'hero', 'About Hero', aboutHero, 1);

  const aboutFeatures = {
    sectionLabel: "Features",
    sectionLabel_ar: "الميزات",
    heading: "Everything in one place.",
    heading_ar: "كل اللي محتاجه في مكان واحد.",
    intro: "",
    intro_ar: "",
    items: [
      { icon: "Dumbbell", title: "Certified Programs", title_ar: "برامج معتمدة",
        desc: "Structured workouts for all levels — from beginner to advanced athlete.",
        desc_ar: "تمارين منظّمة لكل المستويات — من المبتدئ للرياضي المحترف.", imageUrl: "" },
      { icon: "Users", title: "Certified Human Coaches", title_ar: "كوتشات بشريين معتمدين",
        desc: "Real certified coaches — not bots — build plans tailored to your body, goals, and schedule.",
        desc_ar: "كوتشات حقيقيين معتمدين — مش بوتات — بيبنوا خطط حسب جسمك وأهدافك وجدولك.", imageUrl: "" },
      { icon: "BarChart", title: "Smart Analytics", title_ar: "تحليلات ذكية",
        desc: "Visual dashboards track every step, calorie, and personal milestone.",
        desc_ar: "لوحات بصرية بتتابع كل خطوة وسعرة حرارية ومعلم شخصي.", imageUrl: "" },
      { icon: "Bell", title: "Smart Reminders", title_ar: "تذكيرات ذكية",
        desc: "Nudges that keep you consistent without being annoying.",
        desc_ar: "إشعارات بتخليك ملتزم من غير ما تكون مزعجة.", imageUrl: "" },
      { icon: "Globe", title: "Fully Bilingual", title_ar: "ثنائي اللغة بالكامل",
        desc: "Every screen available in Arabic and English — built for Egypt, open to the world.",
        desc_ar: "كل شاشة متاحة بالعربي والإنجليزي — مصمم لمصر، مفتوح للعالم.", imageUrl: "" },
    ],
  };
  await upsert('about', 'features', 'About Features', aboutFeatures, 2);

  const aboutTeam = {
    sectionLabel: "WHO WE ARE",
    sectionLabel_ar: "من نحن",
    heading: "Meet the Team",
    heading_ar: "تعرف على الفريق",
    subheading: "Built by fitness lovers.",
    subheading_ar: "بُني بواسطة عشاق اللياقة.",
    members: [
      { name: "Ahmed Hassan", name_ar: "أحمد حسن",
        role: "CEO & Co-Founder", role_ar: "الرئيس التنفيذي والمؤسس",
        bio: "Former national athlete turned entrepreneur. Years of experience transforming the Egyptian fitness scene.",
        bio_ar: "رياضي قومي سابق تحوّل لرائد أعمال. سنين خبرة في تحويل المشهد الرياضي المصري.",
        imageUrl: "", linkedin: "", twitter: "", instagram: "" },
      { name: "Sara Mostafa", name_ar: "سارة مصطفى",
        role: "Head of Coaching", role_ar: "رئيسة قسم الكوتشينج",
        bio: "Certified trainer and nutritionist with hundreds of coached clients across Egypt and the Gulf.",
        bio_ar: "مدربة وأخصائية تغذية معتمدة دربت مئات العملاء عبر مصر والخليج.",
        imageUrl: "", linkedin: "", twitter: "", instagram: "" },
      { name: "Omar Khalid", name_ar: "عمر خالد",
        role: "CTO", role_ar: "المدير التقني",
        bio: "Full-stack engineer who believes the best tech is the kind you don't notice.",
        bio_ar: "مهندس برمجيات بيؤمن إن أفضل تكنولوجيا هي اللي مش بتحس بيها.",
        imageUrl: "", linkedin: "", twitter: "", instagram: "" },
      { name: "Mona Adel", name_ar: "منى عادل",
        role: "Head of Community", role_ar: "رئيسة المجتمع",
        bio: "Community builder, wellness advocate, and the person making sure every member feels seen.",
        bio_ar: "بناء المجتمع، رفيقة العافية، والشخص اللي بيتأكد إن كل عضو شاعر إنه مرئي.",
        imageUrl: "", linkedin: "", twitter: "", instagram: "" },
    ],
  };
  await upsert('about', 'team', 'About Team', aboutTeam, 3);

  // Stats descriptions (used as `label`/`label_ar` per item — numbers come
  // live from /api/public/stats so we don't seed `value`).
  const statsContent = {
    items: [
      { value: "10K+",  label: "Active members training across the platform every week.", label_ar: "عضو نشط يتدرب على المنصة كل أسبوع." },
      { value: "50+",   label: "Vetted certified coaches with verified credentials.",      label_ar: "كوتش معتمد بشهادات موثقة." },
      { value: "500+",  label: "Ready-made training programs to follow.",                  label_ar: "برنامج تدريب جاهز للمتابعة." },
      { value: "4.9/5", label: "App rating from athletes who trained with us.",            label_ar: "تقييم التطبيق من المستخدمين." },
    ],
  };
  await upsert('home', 'stats', 'Stats Section', statsContent, 4);

  // Trust badges (4 small rows under the hero).
  const trustContent = {
    items: [
      { icon: "Shield",     label: "Encrypted Data",  label_ar: "بيانات مشفرة" },
      { icon: "Zap",        label: "Lightning Fast",  label_ar: "سريع وخفيف" },
      { icon: "Smartphone", label: "iOS & Android",   label_ar: "iOS و Android" },
      { icon: "Heart",      label: "Free to Start",   label_ar: "مجاني للبدء" },
    ],
  };
  await upsert('home', 'trust', 'Trust Indicators', trustContent, 5);

  // How It Works steps.
  const stepsContent = {
    sectionLabel: "How It Works",
    sectionLabel_ar: "كيف يعمل",
    heading: "Start in 4 simple steps.",
    heading_ar: "ابدأ في ٤ خطوات بسيطة.",
    items: [
      { step: "01", icon: "Smartphone", title: "Create Account",          title_ar: "سجّل حسابك",
        desc: "Sign up free in seconds and pick your goal.",
        desc_ar: "سجّل مجاناً في ثواني واختار هدفك." },
      { step: "02", icon: "Users",      title: "Search & Choose a Coach", title_ar: "ابحث واختر كوتش",
        desc: "Browse certified coaches and pick the one that fits your goal and budget.",
        desc_ar: "تصفح الكوتشات المعتمدين واختر اللي يناسب هدفك وميزانيتك." },
      { step: "03", icon: "Activity",   title: "Start Training",          title_ar: "ابدأ التمرين",
        desc: "Follow your coach's personalised plan or the guided workouts in the app.",
        desc_ar: "اتبع خطتك المخصصة من كوتشك أو التمارين الجاهزة في التطبيق." },
      { step: "04", icon: "BarChart",   title: "Track Progress",          title_ar: "تابع تقدمك",
        desc: "See your growth with analytics and share your milestones with the community.",
        desc_ar: "شوف تطورك بالأرقام والتحليلات وشارك إنجازاتك مع المجتمع." },
    ],
  };
  await upsert('home', 'steps', 'How It Works', stepsContent, 6);

  // Marquee scrolling words (comma-separated).
  const marqueeContent = {
    words:    "Train Hard, Recover Smart, Break Limits, Build Strength, Stay Consistent, Get Stronger",
    words_ar: "تدرّب, تعافى, اكسر حدودك, ابني عضلاتك, ابقى ثابت, اقوى كل يوم",
  };
  await upsert('home', 'marquee', 'Marquee Words', marqueeContent, 7);

  // ── ABOUT extras: values + timeline ─────────────────────────────────────
  const aboutValues = {
    sectionLabel: "Our Values",
    sectionLabel_ar: "قيمنا",
    heading: "What we stand for.",
    heading_ar: "ما يهمنا.",
    items: [
      { icon: "Heart",  title: "Human First",       title_ar: "الإنسان أولاً",
        desc: "Every feature is built around real people, not metrics. We listen to our community.",
        desc_ar: "كل ميزة بنبنيها مصممة حوالين الناس الحقيقيين، مش الأرقام. بنسمع لمجتمعنا." },
      { icon: "Target", title: "Science-Based",     title_ar: "مبني على العلم",
        desc: "Every workout, meal plan, and insight is backed by research and reviewed by certified professionals.",
        desc_ar: "كل تمرين وخطة غذاء ورؤية مدعومة ببحث ومراجعة من متخصصين معتمدين." },
      { icon: "Zap",    title: "Accessible to All", title_ar: "متاح للجميع",
        desc: "Fitness shouldn't be a privilege. We built affordable plans for every budget and experience level.",
        desc_ar: "اللياقة مش رفاهية. بنبني خطط مناسبة لكل ميزانية ومستوى خبرة." },
      { icon: "Trophy", title: "Results-Driven",    title_ar: "يهتم بالنتائج",
        desc: "We obsess over your progress. Real coaches, real accountability, real transformations.",
        desc_ar: "بنركّز على تقدمك. كوتشات حقيقيين، التزام حقيقي، تحولات حقيقية." },
    ],
  };
  await upsert('about', 'values', 'About Values', aboutValues, 4);

  const aboutTimeline = {
    sectionLabel: "Our Journey",
    sectionLabel_ar: "رحلتنا",
    heading: "From idea to platform.",
    heading_ar: "من فكرة إلى منصة.",
    items: [
      { year: "2022", title: "The Idea",     title_ar: "الفكرة",
        desc: "Two friends frustrated with overpriced gyms and generic apps decided to build something better.",
        desc_ar: "اتنين أصحاب زهقوا من أسعار الجيمات والتطبيقات العامة وقرروا يبنوا حاجة أحسن." },
      { year: "2023", title: "First Launch", title_ar: "أول إطلاق",
        desc: "FitWay Hub launched with its founding members and coaches. The waitlist grew rapidly.",
        desc_ar: "فيت واي هاب أطلق بأعضائه وكوتشاته المؤسسين. قائمة الانتظار كبرت بسرعة." },
      { year: "2024", title: "Growing Fast", title_ar: "نمو سريع",
        desc: "Scaled the member base, onboarded more certified coaches, and launched live video coaching sessions.",
        desc_ar: "وسعنا قاعدة الأعضاء، ضمينا كوتشات معتمدين أكتر، وأطلقنا جلسات الكوتشينج الحي بالفيديو." },
      { year: "2025", title: "Expanding",    title_ar: "التوسع",
        desc: "Growing active member community. Expanding across North Africa and the Arab world.",
        desc_ar: "مجتمع نشط متنامي. توسع عبر شمال إفريقيا والعالم العربي." },
    ],
  };
  await upsert('about', 'timeline', 'About Timeline', aboutTimeline, 5);

  console.log("CMS sections seeded successfully (home + about, EN + AR).");
  process.exit(0);
}

seedCms().catch(console.error);

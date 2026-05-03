// Rich seed — run with: npm run seed
import { run, query, get } from './config/database';
import bcrypt from 'bcryptjs';
import { initDatabase } from './config/database';

// ── Data pools ────────────────────────────────────────────────────────────────

const MALE_NAMES   = ['Ahmed Hassan','Omar Khalid','Youssef Ibrahim','Karim Mostafa','Tarek Nabil','Mohamed Farouk','Amir Saleh','Ziad Tamer','Sherif Adel','Hossam Wael'];
const FEMALE_NAMES = ['Nour El-Din','Sara Ahmed','Hana Mostafa','Rana Khalil','Dina Fawzy','Maya Ibrahim','Laila Hassan','Yasmine Tarek','Mariam Sayed','Reem Nabil'];
const COACH_NAMES  = ['Coach Ali Mahmoud','Coach Sara Fitness','Coach Mona Health','Coach Khaled Power'];
const SPECIALTIES  = ['Strength & Conditioning','HIIT & Weight Loss','Yoga & Mobility','Nutrition & Fitness','Cardio & Endurance'];
const EGYPTIAN_CITIES = ['Cairo','Giza','Alexandria','Hurghada','Sharm El Sheikh','Luxor','Aswan','Mansoura','Tanta'];

function fakeEmail(name: string, i: number): string {
  const clean = name.toLowerCase().replace(/[^a-z]/g,'').slice(0,8);
  const domains = ['gmail.com','yahoo.com','hotmail.com','outlook.com'];
  return `fake.${clean}${i}@${domains[i%domains.length]}`;
}

function daysAgo(n: number): Date { return new Date(Date.now() - n * 86400000); }
function daysAgoStr(n: number): string { return daysAgo(n).toISOString().split('T')[0]; }
function randInt(min: number, max: number): number { return Math.floor(Math.random()*(max-min+1))+min; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random()*arr.length)]; }

// Age → DOB string
function dobFromAge(ageYears: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - ageYears);
  return d.toISOString().split('T')[0];
}

// ── Post content pools ─────────────────────────────────────────────────────────

const USER_POST_BODIES = [
  'Just crushed a new personal record today 💪 Hard work pays off!',
  'Morning workout done before sunrise. This is the lifestyle 🌅',
  'Week 3 of my program and I can already see the changes! @FitWayHub',
  'Rest day vibes 🧘 Recovery is just as important as training.',
  'Anyone else addicted to the post-workout feeling? Best natural high.',
  'Meal prepped for the whole week 🍱 Preparation is key to success.',
  'Hit 10,000 steps before noon! That\'s a new record for me 🏃',
  'Finally did my first pull-up! Months of work for that one moment 🙌',
  'Consistency > intensity. Show up even when you don\'t feel like it.',
  'New program starting tomorrow. Nervous and excited 🔥',
  'My coach changed my life. I\'ve lost 12kg in 3 months!',
  'The gym is my therapy 💙 Whatever is going on outside — in here I\'m free.',
  'Down 5kg in 6 weeks. Slow and steady wins the race 🐢',
  'Skipped the elevator all week. Every step counts!',
  'Protein shake + a good sleep = best recovery combo 💤',
  'First time doing HIIT — I thought I was going to die but I survived 😂',
  'Never miss a Monday. Never. 💯',
  'Ate clean for 30 days and the difference is unbelievable ✨',
  'My friend laughed when I joined FitWay. Now she\'s asking me for advice 😏',
  'Progress photo update: still a long way to go but I\'m proud of how far I\'ve come.',
];

const COMMENT_BODIES = [
  'Keep it up! 🔥', 'This is so inspiring!', 'Amazing progress!',
  'You\'re crushing it 💪', 'I needed this motivation today, thanks!',
  'Same here! The consistency is key.', 'Goals! 🎯',
  'How long did it take you?', 'What program are you on?',
  'This community is everything ❤️', 'Let\'s go! 🚀',
  'I felt that 😂', 'Proud of you!', 'Keep grinding!',
];

const COACH_POST_BODIES = [
  '💡 Coaching tip: You don\'t need to train 2 hours a day. 45 focused minutes beats 2 hours of distracted training every time.',
  '🥗 Nutrition myth busted: You don\'t need to eat clean 100% of the time. 80/20 rule is sustainable and effective.',
  '📊 Tracking your food for just 2 weeks will completely change how you understand your eating habits. Try it.',
  '🏋️ Progressive overload is the #1 driver of muscle growth. Add weight, reps, or sets every single week.',
  '💤 If your progress has stalled, check your sleep first. Everything else comes second.',
  '🔥 New spots open for online coaching this month! DM me to claim yours. 20 users already transformed this year.',
  '📱 Swipe to see my client\'s 12-week transformation. This is what consistent coaching looks like 👉',
  '⚡ Reminder: rest days are not lazy days. They\'re growth days.',
  '🎯 Your body is a long-term project, not a 30-day challenge. Treat it accordingly.',
  '💬 The most common question I get: "How long until I see results?" Honest answer: 4 weeks to feel it, 8 weeks to see it, 12 weeks for others to notice.',
];

// ── Blog content ──────────────────────────────────────────────────────────────

const BLOGS = [
  {
    title: '10 Science-Backed Ways to Burn Fat Faster',
    slug: '10-ways-burn-fat-faster',
    excerpt: 'Discover the most effective, research-proven strategies to accelerate fat loss without sacrificing muscle.',
    content: `## The Science of Fat Loss\n\nFat loss isn't about starving yourself — it's about creating the right hormonal environment. Here are 10 proven strategies:\n\n### 1. Prioritize Protein\nEating 1.6–2.2g of protein per kg of bodyweight preserves muscle while in a caloric deficit.\n\n### 2. Strength Train 3–4x Per Week\nResistance training builds muscle, which raises your resting metabolic rate.\n\n### 3. Sleep 7–9 Hours\nSleep deprivation raises cortisol and ghrelin (hunger hormone) by up to 24%.\n\n### 4. Time-Restricted Eating\nEating within an 8–10 hour window improves insulin sensitivity.\n\n### 5. Walk 8,000–10,000 Steps Daily\nNEAT accounts for 15–30% of total daily energy expenditure.\n\n### 6. Avoid Liquid Calories\nSodas, juices, and alcohol add hundreds of calories without triggering satiety.\n\n### 7. Manage Stress\nChronic stress elevates cortisol, promoting fat storage around the abdomen.\n\n### 8. Stay Hydrated\nDrinking 500ml of water before meals reduces caloric intake by up to 13%.\n\n### 9. Track Your Food\nPeople who track food lose 2–3x more weight than those who don't.\n\n### 10. Be Consistent Over Perfect\nThe best diet is the one you can maintain.`,
    category: 'weight_loss',
  },
  {
    title: 'The Complete Beginner\'s Guide to Building Muscle',
    slug: 'beginners-guide-building-muscle',
    excerpt: 'Everything you need to know to start gaining lean muscle mass — training, nutrition, and recovery.',
    content: `## Building Muscle: The Fundamentals\n\nBuilding muscle is simpler than the fitness industry wants you to believe. Three pillars: **Progressive Overload**, **Sufficient Protein**, and **Recovery**.\n\n### Progressive Overload\nYour muscles grow when you consistently challenge them with more than they're used to.\n\n### Training Split for Beginners\n- **Monday**: Push (Chest, Shoulders, Triceps)\n- **Wednesday**: Pull (Back, Biceps)\n- **Friday**: Legs (Quads, Hamstrings, Glutes, Calves)\n\n### Nutrition for Muscle Gain\nEat at a 200–300 calorie surplus. Consume 1.8–2.2g protein/kg bodyweight.\n\n### Recovery\nMuscles grow outside the gym. Sleep 7–9 hours, manage stress.`,
    category: 'muscle_building',
  },
  {
    title: 'How to Run Your First 5K in 8 Weeks',
    slug: 'run-first-5k-8-weeks',
    excerpt: 'A complete 8-week couch-to-5K training plan that works for absolute beginners.',
    content: `## From Couch to 5K\n\n### Week 1–2: Build the Habit\nRun/walk intervals: 1 min run, 2 min walk × 8 rounds. 3x per week.\n\n### Week 3–4: Extend the Running\n2 min run, 1 min walk × 8 rounds.\n\n### Week 5–6: Continuous Running\n20 minute continuous jog at a conversational pace.\n\n### Week 7–8: Race Preparation\n25–30 minute continuous run.`,
    category: 'cardio',
  },
  {
    title: 'The Truth About Intermittent Fasting',
    slug: 'truth-about-intermittent-fasting',
    excerpt: 'Does intermittent fasting actually work? We break down the science.',
    content: `## Intermittent Fasting: What the Research Shows\n\nIF is primarily a calorie restriction tool. Studies show no significant difference in fat loss vs continuous restriction when calories are matched.\n\n### Popular IF Protocols\n- **16:8** — Fast 16 hours, eat in an 8-hour window\n- **5:2** — Eat normally 5 days, restrict to 500 cal on 2 days\n\n### The Bottom Line\nIF works when it helps you maintain a caloric deficit. It's a scheduling tool, not magic.`,
    category: 'nutrition',
  },
  {
    title: '5 Yoga Poses That Undo a Day at the Desk',
    slug: 'yoga-poses-desk-workers',
    excerpt: 'These five poses target the exact muscles that tighten from sitting all day.',
    content: `## Desk Worker\'s Essential Yoga Routine\n\n### 1. Cat-Cow\nRestores spinal mobility lost from sitting. 10 repetitions.\n\n### 2. Hip Flexor Lunge\nHold 30–60 seconds each side.\n\n### 3. Doorframe Chest Opener\nCounteracts forward shoulder rounding. Hold 30 seconds.\n\n### 4. Seated Spinal Twist\nHold 30 seconds each side.\n\n### 5. Legs Up the Wall\n5–10 minutes. Reduces lower back pressure.`,
    category: 'flexibility',
  },
  {
    title: 'Creatine: The Most Researched Supplement',
    slug: 'creatine-complete-guide',
    excerpt: 'Creatine is safe, effective, and backed by decades of research.',
    content: `## Creatine: Evidence-Based Guide\n\nOver 500 peer-reviewed studies support creatine monohydrate as the most well-researched performance supplement.\n\n### Proven Benefits\n- 5–15% increase in strength and power\n- Increased lean muscle mass\n- Improved high-intensity performance\n\n### Dosing\n**Maintenance:** 3–5g daily. Timing doesn't matter much.\n\n### Safety\nDecades of research show no adverse effects in healthy individuals.`,
    category: 'supplements',
  },
  {
    title: 'Why You\'re Not Losing Weight (And How to Fix It)',
    slug: 'why-not-losing-weight-fix',
    excerpt: 'Stuck at a plateau? These are the most common reasons weight loss stalls.',
    content: `## Breaking Through a Weight Loss Plateau\n\n### Reason 1: Underestimating Calories\nPeople underestimate caloric intake by 20–50%. Weigh your food for one week.\n\n### Reason 2: Metabolic Adaptation\nAfter weeks in a deficit, your body reduces metabolic rate. Take a 1–2 week diet break.\n\n### Reason 3: Too Much Cardio\nExcessive cardio without strength training leads to muscle loss.\n\n### Reason 4: Stress and Sleep\nHigh cortisol impairs fat oxidation. Fix sleep before anything else.`,
    category: 'weight_loss',
  },
  {
    title: 'Sleep: The Most Underrated Performance Enhancer',
    slug: 'sleep-performance-enhancer',
    excerpt: 'Sleep is where gains are actually made.',
    content: `## Why Sleep is Your #1 Performance Tool\n\n### What Happens During Sleep\n- Growth hormone peaks — muscle repair primarily occurs here\n- Cortisol resets\n- Motor patterns are cemented\n\n### Sleep Requirements\n- Sedentary adults: 7–8 hours\n- Regular exercisers: 8–9 hours\n\n### Practical Tips\n1. Consistent schedule — same bedtime and wake time\n2. Cool room — 18–20°C is optimal\n3. No screens 1 hour before bed\n4. No caffeine after 2pm`,
    category: 'recovery',
  },
];

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  await initDatabase();
  const today = new Date().toISOString().split('T')[0];

  // Clear everything
  await run('SET FOREIGN_KEY_CHECKS=0');
  for (const t of ['post_comments','post_likes','challenge_participants','challenges','posts','messages','daily_summaries','steps_entries','premium_sessions','coach_subscriptions','withdrawal_requests','payments','credit_transactions','coaching_meetings','coach_ads','blog_posts','users']) {
    try { await run(`DELETE FROM ${t}`); } catch {}
  }
  await run('SET FOREIGN_KEY_CHECKS=1');

  const hash = async (pw: string) => bcrypt.hash(pw, 10);
  const adminPw = process.env.SEED_ADMIN_PASSWORD || 'AdminPass!2025';
  const coachPw = process.env.SEED_COACH_PASSWORD || 'CoachPass!2025';
  const userPw  = process.env.SEED_USER_PASSWORD  || 'UserPass!2025';
  const fakeH   = await hash('FakePass!2025');

  // ── Admin ──────────────────────────────────────────────────────────────────
  await run(
    `INSERT INTO users (name,email,password,role,is_premium,points,steps,gender,height,weight) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ['Peter Admin','peteradmin@example.com', await hash(adminPw),'admin',0,9999,0,'male',178,80]
  );

  // ── Coaches ────────────────────────────────────────────────────────────────
  const coachIds: number[] = [];
  const coachGenders = ['male','male','female','male'];
  for (let i = 0; i < COACH_NAMES.length; i++) {
    const name = COACH_NAMES[i];
    const sp   = SPECIALTIES[i % SPECIALTIES.length];
    const g    = coachGenders[i];
    const age  = randInt(28, 42);
    const h    = g === 'male' ? randInt(172, 185) : randInt(160, 172);
    const w    = g === 'male' ? randInt(72, 90) : randInt(55, 68);
    const { insertId: cId } = await run(
      `INSERT INTO users (name,email,password,role,is_premium,points,steps,gender,height,weight,
        date_of_birth,target_weight,weekly_goal,fitness_goal,activity_level,onboarding_done,
        avg_daily_steps,streak_days,coach_membership_active,credit,email_verified)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, fakeEmail(name,100+i), i===0 ? await hash(coachPw) : fakeH, 'coach', 1,
       randInt(500,3000), randInt(6000,15000), g, h, w,
       dobFromAge(age), w - randInt(2,8), pick(['0.25','0.5']),
       'maintain_weight', 'active', 1,
       randInt(7000, 13000), randInt(10, 60),
       1, randInt(400, 2500), 1]
    );
    coachIds.push(cId);

    // Insert coaching profile
    try {
      await run(
        `INSERT INTO coach_profiles (user_id, bio, specialty, location, available, plan_types, monthly_price, yearly_price)
         VALUES (?,?,?,?,?,?,?,?)`,
        [cId,
         `Certified ${sp} coach with ${randInt(3,10)}+ years of experience. I've helped ${randInt(50,200)}+ clients achieve their fitness goals through personalized programming and consistent accountability.`,
         sp, pick(EGYPTIAN_CITIES), 1, pick(['complete','workout','complete']),
         pick([99,149,199,249]), pick([999,1499,1999,2499])]
      );
    } catch {}
  }
  const mainCoach = coachIds[0];

  console.log(`✅ Created ${coachIds.length} coaches`);

  // ── Test user (fully onboarded) ─────────────────────────────────────────────
  const { insertId: testUserId } = await run(
    `INSERT INTO users (name,email,password,role,is_premium,points,steps,gender,height,weight,
      date_of_birth,target_weight,weekly_goal,fitness_goal,activity_level,onboarding_done,
      avg_daily_steps,streak_days,step_goal,email_verified)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ['Test User','test@example.com', await hash(userPw),'user',1,
     850, 9200, 'male', 175, 83,
     dobFromAge(28), 75, '0.5',
     'lose_weight', 'moderate', 1,
     8700, 14, 10000, 1]
  );

  // ── Fake users (fully onboarded) ────────────────────────────────────────────
  const userIds: number[] = [];
  const allNames = [
    ...MALE_NAMES.map(n => ({ name: n, gender: 'male' })),
    ...FEMALE_NAMES.map(n => ({ name: n, gender: 'female' })),
  ];

  const medicalOptions = [
    '', '', '', '', // most people have none
    'Mild asthma — avoid extreme cardio intensity',
    'Lower back pain — avoid heavy deadlifts',
    'Knee injury (recovered) — no running',
    'Type 2 diabetes — monitor sugar during training',
    'Hypertension — keep heart rate below 150bpm',
  ];

  // Deliberately spread across all filter dimensions so audience estimates are meaningful.
  // Ages cover all brackets, goals cover all types, activities cover all levels, cities cover Egypt.
  const FITNESS_GOALS   = ['lose_weight','build_muscle','maintain_weight','gain_weight'] as const;
  const ACTIVITY_LEVELS = ['sedentary','light','moderate','active','very_active'] as const;
  // Age brackets: 18-24, 25-34, 35-44, 45-54, 55-65 — rotate through evenly
  const AGE_BRACKETS = [[18,24],[25,34],[35,44],[45,54],[55,65]] as const;

  for (let i = 0; i < allNames.length; i++) {
    const { name, gender } = allNames[i];
    const isPremium    = i % 3 === 0 ? 1 : 0;
    // Rotate deterministically so every combination is represented
    const fitnessGoal  = FITNESS_GOALS[i % FITNESS_GOALS.length];
    const activityLevel= ACTIVITY_LEVELS[i % ACTIVITY_LEVELS.length];
    const ageBracket   = AGE_BRACKETS[i % AGE_BRACKETS.length];
    const age          = randInt(ageBracket[0], ageBracket[1]);
    const city         = EGYPTIAN_CITIES[i % EGYPTIAN_CITIES.length];
    const h            = gender === 'male' ? randInt(168, 188) : randInt(155, 172);
    const w            = gender === 'male' ? randInt(65, 98) : randInt(48, 75);
    const tgtW         = fitnessGoal === 'lose_weight'
      ? w - randInt(5, 20)
      : fitnessGoal === 'gain_weight' || fitnessGoal === 'build_muscle'
      ? w + randInt(3, 12)
      : w;
    const avgSteps = randInt(4000, 13000);
    const streak   = randInt(0, 30);

    const { insertId: uId } = await run(
      `INSERT INTO users (name,email,password,role,is_premium,points,steps,gender,height,weight,
        date_of_birth,target_weight,weekly_goal,fitness_goal,activity_level,
        medical_history,onboarding_done,avg_daily_steps,streak_days,
        step_goal,last_active,email_verified,city)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, fakeEmail(name,i+1), fakeH, 'user', isPremium,
       randInt(50,2500), randInt(2000,14000), gender, h, w,
       dobFromAge(age), tgtW, pick(['0.25','0.5','0.75']),
       fitnessGoal, activityLevel,
       pick(medicalOptions), 1,
       avgSteps, streak,
       pick([8000,10000,12000,15000]),
       daysAgo(randInt(0,5)), 1,
       city]
    );
    userIds.push(uId);
  }

  console.log(`✅ Created ${userIds.length} fully-onboarded fake users`);

  // ── Steps entries (14 days) ────────────────────────────────────────────────
  for (const uid of [...userIds, testUserId]) {
    const baseSteps = randInt(4000, 12000);
    for (let d = 0; d < 14; d++) {
      // Realistic variation: weekends slightly higher, with some off days
      const isWeekend = (new Date(daysAgo(d)).getDay() % 6 === 0);
      const steps = Math.max(500, baseSteps + randInt(-2000, isWeekend ? 4000 : 2000));
      const cal   = Math.round(steps * 0.05);
      const km    = parseFloat((steps * 0.00075).toFixed(2));
      try {
        await run(
          'INSERT INTO steps_entries (user_id,date,steps,calories_burned,distance_km) VALUES (?,?,?,?,?)',
          [uid, daysAgoStr(d), steps, cal, km]
        );
      } catch {}
    }
  }

  console.log('✅ Seeded 14 days of step data per user');

  // ── Community posts ────────────────────────────────────────────────────────
  const postIds: number[] = [];

  // Every user posts 1–3 times
  for (let i = 0; i < userIds.length; i++) {
    const uid = userIds[i];
    const numPosts = randInt(1, 3);
    for (let p = 0; p < numPosts; p++) {
      const body = USER_POST_BODIES[(i * numPosts + p) % USER_POST_BODIES.length];
      const likes = randInt(2, 60);
      const { insertId: pid } = await run(
        'INSERT INTO posts (user_id,content,hashtags,likes,created_at) VALUES (?,?,?,?,?)',
        [uid, body, '#fitness #fitwayhub #health', likes, daysAgo(randInt(0, 30))]
      );
      postIds.push(pid);
    }
  }

  // Test user posts
  const { insertId: testPost1 } = await run(
    'INSERT INTO posts (user_id,content,hashtags,likes) VALUES (?,?,?,?)',
    [testUserId, 'Week 1 done! Already feeling stronger and more energetic 💪 Thanks to my FitWay coach!', '#fitnessjourney #fitwayhub', 28]
  );
  postIds.push(testPost1);

  // Coaches post tips
  for (let i = 0; i < coachIds.length; i++) {
    const cid = coachIds[i];
    const numPosts = randInt(2, 4);
    for (let p = 0; p < numPosts; p++) {
      const body = COACH_POST_BODIES[(i * numPosts + p) % COACH_POST_BODIES.length];
      const likes = randInt(15, 120);
      const { insertId: pid } = await run(
        'INSERT INTO posts (user_id,content,hashtags,likes,created_at) VALUES (?,?,?,?,?)',
        [cid, body, '#coaching #fitness #fitwayhub #Egypt', likes, daysAgo(randInt(0, 21))]
      );
      postIds.push(pid);
    }
  }

  // Add comments on posts
  const commentTargets = postIds.slice(0, Math.min(postIds.length, 20));
  for (const pid of commentTargets) {
    const numComments = randInt(1, 5);
    for (let c = 0; c < numComments; c++) {
      const commenter = pick([...userIds, ...coachIds]);
      try {
        await run(
          'INSERT INTO post_comments (post_id,user_id,content,created_at) VALUES (?,?,?,?)',
          [pid, commenter, pick(COMMENT_BODIES), daysAgo(randInt(0, 10))]
        );
      } catch {}
    }
  }

  console.log(`✅ Seeded ${postIds.length} posts with comments`);

  // ── Premium payments ───────────────────────────────────────────────────────
  const premiumUsers = userIds.filter((_,i) => i % 3 === 0);
  for (const uid of premiumUsers) {
    await run(
      'INSERT INTO payments (user_id,type,plan,amount,payment_method,status,created_at) VALUES (?,?,?,?,?,?,?)',
      [uid,'premium','monthly',50,pick(['vodafone_cash','orange_cash','paypal','paymob_card']),'completed',daysAgo(randInt(1,60))]
    );
  }
  await run('INSERT INTO payments (user_id,type,plan,amount,payment_method,status) VALUES (?,?,?,?,?,?)',
    [testUserId,'premium','monthly',50,'paymob_card','completed']);

  console.log(`✅ Seeded ${premiumUsers.length + 1} premium payments`);

  // ── Coach subscriptions ────────────────────────────────────────────────────
  const subStatuses = ['active','pending','pending_admin'];
  for (let i = 0; i < Math.min(userIds.length, 14); i++) {
    const uid = userIds[i];
    const cid = coachIds[i % coachIds.length];
    const status = subStatuses[i % subStatuses.length];
    const amount = pick([99,149,199,249]);
    try {
      await run(
        `INSERT INTO coach_subscriptions (user_id,coach_id,plan_cycle,plan_type,amount,status,admin_approval_status,coach_decision_status,payment_method,started_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [uid, cid, pick(['monthly','monthly','yearly']), pick(['complete','workout']), amount, status,
         status==='active' ? 'approved' : 'pending',
         status==='active' ? 'accepted' : 'pending',
         pick(['vodafone_cash','ewallet','paymob_card']),
         daysAgo(randInt(1,30)), daysAgo(-randInt(1,30))]
      );
      if (status === 'active') {
        const credit = amount * 0.85;
        await run('UPDATE users SET credit=credit+? WHERE id=?', [credit, cid]);
        await run('INSERT INTO credit_transactions (user_id,amount,type,description) VALUES (?,?,?,?)',
          [cid, credit, 'subscription_earning', `Subscription from user #${uid}`]);
      }
    } catch {}
  }
  try {
    await run(
      `INSERT INTO coach_subscriptions (user_id,coach_id,plan_cycle,plan_type,amount,status,admin_approval_status,coach_decision_status,payment_method) VALUES (?,?,?,?,?,?,?,?,?)`,
      [testUserId, mainCoach,'monthly','complete',149,'active','approved','accepted','paymob_card']
    );
  } catch {}

  console.log('✅ Seeded coach subscriptions');

  // ── Chat messages ──────────────────────────────────────────────────────────
  const MSG_TEMPLATES = [
    ['Hi Coach! I just subscribed. When do we start?','Welcome! Let\'s begin with an assessment. What are your main goals?','Mainly lose weight and build some muscle.','Perfect! I\'ll design a customized program. Do you have any injuries?','No injuries. Ready to work hard!','Great! Check your workout plan — I\'ve added Week 1.'],
    ['Coach, I struggled with squats today. Any form tips?','Keep your chest up and push your knees out. Slow the descent.','Should I go lighter?','Yes, master the form first. We add weight next week.'],
    ['I hit a plateau. Scale hasn\'t moved in 2 weeks.','That\'s normal. Let\'s cycle your calories — more on training days.','How much more?','Add 200 calories on your 3 training days. Same on rest days.'],
    ['Finished week 4! Progress pics look amazing 📸','You\'ve come so far! How do you feel energy-wise?','Way better than before. Sleeping better too!','That\'s the sign everything is working. Let\'s increase intensity now.'],
  ];
  for (let i = 0; i < Math.min(8, userIds.length); i++) {
    const uid = userIds[i];
    const cid = coachIds[i % coachIds.length];
    const template = MSG_TEMPLATES[i % MSG_TEMPLATES.length];
    for (let j = 0; j < template.length; j++) {
      const isCoach = j % 2 !== 0;
      await run('INSERT INTO messages (sender_id,receiver_id,content,created_at) VALUES (?,?,?,?)',
        [isCoach ? cid : uid, isCoach ? uid : cid, template[j], daysAgo(7 - j*0.5)]);
    }
  }
  for (const [msg, fromCoach] of [
    ['Hi! I\'m ready to start my coaching journey.',false],
    ['Welcome! Let me review your profile and create your plan.',true],
    ['That sounds great! Should I start with cardio or weights?',false],
    ['Let\'s start with 3 days of strength training. I\'ve added your first workout.',true],
    ['Done with Week 1! It was tough but I made it through 💪',false],
    ['Excellent! Your consistency is impressive. Week 2 is ready.',true],
  ] as [string, boolean][]) {
    await run('INSERT INTO messages (sender_id,receiver_id,content) VALUES (?,?,?)',
      [fromCoach ? mainCoach : testUserId, fromCoach ? testUserId : mainCoach, msg]);
  }

  console.log('✅ Seeded chat messages');


  // ── Ads System: Campaigns, AdSets, Ads, Creatives, Targeting, Analytics, Audit Logs ──
  // Simplified seeding that relies on migration 004 table names and columns.
  const campaignObjectives = ['coaching','awareness','traffic','engagement','bookings','announcements'];
  const adPlacements = ['feed','home_banner','community','search','profile_boost','notification','discovery'];
  const creativeTypes = ['image','video','carousel'];
  const campaignStatuses = ['draft','pending_review','active','paused','rejected','archived'];
  const adStatuses = ['active','paused','archived'];

  let totalCampaigns = 0, totalAdSets = 0, totalAds = 0, totalCreatives = 0, totalAuditLogs = 0;

  for (const cid of coachIds) {
    const numCampaigns = randInt(2,3);
    for (let i = 0; i < numCampaigns; i++) {
      const campName = `${pick(['Summer','Ramadan','Power','Yoga','Transformation','Challenge'])} ${pick(['Body','Strength','Wellness','Fat Loss','Coaching'])} ${2024 + randInt(0,2)}`;
      const objective = pick(campaignObjectives);
      const status = pick(['pending_review','active','paused']);
      const budget = randInt(500,4000);
      const start = daysAgo(randInt(10,60));
      const end = daysAgo(-randInt(1,60));

      // Insert campaign using existing columns on this DB
      const campColsRes: any = await query(`SHOW COLUMNS FROM ad_campaigns`);
      const campCols = Array.isArray(campColsRes) ? campColsRes.map((r:any) => r.Field) : [];
      const cCols: string[] = ['coach_id','name','objective','status'];
      const cVals: any[] = [cid, campName, objective, status];
      if (campCols.includes('daily_budget')) { cCols.push('daily_budget'); cVals.push(budget); }
      else if (campCols.includes('lifetime_budget')) { cCols.push('lifetime_budget'); cVals.push(budget); }
      if (campCols.includes('schedule_start')) { cCols.push('schedule_start'); cVals.push(start); }
      if (campCols.includes('schedule_end')) { cCols.push('schedule_end'); cVals.push(end); }
      if (campCols.includes('created_at')) { cCols.push('created_at'); cVals.push(start); }
      if (campCols.includes('updated_at')) { cCols.push('updated_at'); cVals.push(end); }
      const campSql = `INSERT INTO ad_campaigns (${cCols.join(',')}) VALUES (${cCols.map(_ => '?').join(',')})`;
      let campaignId: number;
      try {
        const res: any = await run(campSql, cVals);
        campaignId = res.insertId;
      } catch (err: any) {
        // Try fallback: remove 'objective' if it causes enum truncation
        try {
          const idx = cCols.indexOf('objective');
          if (idx !== -1) {
            const cols2 = cCols.slice(); const vals2 = cVals.slice();
            cols2.splice(idx,1); vals2.splice(idx,1);
            const sql2 = `INSERT INTO ad_campaigns (${cols2.join(',')}) VALUES (${cols2.map(_ => '?').join(',')})`;
            const res2: any = await run(sql2, vals2);
            campaignId = res2.insertId;
          } else {
            throw err;
          }
        } catch (err2: any) {
          // Final fallback: minimal insert (coach_id,name,created_at,updated_at)
          const res3: any = await run(
            `INSERT INTO ad_campaigns (coach_id,name,created_at,updated_at) VALUES (?,?,?,?)`,
            [cid, campName, start, end]
          );
          campaignId = res3.insertId;
        }
      }
      totalCampaigns++;

      await run(
        `INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, new_state, created_at)
         VALUES (?,?,?,?,?,?,?)`,
        [cid, 'coach', 'create', 'campaign', campaignId, JSON.stringify({ name: campName, status }), start]
      ).catch(() => {});
      totalAuditLogs++;

      const numAdSets = randInt(1,2);
      for (let s = 0; s < numAdSets; s++) {
        const adSetName = `${campName} Set ${s+1}`;
        const adSetStatus = pick(adStatuses);
        const adSetBudget = Math.round(budget / numAdSets);
        const targeting = { gender: pick(['all','male','female']), ageMin: randInt(18,30), ageMax: randInt(35,55), interests: pick([['fitness','weight_loss'],['yoga','wellness'],['running','cardio']]) };

        // Insert ad_set using existing columns on this DB
        const adSetColsRes: any = await query(`SHOW COLUMNS FROM ad_sets`);
        const adSetCols = Array.isArray(adSetColsRes) ? adSetColsRes.map((r:any) => r.Field) : [];
        const adSetColTypes: Record<string,string> = Array.isArray(adSetColsRes) ? adSetColsRes.reduce((acc:any, r:any)=>{ acc[r.Field]=r.Type; return acc; }, {}) : {};
        const asCols: string[] = ['campaign_id','name','status'];
        const asVals: any[] = [campaignId, adSetName, adSetStatus];
        if (adSetCols.includes('placement')) {
          const placementVal = adSetColTypes['placement'] && adSetColTypes['placement'].toLowerCase().includes('json') ? JSON.stringify(pick(adPlacements)) : pick(adPlacements);
          asCols.push('placement'); asVals.push(placementVal);
        }
        if (adSetCols.includes('target_gender')) { asCols.push('target_gender'); asVals.push(targeting.gender); }
        if (adSetCols.includes('target_age_min')) { asCols.push('target_age_min'); asVals.push(targeting.ageMin); }
        if (adSetCols.includes('target_age_max')) { asCols.push('target_age_max'); asVals.push(targeting.ageMax); }
        if (adSetCols.includes('target_interests')) { asCols.push('target_interests'); asVals.push(JSON.stringify(targeting.interests)); }
        if (adSetCols.includes('daily_budget')) { asCols.push('daily_budget'); asVals.push(adSetBudget); }
        if (adSetCols.includes('created_at')) { asCols.push('created_at'); asVals.push(start); }
        if (adSetCols.includes('updated_at')) { asCols.push('updated_at'); asVals.push(end); }
        const adSetSql = `INSERT INTO ad_sets (${asCols.join(',')}) VALUES (${asCols.map(_=>'?').join(',')})`;
        const { insertId: adSetId } = await run(adSetSql, asVals);
        totalAdSets++;

        await run(
          `INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, new_state, created_at)
           VALUES (?,?,?,?,?,?,?)`,
          [cid, 'coach', 'create', 'ad_set', adSetId, JSON.stringify({ name: adSetName, status: adSetStatus }), start]
        ).catch(() => {});
        totalAuditLogs++;

        const numAds = randInt(1,2);
        for (let a = 0; a < numAds; a++) {
          const adName = `${adSetName} Ad ${a+1}`;
          const adStatus = pick(adStatuses);
          const adStart = start;
          const adEnd = end;

          const creativeType = pick(creativeTypes);
          const creativeUrl = creativeType === 'image' ? `https://fitwayhub.com/assets/ads/creative${randInt(1,10)}.jpg` : `https://fitwayhub.com/assets/ads/creative${randInt(1,5)}.mp4`;
          // Insert creative using columns available in this DB schema
            try {
            const acColsRes: any = await query(`SHOW COLUMNS FROM ad_creatives`);
            console.log('ad_creatives columns raw:', JSON.stringify(acColsRes));
            const acCols = Array.isArray(acColsRes) ? acColsRes.map((r: any) => r.Field) : [];
            console.log('ad_creatives columns:', acCols.join(', '));
            const cols: string[] = [];
            const vals: any[] = [];
            if (acCols.includes('coach_id')) { cols.push('coach_id'); vals.push(cid); }
            else if (acCols.includes('owner_id')) { cols.push('owner_id'); vals.push(cid); }
            else if (acCols.includes('created_by')) { cols.push('created_by'); vals.push(cid); }
            if (acCols.includes('name')) { cols.push('name'); vals.push(`${campName} creative`); }
            if (acCols.includes('format')) { cols.push('format'); vals.push(creativeType); }
            if (acCols.includes('media_url')) { cols.push('media_url'); vals.push(creativeUrl); }
            else if (acCols.includes('url')) { cols.push('url'); vals.push(creativeUrl); }
            if (acCols.includes('thumbnail_url')) { cols.push('thumbnail_url'); vals.push(null); }
            if (acCols.includes('carousel_items')) { cols.push('carousel_items'); vals.push('[]'); }
            if (acCols.includes('created_at')) { cols.push('created_at'); vals.push(adStart); }
            if (acCols.includes('updated_at')) { cols.push('updated_at'); vals.push(adEnd); }

            let creativeId: number;
            if (cols.length > 0) {
              const sql = `INSERT INTO ad_creatives (${cols.join(',')}) VALUES (${cols.map(_=>'?').join(',')})`;
              const res: any = await run(sql, vals);
              creativeId = res.insertId;
            } else {
              // As a last resort, try minimal insert and include owner/coach if required
              const minCols: string[] = ['name', 'media_url', 'created_at'];
              const minVals: any[] = [`${campName} creative`, creativeUrl, adStart];
              if (acCols.includes('owner_id')) { minCols.unshift('owner_id'); minVals.unshift(cid); }
              else if (acCols.includes('coach_id')) { minCols.unshift('coach_id'); minVals.unshift(cid); }
              else if (acCols.includes('created_by')) { minCols.unshift('created_by'); minVals.unshift(cid); }
              const res: any = await run(
                `INSERT INTO ad_creatives (${minCols.join(',')}) VALUES (${minCols.map(_=>'?').join(',')})`,
                minVals
              );
              creativeId = res.insertId;
            }
            // expose creativeId for next insertion
            (global as any).__lastCreativeId = creativeId;
            totalCreatives++;
          } catch (e) {
            console.warn('Creative insert error:', (e as any).message);
            throw e;
          }

          const impressions = randInt(1000,20000);
          const clicks = Math.floor(impressions * (0.01 + Math.random()*0.04));
          const conversions = randInt(0, Math.max(1, Math.floor(clicks * 0.2)));
          const spent = parseFloat((adSetBudget * (0.1 + Math.random()*0.6)).toFixed(2));

          // use creativeId from previous block (compatibly set)
          const creativeIdToUse = (global as any).__lastCreativeId || null;
          // Insert ad using available columns on this DB
          const adColsRes: any = await query(`SHOW COLUMNS FROM ads`);
          const adCols = Array.isArray(adColsRes) ? adColsRes.map((r:any)=>r.Field) : [];
          const aCols: string[] = [];
          const aVals: any[] = [];
          if (adCols.includes('ad_set_id')) { aCols.push('ad_set_id'); aVals.push(adSetId); }
          if (adCols.includes('campaign_id')) { aCols.push('campaign_id'); aVals.push(campaignId); }
          if (adCols.includes('name')) { aCols.push('name'); aVals.push(adName); }
          if (adCols.includes('status')) { aCols.push('status'); aVals.push(adStatus); }
          if (adCols.includes('creative_id')) { aCols.push('creative_id'); aVals.push(creativeIdToUse); }
          if (adCols.includes('placement')) { aCols.push('placement'); aVals.push(pick(adPlacements)); }
          if (adCols.includes('impressions')) { aCols.push('impressions'); aVals.push(impressions); }
          if (adCols.includes('clicks')) { aCols.push('clicks'); aVals.push(clicks); }
          if (adCols.includes('conversions')) { aCols.push('conversions'); aVals.push(conversions); }
          if (adCols.includes('amount_spent')) { aCols.push('amount_spent'); aVals.push(spent); }
          if (adCols.includes('created_at')) { aCols.push('created_at'); aVals.push(adStart); }
          if (adCols.includes('updated_at')) { aCols.push('updated_at'); aVals.push(adEnd); }

          const { insertId: adId } = await run(
            `INSERT INTO ads (${aCols.join(',')}) VALUES (${aCols.map(_=>'?').join(',')})`,
            aVals
          );
          totalAds++;

          await run(
            `INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, new_state, created_at)
             VALUES (?,?,?,?,?,?,?)`,
            [cid, 'coach', 'create', 'ad', adId, JSON.stringify({ name: adName, status: adStatus }), adStart]
          ).catch(() => {});
          totalAuditLogs++;
        }
      }
    }
  }
  console.log(`✅ Seeded ${totalCampaigns} campaigns, ${totalAdSets} ad sets, ${totalAds} ads, ${totalCreatives} creatives, ${totalAuditLogs} audit logs for ads system`);

  // ── Blog posts ─────────────────────────────────────────────────────────────
  for (let i = 0; i < BLOGS.length; i++) {
    const blog = BLOGS[i];
    const authorId = i < 4 ? mainCoach : coachIds[i % coachIds.length];
    try {
      await run(
        `INSERT INTO blog_posts (title,slug,language,excerpt,content,status,author_id,author_role,published_at) VALUES (?,?,?,?,?,?,?,?,?)`,
        [blog.title, blog.slug, 'en', blog.excerpt, blog.content, 'published', authorId, 'coach', daysAgo(randInt(1,90))]
      );
    } catch (e) { console.warn('Blog seed error:', (e as any).message); }
  }

  console.log('✅ Seeded 8 blog posts');

  // ── 30-Day Challenge ───────────────────────────────────────────────────────
  const { insertId: challengeId } = await run(
    'INSERT INTO challenges (creator_id,title,description,start_date,end_date) VALUES (?,?,?,?,?)',
    [mainCoach,'30-Day Transformation Challenge',
     'Complete daily workouts and log your steps for 30 days. Top performers win free coaching sessions!',
     today, daysAgoStr(-30)]
  );
  for (const uid of [...userIds.slice(0,10), testUserId]) {
    try { await run('INSERT INTO challenge_participants (challenge_id,user_id) VALUES (?,?)',[challengeId,uid]); } catch {}
  }

  console.log('\n✅ Database seeded successfully!');
  console.log(`   👤 Admin: peteradmin@example.com / ${adminPw}`);
  console.log(`   🏋 Coach: ${fakeEmail(COACH_NAMES[0],100)} / ${coachPw}`);
  console.log(`   🙂 User:  test@example.com / ${userPw}`);
  console.log(`   📊 ${userIds.length} fake users | ${coachIds.length} coaches | ${totalCampaigns} ad campaigns | ${postIds.length} posts | 8 blogs`);
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });

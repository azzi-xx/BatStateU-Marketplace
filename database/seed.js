/**
 * Database seeder (data tier).
 *
 *   npm run seed
 *
 * Wipes users/categories/listings and inserts a realistic demo dataset:
 * 1 admin, 10 students, 6 categories, and 30 listings spread across the last
 * 45 days. Spread-out dates matter — Phase 6's dashboard charts read them.
 */
require('dotenv').config({ quiet: true });

const bcrypt = require('bcryptjs');
const { db, applySchema, DB_PATH } = require('../config/db');

const DEMO_PASSWORD = 'password123';

function sqliteDate(daysAgo, minutesOffset = 0) {
  const ms = Date.now() - daysAgo * 24 * 60 * 60 * 1000 - minutesOffset * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

const CATEGORIES = [
  { name: 'Books', slug: 'books' },
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Uniforms & Clothing', slug: 'uniforms' },
  { name: 'School Supplies', slug: 'supplies' },
  { name: 'Dorm Essentials', slug: 'dorm' },
  { name: 'Others', slug: 'others' },
];

const USERS = [
  {
    studentId: '22-01001',
    fullName: 'Juan Dela Cruz',
    email: 'juan.delacruz@batstate-u.edu.ph',
    program: 'BS Information Technology',
    yearLevel: 3,
    daysAgo: 120,
    lastSeenMinutes: 2,
  },
  {
    studentId: '22-01002',
    fullName: 'Maria Santos',
    email: 'maria.santos@batstate-u.edu.ph',
    program: 'BS Computer Science',
    yearLevel: 2,
    daysAgo: 110,
    lastSeenMinutes: 4,
  },
  {
    studentId: '21-01003',
    fullName: 'Paolo Reyes',
    email: 'paolo.reyes@batstate-u.edu.ph',
    program: 'BS Civil Engineering',
    yearLevel: 4,
    daysAgo: 95,
  },
  {
    studentId: '22-01004',
    fullName: 'Angela Bautista',
    email: 'angela.bautista@batstate-u.edu.ph',
    program: 'BS Nursing',
    yearLevel: 2,
    daysAgo: 88,
    lastSeenMinutes: 1,
  },
  {
    studentId: '23-01005',
    fullName: 'Mark Villanueva',
    email: 'mark.villanueva@batstate-u.edu.ph',
    program: 'BS Information Technology',
    yearLevel: 1,
    daysAgo: 76,
  },
  {
    studentId: '21-01006',
    fullName: 'Liza Mendoza',
    email: 'liza.mendoza@batstate-u.edu.ph',
    program: 'BS Business Administration',
    yearLevel: 3,
    daysAgo: 70,
    lastSeenMinutes: 60,
  },
  {
    studentId: '20-01007',
    fullName: 'Kevin Ramos',
    email: 'kevin.ramos@batstate-u.edu.ph',
    program: 'BS Electrical Engineering',
    yearLevel: 4,
    daysAgo: 64,
  },
  {
    studentId: '22-01008',
    fullName: 'Nicole Aguilar',
    email: 'nicole.aguilar@batstate-u.edu.ph',
    program: 'BS Education',
    yearLevel: 2,
    daysAgo: 52,
  },
  {
    studentId: '22-01009',
    fullName: 'Christian Torres',
    email: 'christian.torres@batstate-u.edu.ph',
    program: 'BS Information Technology',
    yearLevel: 3,
    daysAgo: 40,
    lastSeenMinutes: 180,
  },
  {
    studentId: '23-01010',
    fullName: 'Bea Navarro',
    email: 'bea.navarro@batstate-u.edu.ph',
    program: 'BS Computer Science',
    yearLevel: 1,
    daysAgo: 25,
  },
];

const LISTINGS = [
  {
    title: 'Calculus Made Easy — Stewart 8th Edition',
    category: 'books',
    price: 450,
    condition: 'like_new',
    seller: 0,
    daysAgo: 2,
    views: 64,
    description:
      'Barely used, no highlights or torn pages. Bought it for Math 1 but switched sections. Meet-up at the CEA building lobby.',
  },
  {
    title: 'TI-84 Plus Graphing Calculator',
    category: 'electronics',
    price: 1800,
    condition: 'used',
    seller: 1,
    daysAgo: 1,
    views: 118,
    description:
      'Works perfectly, includes the slide cover. Slight scratches on the back. Batteries not included.',
  },
  {
    title: 'Engineering Drawing Set — Complete',
    category: 'supplies',
    price: 350,
    condition: 'like_new',
    seller: 2,
    daysAgo: 4,
    views: 41,
    description:
      'Complete set: T-square, triangles, French curve, compass, and scale. Used for one semester only.',
  },
  {
    title: 'PE Uniform — Size M (Unused)',
    category: 'uniforms',
    price: 250,
    condition: 'new',
    seller: 3,
    daysAgo: 3,
    views: 27,
    description: 'Brand new, wrong size for me. Still has the tag. Official BatStateU PE shirt.',
  },
  {
    title: 'Mini Electric Fan — 12 inch',
    category: 'dorm',
    price: 400,
    condition: 'used',
    seller: 4,
    daysAgo: 6,
    views: 33,
    description: 'Quiet motor, strong airflow. Perfect for dorm rooms. Slight cosmetic wear on the base.',
  },
  {
    title: 'Arduino Uno Starter Kit',
    category: 'electronics',
    price: 1200,
    condition: 'like_new',
    seller: 0,
    daysAgo: 5,
    views: 87,
    description:
      'Complete kit with breadboard, jumper wires, LEDs, sensors, and a servo. Used for one IT 311 project.',
  },
  {
    title: 'BSIT 3rd Year Textbook Bundle (5 books)',
    category: 'books',
    price: 900,
    condition: 'used',
    seller: 0,
    daysAgo: 9,
    views: 52,
    description:
      'Data Structures, Networking, Database Systems, Software Engineering, and Operating Systems. Some notes in pencil.',
  },
  {
    title: 'Desk Lamp with USB Charging Port',
    category: 'dorm',
    price: 300,
    condition: 'like_new',
    seller: 5,
    daysAgo: 8,
    views: 24,
    description: 'Three brightness levels, adjustable arm, USB-A port for charging your phone.',
  },
  {
    title: 'Nursing Uniform Set — 2 pairs',
    category: 'uniforms',
    price: 550,
    condition: 'used',
    seller: 3,
    daysAgo: 12,
    views: 39,
    description: 'Lightly used for one semester. Washed and ready to wear. Size small to medium.',
  },
  {
    title: 'USB-C 65W Laptop Charger',
    category: 'electronics',
    price: 700,
    condition: 'used',
    seller: 6,
    daysAgo: 11,
    views: 71,
    description: 'Universal USB-C charger with 65W output. Works with most modern laptops.',
  },
  {
    title: 'Casio FX-991ES Scientific Calculator',
    category: 'electronics',
    price: 600,
    condition: 'like_new',
    seller: 8,
    daysAgo: 7,
    views: 95,
    description: 'Original Casio, all functions working. Comes with the hard case. Great for engineering boards.',
  },
  {
    title: 'Foldable Study Table',
    category: 'dorm',
    price: 850,
    condition: 'used',
    seller: 7,
    daysAgo: 15,
    views: 46,
    description: 'Sturdy folding table, fits a laptop and a notebook. Easy to store under the bed.',
  },
  {
    title: 'Laboratory Gown — White, Size L',
    category: 'uniforms',
    price: 200,
    condition: 'new',
    seller: 2,
    daysAgo: 14,
    views: 18,
    description: 'Never worn, still in plastic. Bought two by mistake.',
  },
  {
    title: 'Ballpen Bundle — 24 pcs, Black',
    category: 'supplies',
    price: 120,
    condition: 'new',
    seller: 9,
    daysAgo: 10,
    views: 12,
    description: 'Unopened box of 24 black ballpens. Selling cheap because I have too many.',
  },
  {
    title: 'Logitech M170 Wireless Mouse',
    category: 'electronics',
    price: 250,
    condition: 'used',
    seller: 1,
    daysAgo: 18,
    views: 58,
    description: 'Reliable wireless mouse with USB receiver. Battery still lasts weeks.',
  },
  {
    title: 'Philippine History & Constitution Book',
    category: 'books',
    price: 180,
    condition: 'used',
    seller: 8,
    daysAgo: 21,
    views: 20,
    description: 'Required reading for Rizal and Philippine History courses. Minimal highlighting.',
  },
  {
    title: 'A4 Bond Paper — 1 Ream (Sub 20)',
    category: 'supplies',
    price: 220,
    condition: 'new',
    seller: 9,
    daysAgo: 17,
    views: 16,
    status: 'reserved',
    description: 'Sealed ream, 500 sheets. Meet-up at the main library.',
  },
  {
    title: 'Rice Cooker — 1.8L',
    category: 'dorm',
    price: 750,
    condition: 'used',
    seller: 4,
    daysAgo: 24,
    views: 61,
    description: 'Works great, non-stick inner pot still in good condition. Dorm essential.',
  },
  {
    title: 'Aluminum Laptop Stand',
    category: 'electronics',
    price: 350,
    condition: 'like_new',
    seller: 0,
    daysAgo: 19,
    views: 44,
    description: 'Adjustable height, fits up to 16-inch laptops. Helps with neck pain during long coding sessions.',
  },
  {
    title: 'Civil Engineering Formulas Handbook',
    category: 'books',
    price: 300,
    condition: 'used',
    seller: 2,
    daysAgo: 27,
    views: 35,
    status: 'sold',
    description: 'Pocket handbook with formulas for structural and geotechnical subjects.',
  },
  {
    title: 'Extension Cord — 4 Sockets with Switch',
    category: 'dorm',
    price: 180,
    condition: 'used',
    seller: 5,
    daysAgo: 23,
    views: 29,
    description: '3 meters long, individual switches, surge protection. Essential for dorm desks.',
  },
  {
    title: 'Official BatStateU PE Shirt',
    category: 'uniforms',
    price: 300,
    condition: 'new',
    seller: 7,
    daysAgo: 30,
    views: 40,
    description: 'Brand new official PE shirt, size medium. Never washed, never worn.',
  },
  {
    title: 'Noise-Cancelling Earbuds',
    category: 'electronics',
    price: 950,
    condition: 'used',
    seller: 1,
    daysAgo: 26,
    views: 103,
    description: 'Great for studying in noisy places. Includes charging case and extra ear tips.',
  },
  {
    title: 'Whiteboard Marker Set — 8 colors',
    category: 'supplies',
    price: 150,
    condition: 'new',
    seller: 9,
    daysAgo: 31,
    views: 9,
    description: 'Unused markers with eraser. Good for group study sessions.',
  },
  {
    title: 'Single Bed Sheet Set',
    category: 'dorm',
    price: 320,
    condition: 'used',
    seller: 6,
    daysAgo: 35,
    views: 22,
    description: 'One fitted sheet, one flat sheet, one pillowcase. Clean and freshly laundered.',
  },
  {
    title: 'Rizal Course Notes + Reviewer',
    category: 'books',
    price: 100,
    condition: 'used',
    seller: 8,
    daysAgo: 33,
    views: 14,
    status: 'sold',
    description: 'Handwritten notes plus a printed reviewer. Scored well using these.',
  },
  {
    title: 'Mechanical Keyboard — 60% Layout',
    category: 'electronics',
    price: 1100,
    condition: 'used',
    seller: 0,
    daysAgo: 37,
    views: 76,
    status: 'reserved',
    description: 'Blue switches, compact layout, RGB backlight. Comes with the USB-C cable.',
  },
  {
    title: 'Org / Graduation T-shirt',
    category: 'uniforms',
    price: 280,
    condition: 'new',
    seller: 5,
    daysAgo: 40,
    views: 17,
    description: 'Unused org shirt, size large. Selling at cost price.',
  },
  {
    title: 'Stainless Water Bottle — 1 Liter',
    category: 'dorm',
    price: 260,
    condition: 'like_new',
    seller: 3,
    daysAgo: 42,
    views: 21,
    description: 'Keeps drinks cold for hours. No dents, lightly used.',
  },
  {
    title: 'Engineering Pad & Graph Paper Set',
    category: 'supplies',
    price: 140,
    condition: 'new',
    seller: 2,
    daysAgo: 44,
    views: 11,
    description: 'Three engineering pads and one pack of graph paper. Unopened.',
  },
];

function resetTables() {
  db.exec(`
    DELETE FROM listings;
    DELETE FROM categories;
    DELETE FROM users;
    DELETE FROM sqlite_sequence WHERE name IN ('listings', 'categories', 'users');
  `);
}

async function seed() {
  console.log('Applying schema...');
  applySchema();

  console.log('Clearing existing demo data...');
  resetTables();

  console.log(`Hashing demo password ("${DEMO_PASSWORD}")...`);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const insertUser = db.prepare(`
    INSERT INTO users (student_id, full_name, email, password_hash, role, program, year_level, status, last_seen_at, created_at)
    VALUES (@studentId, @fullName, @email, @passwordHash, @role, @program, @yearLevel, 'active', @lastSeenAt, @createdAt)
  `);

  const insertCategory = db.prepare('INSERT INTO categories (name, slug) VALUES (@name, @slug)');

  const insertListing = db.prepare(`
    INSERT INTO listings (seller_id, category_id, title, description, price_centavos, item_condition, image_path, status, views, created_at, updated_at)
    VALUES (@sellerId, @categoryId, @title, @description, @priceCentavos, @itemCondition, NULL, @status, @views, @createdAt, @createdAt)
  `);

  const run = db.transaction(() => {
    // Admin account
    insertUser.run({
      studentId: 'ADMIN-001',
      fullName: 'Marketplace Admin',
      email: 'admin@batstate-u.edu.ph',
      passwordHash,
      role: 'admin',
      program: null,
      yearLevel: null,
      lastSeenAt: sqliteDate(0, 1),
      createdAt: sqliteDate(180),
    });

    // Students
    const userIds = USERS.map((u) => {
      const info = insertUser.run({
        studentId: u.studentId,
        fullName: u.fullName,
        email: u.email,
        passwordHash,
        role: 'student',
        program: u.program,
        yearLevel: u.yearLevel,
        lastSeenAt: u.lastSeenMinutes ? sqliteDate(0, u.lastSeenMinutes) : sqliteDate(u.daysAgo - 5),
        createdAt: sqliteDate(u.daysAgo),
      });
      return Number(info.lastInsertRowid);
    });

    // Categories
    const categoryIds = {};
    for (const category of CATEGORIES) {
      const info = insertCategory.run(category);
      categoryIds[category.slug] = Number(info.lastInsertRowid);
    }

    // Listings
    for (const listing of LISTINGS) {
      insertListing.run({
        sellerId: userIds[listing.seller],
        categoryId: categoryIds[listing.category],
        title: listing.title,
        description: listing.description,
        priceCentavos: Math.round(listing.price * 100),
        itemCondition: listing.condition,
        status: listing.status || 'available',
        views: listing.views,
        createdAt: sqliteDate(listing.daysAgo),
      });
    }
  });

  run();

  console.log('');
  console.log('Seed complete.');
  console.log(`  Database : ${DB_PATH}`);
  console.log(`  Users    : 1 admin + ${USERS.length} students`);
  console.log(`  Listings : ${LISTINGS.length}`);
  console.log('');
  console.log('Demo accounts (password for all: ' + DEMO_PASSWORD + ')');
  console.log('  Student : juan.delacruz@batstate-u.edu.ph');
  console.log('  Admin   : admin@batstate-u.edu.ph');
  console.log('');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exitCode = 1;
});

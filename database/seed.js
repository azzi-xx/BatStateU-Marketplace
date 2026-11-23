/**
 * Database seeder (data tier).
 *
 *   npm run seed
 *
 * Wipes all demo tables and inserts a larger, deliberately varied dataset:
 * 1 admin, 28 students, 6 categories, 100 listings (30 curated + 70 generated
 * from realistic item templates), ~55 orders, and ~45 messages. Dates, sellers,
 * prices, conditions, views, and statuses are spread across the last four months
 * so the browse pages and Phase 6 dashboard charts look like a real database.
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
  {
    studentId: '22-01011',
    fullName: 'Rafael Domingo',
    email: 'rafael.domingo@batstate-u.edu.ph',
    program: 'BS Mechanical Engineering',
    yearLevel: 2,
    daysAgo: 22,
    lastSeenMinutes: 15,
  },
  {
    studentId: '23-01012',
    fullName: 'Trisha Lim',
    email: 'trisha.lim@batstate-u.edu.ph',
    program: 'BS Accountancy',
    yearLevel: 1,
    daysAgo: 21,
  },
  {
    studentId: '21-01013',
    fullName: 'Gabriel Mercado',
    email: 'gabriel.mercado@batstate-u.edu.ph',
    program: 'BS Architecture',
    yearLevel: 4,
    daysAgo: 19,
    lastSeenMinutes: 35,
  },
  {
    studentId: '22-01014',
    fullName: 'Danica Flores',
    email: 'danica.flores@batstate-u.edu.ph',
    program: 'BS Psychology',
    yearLevel: 2,
    daysAgo: 18,
  },
  {
    studentId: '23-01015',
    fullName: 'Miguel Castillo',
    email: 'miguel.castillo@batstate-u.edu.ph',
    program: 'BS Computer Engineering',
    yearLevel: 1,
    daysAgo: 17,
    lastSeenMinutes: 5,
  },
  {
    studentId: '20-01016',
    fullName: 'Patricia Ong',
    email: 'patricia.ong@batstate-u.edu.ph',
    program: 'BS Nursing',
    yearLevel: 3,
    daysAgo: 16,
  },
  {
    studentId: '22-01017',
    fullName: 'Joshua Rivera',
    email: 'joshua.rivera@batstate-u.edu.ph',
    program: 'BS Information Systems',
    yearLevel: 3,
    daysAgo: 15,
    lastSeenMinutes: 90,
  },
  {
    studentId: '21-01018',
    fullName: 'Camille Dizon',
    email: 'camille.dizon@batstate-u.edu.ph',
    program: 'BS Education',
    yearLevel: 4,
    daysAgo: 14,
  },
  {
    studentId: '23-01019',
    fullName: 'Aaron Salazar',
    email: 'aaron.salazar@batstate-u.edu.ph',
    program: 'BS Civil Engineering',
    yearLevel: 1,
    daysAgo: 12,
    lastSeenMinutes: 12,
  },
  {
    studentId: '22-01020',
    fullName: 'Faye Aquino',
    email: 'faye.aquino@batstate-u.edu.ph',
    program: 'BS Business Administration',
    yearLevel: 2,
    daysAgo: 11,
  },
  {
    studentId: '21-01021',
    fullName: 'Kenneth Padilla',
    email: 'kenneth.padilla@batstate-u.edu.ph',
    program: 'BS Electrical Engineering',
    yearLevel: 3,
    daysAgo: 10,
    lastSeenMinutes: 240,
  },
  {
    studentId: '22-01022',
    fullName: 'Sienna Velasco',
    email: 'sienna.velasco@batstate-u.edu.ph',
    program: 'BS Computer Science',
    yearLevel: 3,
    daysAgo: 9,
    lastSeenMinutes: 3,
  },
  {
    studentId: '20-01023',
    fullName: 'Dominic Herrera',
    email: 'dominic.herrera@batstate-u.edu.ph',
    program: 'BS Mechanical Engineering',
    yearLevel: 4,
    daysAgo: 8,
  },
  {
    studentId: '23-01024',
    fullName: 'Althea Soriano',
    email: 'althea.soriano@batstate-u.edu.ph',
    program: 'BS Accountancy',
    yearLevel: 1,
    daysAgo: 7,
    lastSeenMinutes: 45,
  },
  {
    studentId: '22-01025',
    fullName: 'Rafaela Cruz',
    email: 'rafaela.cruz@batstate-u.edu.ph',
    program: 'BS Psychology',
    yearLevel: 2,
    daysAgo: 6,
  },
  {
    studentId: '21-01026',
    fullName: 'Ivan Lacson',
    email: 'ivan.lacson@batstate-u.edu.ph',
    program: 'BS Architecture',
    yearLevel: 3,
    daysAgo: 5,
    lastSeenMinutes: 20,
  },
  {
    studentId: '22-01027',
    fullName: 'Jasmine Panganiban',
    email: 'jasmine.panganiban@batstate-u.edu.ph',
    program: 'BS Nursing',
    yearLevel: 2,
    daysAgo: 4,
  },
  {
    studentId: '23-01028',
    fullName: 'Enzo Marasigan',
    email: 'enzo.marasigan@batstate-u.edu.ph',
    program: 'BS Information Technology',
    yearLevel: 1,
    daysAgo: 3,
    lastSeenMinutes: 8,
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

/**
 * Catalog of realistic item templates used to generate 70 additional listings.
 * Each template contributes a base price, condition, and description; the seller,
 * date, views, and small price jitter are derived deterministically below so the
 * seed is reproducible.
 */
const CATALOG = [
  { title: 'General Chemistry 1 Textbook', category: 'books', price: 380, condition: 'used', description: 'Stoichiometry, thermochemistry, and lab notes. Some chapters highlighted in yellow.' },
  { title: 'Fundamentals of Accounting Vol. 1', category: 'books', price: 420, condition: 'like_new', description: 'Valix edition. No markings, only the cover has a small crease.' },
  { title: 'Physics for Engineers (Resnick)', category: 'books', price: 560, condition: 'used', description: 'Covers mechanics and electromagnetism. Spine intact, minimal notes.' },
  { title: 'Data Structures & Algorithms in C', category: 'books', price: 340, condition: 'used', description: 'Reference for IT 313. A few diagrams have pencil annotations.' },
  { title: 'Nursing Drug Guide 2025', category: 'books', price: 650, condition: 'like_new', description: 'Latest edition, unused access code. Bought an extra copy.' },
  { title: 'Principles of Marketing', category: 'books', price: 300, condition: 'used', description: 'Kotler edition. Highlighted definitions, otherwise clean.' },
  { title: 'Architectural Graphics Standards', category: 'books', price: 720, condition: 'like_new', description: 'Large hardcover reference. Shelf wear on the dust jacket only.' },
  { title: 'Psychology: Themes & Variations', category: 'books', price: 480, condition: 'used', description: 'General Psych textbook with a few sticky tabs still attached.' },
  { title: 'Differential Equations Workbook', category: 'books', price: 210, condition: 'used', description: 'Solved examples for Math 3. Half of the pages are untouched.' },
  { title: 'Rizal Life and Works', category: 'books', price: 150, condition: 'like_new', description: 'Complete and unmarked. Required for the Rizal course.' },
  { title: 'English for Academic Purposes', category: 'books', price: 190, condition: 'used', description: 'Writing and research modules. Name erased from the inside cover.' },
  { title: 'Civil Engineering License Reviewer', category: 'books', price: 850, condition: 'like_new', description: 'Board exam reviewer, 2024 edition. No writing inside.' },
  { title: 'USB Flash Drive 64GB', category: 'electronics', price: 280, condition: 'new', description: 'Sealed, USB 3.0. Bought the wrong capacity.' },
  { title: 'HDMI Cable 2m', category: 'electronics', price: 150, condition: 'like_new', description: 'Supports 4K. Used twice for a presentation.' },
  { title: 'Wireless Earbuds Charging Case', category: 'electronics', price: 180, condition: 'used', description: 'Case only, no earbuds. Still charges normally.' },
  { title: 'Scientific Calculator FX-82MS', category: 'electronics', price: 450, condition: 'used', description: 'All keys responsive. Includes slide cover.' },
  { title: 'Power Bank 10000mAh', category: 'electronics', price: 550, condition: 'like_new', description: 'Two USB ports, charges a phone twice. Cable included.' },
  { title: 'USB-C Hub 6-in-1', category: 'electronics', price: 780, condition: 'used', description: 'HDMI, USB-A, SD, and USB-C passthrough. Works with my laptop.' },
  { title: 'Webcam 1080p', category: 'electronics', price: 620, condition: 'like_new', description: 'Clip-on webcam with mic. Used for a few online classes.' },
  { title: 'Bluetooth Speaker', category: 'electronics', price: 480, condition: 'used', description: 'Loud enough for a dorm room. Minor scratch on the side.' },
  { title: 'LED Desk Light Bar', category: 'electronics', price: 390, condition: 'new', description: 'Monitor light bar, three color temperatures. Unopened.' },
  { title: 'Ethernet Cable 5m', category: 'electronics', price: 120, condition: 'new', description: 'Cat 6, still in packaging. Bought too short for my setup.' },
  { title: 'Tablet Stand Adjustable', category: 'electronics', price: 220, condition: 'like_new', description: 'Aluminum stand, folds flat. Fits phones and tablets.' },
  { title: 'Keyboard Mouse Combo', category: 'electronics', price: 650, condition: 'used', description: 'Wired combo, quiet keys. Both work perfectly.' },
  { title: 'Mini Tripod for Phone', category: 'electronics', price: 160, condition: 'new', description: 'Flexible legs, phone clamp included. Never used.' },
  { title: 'Nursing Clinical Uniform', category: 'uniforms', price: 480, condition: 'used', description: 'One set, size small. Washed after the last duty.' },
  { title: 'ROTC Training Shirt', category: 'uniforms', price: 250, condition: 'new', description: 'Official ROTC shirt, size medium. Still in plastic.' },
  { title: 'College of Engineering Polo', category: 'uniforms', price: 350, condition: 'like_new', description: 'Department polo, size large. Worn twice.' },
  { title: 'Laboratory Coat Size M', category: 'uniforms', price: 230, condition: 'like_new', description: 'White lab coat, no stains. Used for one chemistry lab.' },
  { title: 'PE Jogging Pants', category: 'uniforms', price: 300, condition: 'used', description: 'Size medium, elastic waist. Faded slightly from washing.' },
  { title: 'Accountancy Department Polo', category: 'uniforms', price: 320, condition: 'new', description: 'Unused polo, size small. Wrong size for me.' },
  { title: 'Safety Shoes Size 8', category: 'uniforms', price: 750, condition: 'used', description: 'Steel toe, good for OJT. Normal scuffs on the sole.' },
  { title: 'Graduation Toga (Surplus)', category: 'uniforms', price: 600, condition: 'used', description: 'Complete set with cap. Used once for a graduation photo.' },
  { title: 'Sticky Notes Bundle', category: 'supplies', price: 110, condition: 'new', description: 'Five pads in assorted colors. Unopened.' },
  { title: 'A4 Folder Set', category: 'supplies', price: 95, condition: 'new', description: 'Ten clear folders with sliding clips. Sealed pack.' },
  { title: 'Gel Pen Set 12 Colors', category: 'supplies', price: 180, condition: 'new', description: 'Smooth 0.5mm gel pens. Complete set.' },
  { title: 'Pencil Case with Compass', category: 'supplies', price: 140, condition: 'like_new', description: 'Metal compass, ruler, and eraser inside. Light use.' },
  { title: 'Colored Paper Pack', category: 'supplies', price: 130, condition: 'new', description: 'A4 assorted colors, 50 sheets. Left over from a project.' },
  { title: 'Stapler & Staple Wire', category: 'supplies', price: 160, condition: 'used', description: 'Standard stapler with a box of wire. Works smoothly.' },
  { title: 'Highlighters 6-pack', category: 'supplies', price: 120, condition: 'new', description: 'Pastel highlighters, all unused.' },
  { title: 'Tracing Paper Roll', category: 'supplies', price: 175, condition: 'new', description: 'For drafting plates. Unrolled once to check the size.' },
  { title: 'Clipboard A4', category: 'supplies', price: 90, condition: 'used', description: 'Wooden clipboard with a strong clip. Slight edge wear.' },
  { title: 'Calculator Batteries (2-pack)', category: 'supplies', price: 60, condition: 'new', description: 'Button cell batteries for scientific calculators.' },
  { title: 'Index Cards 100pcs', category: 'supplies', price: 85, condition: 'new', description: 'Ruled index cards, still wrapped.' },
  { title: 'Plastic Storage Box 50L', category: 'dorm', price: 380, condition: 'used', description: 'With lid, no cracks. Fits under a dorm bed.' },
  { title: 'Single Electric Kettle', category: 'dorm', price: 450, condition: 'like_new', description: '1.5L, auto shutoff. Descaled and cleaned.' },
  { title: 'Bedside Lamp', category: 'dorm', price: 260, condition: 'used', description: 'Warm bulb included. Switch works every time.' },
  { title: 'Clip Fan', category: 'dorm', price: 300, condition: 'used', description: 'Clips to a bed frame or desk. Three speeds.' },
  { title: 'Foldable Laundry Basket', category: 'dorm', price: 220, condition: 'like_new', description: 'Collapses flat. No tears in the mesh.' },
  { title: 'Door Hanging Organizer', category: 'dorm', price: 250, condition: 'new', description: 'Six pockets, hangs with hooks. Unused.' },
  { title: 'Non-stick Frying Pan', category: 'dorm', price: 340, condition: 'used', description: '24cm pan, coating intact. Hand wash only.' },
  { title: 'Rice Cooker 1.0L', category: 'dorm', price: 650, condition: 'used', description: 'Perfect for one person. Inner pot still non-stick.' },
  { title: 'Mosquito Net', category: 'dorm', price: 280, condition: 'new', description: 'Single-bed size, with mounting hooks. Unopened.' },
  { title: 'Shower Caddy', category: 'dorm', price: 180, condition: 'like_new', description: 'Plastic caddy with drain holes. Cleaned and ready.' },
  { title: 'Desk Organizer', category: 'dorm', price: 210, condition: 'new', description: 'Three compartments for pens and notes. Unused.' },
  { title: 'Memory Foam Pillow', category: 'dorm', price: 400, condition: 'like_new', description: 'Standard size, washed cover. Too firm for me.' },
  { title: 'Wall Clock', category: 'dorm', price: 240, condition: 'used', description: 'Silent sweep, battery included. Keeps accurate time.' },
  { title: 'Plastic Hangers 10pcs', category: 'dorm', price: 150, condition: 'new', description: 'Sturdy hangers, still bundled together.' },
  { title: 'Folding Umbrella', category: 'others', price: 250, condition: 'like_new', description: 'Compact umbrella, automatic open. Used a few times.' },
  { title: 'Bike Lock with Key', category: 'others', price: 320, condition: 'used', description: 'Steel cable lock, two keys included.' },
  { title: 'Gym Bag', category: 'others', price: 450, condition: 'used', description: 'Large duffel with shoe compartment. Zippers work well.' },
  { title: 'Reusable Water Tumbler', category: 'others', price: 280, condition: 'new', description: '1L insulated tumbler, unopened. Wrong color.' },
  { title: 'Guitar Capo', category: 'others', price: 180, condition: 'like_new', description: 'Spring capo for acoustic guitar. Barely used.' },
  { title: 'Badminton Racket Pair', category: 'others', price: 850, condition: 'used', description: 'Two rackets with a tube of shuttlecocks.' },
  { title: 'Sewing Kit', category: 'others', price: 150, condition: 'new', description: 'Travel sewing kit with scissors and thread.' },
  { title: 'Hair Dryer', category: 'others', price: 520, condition: 'used', description: 'Two heat settings, foldable handle. Works fine.' },
  { title: 'Travel Adapter', category: 'others', price: 240, condition: 'new', description: 'Universal adapter with USB ports. Sealed.' },
  { title: 'Board Game Set', category: 'others', price: 600, condition: 'like_new', description: 'Complete pieces, opened but never played.' },
  { title: 'Yoga Mat 6mm', category: 'others', price: 380, condition: 'like_new', description: 'Non-slip mat with carrying strap. Wiped down.' },
  { title: 'Bike Helmet', category: 'others', price: 550, condition: 'used', description: 'Adjustable strap, no cracks. Light scuffs.' },
];

const GENERATED_LISTINGS = CATALOG.map((item, offset) => {
  const seller = (offset * 11 + 3) % USERS.length;
  const daysAgo = 4 + ((offset * 11) % 116);
  const views = 6 + ((offset * 37 + 11) % 210);
  const price = Math.max(20, item.price + ((offset % 5) - 2) * 10 + (offset % 9 === 0 ? 5 : 0));
  return {
    title: item.title,
    category: item.category,
    price,
    condition: item.condition,
    seller,
    daysAgo,
    views,
    description: item.description,
  };
});

const ALL_LISTINGS = [...LISTINGS, ...GENERATED_LISTINGS];
const PENDING_NOTES = [
  'I can meet at the main library tomorrow.',
  'Is the price negotiable?',
  'I will pick it up this weekend.',
  'Can we meet near the dorm entrance?',
  'I can pay via GCash if that helps.',
];

const GENERATED_ORDERS = [];
GENERATED_LISTINGS.forEach((listing, offset) => {
  const listingIndex = LISTINGS.length + offset;
  let kind = null;
  if (offset % 3 === 0) kind = 'completed';
  else if (offset % 11 === 0) kind = 'pending';
  else if (offset % 17 === 0) kind = 'cancelled';
  if (!kind) return;

  let buyer = (offset * 5 + 7) % USERS.length;
  if (buyer === listing.seller) buyer = (buyer + 1) % USERS.length;

  const baseDays = listing.daysAgo;
  const daysAgo =
    kind === 'completed'
      ? Math.max(0, baseDays - (1 + (offset % 5)))
      : kind === 'pending'
        ? Math.min(baseDays, 1 + (offset % 3))
        : Math.max(0, baseDays - 2);

  const order = {
    listing: listingIndex,
    buyer,
    daysAgo,
    status: kind,
  };

  if (kind === 'pending') {
    order.note = PENDING_NOTES[offset % PENDING_NOTES.length];
  } else if (kind === 'cancelled') {
    order.note = offset % 2 === 0 ? 'Changed my mind, sorry!' : null;
  } else if (offset % 4 === 0) {
    order.note = 'Meet-up at the CEA lobby.';
  }

  GENERATED_ORDERS.push(order);
});

/** Extra conversations derived from a subset of the generated orders. */
const GENERATED_MESSAGES = [];
GENERATED_ORDERS.forEach((order, i) => {
  if (i % 2 !== 0) return;
  const seller = ALL_LISTINGS[order.listing].seller;
  const buyer = order.buyer;
  const day = order.daysAgo;

  if (order.status === 'pending') {
    GENERATED_MESSAGES.push(
      { listing: order.listing, from: buyer, to: seller, body: 'Hi! Is this still available?', daysAgo: day + 1, minutes: 40, read: true },
      { listing: order.listing, from: seller, to: buyer, body: 'Yes, still available. You can send a request.', daysAgo: day + 1, minutes: 25, read: true },
      { listing: order.listing, from: buyer, to: seller, body: 'Sent a request. Can we meet at the main library?', daysAgo: day, minutes: 10, read: false }
    );
  } else if (order.status === 'completed') {
    GENERATED_MESSAGES.push(
      { listing: order.listing, from: buyer, to: seller, body: 'Hi, is this still available?', daysAgo: day + 1, minutes: 30, read: true },
      { listing: order.listing, from: seller, to: buyer, body: 'Yes, it is. Let us arrange a meet-up.', daysAgo: day + 1, minutes: 15, read: true },
      { listing: order.listing, from: buyer, to: seller, body: 'Thanks, see you tomorrow.', daysAgo: day, minutes: 20, read: true }
    );
  } else {
    GENERATED_MESSAGES.push(
      { listing: order.listing, from: buyer, to: seller, body: 'Hi, is this still available?', daysAgo: day + 1, minutes: 30, read: true },
      { listing: order.listing, from: buyer, to: seller, body: 'Sorry, I need to cancel. Something came up.', daysAgo: day, minutes: 10, read: false }
    );
  }
});

/**
 * Demo orders. `listing` and `buyer` are indexes into ALL_LISTINGS and USERS.
 *
 * The first 22 are curated; the rest are generated so the data looks like a
 * real marketplace. Statuses stay consistent with the listing state.
 */

const ORDERS = [
  { listing: 19, buyer: 0, daysAgo: 26, status: 'completed', note: 'Meet-up at the CEA lobby.' },
  { listing: 25, buyer: 1, daysAgo: 33, status: 'completed' },
  { listing: 1, buyer: 0, daysAgo: 28, status: 'completed' },
  { listing: 2, buyer: 3, daysAgo: 24, status: 'completed' },
  { listing: 3, buyer: 9, daysAgo: 22, status: 'completed' },
  { listing: 5, buyer: 1, daysAgo: 20, status: 'completed' },
  { listing: 7, buyer: 6, daysAgo: 18, status: 'completed' },
  { listing: 9, buyer: 2, daysAgo: 16, status: 'completed' },
  { listing: 11, buyer: 5, daysAgo: 14, status: 'completed' },
  { listing: 13, buyer: 0, daysAgo: 12, status: 'completed' },
  { listing: 15, buyer: 3, daysAgo: 10, status: 'completed' },
  { listing: 18, buyer: 8, daysAgo: 8, status: 'completed' },
  { listing: 21, buyer: 4, daysAgo: 6, status: 'completed' },
  { listing: 23, buyer: 1, daysAgo: 4, status: 'completed' },
  { listing: 27, buyer: 0, daysAgo: 2, status: 'completed' },
  { listing: 29, buyer: 7, daysAgo: 1, status: 'completed' },

  { listing: 16, buyer: 0, daysAgo: 1, status: 'pending', note: 'I can meet at the main library tomorrow.' },
  { listing: 26, buyer: 1, daysAgo: 2, status: 'pending', note: 'Is the keyboard still negotiable?' },
  { listing: 17, buyer: 3, daysAgo: 1, status: 'pending', note: 'I will pick it up this weekend.' },

  { listing: 4, buyer: 0, daysAgo: 5, status: 'cancelled', note: 'Changed my mind, sorry!' },
  { listing: 8, buyer: 9, daysAgo: 9, status: 'cancelled' },
  { listing: 12, buyer: 6, daysAgo: 13, status: 'cancelled' },
];

/** Demo conversations. `from` and `to` are indexes into USERS. */
const MESSAGES = [
  { listing: 0, from: 1, to: 0, body: 'Hi! Is the Calculus book still available?', daysAgo: 2, minutes: 0, read: true },
  { listing: 0, from: 0, to: 1, body: 'Yes, still available. No highlights or torn pages.', daysAgo: 2, minutes: 8, read: true },
  { listing: 0, from: 1, to: 0, body: 'Great, can I meet you at the CEA lobby tomorrow?', daysAgo: 1, minutes: 0, read: true },
  { listing: 0, from: 0, to: 1, body: 'Sure, 10 AM works for me.', daysAgo: 1, minutes: 5, read: true },

  { listing: 6, from: 3, to: 0, body: 'Are all five books included in the bundle?', daysAgo: 3, minutes: 0, read: true },
  { listing: 6, from: 0, to: 3, body: 'Yes, all five. A few pages have pencil notes.', daysAgo: 3, minutes: 12, read: true },
  { listing: 6, from: 3, to: 0, body: 'I will take them. Can you do 800?', daysAgo: 2, minutes: 0, read: true },

  { listing: 1, from: 0, to: 1, body: 'Hi, does the calculator include the slide cover?', daysAgo: 1, minutes: 0, read: true },
  { listing: 1, from: 1, to: 0, body: 'Yes, cover and batteries included.', daysAgo: 0, minutes: 120, read: true },
  { listing: 1, from: 1, to: 0, body: 'I can meet at the library if you are interested.', daysAgo: 0, minutes: 20, read: false },

  { listing: 16, from: 0, to: 9, body: 'Hi, I sent a request for the bond paper.', daysAgo: 1, minutes: 0, read: true },
  { listing: 16, from: 9, to: 0, body: 'Got it! I will confirm after my class.', daysAgo: 0, minutes: 300, read: false },
];

const ALL_ORDERS = [...ORDERS, ...GENERATED_ORDERS];
const ALL_MESSAGES = [...MESSAGES, ...GENERATED_MESSAGES];

function resetTables() {
  db.exec(`
    DELETE FROM messages;
    DELETE FROM orders;
    DELETE FROM listings;
    DELETE FROM categories;
    DELETE FROM users;
    DELETE FROM sqlite_sequence
      WHERE name IN ('messages', 'orders', 'listings', 'categories', 'users');
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

  const insertOrder = db.prepare(`
    INSERT INTO orders (listing_id, buyer_id, seller_id, amount_centavos, status, note, created_at, updated_at, completed_at)
    VALUES (@listingId, @buyerId, @sellerId, @amountCentavos, @status, @note, @createdAt, @updatedAt, @completedAt)
  `);

  const insertMessage = db.prepare(`
    INSERT INTO messages (listing_id, sender_id, recipient_id, body, read_at, created_at)
    VALUES (@listingId, @senderId, @recipientId, @body, @readAt, @createdAt)
  `);

  const setListingStatus = db.prepare(
    "UPDATE listings SET status = ?, updated_at = ? WHERE id = ?"
  );

  const run = db.transaction(() => {
    // Admin account
    insertUser.run({
      studentId: 'ADMIN-001',
      fullName: 'Marketplace Admin',
      email: 'admin@g.batstate-u.edu.ph',
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
        email: `${u.studentId}@g.batstate-u.edu.ph`,
        passwordHash,
        role: 'student',
        program: u.program,
        yearLevel: u.yearLevel,
        lastSeenAt: u.lastSeenMinutes ? sqliteDate(0, u.lastSeenMinutes) : sqliteDate(u.daysAgo - 5),
        createdAt: sqliteDate(u.daysAgo),
      });
      return Number(info.lastInsertRowid);
    });

    // External (outside the organization) account — demonstrates the marker.
    insertUser.run({
      studentId: 'EXT-0001',
      fullName: 'Guest User',
      email: 'guest.user@gmail.com',
      passwordHash,
      role: 'student',
      program: 'External',
      yearLevel: null,
      lastSeenAt: sqliteDate(0, 30),
      createdAt: sqliteDate(15),
    });

    // Categories
    const categoryIds = {};
    for (const category of CATEGORIES) {
      const info = insertCategory.run(category);
      categoryIds[category.slug] = Number(info.lastInsertRowid);
    }

    // Listings
    const listingIds = [];
    for (const listing of ALL_LISTINGS) {
      const info = insertListing.run({
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
      listingIds.push(Number(info.lastInsertRowid));
    }

    // Orders — the order rows and the listing statuses are written together.
    for (const order of ALL_ORDERS) {
      const listing = ALL_LISTINGS[order.listing];
      const createdAt = sqliteDate(order.daysAgo);
      const completedAt =
        order.status === 'completed' ? sqliteDate(Math.max(0, order.daysAgo - 1)) : null;

      insertOrder.run({
        listingId: listingIds[order.listing],
        buyerId: userIds[order.buyer],
        sellerId: userIds[listing.seller],
        amountCentavos: Math.round(listing.price * 100),
        status: order.status,
        note: order.note || null,
        createdAt,
        updatedAt: completedAt || createdAt,
        completedAt,
      });

      if (order.status === 'completed') {
        setListingStatus.run('sold', completedAt, listingIds[order.listing]);
      } else if (order.status === 'pending') {
        setListingStatus.run('reserved', createdAt, listingIds[order.listing]);
      }
    }

    // Messages
    for (const message of ALL_MESSAGES) {
      const createdAt = sqliteDate(message.daysAgo, message.minutes);

      insertMessage.run({
        listingId: listingIds[message.listing],
        senderId: userIds[message.from],
        recipientId: userIds[message.to],
        body: message.body,
        readAt: message.read ? createdAt : null,
        createdAt,
      });
    }
  });

  run();

  console.log('');
  console.log('Seed complete.');
  console.log(`  Database : ${DB_PATH}`);
  console.log(`  Users    : 1 admin + ${USERS.length + 1} students (${USERS.length} campus + 1 external)`);
  console.log(`  Listings : ${ALL_LISTINGS.length} (${LISTINGS.length} curated + ${GENERATED_LISTINGS.length} generated)`);
  const orderCounts = ALL_ORDERS.reduce(
    (acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    },
    {}
  );
  console.log(
    `  Orders   : ${ALL_ORDERS.length} (${orderCounts.completed || 0} completed, ${orderCounts.pending || 0} pending, ${orderCounts.cancelled || 0} cancelled)`
  );
  console.log(`  Messages : ${ALL_MESSAGES.length}`);
  console.log('');
  console.log('Demo accounts (password for all: ' + DEMO_PASSWORD + ')');
  console.log('  Student : 22-01001@g.batstate-u.edu.ph');
  console.log('  Admin   : admin@g.batstate-u.edu.ph');
  console.log('  External: guest.user@gmail.com (shows the "outside organization" marker)');
  console.log('');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exitCode = 1;
});

import { pool } from '../server/db/pool.js';

const domains = [
  ['SDE', 'Software development', 'Algorithms, data structures and backend engineering.', 'code'],
  ['WEB', 'Web development', 'Modern interfaces, web applications and APIs.', 'globe'],
  ['ANALYTICS', 'Data analytics', 'SQL, spreadsheets, statistics and reporting.', 'chart'],
  ['AIML', 'AI & machine learning', 'Python, modelling and machine-learning fundamentals.', 'spark'],
  ['CORE_ETE', 'Core electronics / ETE', 'Digital electronics, circuits and communication fundamentals.', 'chip'],
  ['EMBEDDED', 'Embedded systems', 'Embedded C, microcontrollers and firmware.', 'cpu'],
  ['OTHER', 'Other interests', 'Explore additional pathways and interdisciplinary roles.', 'compass'],
];

const skillRows = [
  ['C++', 'Programming', 'Object-oriented programming and systems fundamentals.', ['SDE']],
  ['C', 'Programming', 'Foundational programming and low-level concepts.', ['SDE','CORE_ETE','EMBEDDED']],
  ['Java', 'Programming', 'Object-oriented programming and application development.', ['SDE','WEB']],
  ['Python', 'Programming', 'Programming for automation, data and machine learning.', ['SDE','ANALYTICS','AIML']],
  ['DSA', 'Problem solving', 'Data structures, algorithms and coding practice.', ['SDE']],
  ['HTML', 'Web', 'Semantic document structure for web interfaces.', ['WEB']],
  ['CSS', 'Web', 'Responsive layouts and visual styling.', ['WEB']],
  ['JavaScript', 'Web', 'Browser interaction and modern JavaScript fundamentals.', ['WEB','SDE']],
  ['Node.js', 'Programming', 'Server-side JavaScript runtime fundamentals.', ['WEB','SDE']],
  ['React', 'Web', 'Component-based frontend development.', ['WEB']],
  ['SQL', 'Databases', 'Relational data querying and analysis.', ['ANALYTICS','SDE']],
  ['MySQL', 'Databases', 'Relational database design and queries.', ['ANALYTICS','SDE']],
  ['MongoDB', 'Databases', 'Document database fundamentals.', ['WEB','SDE']],
  ['Excel', 'Analytics', 'Spreadsheet analysis and formula-based reporting.', ['ANALYTICS']],
  ['Power BI', 'Analytics', 'Data modelling and business intelligence dashboards.', ['ANALYTICS']],
  ['Statistics', 'Analytics', 'Descriptive statistics and inference fundamentals.', ['ANALYTICS','AIML']],
  ['Machine Learning', 'AI / ML', 'Core supervised and unsupervised learning concepts.', ['AIML']],
  ['Digital Electronics', 'Core ETE', 'Logic design, combinational and sequential circuits.', ['CORE_ETE','EMBEDDED']],
  ['Embedded C', 'Embedded', 'C programming patterns for constrained devices.', ['EMBEDDED','CORE_ETE']],
  ['Microcontrollers', 'Embedded', 'Microcontroller architecture and peripheral basics.', ['EMBEDDED','CORE_ETE']],
  ['Operating Systems', 'Core CS', 'Processes, memory and concurrency fundamentals.', ['SDE']],
  ['Computer Networks', 'Core CS', 'Network layers, protocols and troubleshooting.', ['SDE','WEB']],
];

const firstNames = ['Aarav','Aditi','Ananya','Arjun','Diya','Ishaan','Kabir','Meera','Nisha','Rohan','Saanvi','Vihaan','Zoya','Kavya','Dev','Mira','Neel','Ira','Reyansh','Tara'];
const lastNames = ['Sharma','Reddy','Nair','Das','Iyer','Patel','Khan','Gupta','Rao','Sen','Kapoor','Joshi','Menon','Bose','Kulkarni','Roy','Mishra','Mehta','Verma','Pillai'];
const branches = ['CSE','ECE','EEE','ME','CE'];
const domainsByStudent = ['SDE','WEB','ANALYTICS','AIML','CORE_ETE','EMBEDDED','OTHER'];
const namesFor = (i) => `${firstNames[i % firstNames.length]} ${lastNames[Math.floor(i / firstNames.length) % lastNames.length]}`;
const day = (offset) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); };

const opportunities = [
  ['Northstar Logic','Associate Software Engineer','SDE',12.5,'Bengaluru','Hybrid',7.5,2026,2027,30,['CSE','ECE'],[['C++',5,'required'],['DSA',5,'required'],['SQL',3,'preferred']],['Online assessment','Technical interview','HR discussion']],
  ['Bluepeak Digital','Frontend Developer','WEB',9.2,'Hyderabad','Hybrid',7.0,2026,2028,45,['CSE','ECE','EEE'],[['HTML',4,'required'],['CSS',4,'required'],['JavaScript',5,'required'],['React',4,'preferred']],['Portfolio review','Web fundamentals','Team interview']],
  ['Cedar Analytics','Junior Data Analyst','ANALYTICS',8.0,'Pune','On-site',6.8,2026,2028,60,['CSE','ECE','EEE','CE'],[['SQL',5,'required'],['Excel',5,'required'],['Statistics',4,'preferred']],['Aptitude test','SQL exercise','Manager round']],
  ['Orbit Forge','Machine Learning Associate','AIML',14.0,'Remote','Remote',8.0,2026,2027,10,['CSE','ECE'],[['Python',6,'required'],['Machine Learning',5,'required'],['Statistics',4,'preferred']],['ML assessment','Technical interview','HR discussion']],
  ['Kestrel Circuits','Graduate Electronics Engineer','CORE_ETE',7.8,'Chennai','On-site',7.0,2026,2027,-12,['ECE','EEE'],[['Digital Electronics',5,'required'],['C',4,'preferred']],['Core test','Design discussion','HR round']],
  ['Signal Harbor','Embedded Firmware Trainee','EMBEDDED',8.6,'Bengaluru','On-site',7.2,2026,2028,75,['ECE','EEE','CSE'],[['Embedded C',5,'required'],['Microcontrollers',5,'required'],['C',4,'preferred']],['Embedded test','Firmware interview','HR discussion']],
  ['MapleStack','Backend Developer','SDE',11.0,'Gurugram','Hybrid',7.5,2026,2027,14,['CSE'],[['Java',5,'required'],['SQL',4,'required'],['DSA',4,'preferred']],['Coding test','Backend interview','HR round']],
  ['NimbleGrid','Web Application Associate','WEB',7.2,'Kochi','Remote',6.5,2026,2029,22,['CSE','ECE','EEE','ME','CE'],[['HTML',4,'required'],['JavaScript',4,'required'],['MySQL',3,'preferred']],['Web quiz','Project discussion','HR round']],
  ['Amberline Insights','Business Intelligence Analyst','ANALYTICS',10.5,'Mumbai','Hybrid',7.5,2027,2028,33,['CSE','ECE','EEE','CE'],[['Power BI',5,'required'],['SQL',5,'required'],['Excel',4,'preferred']],['Case exercise','Dashboard review','HR round']],
  ['Meridian AI','Data Science Associate','AIML',13.2,'Pune','Hybrid',8.0,2026,2027,42,['CSE','ECE'],[['Python',6,'required'],['Statistics',5,'required'],['Machine Learning',4,'preferred']],['Data task','ML interview','HR discussion']],
  ['Copperleaf Systems','Core Electronics Trainee','CORE_ETE',6.8,'Mysuru','On-site',6.5,2026,2029,8,['ECE','EEE'],[['Digital Electronics',4,'required'],['C',3,'preferred']],['Core aptitude','Technical interview']],
  ['Redwood Micro','Firmware Engineer I','EMBEDDED',9.5,'Noida','On-site',7.5,2026,2027,51,['ECE','EEE'],[['Embedded C',6,'required'],['Microcontrollers',5,'required'],['C',5,'preferred']],['C assessment','Board fundamentals','HR round']],
  ['Lattice Cloud','Platform Engineer Associate','SDE',15.0,'Bengaluru','Hybrid',8.5,2026,2027,-4,['CSE'],[['C++',6,'required'],['DSA',6,'required'],['Operating Systems',4,'preferred']],['Timed coding','Systems interview','Team round']],
  ['Willow Metrics','Reporting Analyst','ANALYTICS',7.6,'Jaipur','Remote',6.8,2026,2029,25,['CSE','ECE','EEE','ME','CE'],[['Excel',5,'required'],['SQL',4,'required'],['Power BI',3,'preferred']],['Spreadsheet task','Analyst conversation']],
  ['Silverline Web','UI Engineer Trainee','WEB',8.8,'Delhi','Hybrid',7.0,2026,2028,17,['CSE','ECE'],[['HTML',5,'required'],['CSS',5,'required'],['JavaScript',4,'required']],['UI exercise','Frontend interview','HR discussion']],
  ['Juniper Robotics','Embedded Systems Associate','EMBEDDED',10.2,'Chennai','On-site',7.8,2027,2028,64,['ECE','EEE','ME'],[['Embedded C',5,'required'],['Microcontrollers',5,'required'],['Digital Electronics',4,'preferred']],['Embedded quiz','Technical panel','HR round']],
  ['Cloudwell Labs','Software Engineer Trainee','SDE',10.0,'Remote','Remote',7.0,2026,2029,38,['CSE','ECE','EEE'],[['Java',4,'required'],['DSA',4,'required'],['Computer Networks',3,'preferred']],['Online test','Coding interview','HR round']],
  ['Pinecone Dataworks','Analytics Engineer','ANALYTICS',12.0,'Bengaluru','Hybrid',7.8,2026,2027,70,['CSE','ECE'],[['SQL',6,'required'],['Python',4,'required'],['Statistics',4,'preferred']],['SQL challenge','Data modelling','HR discussion']],
  ['Dawn Circuitry','Electronics Design Trainee','CORE_ETE',7.4,'Coimbatore','On-site',6.7,2026,2028,13,['ECE','EEE'],[['Digital Electronics',5,'required'],['C',4,'preferred']],['Circuit fundamentals','Technical interview']],
  ['Evergreen Apps','Full-Stack Developer','WEB',11.8,'Hyderabad','Hybrid',7.4,2026,2027,48,['CSE','ECE'],[['JavaScript',5,'required'],['React',4,'required'],['MySQL',4,'required'],['Node.js',3,'preferred']],['Web test','Build exercise','HR round']],
];

const tests = [
  {title:'Quantitative aptitude · foundations',category:'Quantitative aptitude',description:'Percentages, ratios and everyday numerical reasoning.',minutes:18,difficulty:'Beginner',questions:[
    ['A campus has 240 students in a cohort. If 25% are in the ECE branch, how many ECE students are there?','Percentages',['48','60','72','80'],1,'25% of 240 is 60.'],
    ['A book priced at ₹800 is discounted by 10%. What is its sale price?','Percentages',['₹700','₹720','₹740','₹760'],1,'10% of ₹800 is ₹80, so the sale price is ₹720.'],
    ['The ratio of interns to mentors is 5:2. If there are 35 interns, how many mentors are there?','Ratios',['10','12','14','16'],2,'Each ratio unit is 35 ÷ 5 = 7, so 2 units is 14.'],
  ]},
  {title:'Logical reasoning · patterns',category:'Logical reasoning',description:'Sequences, ordering and clear pattern recognition.',minutes:15,difficulty:'Beginner',questions:[
    ['What number comes next: 3, 6, 12, 24, …?','Sequences',['30','36','42','48'],3,'Each term doubles, so the next term is 48.'],
    ['All lab assistants wear an ID badge. Mira is a lab assistant. Which statement follows?','Deduction',['Mira wears an ID badge.','Everyone with a badge is a lab assistant.','Mira works in every lab.','No conclusion follows.'],0,'The premise directly applies to Mira.'],
    ['If MONDAY is coded as NPOEBZ by shifting each letter forward one place, how is DAY coded?','Letter patterns',['EBZ','CBX','EBY','EAZ'],0,'D→E, A→B, Y→Z.'],
  ]},
  {title:'Core CS · systems and data',category:'Core CS fundamentals',description:'Operating systems, networks and relational database basics.',minutes:20,difficulty:'Intermediate',questions:[
    ['Which structure commonly stores a process that is ready to run?','Operating systems',['Queue','Stack only','Hash set only','Tree'],0,'Schedulers commonly maintain ready queues.'],
    ['Which SQL clause filters rows before grouping?','Databases',['HAVING','WHERE','ORDER BY','LIMIT'],1,'WHERE filters input rows before aggregation.'],
    ['Which OSI layer is primarily responsible for routing between networks?','Networks',['Physical','Data Link','Network','Presentation'],2,'The Network layer handles routing and logical addressing.'],
  ]},
  {title:'Web & SQL · practical basics',category:'Technical MCQs',description:'Browser fundamentals, JavaScript and relational queries.',minutes:20,difficulty:'Intermediate',questions:[
    ['Which HTML element is most appropriate for a page’s primary navigation?','HTML',['<section>','<nav>','<aside>','<summary>'],1,'The nav element identifies a major navigation block.'],
    ['What does a JavaScript Promise represent?','JavaScript',['A CSS rule','An eventual result of an asynchronous operation','A database table','A browser cookie'],1,'A Promise represents completion or failure of an asynchronous operation.'],
    ['Which SQL keyword removes duplicate rows from a result?','SQL',['UNIQUE','DISTINCT','ONLY','DEDUP'],1,'SELECT DISTINCT removes duplicate result rows.'],
  ]},
  {title:'ETE & embedded · fundamentals',category:'Domain-specific ETE',description:'Digital logic and microcontroller essentials.',minutes:18,difficulty:'Intermediate',questions:[
    ['How many output bits does a 4-to-1 multiplexer have?','Digital electronics',['One','Two','Four','Eight'],0,'A multiplexer selects one of several inputs onto a single output.'],
    ['Which storage is typically volatile in a microcontroller system?','Embedded systems',['Flash','EEPROM','SRAM','ROM'],2,'SRAM loses its stored contents when power is removed.'],
    ['What is the purpose of a pull-up resistor on a digital input?','Digital electronics',['Hold the line at a defined logic-high level when otherwise floating','Increase CPU clock speed','Convert analog values to digital','Store program code'],0,'A pull-up establishes a stable high level when the input is not actively driven low.'],
  ]},
  {title:'DSA · problem-solving warm-up',category:'DSA and coding',description:'Foundational data structures and complexity reasoning.',minutes:20,difficulty:'Beginner',questions:[
    ['What is the average lookup time for a key in a well-sized hash table?','Data structures',['O(1)','O(log n)','O(n)','O(n log n)'],0,'Average-case hash lookup is constant time, assuming a suitable hash function and load factor.'],
    ['Which data structure follows FIFO ordering?','Data structures',['Stack','Queue','Binary search tree','Heap'],1,'A queue removes items in first-in, first-out order.'],
    ['What is the time complexity of binary search on a sorted array?','Algorithms',['O(1)','O(log n)','O(n)','O(n²)'],1,'Binary search halves the remaining search interval each step.'],
  ]},
  {title:'Verbal ability · reading and clarity',category:'Verbal ability',description:'Reading comprehension, concise wording and grammar.',minutes:16,difficulty:'Beginner',questions:[
    ['Choose the clearest sentence for a project update.','Written communication',['The module was done by us yesterday.','We completed the module yesterday.','Yesterday the completion of the module was done.','The module, it was completed yesterday.'],1,'The active sentence is concise and clearly identifies the action.'],
    ['Select the closest meaning of “concise”.','Vocabulary',['Brief and clear','Uncertain','Repeated','Unrelated'],0,'Concise means expressing information clearly in few words.'],
    ['A report says that all sampled boards passed a test. What conclusion is safest?','Reading comprehension',['Every board in the world passes the test.','All sampled boards passed; broader results need more evidence.','The test is unnecessary.','The boards were never tested.'],1,'A conclusion should not generalize beyond the sample.'],
  ]},
  {title:'Technical interview · explain your reasoning',category:'Technical interviews',description:'Conceptual questions that reward clear technical explanations.',minutes:18,difficulty:'Intermediate',questions:[
    ['Why can an index speed up a database lookup?','Databases',['It can reduce the rows scanned for a matching key.','It encrypts every table.','It removes the need for backups.','It makes every write free.'],0,'An index provides a search structure that may reduce the work needed to locate rows.'],
    ['What is a useful first step when a service returns intermittent errors?','Debugging',['Inspect a timestamped request, error pattern and dependency status.','Delete the database.','Increase every timeout immediately.','Hide the error from users.'],0,'A reproducible trace and dependency checks help isolate the failure before changing configuration.'],
    ['When comparing two algorithms, which statement is most useful?','Algorithms',['Discuss time and space trade-offs for the expected input size.','Always choose the longest implementation.','Ignore constraints.','Choose only by variable names.'],0,'A useful comparison accounts for input scale and both time and space costs.'],
  ]},
  {title:'HR interview · workplace judgment',category:'HR interviews',description:'Situational judgment and constructive communication.',minutes:15,difficulty:'Beginner',questions:[
    ['A deadline is at risk because a dependency is late. What is the best next step?','Communication',['Notify the team early, explain the impact and propose options.','Wait until after the deadline.','Blame a teammate publicly.','Mark the task complete without checking.'],0,'Early, specific communication lets the team agree on a realistic next action.'],
    ['You receive feedback that a presentation is hard to follow. What response is most constructive?','Feedback',['Ask which section was unclear and revise it.','Dismiss every comment.','Stop presenting forever.','Change unrelated data.'],0,'Specific feedback can guide an improvement that can be checked.'],
    ['A teammate disagrees with your approach. What is a useful response?','Collaboration',['Clarify the shared goal, compare evidence and agree on a small next step.','Interrupt until they stop.','Assume bad intent.','Avoid documenting a decision.'],0,'Respectful discussion centered on evidence and goals supports a workable decision.'],
  ]},
];

const roadmapData = [
  ['SDE','C++ and DSA for SDE',[
    ['C++ foundations','Types, control flow and functions.','Beginner',45,'https://en.cppreference.com/w/cpp/language/'],
    ['Arrays, strings and complexity','Build fluency with arrays, strings and Big-O.','Beginner',60,'https://www.geeksforgeeks.org/learn-data-structures-and-algorithms-dsa-tutorial/'],
    ['Linked lists, stacks and queues','Implement core linear structures.','Intermediate',60,'https://www.geeksforgeeks.org/data-structures/'],
    ['Trees, graphs and traversal','Explore hierarchical and graph structures.','Intermediate',90,'https://cp-algorithms.com/'],
    ['Sorting, searching and timed practice','Compare algorithms and practice interview-style problems.','Advanced',90,'https://leetcode.com/problemset/'],
  ]],
  ['WEB','Web development: HTML to React',[
    ['Semantic HTML','Structure accessible web documents.','Beginner',45,'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content'],
    ['CSS layouts and responsive design','Use flexbox, grid and responsive principles.','Beginner',60,'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics'],
    ['JavaScript essentials','Use modules, events, async functions and the DOM.','Intermediate',75,'https://javascript.info/'],
    ['HTTP, forms and APIs','Build accessible forms and consume JSON APIs.','Intermediate',60,'https://developer.mozilla.org/en-US/docs/Web/HTTP'],
    ['React fundamentals','Learn components and state before building a small interface.','Advanced',90,'https://react.dev/learn'],
  ]],
  ['ANALYTICS','SQL, Excel and Power BI',[
    ['Spreadsheet foundations','Organize, clean and summarize tabular data.','Beginner',45,'https://support.microsoft.com/excel'],
    ['SQL queries and joins','Filter, group and join relational data.','Beginner',60,'https://sqlbolt.com/'],
    ['Descriptive statistics','Summarize distributions and compare groups.','Intermediate',60,'https://www.khanacademy.org/math/statistics-probability'],
    ['Power BI data model','Connect tables and build measures.','Intermediate',75,'https://learn.microsoft.com/power-bi/'],
    ['Dashboard storytelling','Present findings with clear measures and visual choices.','Advanced',60,'https://learn.microsoft.com/power-bi/guidance/'],
  ]],
  ['AIML','Python and machine-learning fundamentals',[
    ['Python essentials','Practice data types, control flow and functions.','Beginner',60,'https://docs.python.org/3/tutorial/'],
    ['NumPy and data preparation','Work with arrays and clean tabular data.','Beginner',75,'https://numpy.org/doc/stable/user/absolute_beginners.html'],
    ['Statistics for modelling','Review probability, distributions and evaluation.','Intermediate',75,'https://scikit-learn.org/stable/getting_started.html'],
    ['Supervised learning','Train and evaluate simple classification/regression models.','Intermediate',90,'https://scikit-learn.org/stable/supervised_learning.html'],
    ['Model validation and communication','Use validation carefully and explain limitations.','Advanced',75,'https://scikit-learn.org/stable/modules/cross_validation.html'],
  ]],
  ['EMBEDDED','Embedded C and microcontrollers',[
    ['C language foundations','Review types, pointers, arrays and functions.','Beginner',60,'https://en.cppreference.com/w/c/language/'],
    ['Digital logic essentials','Practice Boolean logic and combinational circuits.','Beginner',60,'https://www.allaboutcircuits.com/textbook/digital/'],
    ['Microcontroller peripherals','Study GPIO, timers and serial interfaces.','Intermediate',75,'https://docs.arduino.cc/'],
    ['Interrupts and embedded debugging','Reason about timing, state and hardware debugging.','Intermediate',90,'https://interrupt.memfault.com/'],
    ['Small firmware project','Integrate a sensor, state machine and documented test plan.','Advanced',120,'https://docs.arduino.cc/'],
  ]],
];

async function insertMany(table, columns, rows) {
  if (!rows.length) return;
  const width = columns.length;
  const slots = rows.map(() => `(${Array(width).fill('?').join(',')})`).join(',');
  const values = rows.flat();
  await pool.execute(`INSERT IGNORE INTO ${table} (${columns.join(',')}) VALUES ${slots}`, values);
}

try {
  await insertMany('domains', ['code','name','description','icon'], domains);
  const domainRows = await pool.query('SELECT id, code FROM domains');
  const domainId = new Map(domainRows[0].map((row) => [row.code, row.id]));

  await insertMany('skills', ['name','category','description'], skillRows.map(([name, category, description]) => [name, category, description]));
  const skills = await pool.query('SELECT id, name FROM skills');
  const skillId = new Map(skills[0].map((row) => [row.name, row.id]));
  const skillDomainRows = skillRows.flatMap(([name,,,codes]) => codes.map((code) => [skillId.get(name), domainId.get(code)]));
  await insertMany('skill_domains', ['skill_id','domain_id'], skillDomainRows);

  const currentYear = new Date().getUTCFullYear();
  const studentRows = [];
  for (let i = 0; i < 200; i += 1) {
    const gradYear = currentYear + (i % 4);
    const academicYear = gradYear === currentYear ? '4th year' : `${5 - (gradYear - currentYear)}th year`;
    const enrollment = i === 0 ? 'BTET24O1091' : `BTET${String(24 + Math.floor(i / 100)).padStart(2,'0')}${branches[i % branches.length]}${String(i + 1).padStart(4,'0')}`;
    const cgpa = (i === 0 ? 8.3 : 6.0 + ((i * 17) % 41) / 10).toFixed(2);
    studentRows.push([enrollment, namesFor(i), branches[i % branches.length], academicYear, gradYear, cgpa, 'interests']);
  }
  await insertMany('students', ['enrollment_no','full_name','branch','academic_year','batch','cgpa','onboarding_step'], studentRows);
  const studentRecords = await pool.query('SELECT id, enrollment_no, branch FROM students WHERE enrollment_no LIKE ?', ['BTET%']);
  const studentId = new Map(studentRecords[0].map((row) => [row.enrollment_no, row.id]));
  const backlogRows = [];
  for (let i = 0; i < 200; i += 1) {
    const enrollment = i === 0 ? 'BTET24O1091' : `BTET${String(24 + Math.floor(i / 100)).padStart(2,'0')}${branches[i % branches.length]}${String(i + 1).padStart(4,'0')}`;
    const sid = studentId.get(enrollment);
    if (sid) backlogRows.push([sid, i === 0 ? 0 : i % 4]);
  }
  await insertMany('student_academic_facts', ['student_id','active_backlogs'], backlogRows);

  const interestRows = [];
  const ratingRows = [];
  for (let i = 0; i < 200; i += 1) {
    const enrollment = i === 0 ? 'BTET24O1091' : `BTET${String(24 + Math.floor(i / 100)).padStart(2,'0')}${branches[i % branches.length]}${String(i + 1).padStart(4,'0')}`;
    const sid = studentId.get(enrollment);
    if (!sid) continue;
    const primary = domainsByStudent[i % domainsByStudent.length];
    const second = domainsByStudent[(i + 1) % domainsByStudent.length];
    interestRows.push([sid, domainId.get(primary)], [sid, domainId.get(second)]);
    const applicable = skillRows.filter(([, , , codes]) => codes.includes(primary) || (i % 2 === 0 && codes.includes(second)));
    for (const [name] of applicable) ratingRows.push([sid, skillId.get(name), ((i * 7 + skillId.get(name) * 3) % 10) + 1]);
  }
  await insertMany('student_interests', ['student_id','domain_id'], interestRows);
  await insertMany('student_skills', ['student_id','skill_id','rating'], ratingRows);

  for (const [index, item] of opportunities.entries()) {
    const [companyName, title, domainCode, packageLpa, location, workMode, minCgpa, batchFrom, batchTo, deadlineDays, branchesAllowed, requiredSkills, stages] = item;
    await pool.execute('INSERT IGNORE INTO companies (name, brand_mark, description, is_demo) VALUES (?, ?, ?, TRUE)', [companyName, companyName.split(/\s+/).map((part) => part[0]).join('').slice(0,3).toUpperCase(), `Fictional demonstration employer profile for ${domainCode.toLowerCase()} placement preparation.`]);
    const [companies] = await pool.execute('SELECT id FROM companies WHERE name = ?', [companyName]);
    const companyId = companies[0].id;
    const [existing] = await pool.execute('SELECT id FROM opportunities WHERE company_id = ? AND title = ? LIMIT 1', [companyId, title]);
    let opportunityId = existing[0]?.id;
    const isNewOpportunity = !opportunityId;
    if (isNewOpportunity) {
      const [result] = await pool.execute('INSERT INTO opportunities (company_id,title,domain_id,package_lpa,location,work_mode,min_cgpa,batch_from,batch_to,application_deadline,status,job_description,extra_rules) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [companyId,title,domainId.get(domainCode),packageLpa,location,workMode,minCgpa,batchFrom,batchTo,day(deadlineDays),'active',`${title} is a fictional demonstration opportunity for students interested in ${domainCode.toLowerCase()} placement preparation. The role includes guided onboarding, a structured assessment process and collaborative project work.`, index % 3 === 0 ? 'Review the posted role requirements and keep your preparation plan current.' : 'No additional academic criteria beyond the listed eligibility rules.']);
      opportunityId = result.insertId;
    }
    // Seed relationship criteria once; later starts must not undo administrator edits.
    if (isNewOpportunity) {
      const branchValues = branchesAllowed.map((branch) => [opportunityId, branch]);
      await insertMany('opportunity_branches', ['opportunity_id','branch'], branchValues);
      const reqValues = requiredSkills.map(([name, rating, type]) => [opportunityId, skillId.get(name), rating, type]).filter((row) => row[1]);
      await insertMany('opportunity_skill_requirements', ['opportunity_id','skill_id','min_rating','requirement_type'], reqValues);
      const allowedYears = index % 5 === 1 ? ['3rd year','4th year'] : index % 5 === 2 ? ['4th year'] : index % 5 === 4 ? ['2nd year','3rd year'] : [];
      await insertMany('opportunity_academic_years', ['opportunity_id','academic_year'], allowedYears.map((year) => [opportunityId,year]));
      await insertMany('opportunity_stages', ['opportunity_id','stage_name','stage_order'], stages.map((name, stageOrder) => [opportunityId,name,stageOrder + 1]));
    }
  }

  for (const test of tests) {
    const [existing] = await pool.execute('SELECT id FROM mock_tests WHERE title = ? LIMIT 1', [test.title]);
    let testId = existing[0]?.id;
    if (!testId) {
      const [result] = await pool.execute('INSERT INTO mock_tests (title,category,description,duration_minutes,difficulty,is_active) VALUES (?,?,?,?,?,TRUE)', [test.title,test.category,test.description,test.minutes,test.difficulty]);
      testId = result.insertId;
    }
    for (const [i, question] of test.questions.entries()) {
      const [oldQuestion] = await pool.execute('SELECT id FROM test_questions WHERE test_id = ? AND question_order = ?', [testId, i + 1]);
      let questionId = oldQuestion[0]?.id;
      if (!questionId) {
        const [result] = await pool.execute('INSERT INTO test_questions (test_id,prompt,topic,explanation,question_order,is_active) VALUES (?,?,?,?,?,TRUE)', [testId,question[0],question[1],question[4],i + 1]);
        questionId = result.insertId;
      }
      const [oldOptions] = await pool.execute('SELECT COUNT(*) AS count FROM answer_options WHERE question_id = ?', [questionId]);
      if (!Number(oldOptions[0].count)) await insertMany('answer_options', ['question_id','option_text','is_correct','option_order'], question[2].map((text, optionIndex) => [questionId,text,optionIndex === question[3],optionIndex + 1]));
    }
  }

  const preparationCategories = {
    SDE: ['DSA and coding','Core CS fundamentals','Technical MCQs','Technical interviews','HR interviews'],
    WEB: ['Technical MCQs','DSA and coding','Technical interviews','HR interviews'],
    ANALYTICS: ['Quantitative aptitude','Technical MCQs','Logical reasoning','HR interviews'],
    AIML: ['DSA and coding','Quantitative aptitude','Technical MCQs','Technical interviews'],
    CORE_ETE: ['Domain-specific ETE','Technical MCQs','Logical reasoning','Technical interviews'],
    EMBEDDED: ['Domain-specific ETE','Technical MCQs','Logical reasoning','Technical interviews'],
    OTHER: ['Quantitative aptitude','Logical reasoning','Verbal ability','Technical MCQs','HR interviews'],
  };
  const [roleRows] = await pool.query("SELECT o.id,o.title,d.code AS domain_code,c.name AS company_name FROM opportunities o JOIN domains d ON d.id=o.domain_id JOIN companies c ON c.id=o.company_id WHERE c.is_demo=TRUE ORDER BY o.id");
  const [testRows] = await pool.query("SELECT id,title,category FROM mock_tests WHERE is_active=TRUE ORDER BY id");
  const testByCategory = new Map();
  for (const item of testRows) if (!testByCategory.has(item.category)) testByCategory.set(item.category, item);
  const roleRecommendationRows = [];
  for (const role of roleRows) {
    for (const [index, category] of (preparationCategories[role.domain_code] || preparationCategories.OTHER).entries()) {
      const practiceTest = testByCategory.get(category);
      if (practiceTest) roleRecommendationRows.push([role.id,practiceTest.id,`${role.company_name}: review ${category.toLowerCase()} for this ${role.title.toLowerCase()} role.`,index + 1]);
    }
  }
  await insertMany('opportunity_test_recommendations', ['opportunity_id','test_id','recommendation_note','sort_order'], roleRecommendationRows);

  for (const [domainCode, title, topicRows] of roadmapData) {
    let roadmapId;
    const [existingRoadmap] = await pool.execute('SELECT id FROM roadmaps WHERE domain_id = ? AND title = ?', [domainId.get(domainCode), title]);
    if (existingRoadmap[0]) roadmapId = existingRoadmap[0].id;
    else {
      const [result] = await pool.execute('INSERT INTO roadmaps (domain_id,title,description,level,is_active) VALUES (?,?,?,?,TRUE)', [domainId.get(domainCode),title,`A practical ${title.toLowerCase()} pathway. Mark topics as you work through them; external resources remain separate from verified credentials.`, 'Beginner to advanced']);
      roadmapId = result.insertId;
    }
    for (const [i, [topicTitle, description, difficulty, minutes, url]] of topicRows.entries()) {
      const [existingTopic] = await pool.execute('SELECT id FROM roadmap_topics WHERE roadmap_id = ? AND topic_order = ?', [roadmapId, i + 1]);
      let topicId = existingTopic[0]?.id;
      if (!topicId) {
        const [result] = await pool.execute('INSERT INTO roadmap_topics (roadmap_id,title,description,difficulty,topic_order,minutes_estimate) VALUES (?,?,?,?,?,?)', [roadmapId,topicTitle,description,difficulty,i + 1,minutes]);
        topicId = result.insertId;
      }
      const [resource] = await pool.execute('SELECT id FROM learning_resources WHERE topic_id = ? LIMIT 1', [topicId]);
      if (!resource.length) await pool.execute('INSERT INTO learning_resources (topic_id,title,url,resource_type) VALUES (?,?,?,?)', [topicId,`Start here: ${topicTitle}`,url,'Documentation']);
      if (i > 0) {
        const [prevTopic] = await pool.execute('SELECT id FROM roadmap_topics WHERE roadmap_id = ? AND topic_order = ?', [roadmapId, i]);
        if (prevTopic[0]) await pool.execute('INSERT IGNORE INTO topic_prerequisites (topic_id,prerequisite_topic_id) VALUES (?,?)', [topicId,prevTopic[0].id]);
      }
    }
  }

  const topicCategories = {
    SDE: ['DSA and coding'],
    WEB: ['Technical MCQs'],
    ANALYTICS: ['Quantitative aptitude','Technical MCQs'],
    AIML: ['Technical MCQs','DSA and coding'],
    EMBEDDED: ['Domain-specific ETE'],
  };
  const [topicRecords] = await pool.query('SELECT t.id,t.title,t.topic_order,d.code AS domain_code FROM roadmap_topics t JOIN roadmaps r ON r.id=t.roadmap_id JOIN domains d ON d.id=r.domain_id ORDER BY t.id');
  const topicPracticeRows = topicRecords.map((topic) => {
    const categories = topicCategories[topic.domain_code] || ['Quantitative aptitude','Logical reasoning'];
    const title = topic.title.toLowerCase();
    const category = topic.domain_code === 'ANALYTICS' && title.includes('sql') ? 'Technical MCQs' : categories[(Number(topic.topic_order) - 1) % categories.length];
    const practiceTest = testByCategory.get(category);
    return practiceTest ? [topic.id,practiceTest.id,`Quick ${category.toLowerCase()} self-check after studying ${topic.title}.`,1] : null;
  }).filter(Boolean);
  await insertMany('roadmap_topic_practice_tests', ['topic_id','test_id','practice_note','sort_order'], topicPracticeRows);

  console.log(`Demo seed complete: ${studentRows.length} fictional students, ${opportunities.length} opportunities, ${tests.length} tests and ${roadmapData.length} roadmaps (repeatable; existing student progress and administrator edits are preserved).`);
} finally {
  await pool.end();
}

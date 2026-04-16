#!/usr/bin/env node
/**
 * seedTestData.mjs — Creates a test user and seeds sample notes, tags, and wiki-links.
 *
 * HTTP-based: calls the running backend API. No direct DB access, no build step.
 *
 * Test credentials:
 *   username : testuser
 *   password : password123
 *
 * Usage (local)  : node scripts/seedTestData.mjs
 * Usage (Docker) : run via the "seeder" service in docker-compose.yml
 *
 * Idempotent safe to re-run. Skips notes that already exist.
 * Dates are always re-applied so re-running keeps the timeline accurate.
 */

const API = process.env.API_URL ?? "http://localhost:3000/api";
const USERNAME = "testuser";
const EMAIL = "test@example.com";
const PASSWORD = "password123";

// Seed data -----------------------------------------------------------------
//
// 50 notes across 2022–2026 designed for demo across four axes:
//
//   GRAPH     tech/work cluster (hub nodes), personal/health, books, food,
//              cross-cluster bridges, isolated notes, dead ends
//   TIMELINE evenly spread Jan 2022 to Apr 2026
//   TAGS     16 unique tags, rich co-occurrence for the tag matrix
//   LINKS    high-degree hubs, BFS paths, dead ends, cluster navigation

const NOTES = [
	// 2022 Q1

	{
		title: "Starting My Reading Journey",
		content:
			"Set a goal to read one technical book per month. First up: Clean Code by Robert Martin. The idea is to build a solid foundation before diving into larger projects.\n\nFirst notes in [[Clean Code Review]].",
		tags: ["books", "personal", "learning"],
		links: ["Clean Code Review"],
		created_at: "2022-01-15",
	},
	{
		title: "First Coding Project",
		content:
			"Built my first web app — a simple todo list using HTML, CSS and vanilla JavaScript. Learned about the DOM, event listeners, and local storage. Exciting to see something work end to end.\n\nGot the fundamentals from [[Web Development Fundamentals]].",
		tags: ["tech", "learning", "personal"],
		links: ["Web Development Fundamentals"],
		created_at: "2022-02-10",
	},
	{
		title: "Web Development Fundamentals",
		content:
			"Core concepts: HTML structure, CSS box model, JavaScript event loop, HTTP request/response cycle. These are the foundation everything else builds on. Understanding the event loop was the biggest unlock.",
		tags: ["tech", "frontend", "learning"],
		links: [],
		created_at: "2022-03-05",
	},

	// 2022 Q2

	{
		title: "Introduction to Databases",
		content:
			"Relational databases use tables, rows, and columns. SQL is the query language. Indexes speed up reads at the cost of write performance. Normalisation reduces redundancy. SQLite is a good starting point.\n\nBuilds on [[Web Development Fundamentals]].",
		tags: ["tech", "backend", "learning"],
		links: ["Web Development Fundamentals"],
		created_at: "2022-04-18",
	},
	{
		title: "Linux Command Line Basics",
		content:
			"Navigation: ls, cd, pwd. File ops: cp, mv, rm, mkdir. Process management: ps, kill, top. Pipes and redirection. SSH and scp for remote access. The terminal is faster once you get past the learning curve.",
		tags: ["tech", "learning"],
		links: [],
		created_at: "2022-05-30",
	},
	{
		title: "Cooking Basics",
		content:
			"Knife skills, heat control, seasoning at every stage. Learned the difference between sautéing, braising, and roasting. Mise en place saves so much stress. These fundamentals apply to almost every recipe.\n\nExpanding into [[Recipe Collection]].",
		tags: ["cooking", "food", "personal"],
		links: ["Recipe Collection"],
		created_at: "2022-06-12",
	},

	// 2022 Q3 

	{
		title: "Git and Version Control",
		content:
			"Commits, branches, merges, rebases. Pull request workflow. Git blame and bisect for debugging. Conventional commits for readable history. The reflog has saved me more than once.",
		tags: ["tech", "learning"],
		links: [],
		created_at: "2022-07-08",
	},
	{
		title: "CSS Layout Deep Dive",
		content:
			"Flexbox for one-dimensional layouts, CSS Grid for two-dimensional. Position: relative, absolute, fixed, sticky. Media queries for responsive design. Container queries are the future.\n\nBuilds on [[Web Development Fundamentals]].",
		tags: ["tech", "frontend", "learning"],
		links: ["Web Development Fundamentals"],
		created_at: "2022-08-22",
	},
	{
		title: "Clean Code Review",
		content:
			"Key takeaways: functions do one thing, names reveal intent, comments explain why not what. Small functions. No side effects. The boy scout rule: always leave code cleaner than you found it.\n\nPrinciples applied in [[Backend Architecture]] and [[API Design Patterns]].",
		tags: ["books", "learning", "tech"],
		links: ["Backend Architecture", "API Design Patterns"],
		created_at: "2022-09-14",
	},

	//  2022 Q4 

	{
		title: "Recipe Collection",
		content:
			"Pasta sauce: tomatoes, garlic, basil, olive oil. Simmer two hours on low. Add parmesan at the end. Shakshuka: spiced tomato base, poached eggs on top. Roast chicken: dry brine overnight, high heat to finish.",
		tags: ["cooking", "food", "personal"],
		links: [],
		created_at: "2022-10-05",
	},
	{
		title: "Personal Goals 2022",
		content:
			"Read six technical books — hit five. Built two side projects. Did not run the 5k. Cook more at home — success, down to ordering out once a week.\n\nTracked in [[Starting My Reading Journey]] and [[First Coding Project]].",
		tags: ["personal", "planning"],
		links: ["Starting My Reading Journey", "First Coding Project"],
		created_at: "2022-11-28",
	},
	{
		title: "TypeScript Fundamentals",
		content:
			"Static typing catches bugs before runtime. Interfaces vs types. Generics for reusable code. Utility types: Partial, Required, Pick, Omit. Strict mode is worth the initial pain.\n\nUsed throughout [[Backend Architecture]] and [[Frontend Components]].",
		tags: ["tech", "learning", "frontend"],
		links: ["Backend Architecture", "Frontend Components"],
		created_at: "2022-12-10",
	},

	// 2023 Q1

	{
		title: "Backend Architecture",
		content:
			"The backend uses Express with TypeScript and SQLite. JWT authentication with a migration-based schema system. REST API with authenticated endpoints for notes, tags, and links.\n\nSchema in [[Database Design]]. Endpoints in [[API Design Patterns]]. System context in [[System Design Notes]].",
		tags: ["tech", "backend", "work"],
		links: [
			"Database Design",
			"API Design Patterns",
			"System Design Notes",
		],
		created_at: "2023-01-20",
	},
	{
		title: "Database Design",
		content:
			"SQLite with FTS5 for full-text search using BM25 ranking. Tables: DB_NOTES, DB_TAGS, DB_NOTE_TAGS, DB_NOTES_LINKS. Migration system handles versioning. Foreign key constraints on delete cascade.\n\nOverall system context in [[Backend Architecture]].",
		tags: ["tech", "backend", "work"],
		links: ["Backend Architecture"],
		created_at: "2023-02-14",
	},

	// 2023 Q2

	{
		title: "API Design Patterns",
		content:
			"REST with consistent response shapes. Bearer token auth. Bulk endpoints for performance. Errors follow HTTP semantics. Versioning strategy: URL path prefix. Document everything in the route file.\n\nSchema decisions in [[Database Design]].",
		tags: ["tech", "backend", "patterns"],
		links: ["Database Design"],
		created_at: "2023-03-30",
	},
	{
		title: "System Design Notes",
		content:
			"Load balancing, horizontal vs vertical scaling. Caching layers: CDN, Redis, in-process. Database sharding and replication. CAP theorem tradeoffs. Event-driven architecture with message queues.\n\nDirectly relevant to [[Database Design]] and [[Backend Architecture]].",
		tags: ["tech", "backend", "learning"],
		links: ["Database Design", "Backend Architecture"],
		created_at: "2023-05-08",
	},
	{
		title: "Workout Plan",
		content:
			"Monday chest and triceps. Wednesday back and biceps. Friday legs and shoulders. Three cardio sessions per week. Progressive overload every two weeks. Rest is part of the programme.\n\nRun tracking in [[Running Log]].",
		tags: ["fitness", "health", "personal"],
		links: ["Running Log"],
		created_at: "2023-06-01",
	},

	// 2023 Q3 

	{
		title: "Reading List",
		content:
			"Currently reading: Designing Data-Intensive Applications. Queue: The Pragmatic Programmer, A Philosophy of Software Design, Crafting Interpreters.\n\nNotes from completed books in [[Clean Code Review]] and [[Starting My Reading Journey]].",
		tags: ["books", "learning"],
		links: ["Clean Code Review", "Starting My Reading Journey"],
		created_at: "2023-07-15",
	},
	{
		title: "Vue 3 Composition API",
		content:
			"ref and reactive for state. computed for derived values. watch and watchEffect for side effects. Composables replace mixins. The setup function runs before the component mounts.\n\nUsed throughout [[Frontend Components]].",
		tags: ["tech", "frontend", "learning"],
		links: ["Frontend Components"],
		created_at: "2023-08-20",
	},
	{
		title: "Cooking Journal",
		content:
			"Tried a new pasta recipe — needed more basil and less salt. Shakshuka on Sunday was perfect. First time making bread from scratch: dense but edible. Adding successes to [[Recipe Collection]]. Techniques from [[Cooking Basics]] really showing.",
		tags: ["cooking", "food", "personal"],
		links: ["Recipe Collection", "Cooking Basics"],
		created_at: "2023-09-05",
	},

	// 2023 Q4

	{
		title: "Running Log",
		content:
			"Week 1: 5km, 6km, 5km. Week 2: 6km, 7km, 6km. Week 8: first 10km run. Pace improving. Goal: half marathon next year.\n\nPart of the structured [[Workout Plan]].",
		tags: ["fitness", "health", "personal"],
		links: ["Workout Plan"],
		created_at: "2023-10-12",
	},
	{
		title: "Docker and Containers",
		content:
			"Images vs containers. Dockerfile layers and caching. docker-compose for multi-service local dev. Volume mounts for persistent data. Health checks and restart policies. Containers made environment parity a solved problem.",
		tags: ["tech", "backend", "learning"],
		links: [],
		created_at: "2023-11-18",
	},
	{
		title: "Personal Goals 2023",
		content:
			"Ran my first 10km. Read eight books. Shipped the backend and started the graph feature. Cooked at home four nights a week on average. Good year overall.\n\nHealth tracked in [[Running Log]] and [[Workout Plan]].",
		tags: ["personal", "planning"],
		links: ["Running Log", "Workout Plan"],
		created_at: "2023-12-28",
	},

	// 2024 Q1 

	{
		title: "Q1 Planning Meeting",
		content:
			"Three main initiatives: graph visualization, full-text search, and tag management. Sprint starts Monday. Deliverables clear.\n\nOutcomes in [[Sprint Retrospective]]. Updates in [[Team Standup Notes]]. Work items: [[Frontend Components]] and [[Graph Visualization Notes]].",
		tags: ["work", "planning", "leadership"],
		links: [
			"Sprint Retrospective",
			"Team Standup Notes",
			"Frontend Components",
			"Graph Visualization Notes",
		],
		created_at: "2024-01-08",
	},
	{
		title: "Frontend Components",
		content:
			"Vue 3 composition API. Editor uses contenteditable for rich text. Force-directed graph with D3.js. Tag panel for per-note and global tag management.\n\nAPI layer in [[Backend Architecture]]. Graph details in [[Graph Visualization Notes]]. Typing in [[TypeScript Fundamentals]].",
		tags: ["tech", "frontend", "work"],
		links: [
			"Backend Architecture",
			"Graph Visualization Notes",
			"TypeScript Fundamentals",
		],
		created_at: "2024-02-14",
	},
	{
		title: "Team Standup Notes",
		content:
			"Daily standups at 10am. Ryan working on note links. Sid working on sidebar navigation. David working on graph visualizations and the tag system. Velocity is good this sprint.",
		tags: ["work", "team"],
		links: [],
		created_at: "2024-03-01",
	},

	// 2024 Q2

	{
		title: "Sprint Retrospective",
		content:
			"Graph visualization sprint went well. Tag system took longer than expected but the two-cache model is solid. Next sprint: sentiment analysis and real data.\n\nOriginated from [[Q1 Planning Meeting]]. Actions in [[Team Standup Notes]].",
		tags: ["work", "planning", "team"],
		links: ["Q1 Planning Meeting", "Team Standup Notes"],
		created_at: "2024-04-05",
	},
	{
		title: "Testing Strategies",
		content:
			"Unit tests for pure functions. Integration tests for API endpoints — hit the real DB, no mocks. E2E tests for critical user flows. Test pyramid: many unit, some integration, few E2E. Coverage is a proxy, not the goal.",
		tags: ["tech", "backend", "patterns"],
		links: [],
		created_at: "2024-05-20",
	},
	{
		title: "Graph Visualization Notes",
		content:
			"D3 force simulation with charge, link, center, and collision forces. Node sizing by connection count. Two edge types: wiki-links (solid) and tag edges (dashed). Stats panel. Path finding with BFS. Timeline mode pins nodes by date.\n\nAlgorithms in [[Data Analysis Methods]].",
		tags: ["tech", "frontend", "data"],
		links: ["Data Analysis Methods"],
		created_at: "2024-06-20",
	},

	// 2024 Q3

	{
		title: "Data Analysis Methods",
		content:
			"BFS for connected component detection. BM25 for full-text ranking. Co-occurrence matrix for tag relationships. Degree centrality for hub notes. Shortest path for note navigation.\n\nImplementation in [[Graph Visualization Notes]]. ML extension in [[Machine Learning Basics]].",
		tags: ["tech", "data", "learning"],
		links: ["Graph Visualization Notes", "Machine Learning Basics"],
		created_at: "2024-07-15",
	},
	{
		title: "Performance Optimisation",
		content:
			"Profile before optimising. Chrome DevTools flame graph. React/Vue component memoisation. Bundle splitting and lazy loading. SQLite query EXPLAIN. N+1 query problem and how to avoid it.",
		tags: ["tech", "frontend", "backend"],
		links: [],
		created_at: "2024-08-22",
	},
	{
		title: "Security Fundamentals",
		content:
			"OWASP Top 10. SQL injection prevention via parameterised queries. XSS and CSP headers. JWT best practices: short expiry, refresh tokens, HttpOnly cookies. Never store secrets in code.",
		tags: ["tech", "backend", "learning"],
		links: [],
		created_at: "2024-09-10",
	},

	// 2024 Q4

	{
		title: "Half Marathon Training",
		content:
			"Base building phase: four runs per week, no speedwork yet. Long run on Sundays, capped at 16km for now. Easy pace for 80% of miles. Heart rate monitoring key to avoiding overtraining.\n\nBuilds on [[Running Log]] and [[Workout Plan]].",
		tags: ["fitness", "health", "personal"],
		links: ["Running Log", "Workout Plan"],
		created_at: "2024-10-05",
	},
	{
		title: "Meal Prep Routine",
		content:
			"Sunday: batch cook grains, roast a tray of vegetables, prep proteins. Keeps weeknight cooking to under 15 minutes. Saves money and avoids bad food decisions when tired.\n\nRecipes from [[Recipe Collection]]. Basics from [[Cooking Basics]].",
		tags: ["cooking", "food", "health"],
		links: ["Recipe Collection", "Cooking Basics"],
		created_at: "2024-11-14",
	},
	{
		title: "Year in Review 2024",
		content:
			"Shipped the graph visualization feature. Passed the 10km mark regularly. Read ten books. Team grew from three to five. Next year: half marathon, ML fundamentals, distributed systems depth.\n\nProject work: [[Q1 Planning Meeting]] and [[Sprint Retrospective]].",
		tags: ["personal", "planning", "work"],
		links: ["Q1 Planning Meeting", "Sprint Retrospective"],
		created_at: "2024-12-30",
	},

	// 2025 Q1 

	{
		title: "Machine Learning Basics",
		content:
			"Supervised vs unsupervised. Gradient descent. Overfitting and regularisation. Neural network basics: layers, activations, backpropagation. Practical: scikit-learn, PyTorch.\n\nBuilds on [[Data Analysis Methods]] and [[Introduction to Databases]].",
		tags: ["tech", "learning", "data"],
		links: ["Data Analysis Methods", "Introduction to Databases"],
		created_at: "2025-01-10",
	},
	{
		title: "Personal Goals 2025",
		content:
			"Run a half marathon by June. Read 12 books. Ship two features. Learn ML fundamentals.\n\nFitness in [[Half Marathon Training]]. Books in [[Reading List]]. Reward trip: [[Travel Plans]].",
		tags: ["personal", "planning"],
		links: ["Half Marathon Training", "Reading List", "Travel Plans"],
		created_at: "2025-02-01",
	},
	{
		title: "Travel Plans",
		content:
			"Japan in spring: Tokyo, Kyoto, Osaka. Book flights three months out. JR Pass for bullet trains. Must-visit: Arashiyama bamboo grove, teamLab digital art, Nishiki Market.",
		tags: ["personal"],
		links: [],
		created_at: "2025-03-18",
	},

	// 2025 Q2 

	{
		title: "Architecture Decision Records",
		content:
			"ADR-001: SQLite over Postgres — simplicity and zero-config for current scale. ADR-002: REST over GraphQL — team familiarity. ADR-003: Vue 3 over React — composition API fits our component model.\n\nContext in [[Backend Architecture]] and [[System Design Notes]].",
		tags: ["tech", "backend", "work"],
		links: ["Backend Architecture", "System Design Notes"],
		created_at: "2025-04-22",
	},
	{
		title: "Observability and Logging",
		content:
			"Structured logs over plaintext. Correlation IDs for request tracing. Metrics: RED method (Rate, Errors, Duration). Alerts on symptoms not causes. OpenTelemetry for vendor-neutral instrumentation.",
		tags: ["tech", "backend", "patterns"],
		links: [],
		created_at: "2025-05-30",
	},
	{
		title: "Half Marathon Race Day",
		content:
			"Finished in 2:04:32. Miles 1–8 felt controlled. Miles 9–11 the hardest. Last two miles on adrenaline. Fuelled at miles 4, 8, and 11. Would start slightly slower next time.\n\nTraining in [[Half Marathon Training]].",
		tags: ["fitness", "health", "personal"],
		links: ["Half Marathon Training"],
		created_at: "2025-06-15",
	},

	// 2025 Q3

	{
		title: "Project Retrospective 2025",
		content:
			"Graph feature shipped and well received. Tag system proved its value. FTS search is fast and accurate. Areas to improve: test coverage, documentation.\n\nStarted at [[Q1 Planning Meeting]]. Graph details in [[Graph Visualization Notes]]. Standups in [[Team Standup Notes]].",
		tags: ["work", "planning", "team"],
		links: [
			"Q1 Planning Meeting",
			"Graph Visualization Notes",
			"Team Standup Notes",
		],
		created_at: "2025-07-20",
	},
	{
		title: "Distributed Systems Notes",
		content:
			"Consensus algorithms: Raft and Paxos. Eventual consistency. Vector clocks for causality. Two-phase commit failure modes. CRDT for conflict-free replicated data.\n\nBuilds on [[System Design Notes]] and [[Architecture Decision Records]].",
		tags: ["tech", "backend", "learning"],
		links: ["System Design Notes", "Architecture Decision Records"],
		created_at: "2025-08-28",
	},

	// 2025 Q4

	{
		title: "Open Source Contributions",
		content:
			"First merged PR to a mid-sized project: fixed a documentation bug. Second: small performance improvement caught with profiling. Good way to learn how larger codebases are structured.",
		tags: ["tech", "learning"],
		links: [],
		created_at: "2025-10-10",
	},
	{
		title: "Year in Review 2025",
		content:
			"Half marathon done. Read 11 books. Shipped two features. Visited Japan — exceeded expectations. Distributed systems knowledge growing. Team culture strong.\n\nMilestones: [[Half Marathon Race Day]], [[Project Retrospective 2025]], [[Travel Plans]].",
		tags: ["personal", "planning", "work"],
		links: [
			"Half Marathon Race Day",
			"Project Retrospective 2025",
			"Travel Plans",
		],
		created_at: "2025-12-28",
	},

	// 2026 Q1

	{
		title: "Q1 Planning Meeting 2026",
		content:
			"Priorities: timeline visualization, sentiment analysis pipeline, performance improvements. New team member joining next week.\n\nLessons from [[Project Retrospective 2025]]. Updates in [[Team Standup Notes]]. Tech decisions in [[Architecture Decision Records]].",
		tags: ["work", "planning", "leadership"],
		links: [
			"Project Retrospective 2025",
			"Team Standup Notes",
			"Architecture Decision Records",
		],
		created_at: "2026-01-06",
	},
	{
		title: "Learning Roadmap 2026",
		content:
			"Q1: finish Designing Data-Intensive Applications. Q2: ML pipelines. Q3: contribute to open source. Q4: write a technical blog post.\n\nBuilds on [[Machine Learning Basics]] and [[Reading List]]. Depth via [[Distributed Systems Notes]].",
		tags: ["learning", "tech", "planning"],
		links: [
			"Machine Learning Basics",
			"Reading List",
			"Distributed Systems Notes",
		],
		created_at: "2026-02-10",
	},
	{
		title: "Personal Goals 2026",
		content:
			"Run another half marathon, targeting sub-2 hours. Read 15 books. Ship two features. Take a second Japan trip.\n\nBuilds on [[Personal Goals 2025]]. Fitness: [[Running Log]]. Books: [[Reading List]].",
		tags: ["personal", "planning"],
		links: ["Personal Goals 2025", "Running Log", "Reading List"],
		created_at: "2026-03-15",
	},

	// Calendar density notes
	// Clustered around existing note dates to create realistic activity bursts.
	// Minimal links so graph structure stays clean.

	// 2024 Q1 cluster
	{
		title: "JavaScript Closures",
		content:
			"Closures let inner functions access outer scope even after the outer function returns. Common patterns: factory functions, partial application, module enclosing private state.",
		tags: ["tech", "learning"],
		links: [],
		created_at: "2024-01-09",
	},
	{
		title: "Agile Ceremonies Overview",
		content:
			"Sprint planning, daily standup, review, and retrospective. Each ceremony has a clear purpose and time-box. Skipping retros is where teams start accumulating process debt.",
		tags: ["work", "planning"],
		links: [],
		created_at: "2024-01-10",
	},
	{
		title: "CSS Custom Properties",
		content:
			"CSS variables (--color-bg etc.) enable runtime theming without JavaScript. Cascade and inheritance apply. Combine with media queries for dark mode without a class toggle.",
		tags: ["tech", "frontend"],
		links: [],
		created_at: "2024-02-12",
	},
	{
		title: "Code Review Checklist",
		content:
			"Check: logic correctness, edge cases, naming, test coverage, security implications, and performance impact. Leave comments as questions not commands. Approve fast when things are good.",
		tags: ["tech", "work"],
		links: [],
		created_at: "2024-02-15",
	},
	{
		title: "API Error Handling Patterns",
		content:
			"Return consistent error shapes: { error, message, code }. Use HTTP status codes correctly. Never leak stack traces to clients. Log full errors server-side with a request correlation ID.",
		tags: ["tech", "backend"],
		links: [],
		created_at: "2024-03-02",
	},
	{
		title: "Pair Programming Notes",
		content:
			"Driver writes, navigator reviews in real time. Switch roles every 25 minutes. Works best for complex logic or onboarding. Exhausting for solo work; use for targeted sessions.",
		tags: ["tech", "work"],
		links: [],
		created_at: "2024-03-04",
	},

	// --- Additional Clusters for 2024 ---
	{
		title: "Apex Trigger Frameworks",
		content:
			"Evaluation of Trigger Handlers vs. logic-less triggers. Using a single entry point per object prevents recursive loops and ensures predictable execution order.",
		tags: ["tech", "salesforce"],
		links: [],
		created_at: "2024-01-09",
	},
	{
		title: "JavaScript Prototypes",
		content:
			'Understanding the prototype chain is key to mastering "class" syntax in JS. Every object has a private property which holds a link to another object called its prototype.',
		tags: ["tech", "learning"],
		links: [],
		created_at: "2024-01-09",
	},
	{
		title: "Daily Standup: Sprint 12",
		content:
			"Blocked on API credentials for the sandbox. Discussed moving the auth logic to a named credential to simplify the Apex callout.",
		tags: ["work", "planning"],
		links: [],
		created_at: "2024-01-10",
	},
	{
		title: "LWC Lifecycle Hooks",
		content:
			"connectedCallback vs renderedCallback. Use connectedCallback for initial data fetch. Avoid manipulating the DOM in renderedCallback to prevent infinite loops.",
		tags: ["tech", "salesforce"],
		links: [],
		created_at: "2024-02-12",
	},
	{
		title: "Flexbox Alignment Guide",
		content:
			'justify-content for main axis, align-items for cross axis. Using "margin: auto" on a flex child is a powerful trick for centering in a specific direction.',
		tags: ["tech", "frontend"],
		links: [],
		created_at: "2024-02-12",
	},
	{
		title: "PR Review: Auth Module",
		content:
			"Found a hardcoded Client ID. Requested move to Custom Metadata. Logic for token refresh looks solid and handles 401s gracefully.",
		tags: ["tech", "work"],
		links: [],
		created_at: "2024-02-15",
	},
	{
		title: "Post-Mortem: Deployment Fail",
		content:
			"Validation failed due to missing picklist values in the metadata. Lesson: always include record types and dependent picklists in the same manifest.",
		tags: ["tech", "work"],
		links: [],
		created_at: "2024-03-02",
	},
	{
		title: "Git Rebase Interactive",
		content:
			'Using rebase -i to squash five tiny "fix" commits into one clean feature commit. Makes the history much easier to read during the final merge.',
		tags: ["tech", "work"],
		links: [],
		created_at: "2024-04-04",
	},
	{
		title: "Uranium Market Thesis",
		content:
			"Supply deficit continues to grow. Focusing on Sprott Physical Uranium Trust (U.UN) for pure-play exposure as utilities look for long-term contracts.",
		tags: ["investing", "personal"],
		links: [],
		created_at: "2024-04-04",
	},
	// 2024 Q2 cluster
	{
		title: "Merge Strategy Decision",
		content:
			"Squash merge for feature branches keeps main history clean. Merge commit for long-running branches preserves context. Rebase for personal branches before PR. Pick one strategy per repo.",
		tags: ["tech", "work"],
		links: [],
		created_at: "2024-04-04",
	},
	{
		title: "Sprint Review Apr 2024",
		content:
			"Demoed graph node selection and path-finding. Stakeholders liked the visual but want better mobile layout. Tag panel feedback positive. Carry-over: performance on large graphs.",
		tags: ["work", "planning"],
		links: [],
		created_at: "2024-04-07",
	},
	{
		title: "Unit Test Patterns",
		content:
			"Arrange-Act-Assert. One assertion per test where possible. Test behaviour not implementation. Descriptive test names that read as sentences. Parameterised tests for edge cases.",
		tags: ["tech", "patterns"],
		links: [],
		created_at: "2024-05-19",
	},
	{
		title: "D3 Zoom Behaviour",
		content:
			"zoom.on fires on every wheel tick. Use transform.rescaleX to get semantic x range. scaleExtent limits how far users can zoom. translateExtent keeps the graph in frame.",
		tags: ["tech", "frontend"],
		links: [],
		created_at: "2024-06-19",
	},
	{
		title: "SVG Performance Tips",
		content:
			"Prefer canvas for 10k+ elements. Use will-change sparingly. Group static elements and only update dynamic subtrees. pointer-events: none on non-interactive layers cuts hit-testing cost.",
		tags: ["tech", "frontend"],
		links: [],
		created_at: "2024-06-21",
	},
	{
		title: "BFS vs DFS",
		content:
			"BFS finds shortest paths in unweighted graphs. DFS uses less memory and is simpler for cycle detection and topological sort. For graph visualisation, BFS is the right tool for connected component detection.",
		tags: ["tech", "data"],
		links: [],
		created_at: "2024-07-13",
	},
	{
		title: "Bundle Splitting Notes",
		content:
			"Route-based code splitting with dynamic imports. Vendor chunk for stable deps. Keep initial bundle under 200 KB gzipped. Analyse with rollup-plugin-visualizer or webpack-bundle-analyzer.",
		tags: ["tech", "frontend"],
		links: [],
		created_at: "2024-08-21",
	},
	{
		title: "Content Security Policy",
		content:
			"CSP prevents XSS by whitelisting sources for scripts, styles, images. Start with report-only mode to catch violations. nonce-based CSP is stronger than hash-based. Always include the report-uri directive.",
		tags: ["tech", "backend"],
		links: [],
		created_at: "2024-09-09",
	},

	// 2024 Q4 cluster
	{
		title: "Race Day Checklist",
		content:
			"Night before: lay out gear, charge watch, prep breakfast. Morning: eat 90 min before gun, warm up 15 min, seed in correct corral. Race: start conservative, fuel at miles 4 and 8, leave nothing for the last stretch.",
		tags: ["fitness", "personal"],
		links: [],
		created_at: "2024-10-06",
	},
	{
		title: "Batch Cooking Session",
		content:
			"Cooked: lentil soup, roasted vegetables, grilled chicken thighs. Prep time 90 minutes, covered five dinners. Adding tahini dressing made everything more interesting. Will repeat weekly.",
		tags: ["cooking", "food"],
		links: [],
		created_at: "2024-11-13",
	},
	{
		title: "2024 Books Summary",
		content:
			"Finished: Designing Data-Intensive Applications, A Philosophy of Software Design, Atomic Habits, The Pragmatic Programmer, and four others. Best read: DDIA, worth multiple passes.",
		tags: ["books", "personal"],
		links: [],
		created_at: "2024-12-29",
	},

	// 2025 Q1 cluster
	{
		title: "Linear Algebra for ML",
		content:
			"Vectors, matrices, dot products. Matrix multiplication as a linear transformation. Eigenvalues and eigenvectors explain PCA. NumPy makes this practical without needing to implement from scratch.",
		tags: ["tech", "data"],
		links: [],
		created_at: "2025-01-08",
	},
	{
		title: "ML Study Session Notes",
		content:
			"Worked through gradient descent with a simple linear regression. Visualising the loss surface helped intuition. Next: logistic regression and the cross-entropy loss.",
		tags: ["tech", "learning"],
		links: [],
		created_at: "2025-01-12",
	},
	{
		title: "2025 Budget and Goals",
		content:
			"Emergency fund topped up. Saving 20% of income. Fitness goal: half marathon by June. Career goal: two shipped features and a conference talk. Learning goal: ML fundamentals done by Q2.",
		tags: ["personal", "planning"],
		links: [],
		created_at: "2025-02-03",
	},
	{
		title: "Japan Itinerary Draft",
		content:
			"Week 1: Tokyo — Shinjuku, Akihabara, Shibuya, teamLab. Week 2: Kyoto — Fushimi Inari, Arashiyama, Nishiki Market, day trip to Nara. Osaka last two days for food. JR Pass covers all bullet trains.",
		tags: ["personal"],
		links: [],
		created_at: "2025-03-17",
	},
	{
		title: "Architecture Review Notes",
		content:
			"Reviewed ADRs with the team. SQLite holding up well at current scale. Agreed to revisit the REST vs event-driven decision at 10× current load. Document assumptions, not just decisions.",
		tags: ["tech", "work"],
		links: [],
		created_at: "2025-04-21",
	},
	{
		title: "Race Week Preparation",
		content:
			"Taper week — reduced mileage by 40%. Keeping easy runs to maintain feel. Sleeping 8 hours. Pre-race meal planned: pasta and roasted vegetables. Bib pickup Saturday morning.",
		tags: ["fitness", "health"],
		links: [],
		created_at: "2025-06-13",
	},
	{
		title: "Post-Race Recovery",
		content:
			"Compression socks for 24 hours. Ice bath day one, heat day two. Easy walk day three. No running for a week. Nutrition: prioritise protein and carbs immediately after. Celebrated with a good dinner.",
		tags: ["fitness", "health"],
		links: [],
		created_at: "2025-06-17",
	},
	// --- Additional Clusters for 2025 ---
	{
		title: "Matrix Calculus for ML",
		content:
			"Deriving gradients for the weights in a neural network. The chain rule becomes a series of matrix multiplications. Essential for understanding backpropagation.",
		tags: ["tech", "learning"],
		links: [],
		created_at: "2025-01-08",
	},
	{
		title: "ETF Portfolio Audit",
		content:
			"XUU (US) and XIC (Canada) are performing as expected. Increasing tilt toward semiconductors (XSD) given the AI hardware demand. Keeping cash reserve at 10%.",
		tags: ["investing", "personal"],
		links: [],
		created_at: "2025-01-08",
	},
	{
		title: "Probability & Statistics Review",
		content:
			'Bayes Theorem applied to spam filtering. If a message contains "win", what is the probability it is actually spam? Helpful for the upcoming ML assignment.',
		tags: ["tech", "learning"],
		links: [],
		created_at: "2025-01-12",
	},
	{
		title: "Tokyo Record Store Map",
		content:
			"Must visit: Disk Union in Shinjuku, Tower Records in Shibuya, and Face Records in Miyashita Park. Bringing an extra carry-on just for vinyl.",
		tags: ["personal", "travel"],
		links: [],
		created_at: "2025-03-17",
	},
	{
		title: "Japan Rail Pass Pricing",
		content:
			"Math check: Tokyo to Kyoto round trip + Nara day trip. The 14-day pass is barely worth it now after the price hike; might be better to buy individual tickets.",
		tags: ["personal", "travel"],
		links: [],
		created_at: "2025-03-17",
	},
	{
		title: "Taper Tantrums (Running)",
		content:
			"Running less makes me feel like I’m losing fitness, but the data says rest is the only way to peak on Sunday. Trusting the 16-week block.",
		tags: ["fitness", "health"],
		links: [],
		created_at: "2025-06-13",
	},
	{
		title: "Race Morning Routine",
		content:
			"Oatmeal with banana. Dynamic stretching. Checking the weather: 12°C with light wind. Perfect conditions for a PB attempt.",
		tags: ["fitness", "health"],
		links: [],
		created_at: "2025-06-13",
	},
	// 2025 Q3-Q4 cluster
	{
		title: "Q3 Sprint Kickoff",
		content:
			"Three tracks: performance improvements, documentation, and new onboarding flow. Two-week sprints. Each track has one lead. Check-in midpoint on week one Friday.",
		tags: ["work", "planning"],
		links: [],
		created_at: "2025-07-18",
	},
	{
		title: "Consensus Algorithm Notes",
		content:
			"Raft leader election: nodes start as followers, timeout triggers candidacy, majority vote wins. Log replication: leader sends entries, commits once a majority acknowledges. Simpler than Paxos to reason about.",
		tags: ["tech", "learning"],
		links: [],
		created_at: "2025-08-27",
	},
	{
		title: "Open Source PR Notes",
		content:
			"Found a docs inconsistency in a popular testing library. Opened an issue first, got maintainer buy-in, then submitted the PR. Review cycle took a week. Second PR: small performance fix, merged same day.",
		tags: ["tech", "learning"],
		links: [],
		created_at: "2025-10-09",
	},
	{
		title: "Advent of Code 2025",
		content:
			"Day 1–5 done in Python. Day 3 required interval merging — good practice. Day 5 used BFS — clicked immediately from graph work. Aiming for top 25 days this year.",
		tags: ["tech", "learning"],
		links: [],
		created_at: "2025-12-05",
	},
	{
		title: "2025 Year Summary",
		content:
			"Half marathon: ✓. Books read: 11. Features shipped: 2. Japan trip: ✓. ML fundamentals: mostly done. Distributed systems knowledge much deeper. Team is strong. Good year.",
		tags: ["personal", "planning"],
		links: [],
		created_at: "2025-12-27",
	},

	// 2026 Q1-Q2 cluster
	{
		title: "2026 Intentions",
		content:
			"Word for the year: depth. Go deeper on ML, on writing, on running. Fewer side projects, more completion. One blog post per quarter. Sub-2 hour half marathon by October.",
		tags: ["personal", "planning"],
		links: [],
		created_at: "2026-01-04",
	},
	{
		title: "Sprint Setup Jan 2026",
		content:
			"Kicked off the new sprint. Timeline visualization is the main deliverable. Graph UX improvements in parallel. Dependency audit scheduled for end of week.",
		tags: ["work", "planning"],
		links: [],
		created_at: "2026-01-05",
	},
	{
		title: "Dependency Audit",
		content:
			"Audited all npm packages — 3 with known vulnerabilities, all low severity. Updated D3 to latest minor. Removed two unused packages. Added automated audit to CI pipeline.",
		tags: ["tech", "work"],
		links: [],
		created_at: "2026-01-08",
	},
	{
		title: "DDIA Reading Notes",
		content:
			"Chapter on replication: single-leader, multi-leader, leaderless. Replication lag causes read-your-writes and monotonic read anomalies. Solutions: read from leader, track replication position per user.",
		tags: ["books", "learning"],
		links: [],
		created_at: "2026-02-09",
	},
	{
		title: "Kafka Fundamentals",
		content:
			"Topics divided into partitions. Consumers in a group each handle a subset of partitions. Retention is time-based not consumption-based. Offsets let consumers replay from any point. Good fit for event sourcing.",
		tags: ["tech", "backend"],
		links: [],
		created_at: "2026-02-12",
	},
	{
		title: "Sub-2hr Training Block",
		content:
			"Starting 16-week plan. Target race pace: 5:40/km. Key sessions: weekly tempo run, fortnightly long run with last 5km at race pace. Heart rate zone 2 for easy days.",
		tags: ["fitness", "health"],
		links: [],
		created_at: "2026-03-14",
	},
	{
		title: "Weekly Retrospective",
		content:
			"Good: graph timeline feature shipped to staging. Needs work: overlay pointer events still flaky on Firefox. Next: fix the hover card positioning and add semantic zoom tests.",
		tags: ["work", "tech"],
		links: [],
		created_at: "2026-03-17",
	},
	{
		title: "Blog Post Draft",
		content:
			"Topic: building a force-directed graph in Vue 3 and D3. Outline: motivation, D3 simulation setup, semantic zoom, timeline mode, lessons learned. Aiming for 1500 words. Draft done by end of April.",
		tags: ["tech", "learning"],
		links: [],
		created_at: "2026-04-07",
	},
	{
		title: "Graph View Improvements",
		content:
			"Fixed hover card position in timeline mode. Added y-boundary clamp so nodes stay in frame. Reduced gravity to let collision force spread nodes naturally. Timeline now occupies the full vertical space.",
		tags: ["tech", "frontend"],
		links: [],
		created_at: "2026-04-12",
	},
	{
		title: "Week in Review",
		content:
			"Productive week: timeline fixes, calendar update, seed script improvements. Reviewed two PRs. Planning session booked for Monday. Good momentum going into the end of the semester.",
		tags: ["work", "personal"],
		links: [],
		created_at: "2026-04-13",
	},

	// 2026 Q2

	{
		title: "Reflections on Four Years of Notes",
		content:
			"Looking back at notes from 2022 to now — the growth is visible. Tech understanding deepened from web fundamentals to distributed systems. Personal habits compounded. The graph view tells the story better than any summary could.\n\nJourney started in [[Starting My Reading Journey]] and [[First Coding Project]]. Current state: [[Learning Roadmap 2026]] and [[Personal Goals 2026]].",
		tags: ["personal", "learning", "planning"],
		links: [
			"Starting My Reading Journey",
			"First Coding Project",
			"Learning Roadmap 2026",
			"Personal Goals 2026",
		],
		created_at: "2026-04-10",
	},
	// --- Additional Clusters for 2026 ---
	{
		title: "Thesis: Agentic Resilience",
		content:
			'Drafted the benchmarking section. How do we measure "self-healing"? Looking at success rates after a simulated API failure in a multi-agent chain.',
		tags: ["tech", "learning"],
		links: [],
		created_at: "2026-01-04",
	},
	{
		title: "Houseplant Care Log",
		content:
			"Repotted the Monstera. It’s definitely getting enough light in the new studio office. Added worm castings to the soil mix. Slow-release fertilizer for the Pothos.",
		tags: ["personal"],
		links: [],
		created_at: "2026-01-04",
	},
	{
		title: "Agentforce Quote POC",
		content:
			'Configured the prompt template to pull data from the Opportunity and related Line Items. Hand-off to the "Discounting Agent" works via a sub-flow.',
		tags: ["tech", "salesforce"],
		links: [],
		created_at: "2026-01-05",
	},
	{
		title: "Multi-Agent Logic Flow",
		content:
			'Using a Router agent to decide between "Technical Support" and "Billing". If the confidence score is < 0.7, default to human intervention.',
		tags: ["tech", "salesforce"],
		links: [],
		created_at: "2026-01-05",
	},
	{
		title: "Database Partitioning (DDIA)",
		content:
			"Key-range partitioning vs. Hash-based. Hash-based is better for preventing hot spots but makes range scans much slower. Trade-offs for every architecture.",
		tags: ["books", "learning"],
		links: [],
		created_at: "2026-02-09",
	},
	{
		title: "Kafka Consumer Groups",
		content:
			"If you have more partitions than consumers, some consumers handle multiple. If you have more consumers than partitions, some stay idle. Scaling 101.",
		tags: ["tech", "backend"],
		links: [],
		created_at: "2026-02-12",
	},
	{
		title: "Weekly Bullion Watch",
		content:
			"Silver is showing strong resistance at recent highs. Copper demand up for EV infrastructure. Checking the premiums at local dealers vs. ETF tracking.",
		tags: ["investing"],
		links: [],
		created_at: "2026-03-14",
	},
	{
		title: "Record Session: Jazz Night",
		content:
			'Spinning "A Love Supreme" while debugging the timeline CSS. Something about the tempo helps with focus. Need to find a cleaner copy of "Kind of Blue".',
		tags: ["personal"],
		links: [],
		created_at: "2026-03-14",
	},
	{
		title: "Firefox Pointer Fix",
		content:
			'Solved the Firefox-specific hover bug by setting "pointer-events: bounding-box" on the SVG elements. Chrome was more forgiving, but Firefox needed the explicit CSS.',
		tags: ["tech", "frontend"],
		links: [],
		created_at: "2026-03-17",
	},
];

// Folders

const FOLDERS = ["Engineering", "Work & Projects", "Health & Fitness", "Personal"];

// Maps note title to folder name. Notes not listed here stay at root.
const NOTE_FOLDERS = {
	// Engineering
	"Web Development Fundamentals":     "Engineering",
	"Introduction to Databases":        "Engineering",
	"Linux Command Line Basics":        "Engineering",
	"Git and Version Control":          "Engineering",
	"CSS Layout Deep Dive":             "Engineering",
	"TypeScript Fundamentals":          "Engineering",
	"Backend Architecture":             "Engineering",
	"Database Design":                  "Engineering",
	"API Design Patterns":              "Engineering",
	"System Design Notes":              "Engineering",
	"Vue 3 Composition API":            "Engineering",
	"Docker and Containers":            "Engineering",
	"Frontend Components":              "Engineering",
	"Graph Visualization Notes":        "Engineering",
	"Data Analysis Methods":            "Engineering",
	"Performance Optimisation":         "Engineering",
	"Security Fundamentals":            "Engineering",
	"Machine Learning Basics":          "Engineering",
	"Architecture Decision Records":    "Engineering",
	"Observability and Logging":        "Engineering",
	"Distributed Systems Notes":        "Engineering",
	"Open Source Contributions":        "Engineering",
	"JavaScript Closures":              "Engineering",
	"CSS Custom Properties":            "Engineering",
	"Code Review Checklist":            "Engineering",
	"API Error Handling Patterns":      "Engineering",
	"JavaScript Prototypes":            "Engineering",
	"Flexbox Alignment Guide":          "Engineering",
	"DDIA Reading Notes":               "Engineering",
	"Kafka Fundamentals":               "Engineering",
	"Kafka Consumer Groups":            "Engineering",
	"Database Partitioning (DDIA)":     "Engineering",
	"Graph View Improvements":          "Engineering",
	"Firefox Pointer Fix":              "Engineering",
	"LWC Lifecycle Hooks":              "Engineering",
	"Apex Trigger Frameworks":          "Engineering",
	"Thesis: Agentic Resilience":       "Engineering",
	"Multi-Agent Logic Flow":           "Engineering",
	"Agentforce Quote POC":             "Engineering",
	"Dependency Audit":                 "Engineering",

	// Work & Projects
	"Q1 Planning Meeting":              "Work & Projects",
	"Team Standup Notes":               "Work & Projects",
	"Sprint Retrospective":             "Work & Projects",
	"Testing Strategies":               "Work & Projects",
	"Agile Ceremonies Overview":        "Work & Projects",
	"PR Review: Auth Module":           "Work & Projects",
	"Pair Programming Notes":           "Work & Projects",
	"Daily Standup: Sprint 12":         "Work & Projects",
	"Q1 Planning Meeting 2026":         "Work & Projects",
	"Weekly Retrospective":             "Work & Projects",
	"Week in Review":                   "Work & Projects",

	// Health & Fitness
	"Workout Plan":                     "Health & Fitness",
	"Running Log":                      "Health & Fitness",
	"Half Marathon Training":           "Health & Fitness",
	"Half Marathon Race Day":           "Health & Fitness",
	"Sub-2hr Training Block":           "Health & Fitness",

	// Personal
	"First Coding Project":             "Personal",
	"Starting My Reading Journey":      "Personal",
	"Personal Goals 2022":              "Personal",
	"Cooking Basics":                   "Personal",
	"Recipe Collection":                "Personal",
	"Clean Code Review":                "Personal",
	"Reading List":                     "Personal",
	"Cooking Journal":                  "Personal",
	"Personal Goals 2023":              "Personal",
	"Meal Prep Routine":                "Personal",
	"Year in Review 2024":              "Personal",
	"Personal Goals 2025":              "Personal",
	"Travel Plans":                     "Personal",
	"Year in Review 2025":              "Personal",
	"Learning Roadmap 2026":            "Personal",
	"Personal Goals 2026":              "Personal",
	"Reflections on Four Years of Notes": "Personal",
	"Blog Post Draft":                  "Personal",
	"Houseplant Care Log":              "Personal",
	"Weekly Bullion Watch":             "Personal",
	"Record Session: Jazz Night":       "Personal",
};

// Helpers

function log(msg) {
	console.log(msg);
}

async function post(path, body, token) {
	const headers = { "Content-Type": "application/json" };
	if (token) headers["Authorization"] = `Bearer ${token}`;
	const res = await fetch(`${API}${path}`, {
		method: "POST",
		headers,
		body: JSON.stringify(body),
	});
	return {
		ok: res.ok,
		status: res.status,
		data: res.ok ? await res.json().catch(() => null) : null,
	};
}

async function get(path, token) {
	const headers = {};
	if (token) headers["Authorization"] = `Bearer ${token}`;
	const res = await fetch(`${API}${path}`, { headers });
	return { ok: res.ok, data: res.ok ? await res.json().catch(() => []) : [] };
}

async function waitForBackend(retries = 20, intervalMs = 3000) {
	for (let i = 0; i < retries; i++) {
		try {
			const res = await fetch(`${API}/health`);
			if (res.ok) {
				return;
			}
		} catch {
			/* not ready yet */
		}
		log(`Waiting for backend... (${i + 1}/${retries})`);
		await new Promise((r) => setTimeout(r, intervalMs));
	}
	throw new Error("Backend did not become ready in time");
}

//Main 

async function main() {
	await waitForBackend();

	// 1. Register (ok to fail if user exists)
	await post("/register", { username: USERNAME, email: EMAIL, password: PASSWORD });

	// 2. Login
	const login = await post("/login", {
		username: USERNAME,
		password: PASSWORD,
	});
	if (!login.ok) throw new Error(`Login failed (status ${login.status})`);
	const token = login.data.token;

	// 3. Load existing tags (idempotency)
	const existingTagsRes = await get("/tags", token);
	const tagIdByName = {};
	for (const t of existingTagsRes.data?.tags ?? [])
		tagIdByName[t.name] = t.id;

	const allTagNames = [...new Set(NOTES.flatMap((n) => n.tags))];
	for (const name of allTagNames) {
		if (tagIdByName[name]) continue;
		const r = await post("/tags", { name }, token);
		if (r.ok && r.data?.id) tagIdByName[name] = r.data.id;
	}

	// 4. Load existing notes (idempotency)
	const existingNotesRes = await get("/notes", token);
	const existingNotes = existingNotesRes.data ?? [];
	const noteIdByTitle = {};
	for (const n of existingNotes) noteIdByTitle[n.title] = n.id;

	let created = 0;
	for (const note of NOTES) {
		if (noteIdByTitle[note.title]) continue;
		const tagLine = note.tags.length
			? "\n\n" + note.tags.map((t) => `#${t}`).join(" ")
			: "";
		const r = await post(
			"/notes",
			{ title: note.title, content: note.content + tagLine },
			token,
		);
		if (!r.ok) continue;
		const id = r.data?.id;
		noteIdByTitle[note.title] = id;

		if (note.tags.length) {
			await post(`/notes/${id}/tags`, { tags: note.tags }, token);
		}

		created++;
	}
	// 5. Apply creation dates (always re-applied so re-running keeps timeline accurate)
	for (const note of NOTES) {
		const id = noteIdByTitle[note.title];
		if (!id) continue;
		await post(`/notes/${id}/created-at`, { created_at: note.created_at }, token);
	}

	// 6. Create wiki-links
	let linkCount = 0;
	for (const note of NOTES) {
		if (!note.links.length) continue;
		const fromId = noteIdByTitle[note.title];
		if (!fromId) continue;
		const toIds = note.links.map((t) => noteIdByTitle[t]).filter(Boolean);
		if (!toIds.length) continue;
		const r = await post(
			"/notes/link",
			{ links: [{ from_id: fromId, to_ids: toIds }] },
			token,
		);
		if (r.ok) linkCount += toIds.length;
	}

	// 7. Index notes for search
	for (const note of NOTES) {
		const id = noteIdByTitle[note.title];
		if (!id) continue;
		await post(`/notes/${id}/index`, {
			title: note.title,
			content: note.content,
			tags: note.tags.join(" "),
		});
	}

	// 8. Create folders (idempotent)
	const existingFoldersRes = await get("/folders", token);
	const folderIdByName = {};
	for (const f of existingFoldersRes.data ?? []) folderIdByName[f.name] = f.id;
	for (const name of FOLDERS) {
		if (folderIdByName[name]) continue;
		const r = await post("/folder", { title: name, parent_folder_id: null }, token);
		if (r.ok && r.data?.id) folderIdByName[name] = r.data.id;
	}

	// 9. Move notes into folders
	for (const [title, folderName] of Object.entries(NOTE_FOLDERS)) {
		const noteId = noteIdByTitle[title];
		const folderId = folderIdByName[folderName];
		if (!noteId || !folderId) continue;
		await post(`/notes/${noteId}/move`, { parent_folder_id: folderId }, token);
	}

	log(`Seed complete: ${created} created, ${NOTES.length - created} skipped, ${linkCount} links`);
}

main().catch((err) => {
	console.error("Seed failed:", err.message);
	process.exit(1);
});

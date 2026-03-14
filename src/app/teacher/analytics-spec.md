# Learning Analytics Dashboard Spec

## Event Data Model

Each analytics event follows this shape:

```ts
{
  learner_id: string,
  session_id: string,
  lesson_id: string,
  topic_id: string,
  difficulty_level: "easy" | "medium" | "hard",
  question_id: string,
  answer_status: "correct" | "wrong" | "skipped",
  is_first_try_correct: boolean,
  retries: number,
  score: number,
  mastery_score: number,
  reviewed_wrong_answer: boolean,
  timestamp: string,
}
```

## Mastery Model

- Not started: 0
- Beginner: 1-39
- Developing: 40-59
- Improving: 60-79
- Mastered: 80-100

## Core Formulas

- mastery_score = `0.45*accuracy + 0.25*first_try_accuracy + 0.20*review_recovery + 0.10*recency_boost`
- growth_score = normalized slope of recent accuracy across latest N attempts
- struggle_score = `0.60*wrong_rate + 0.40*retry_rate`
- engagement_score = `0.50*sessions_per_week + 0.50*streak_score - gap_penalty`

## Teacher-Friendly Terms

- Use `Student` instead of `Learner` in visible tables/cards.
- Use `Skill` instead of `Topic ID`.
- Use `Result` with values `Correct`, `Needs Review`, `Skipped`.
- Use `Correct %` and `Finished %` instead of technical rate terms.
- Use `Growth Check (3/5/10)` instead of raw model language.

## Is Time Required For Growth?

- No. Growth decisions should prioritize accuracy, mastery, and consistency.
- Time/speed is removed from submission and dashboard tracking to keep teacher data simple.
- Focus on accuracy trend, retries, mistake recovery, and consistency.

## Backend Aggregation Logic

Use a nightly materialization plus live incremental updates:

1. `analytics_events_raw`

- append-only event log
- indexed by `timestamp`, `learner_id`, `session_id`, `difficulty_level`, `topic_id`

2. `analytics_sessions`

- aggregate by `session_id`
- fields: total_questions, correct, wrong, skipped, completion_rate, first_try_accuracy, retry_rate

3. `analytics_learner_daily`

- aggregate by learner and day
- fields: attempts, accuracy, mastery_avg, retries, reviewed_wrong_count

4. `analytics_learner_profile`

- rolling profile per learner
- fields: current_level, mastery_stage, growth_3_5_10, struggle_score, engagement_score, strengths, weak_areas, recommendation

5. `analytics_class_daily`

- class/admin aggregate by day and difficulty
- fields: avg_accuracy, avg_mastery, active_users, completion_rate, at_risk_count

Suggested jobs:

- stream processor updates raw + session aggregates in near-real-time
- scheduled job computes daily/profile tables every 15-60 minutes

## API Response Shape

Single endpoint powering dashboard with server-side filtered payload:

```json
{
  "meta": {
    "generated_at": "2026-03-14T10:20:00.000Z",
    "level_filter": "all",
    "time_grain": "week",
    "source": "live"
  },
  "summary": {
    "total_attempts": 0,
    "total_learners": 0,
    "average_accuracy": 0,
    "average_mastery": 0,
    "active_users": 0,
    "completion_rate": 0
  },
  "level_performance": [],
  "growth_trends": {
    "score": [],
    "mastery": [],
    "engagement": []
  },
  "weak_areas": [],
  "review_effectiveness": {},
  "learner_profiles": {
    "items": [],
    "page": 1,
    "per_page": 20,
    "total": 0
  },
  "rewards": {},
  "admin": {
    "class_average": 0,
    "at_risk": [],
    "top_performers": [],
    "hardest_content": [],
    "easiest_content": []
  },
  "events": {
    "items": [],
    "page": 1,
    "per_page": 20,
    "total": 0
  }
}
```

## Recommended Production Components

- `TeacherAnalyticsPage` (orchestration)
- `AnalyticsFiltersBar`
- `SummaryCardsGrid`
- `LevelPerformanceTable`
- `TrendChartsPanel`
- `WeakAreasTable`
- `ReviewEffectivenessCards`
- `LearnerProfilesTable`
- `RewardsProgressPanel`
- `AdminInsightsPanel`
- `EventsTable`
- shared UI:
  - `MetricCard`
  - `SparklineChart`
  - `PaginationControls`
  - `DataStateBanner` (loading/empty/error)

## Empty/Loading/No-Data States

- Loading: skeleton cards, skeleton table rows, chart placeholders
- Empty filtered state: explain why no data appears and offer quick reset actions
- No source data: default to mock mode in non-production, show clear banner

## Mobile UX Rules

- stack summary cards into 1-column on small screens
- charts use compact height, horizontal scroll disabled where possible
- tables are horizontally scrollable containers
- sticky filter bar at top on mobile
- pagination controls remain thumb-reachable

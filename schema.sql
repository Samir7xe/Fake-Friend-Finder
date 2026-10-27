CREATE TABLE IF NOT EXISTS quizzes(id TEXT PRIMARY KEY, creator_name TEXT NOT NULL, creator_gender TEXT NOT NULL DEFAULT 'prefer-not-to-say', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS questions(id BIGSERIAL PRIMARY KEY, quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE, prompt TEXT NOT NULL, options JSONB NOT NULL, correct_answer TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS quiz_sessions(id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE, question_order JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS submissions(id BIGSERIAL PRIMARY KEY, session_id TEXT NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE, player_name TEXT NOT NULL, answers JSONB NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS site_settings(key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public_questions (
    id BIGSERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    submitter_name TEXT NOT NULL DEFAULT 'Anonymous',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS website_questions (
    id BIGSERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_answer TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS website_answers (
    id BIGSERIAL PRIMARY KEY,
    player_name TEXT NOT NULL,
    answers JSONB NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS friend_quizzes (
  id TEXT PRIMARY KEY,
  creator_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS friend_quiz_questions (
  id BIGSERIAL PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES friend_quizzes(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  options JSONB NOT NULL,
  creator_answer TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS friend_quiz_sessions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES friend_quizzes(id) ON DELETE CASCADE,
  question_order JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS friend_quiz_submissions (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES friend_quiz_sessions(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  answers JSONB NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visitor_names (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

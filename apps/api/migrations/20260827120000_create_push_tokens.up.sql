CREATE TABLE push_tokens (
    -- 토큰이 PK인 이유: 같은 기기를 다른 계정으로 로그인하면 주인이 바뀌어야 한다.
    -- user_id는 UNIQUE가 아니다 — 한 사람이 기기를 여러 대 쓸 수 있다.
    token TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX push_tokens_user_idx ON push_tokens (user_id);

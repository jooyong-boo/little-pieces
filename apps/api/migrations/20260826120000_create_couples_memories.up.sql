-- 커플 앱은 "누가 올렸는지"가 보여야 하므로 닉네임이 필수다.
ALTER TABLE users ADD COLUMN nickname TEXT NOT NULL;

CREATE TABLE couples (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    anniversary_date DATE,
    invite_code TEXT NOT NULL UNIQUE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE couple_members (
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    -- 한 유저는 한 커플에만. 조회 후 검사로 막으면 동시 요청에 뚫리므로
    -- DB 제약으로 둬서 모든 경로가 한 번에 막히게 한다.
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (couple_id, user_id)
);

CREATE TABLE memories (
    id UUID PRIMARY KEY,
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    place_name TEXT,
    -- 위치 없는 추억도 허용하므로 nullable (2차 지도 기능에서 사용)
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    -- DATE인 이유: "이 날 여기 갔었다"의 자연스러운 단위가 날짜이고,
    -- TIMESTAMPTZ면 KST 밤에 올린 추억이 UTC 기준으로 전날로 밀린다.
    visited_at DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX memories_couple_visited_idx ON memories (couple_id, visited_at DESC, created_at DESC);

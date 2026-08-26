-- 1차에서 의도적으로 미뤘던 컬럼. 안 쓰는 컬럼이 모든 query_as!에 매핑을 강요하므로
-- 실제로 쓰는 지금 추가한다.
ALTER TABLE memories ADD COLUMN image_keys TEXT[] NOT NULL DEFAULT '{}';

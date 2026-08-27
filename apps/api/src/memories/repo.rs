use chrono::{DateTime, NaiveDate, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{error::AppError, storage::Storage};

/// DB 행 그대로. `query_as!`의 대상이라 컬럼과 필드가 1:1로 맞아야 한다.
///
/// 아래 쿼리들이 `AS "컬럼!"`으로 NOT NULL을 명시하는 이유: sqlx의 NULL 추론은
/// 쿼리 플랜을 보고 판단하는데, LEFT JOIN이 있으면 테이블에 데이터가 쌓여 플랜이
/// 바뀌는 것만으로 왼쪽 테이블 컬럼까지 nullable로 보기 시작한다. 스키마가 이미
/// 보장하는 사실이므로 추론에 맡기지 않고 못 박는다.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryRow {
    pub id: Uuid,
    pub author_user_id: Option<Uuid>,
    /// 탈퇴한 유저의 추억은 남기되 작성자만 비운다(FK가 SET NULL).
    pub author_nickname: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub place_name: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    /// 수정 화면이 그대로 되돌려 보낼 수 있게 키를 함께 내려준다.
    pub image_keys: Vec<String>,
    pub visited_at: NaiveDate,
    pub created_at: DateTime<Utc>,
}

/// 행 + 표시용 서명 URL. 버킷이 비공개라 조회에도 서명이 필요하다.
/// `flatten`이라 JSON은 한 겹으로 나간다 — 필드를 하나하나 옮기는 매퍼가 없다.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryView {
    #[serde(flatten)]
    pub memory: MemoryRow,
    pub image_urls: Vec<String>,
}

fn to_view(memory: MemoryRow, storage: Option<&Storage>) -> MemoryView {
    // 스토리지가 없으면 키만 내려가고 URL은 빈 배열이다.
    let image_urls = storage
        .map(|storage| {
            memory
                .image_keys
                .iter()
                .map(|key| storage.presign_get(key))
                .collect()
        })
        .unwrap_or_default();

    MemoryView { memory, image_urls }
}

pub struct MemoryInput {
    pub title: String,
    pub description: Option<String>,
    pub place_name: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub image_keys: Vec<String>,
    pub visited_at: NaiveDate,
}

pub async fn create(
    pool: &PgPool,
    storage: Option<&Storage>,
    couple_id: Uuid,
    author_user_id: Uuid,
    input: &MemoryInput,
) -> Result<MemoryView, AppError> {
    let id = Uuid::new_v4();

    sqlx::query!(
        "INSERT INTO memories \
         (id, couple_id, author_user_id, title, description, place_name, \
          latitude, longitude, image_keys, visited_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        id,
        couple_id,
        author_user_id,
        input.title,
        input.description,
        input.place_name,
        input.latitude,
        input.longitude,
        &input.image_keys,
        input.visited_at
    )
    .execute(pool)
    .await?;

    find(pool, storage, couple_id, id).await
}

pub async fn list(
    pool: &PgPool,
    storage: Option<&Storage>,
    couple_id: Uuid,
) -> Result<Vec<MemoryView>, AppError> {
    let memories = sqlx::query_as!(
        MemoryRow,
        r#"SELECT m.id AS "id!", m.author_user_id, u.nickname AS "author_nickname?",
                  m.title AS "title!", m.description, m.place_name,
                  m.latitude, m.longitude, m.image_keys AS "image_keys!",
                  m.visited_at AS "visited_at!", m.created_at AS "created_at!"
           FROM memories m
           LEFT JOIN users u ON u.id = m.author_user_id
           WHERE m.couple_id = $1
           ORDER BY m.visited_at DESC, m.created_at DESC"#,
        couple_id
    )
    .fetch_all(pool)
    .await?;

    Ok(memories
        .into_iter()
        .map(|memory| to_view(memory, storage))
        .collect())
}

/// 소유권 검사는 `couple_id`를 WHERE에 넣어 쿼리 자체가 하게 한다.
/// 따로 조회해서 비교하면 검사와 사용 사이가 벌어지고 코드도 늘어난다.
pub async fn find(
    pool: &PgPool,
    storage: Option<&Storage>,
    couple_id: Uuid,
    id: Uuid,
) -> Result<MemoryView, AppError> {
    let memory = sqlx::query_as!(
        MemoryRow,
        r#"SELECT m.id AS "id!", m.author_user_id, u.nickname AS "author_nickname?",
                  m.title AS "title!", m.description, m.place_name,
                  m.latitude, m.longitude, m.image_keys AS "image_keys!",
                  m.visited_at AS "visited_at!", m.created_at AS "created_at!"
           FROM memories m
           LEFT JOIN users u ON u.id = m.author_user_id
           WHERE m.id = $1 AND m.couple_id = $2"#,
        id,
        couple_id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(to_view(memory, storage))
}

pub async fn update(
    pool: &PgPool,
    storage: Option<&Storage>,
    couple_id: Uuid,
    id: Uuid,
    input: &MemoryInput,
) -> Result<MemoryView, AppError> {
    let affected = sqlx::query!(
        "UPDATE memories \
         SET title = $3, description = $4, place_name = $5, \
             latitude = $6, longitude = $7, image_keys = $8, visited_at = $9 \
         WHERE id = $1 AND couple_id = $2",
        id,
        couple_id,
        input.title,
        input.description,
        input.place_name,
        input.latitude,
        input.longitude,
        &input.image_keys,
        input.visited_at
    )
    .execute(pool)
    .await?
    .rows_affected();

    if affected == 0 {
        return Err(AppError::NotFound);
    }

    find(pool, storage, couple_id, id).await
}

pub async fn delete(pool: &PgPool, couple_id: Uuid, id: Uuid) -> Result<(), AppError> {
    let affected = sqlx::query!(
        "DELETE FROM memories WHERE id = $1 AND couple_id = $2",
        id,
        couple_id
    )
    .execute(pool)
    .await?
    .rows_affected();

    if affected == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

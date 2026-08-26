use chrono::{DateTime, NaiveDate, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryView {
    pub id: Uuid,
    pub author_user_id: Option<Uuid>,
    /// 탈퇴한 유저의 추억은 남기되 작성자만 비운다(FK가 SET NULL).
    pub author_nickname: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub place_name: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub visited_at: NaiveDate,
    pub created_at: DateTime<Utc>,
}

pub struct MemoryInput {
    pub title: String,
    pub description: Option<String>,
    pub place_name: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub visited_at: NaiveDate,
}

pub async fn create(
    pool: &PgPool,
    couple_id: Uuid,
    author_user_id: Uuid,
    input: &MemoryInput,
) -> Result<MemoryView, AppError> {
    let id = Uuid::new_v4();

    sqlx::query!(
        "INSERT INTO memories \
         (id, couple_id, author_user_id, title, description, place_name, latitude, longitude, visited_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        id,
        couple_id,
        author_user_id,
        input.title,
        input.description,
        input.place_name,
        input.latitude,
        input.longitude,
        input.visited_at
    )
    .execute(pool)
    .await?;

    find(pool, couple_id, id).await
}

pub async fn list(pool: &PgPool, couple_id: Uuid) -> Result<Vec<MemoryView>, AppError> {
    let memories = sqlx::query_as!(
        MemoryView,
        r#"SELECT m.id, m.author_user_id, u.nickname AS "author_nickname?",
                  m.title, m.description, m.place_name,
                  m.latitude, m.longitude, m.visited_at, m.created_at
           FROM memories m
           LEFT JOIN users u ON u.id = m.author_user_id
           WHERE m.couple_id = $1
           ORDER BY m.visited_at DESC, m.created_at DESC"#,
        couple_id
    )
    .fetch_all(pool)
    .await?;

    Ok(memories)
}

/// 소유권 검사는 `couple_id`를 WHERE에 넣어 쿼리 자체가 하게 한다.
/// 따로 조회해서 비교하면 검사와 사용 사이가 벌어지고 코드도 늘어난다.
pub async fn find(pool: &PgPool, couple_id: Uuid, id: Uuid) -> Result<MemoryView, AppError> {
    sqlx::query_as!(
        MemoryView,
        r#"SELECT m.id, m.author_user_id, u.nickname AS "author_nickname?",
                  m.title, m.description, m.place_name,
                  m.latitude, m.longitude, m.visited_at, m.created_at
           FROM memories m
           LEFT JOIN users u ON u.id = m.author_user_id
           WHERE m.id = $1 AND m.couple_id = $2"#,
        id,
        couple_id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)
}

pub async fn update(
    pool: &PgPool,
    couple_id: Uuid,
    id: Uuid,
    input: &MemoryInput,
) -> Result<MemoryView, AppError> {
    let affected = sqlx::query!(
        "UPDATE memories \
         SET title = $3, description = $4, place_name = $5, \
             latitude = $6, longitude = $7, visited_at = $8 \
         WHERE id = $1 AND couple_id = $2",
        id,
        couple_id,
        input.title,
        input.description,
        input.place_name,
        input.latitude,
        input.longitude,
        input.visited_at
    )
    .execute(pool)
    .await?
    .rows_affected();

    if affected == 0 {
        return Err(AppError::NotFound);
    }

    find(pool, couple_id, id).await
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

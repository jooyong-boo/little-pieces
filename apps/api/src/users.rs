use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub nickname: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
}

pub async fn find_by_email(pool: &PgPool, email: &str) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as!(
        User,
        "SELECT id, email, nickname, password_hash, created_at FROM users WHERE email = $1",
        email
    )
    .fetch_optional(pool)
    .await
}

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as!(
        User,
        "SELECT id, email, nickname, password_hash, created_at FROM users WHERE id = $1",
        id
    )
    .fetch_optional(pool)
    .await
}

pub async fn create(
    pool: &PgPool,
    email: &str,
    nickname: &str,
    password_hash: &str,
) -> Result<User, sqlx::Error> {
    sqlx::query_as!(
        User,
        "INSERT INTO users (id, email, nickname, password_hash) VALUES ($1, $2, $3, $4) \
         RETURNING id, email, nickname, password_hash, created_at",
        Uuid::new_v4(),
        email,
        nickname,
        password_hash
    )
    .fetch_one(pool)
    .await
}

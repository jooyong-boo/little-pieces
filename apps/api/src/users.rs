use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
}

pub async fn find_by_email(pool: &PgPool, email: &str) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as!(
        User,
        "SELECT id, email, password_hash, created_at FROM users WHERE email = $1",
        email
    )
    .fetch_optional(pool)
    .await
}

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as!(
        User,
        "SELECT id, email, password_hash, created_at FROM users WHERE id = $1",
        id
    )
    .fetch_optional(pool)
    .await
}

pub async fn create(pool: &PgPool, email: &str, password_hash: &str) -> Result<User, sqlx::Error> {
    sqlx::query_as!(
        User,
        "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3) \
         RETURNING id, email, password_hash, created_at",
        Uuid::new_v4(),
        email,
        password_hash
    )
    .fetch_one(pool)
    .await
}

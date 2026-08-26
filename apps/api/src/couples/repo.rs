use chrono::{DateTime, NaiveDate, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

/// 커플은 두 명까지.
pub const MAX_COUPLE_MEMBERS: i64 = 2;

const INVITE_CODE_LEN: usize = 6;
/// 32글자(2의 거듭제곱)라 아래 modulo가 치우치지 않는다.
/// 헷갈리기 쉬운 0/O, 1/I는 뺐다 — 코드는 사람이 눈으로 읽고 옮겨 적는다.
const INVITE_ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/// 32^6 ≈ 10억이라 충돌은 사실상 없지만, 났을 때 500을 뱉지 않도록.
const INVITE_CODE_ATTEMPTS: u8 = 3;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoupleMemberView {
    pub user_id: Uuid,
    pub nickname: String,
    pub role: String,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoupleView {
    pub id: Uuid,
    pub name: String,
    pub anniversary_date: Option<NaiveDate>,
    pub invite_code: String,
    pub created_at: DateTime<Utc>,
    pub members: Vec<CoupleMemberView>,
}

fn generate_invite_code() -> String {
    use rand_core::{OsRng, RngCore};

    let mut rng = OsRng;
    (0..INVITE_CODE_LEN)
        .map(|_| {
            let index = (rng.next_u32() % INVITE_ALPHABET.len() as u32) as usize;
            INVITE_ALPHABET[index] as char
        })
        .collect()
}

/// UNIQUE 위반이면 어떤 제약이 터졌는지 알려준다.
/// "한 유저는 한 커플" 같은 규칙을 DB에 맡긴 대가로, 어떤 규칙이었는지는 여기서 되읽는다.
fn unique_violation(err: &sqlx::Error) -> Option<&str> {
    match err {
        sqlx::Error::Database(db) if db.is_unique_violation() => db.constraint(),
        _ => None,
    }
}

pub async fn create(
    pool: &PgPool,
    user_id: Uuid,
    name: &str,
    anniversary_date: Option<NaiveDate>,
) -> Result<CoupleView, AppError> {
    for _ in 0..INVITE_CODE_ATTEMPTS {
        // 초대 코드가 충돌하면 트랜잭션 전체를 다시 연다.
        // Postgres는 제약 위반이 나면 그 트랜잭션을 더 못 쓴다.
        let mut tx = pool.begin().await?;
        let couple_id = Uuid::new_v4();
        let invite_code = generate_invite_code();

        let inserted = sqlx::query!(
            "INSERT INTO couples (id, name, anniversary_date, invite_code, created_by_user_id) \
             VALUES ($1, $2, $3, $4, $5)",
            couple_id,
            name,
            anniversary_date,
            invite_code,
            user_id
        )
        .execute(&mut *tx)
        .await;

        if let Err(err) = inserted {
            if unique_violation(&err) == Some("couples_invite_code_key") {
                continue;
            }
            return Err(err.into());
        }

        sqlx::query!(
            "INSERT INTO couple_members (couple_id, user_id, role) VALUES ($1, $2, 'owner')",
            couple_id,
            user_id
        )
        .execute(&mut *tx)
        .await
        .map_err(|err| match unique_violation(&err) {
            Some("couple_members_user_id_key") => AppError::AlreadyInCouple,
            _ => err.into(),
        })?;

        tx.commit().await?;
        return find_by_user(pool, user_id).await?.ok_or(AppError::NotFound);
    }

    Err(AppError::Internal(
        "초대 코드 생성에 반복 실패했습니다.".into(),
    ))
}

pub async fn join(pool: &PgPool, user_id: Uuid, invite_code: &str) -> Result<CoupleView, AppError> {
    let mut tx = pool.begin().await?;

    // FOR UPDATE로 커플 행을 잠근다. 없으면 같은 코드를 동시에 입력한 두 명이
    // 둘 다 "아직 1명"을 보고 통과해 정원이 3명이 된다.
    let couple_id = sqlx::query_scalar!(
        "SELECT id FROM couples WHERE invite_code = $1 FOR UPDATE",
        invite_code
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::InviteNotFound)?;

    let member_count = sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "count!" FROM couple_members WHERE couple_id = $1"#,
        couple_id
    )
    .fetch_one(&mut *tx)
    .await?;

    if member_count >= MAX_COUPLE_MEMBERS {
        return Err(AppError::CoupleFull);
    }

    sqlx::query!(
        "INSERT INTO couple_members (couple_id, user_id, role) VALUES ($1, $2, 'member')",
        couple_id,
        user_id
    )
    .execute(&mut *tx)
    .await
    .map_err(|err| match unique_violation(&err) {
        Some("couple_members_user_id_key") => AppError::AlreadyInCouple,
        _ => err.into(),
    })?;

    tx.commit().await?;
    find_by_user(pool, user_id).await?.ok_or(AppError::NotFound)
}

pub async fn find_by_user(pool: &PgPool, user_id: Uuid) -> Result<Option<CoupleView>, AppError> {
    let Some(couple) = sqlx::query!(
        r#"SELECT c.id, c.name, c.anniversary_date, c.invite_code, c.created_at
           FROM couples c
           JOIN couple_members m ON m.couple_id = c.id
           WHERE m.user_id = $1"#,
        user_id
    )
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };

    Ok(Some(CoupleView {
        members: list_members(pool, couple.id).await?,
        id: couple.id,
        name: couple.name,
        anniversary_date: couple.anniversary_date,
        invite_code: couple.invite_code,
        created_at: couple.created_at,
    }))
}

async fn list_members(pool: &PgPool, couple_id: Uuid) -> Result<Vec<CoupleMemberView>, AppError> {
    let members = sqlx::query_as!(
        CoupleMemberView,
        r#"SELECT m.user_id, u.nickname, m.role, m.joined_at
           FROM couple_members m
           JOIN users u ON u.id = m.user_id
           WHERE m.couple_id = $1
           ORDER BY m.joined_at"#,
        couple_id
    )
    .fetch_all(pool)
    .await?;

    Ok(members)
}

pub async fn update(
    pool: &PgPool,
    couple_id: Uuid,
    user_id: Uuid,
    name: &str,
    anniversary_date: Option<NaiveDate>,
) -> Result<CoupleView, AppError> {
    sqlx::query!(
        "UPDATE couples SET name = $2, anniversary_date = $3 WHERE id = $1",
        couple_id,
        name,
        anniversary_date
    )
    .execute(pool)
    .await?;

    find_by_user(pool, user_id).await?.ok_or(AppError::NotFound)
}

/// 커플에서 나간다. 마지막 한 명이 나가면 커플 자체를 지운다
/// (memories는 FK CASCADE로 함께 정리된다).
pub async fn leave(pool: &PgPool, user_id: Uuid, couple_id: Uuid) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;

    sqlx::query!("DELETE FROM couple_members WHERE user_id = $1", user_id)
        .execute(&mut *tx)
        .await?;

    let remaining = sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "count!" FROM couple_members WHERE couple_id = $1"#,
        couple_id
    )
    .fetch_one(&mut *tx)
    .await?;

    if remaining == 0 {
        sqlx::query!("DELETE FROM couples WHERE id = $1", couple_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invite_code_has_fixed_length_and_safe_alphabet() {
        for _ in 0..100 {
            let code = generate_invite_code();
            assert_eq!(code.chars().count(), INVITE_CODE_LEN);
            assert!(
                code.bytes().all(|b| INVITE_ALPHABET.contains(&b)),
                "혼동하기 쉬운 문자가 섞였다: {code}"
            );
        }
    }

    #[test]
    fn invite_alphabet_is_power_of_two_so_modulo_is_unbiased() {
        assert!(INVITE_ALPHABET.len().is_power_of_two());
    }
}

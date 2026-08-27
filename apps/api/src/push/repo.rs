use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

/// Expo 푸시 토큰 형식.
///
/// 아무 문자열이나 저장해두면 Expo가 조용히 무시해서, 알림이 안 오는 이유를
/// 나중에 찾기 어렵다. 등록 시점에 거른다.
/// (형식은 expo-server-sdk의 `isExpoPushToken`과 맞춘 것이다.)
pub fn is_expo_push_token(token: &str) -> bool {
    let has_prefix = token.starts_with("ExponentPushToken[") || token.starts_with("ExpoPushToken[");
    has_prefix && token.ends_with(']')
}

/// 같은 기기를 다른 계정으로 로그인하면 토큰 주인이 바뀌어야 한다.
pub async fn upsert(pool: &PgPool, user_id: Uuid, token: &str) -> Result<(), AppError> {
    sqlx::query!(
        "INSERT INTO push_tokens (token, user_id) VALUES ($1, $2) \
         ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id",
        token,
        user_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// 로그아웃 시 이 기기 토큰만 지운다. 남의 토큰을 지우지 못하게 user_id를 함께 건다.
pub async fn delete(pool: &PgPool, user_id: Uuid, token: &str) -> Result<(), AppError> {
    sqlx::query!(
        "DELETE FROM push_tokens WHERE token = $1 AND user_id = $2",
        token,
        user_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// 같은 커플의 **다른** 멤버 토큰만. 자기가 올린 추억 알림을 자기가 받으면 안 된다.
pub async fn partner_tokens(
    pool: &PgPool,
    couple_id: Uuid,
    actor_user_id: Uuid,
) -> Result<Vec<String>, AppError> {
    let tokens = sqlx::query_scalar!(
        "SELECT p.token FROM push_tokens p \
         JOIN couple_members m ON m.user_id = p.user_id \
         WHERE m.couple_id = $1 AND p.user_id <> $2",
        couple_id,
        actor_user_id
    )
    .fetch_all(pool)
    .await?;

    Ok(tokens)
}

/// 커플 전원. 기념일 알림은 함께 만든 추억이라 작성자도 대상이다.
pub async fn couple_tokens(pool: &PgPool, couple_id: Uuid) -> Result<Vec<String>, AppError> {
    let tokens = sqlx::query_scalar!(
        "SELECT p.token FROM push_tokens p \
         JOIN couple_members m ON m.user_id = p.user_id \
         WHERE m.couple_id = $1",
        couple_id
    )
    .fetch_all(pool)
    .await?;

    Ok(tokens)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_both_documented_prefixes() {
        assert!(is_expo_push_token("ExponentPushToken[abc123]"));
        assert!(is_expo_push_token("ExpoPushToken[abc123]"));
    }

    #[test]
    fn rejects_anything_else() {
        for token in [
            "",
            "abc123",
            "ExponentPushToken[abc123",
            "ExponentPushToken",
            "fcm-raw-token-looking-thing",
            "[abc123]",
        ] {
            assert!(!is_expo_push_token(token), "허용되면 안 되는 토큰: {token}");
        }
    }
}

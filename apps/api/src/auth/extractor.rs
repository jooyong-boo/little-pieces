use axum::{
    extract::FromRequestParts,
    http::{header::AUTHORIZATION, request::Parts},
};
use uuid::Uuid;

use crate::{auth::jwt, error::AppError, state::AppState};

/// 인증된 유저. Authorization 헤더 파싱 + JWT 검증을 한 곳에 모은다.
pub struct AuthUser {
    pub user_id: Uuid,
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.strip_prefix("Bearer "))
            .ok_or(AppError::InvalidCredentials)?;

        let claims =
            jwt::verify(token, &state.jwt_secret).map_err(|_| AppError::InvalidCredentials)?;

        Ok(AuthUser {
            user_id: claims.sub,
        })
    }
}

/// 커플에 소속된 유저. 추억 관련 핸들러는 전부 `couple_id`가 필요하므로
/// 매 핸들러에서 조회하는 대신 추출기 단계에서 보장한다.
pub struct CoupleMember {
    pub user_id: Uuid,
    pub couple_id: Uuid,
}

impl FromRequestParts<AppState> for CoupleMember {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let AuthUser { user_id } = AuthUser::from_request_parts(parts, state).await?;

        let couple_id = sqlx::query_scalar!(
            "SELECT couple_id FROM couple_members WHERE user_id = $1",
            user_id
        )
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NoCouple)?;

        Ok(CoupleMember { user_id, couple_id })
    }
}

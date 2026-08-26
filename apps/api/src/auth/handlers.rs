use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString, rand_core::OsRng},
};
use axum::{Json, extract::State};
use serde::{Deserialize, Serialize};

use crate::{
    auth::{extractor::AuthUser, jwt},
    error::AppError,
    response::ApiResponse,
    state::AppState,
    users,
};

const NICKNAME_MAX_LEN: usize = 20;
const PASSWORD_MIN_LEN: usize = 8;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignupRequest {
    pub email: String,
    pub password: String,
    pub nickname: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthResponse {
    pub token: String,
}

fn validate_credentials(email: &str, password: &str) -> Result<(), AppError> {
    if !email.contains('@') {
        return Err(AppError::Validation(
            "올바른 이메일 형식이 아닙니다.".into(),
        ));
    }
    if password.len() < PASSWORD_MIN_LEN {
        return Err(AppError::Validation(
            "비밀번호는 8자 이상이어야 합니다.".into(),
        ));
    }
    Ok(())
}

/// 닉네임은 파트너 화면에 그대로 노출되므로 공백만 있는 값을 거른다.
/// 정규화된 닉네임을 돌려줘서 호출부가 trim을 잊지 않게 한다.
fn validate_nickname(nickname: &str) -> Result<String, AppError> {
    let trimmed = nickname.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation("닉네임을 입력해주세요.".into()));
    }
    if trimmed.chars().count() > NICKNAME_MAX_LEN {
        return Err(AppError::Validation(
            "닉네임은 20자 이하여야 합니다.".into(),
        ));
    }
    Ok(trimmed.to_string())
}

pub async fn signup(
    State(state): State<AppState>,
    Json(payload): Json<SignupRequest>,
) -> Result<Json<ApiResponse<AuthResponse>>, AppError> {
    validate_credentials(&payload.email, &payload.password)?;
    let nickname = validate_nickname(&payload.nickname)?;

    if users::find_by_email(&state.pool, &payload.email)
        .await?
        .is_some()
    {
        return Err(AppError::EmailTaken);
    }

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(payload.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("password hashing failed: {e}")))?
        .to_string();

    let user = users::create(&state.pool, &payload.email, &nickname, &password_hash).await?;
    let token = jwt::issue(user.id, &state.jwt_secret)?;

    Ok(Json(ApiResponse::ok(AuthResponse { token })))
}

pub async fn me(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
) -> Result<Json<ApiResponse<users::User>>, AppError> {
    let user = users::find_by_id(&state.pool, user_id)
        .await?
        .ok_or(AppError::InvalidCredentials)?;

    Ok(Json(ApiResponse::ok(user)))
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<ApiResponse<AuthResponse>>, AppError> {
    let user = users::find_by_email(&state.pool, &payload.email)
        .await?
        .ok_or(AppError::InvalidCredentials)?;

    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|e| AppError::Internal(format!("stored hash unreadable: {e}")))?;

    Argon2::default()
        .verify_password(payload.password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::InvalidCredentials)?;

    let token = jwt::issue(user.id, &state.jwt_secret)?;

    Ok(Json(ApiResponse::ok(AuthResponse { token })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_email() {
        assert!(validate_credentials("not-an-email", "password123").is_err());
    }

    #[test]
    fn rejects_short_password() {
        assert!(validate_credentials("a@b.com", "short").is_err());
    }

    #[test]
    fn accepts_valid_credentials() {
        assert!(validate_credentials("a@b.com", "password123").is_ok());
    }

    #[test]
    fn rejects_whitespace_only_nickname() {
        assert!(validate_nickname("   ").is_err());
    }

    #[test]
    fn rejects_too_long_nickname() {
        assert!(validate_nickname(&"가".repeat(NICKNAME_MAX_LEN + 1)).is_err());
    }

    #[test]
    fn accepts_multibyte_nickname_at_limit() {
        // 바이트 길이로 셌다면 한글 20자(60바이트)가 여기서 걸린다.
        assert_eq!(
            validate_nickname(&"가".repeat(NICKNAME_MAX_LEN))
                .unwrap()
                .chars()
                .count(),
            NICKNAME_MAX_LEN
        );
    }

    #[test]
    fn trims_nickname() {
        assert_eq!(validate_nickname("  보리  ").unwrap(), "보리");
    }
}

use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString, rand_core::OsRng},
};
use axum::{
    Json,
    extract::State,
    http::{HeaderMap, header::AUTHORIZATION},
};
use serde::{Deserialize, Serialize};

use crate::{auth::jwt, error::AppError, response::ApiResponse, state::AppState, users};

#[derive(Deserialize)]
pub struct SignupRequest {
    pub email: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
}

fn validate_credentials(email: &str, password: &str) -> Result<(), AppError> {
    if !email.contains('@') {
        return Err(AppError::Validation(
            "올바른 이메일 형식이 아닙니다.".into(),
        ));
    }
    if password.len() < 8 {
        return Err(AppError::Validation(
            "비밀번호는 8자 이상이어야 합니다.".into(),
        ));
    }
    Ok(())
}

pub async fn signup(
    State(state): State<AppState>,
    Json(payload): Json<SignupRequest>,
) -> Result<Json<ApiResponse<AuthResponse>>, AppError> {
    validate_credentials(&payload.email, &payload.password)?;

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

    let user = users::create(&state.pool, &payload.email, &password_hash).await?;
    let token = jwt::issue(user.id, &state.jwt_secret)?;

    Ok(Json(ApiResponse::ok(AuthResponse { token })))
}

pub async fn me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<users::User>>, AppError> {
    let token = headers
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or(AppError::InvalidCredentials)?;

    let claims = jwt::verify(token, &state.jwt_secret).map_err(|_| AppError::InvalidCredentials)?;

    let user = users::find_by_id(&state.pool, claims.sub)
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
}

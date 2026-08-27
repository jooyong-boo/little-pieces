use axum::{Json, extract::State};
use serde::Deserialize;

use crate::{
    auth::extractor::AuthUser, error::AppError, push::repo, response::ApiResponse, state::AppState,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushTokenRequest {
    pub token: String,
}

fn validate(token: &str) -> Result<&str, AppError> {
    let trimmed = token.trim();
    if !repo::is_expo_push_token(trimmed) {
        return Err(AppError::Validation(
            "올바른 Expo 푸시 토큰이 아닙니다.".into(),
        ));
    }
    Ok(trimmed)
}

pub async fn register(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Json(payload): Json<PushTokenRequest>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    repo::upsert(&state.pool, user_id, validate(&payload.token)?).await?;
    Ok(Json(ApiResponse::ok(())))
}

pub async fn unregister(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Json(payload): Json<PushTokenRequest>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    repo::delete(&state.pool, user_id, validate(&payload.token)?).await?;
    Ok(Json(ApiResponse::ok(())))
}

use axum::{Json, extract::State};
use chrono::NaiveDate;
use serde::Deserialize;

use crate::{
    auth::extractor::{AuthUser, CoupleMember},
    couples::repo::{self, CoupleView},
    error::AppError,
    response::ApiResponse,
    state::AppState,
};

const COUPLE_NAME_MAX_LEN: usize = 50;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertCoupleRequest {
    pub name: String,
    pub anniversary_date: Option<NaiveDate>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinCoupleRequest {
    pub invite_code: String,
}

fn validate_name(name: &str) -> Result<String, AppError> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation("커플 이름을 입력해주세요.".into()));
    }
    if trimmed.chars().count() > COUPLE_NAME_MAX_LEN {
        return Err(AppError::Validation(
            "커플 이름은 50자 이하여야 합니다.".into(),
        ));
    }
    Ok(trimmed.to_string())
}

/// 초대 코드는 사람이 손으로 옮겨 적으므로 공백과 대소문자를 흡수한다.
fn normalize_invite_code(code: &str) -> String {
    code.trim().to_uppercase().replace(['-', ' '], "")
}

pub async fn create(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Json(payload): Json<UpsertCoupleRequest>,
) -> Result<Json<ApiResponse<CoupleView>>, AppError> {
    let name = validate_name(&payload.name)?;
    let couple = repo::create(&state.pool, user_id, &name, payload.anniversary_date).await?;
    Ok(Json(ApiResponse::ok(couple)))
}

/// 커플이 없는 것은 신규 유저의 정상 상태다. 에러로 내려보내면
/// 클라이언트가 온보딩과 인증 실패를 구분할 수 없고 재시도만 돌게 된다.
pub async fn me(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
) -> Result<Json<ApiResponse<Option<CoupleView>>>, AppError> {
    let couple = repo::find_by_user(&state.pool, user_id).await?;
    Ok(Json(ApiResponse::ok(couple)))
}

pub async fn join(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Json(payload): Json<JoinCoupleRequest>,
) -> Result<Json<ApiResponse<CoupleView>>, AppError> {
    let code = normalize_invite_code(&payload.invite_code);
    if code.is_empty() {
        return Err(AppError::Validation("초대 코드를 입력해주세요.".into()));
    }

    let couple = repo::join(&state.pool, user_id, &code).await?;
    Ok(Json(ApiResponse::ok(couple)))
}

pub async fn update(
    State(state): State<AppState>,
    CoupleMember { user_id, couple_id }: CoupleMember,
    Json(payload): Json<UpsertCoupleRequest>,
) -> Result<Json<ApiResponse<CoupleView>>, AppError> {
    let name = validate_name(&payload.name)?;
    let couple = repo::update(
        &state.pool,
        couple_id,
        user_id,
        &name,
        payload.anniversary_date,
    )
    .await?;
    Ok(Json(ApiResponse::ok(couple)))
}

pub async fn leave(
    State(state): State<AppState>,
    CoupleMember { user_id, couple_id }: CoupleMember,
) -> Result<Json<ApiResponse<()>>, AppError> {
    repo::leave(&state.pool, user_id, couple_id).await?;
    Ok(Json(ApiResponse::ok(())))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_blank_name() {
        assert!(validate_name("   ").is_err());
    }

    #[test]
    fn trims_name() {
        assert_eq!(validate_name("  우리  ").unwrap(), "우리");
    }

    #[test]
    fn normalizes_hand_typed_invite_code() {
        assert_eq!(normalize_invite_code(" ab3-k9z "), "AB3K9Z");
    }
}

use axum::{
    Json,
    extract::{Path, State},
};
use chrono::NaiveDate;
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    auth::extractor::CoupleMember,
    error::AppError,
    memories::repo::{self, MemoryInput, MemoryView},
    response::ApiResponse,
    state::AppState,
};

const TITLE_MAX_LEN: usize = 120;
const DESCRIPTION_MAX_LEN: usize = 500;
const PLACE_NAME_MAX_LEN: usize = 100;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryRequest {
    pub title: String,
    pub description: Option<String>,
    pub place_name: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub visited_at: NaiveDate,
}

/// 빈 문자열은 "값 없음"으로 취급한다 — 폼에서 비워 보낸 것과 같다.
fn optional_text(
    value: Option<String>,
    max_len: usize,
    label: &str,
) -> Result<Option<String>, AppError> {
    let Some(trimmed) = value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
    else {
        return Ok(None);
    };
    if trimmed.chars().count() > max_len {
        return Err(AppError::Validation(format!(
            "{label}은(는) {max_len}자 이하여야 합니다."
        )));
    }
    Ok(Some(trimmed))
}

/// 위경도는 항상 짝으로 온다. 하나만 오면 지도에 찍을 수 없으므로 거른다.
fn validate_coordinates(
    latitude: Option<f64>,
    longitude: Option<f64>,
) -> Result<(Option<f64>, Option<f64>), AppError> {
    match (latitude, longitude) {
        (None, None) => Ok((None, None)),
        (Some(lat), Some(lon)) => {
            if !(-90.0..=90.0).contains(&lat) || !(-180.0..=180.0).contains(&lon) {
                return Err(AppError::Validation("좌표 범위를 벗어났습니다.".into()));
            }
            Ok((Some(lat), Some(lon)))
        }
        _ => Err(AppError::Validation(
            "위도와 경도는 함께 보내야 합니다.".into(),
        )),
    }
}

fn to_input(payload: MemoryRequest) -> Result<MemoryInput, AppError> {
    let title = payload.title.trim().to_string();
    if title.is_empty() {
        return Err(AppError::Validation("제목을 입력해주세요.".into()));
    }
    if title.chars().count() > TITLE_MAX_LEN {
        return Err(AppError::Validation(format!(
            "제목은 {TITLE_MAX_LEN}자 이하여야 합니다."
        )));
    }

    let (latitude, longitude) = validate_coordinates(payload.latitude, payload.longitude)?;

    Ok(MemoryInput {
        title,
        description: optional_text(payload.description, DESCRIPTION_MAX_LEN, "설명")?,
        place_name: optional_text(payload.place_name, PLACE_NAME_MAX_LEN, "장소명")?,
        latitude,
        longitude,
        visited_at: payload.visited_at,
    })
}

pub async fn create(
    State(state): State<AppState>,
    CoupleMember { user_id, couple_id }: CoupleMember,
    Json(payload): Json<MemoryRequest>,
) -> Result<Json<ApiResponse<MemoryView>>, AppError> {
    let input = to_input(payload)?;
    let memory = repo::create(&state.pool, couple_id, user_id, &input).await?;
    Ok(Json(ApiResponse::ok(memory)))
}

pub async fn list(
    State(state): State<AppState>,
    CoupleMember { couple_id, .. }: CoupleMember,
) -> Result<Json<ApiResponse<Vec<MemoryView>>>, AppError> {
    let memories = repo::list(&state.pool, couple_id).await?;
    Ok(Json(ApiResponse::ok(memories)))
}

pub async fn find(
    State(state): State<AppState>,
    CoupleMember { couple_id, .. }: CoupleMember,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<MemoryView>>, AppError> {
    let memory = repo::find(&state.pool, couple_id, id).await?;
    Ok(Json(ApiResponse::ok(memory)))
}

pub async fn update(
    State(state): State<AppState>,
    CoupleMember { couple_id, .. }: CoupleMember,
    Path(id): Path<Uuid>,
    Json(payload): Json<MemoryRequest>,
) -> Result<Json<ApiResponse<MemoryView>>, AppError> {
    let input = to_input(payload)?;
    let memory = repo::update(&state.pool, couple_id, id, &input).await?;
    Ok(Json(ApiResponse::ok(memory)))
}

pub async fn delete(
    State(state): State<AppState>,
    CoupleMember { couple_id, .. }: CoupleMember,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    repo::delete(&state.pool, couple_id, id).await?;
    Ok(Json(ApiResponse::ok(())))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(title: &str) -> MemoryRequest {
        MemoryRequest {
            title: title.into(),
            description: None,
            place_name: None,
            latitude: None,
            longitude: None,
            visited_at: NaiveDate::from_ymd_opt(2026, 8, 26).unwrap(),
        }
    }

    #[test]
    fn rejects_blank_title() {
        assert!(to_input(request("   ")).is_err());
    }

    #[test]
    fn accepts_memory_without_location() {
        assert!(to_input(request("첫 데이트")).is_ok());
    }

    #[test]
    fn rejects_half_a_coordinate_pair() {
        assert!(validate_coordinates(Some(37.5), None).is_err());
        assert!(validate_coordinates(None, Some(127.0)).is_err());
    }

    #[test]
    fn rejects_out_of_range_coordinates() {
        assert!(validate_coordinates(Some(91.0), Some(127.0)).is_err());
        assert!(validate_coordinates(Some(37.5), Some(181.0)).is_err());
    }

    #[test]
    fn treats_empty_description_as_absent() {
        assert_eq!(optional_text(Some("  ".into()), 10, "설명").unwrap(), None);
    }

    #[test]
    fn counts_description_length_in_characters_not_bytes() {
        let korean = "가".repeat(DESCRIPTION_MAX_LEN);
        assert!(optional_text(Some(korean), DESCRIPTION_MAX_LEN, "설명").is_ok());
    }
}

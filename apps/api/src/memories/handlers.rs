use axum::{
    Json,
    extract::{Path, State},
};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    auth::extractor::CoupleMember,
    error::AppError,
    memories::repo::{self, MemoryInput, MemoryView},
    push,
    response::ApiResponse,
    state::AppState,
    storage::{self, Storage},
};

const TITLE_MAX_LEN: usize = 120;
const DESCRIPTION_MAX_LEN: usize = 500;
const PLACE_NAME_MAX_LEN: usize = 100;
const MAX_IMAGES: usize = 10;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryRequest {
    pub title: String,
    pub description: Option<String>,
    pub place_name: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub image_keys: Option<Vec<String>>,
    pub visited_at: NaiveDate,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadUrlRequest {
    pub content_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadUrlResponse {
    pub key: String,
    pub upload_url: String,
    pub expires_in_seconds: u64,
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

/// 클라이언트가 보낸 키를 그대로 믿으면 남의 커플 사진을 참조할 수 있다.
/// 전 항목이 이 커플 소유인지 확인한다.
fn validate_image_keys(
    couple_id: Uuid,
    keys: Option<Vec<String>>,
) -> Result<Vec<String>, AppError> {
    let keys = keys.unwrap_or_default();

    if keys.len() > MAX_IMAGES {
        return Err(AppError::Validation(format!(
            "사진은 {MAX_IMAGES}장까지 넣을 수 있습니다."
        )));
    }
    if keys.iter().any(|key| !storage::is_owned_by(couple_id, key)) {
        return Err(AppError::ForeignImageKey);
    }

    Ok(keys)
}

fn to_input(couple_id: Uuid, payload: MemoryRequest) -> Result<MemoryInput, AppError> {
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
        image_keys: validate_image_keys(couple_id, payload.image_keys)?,
        visited_at: payload.visited_at,
    })
}

pub async fn create(
    State(state): State<AppState>,
    CoupleMember { user_id, couple_id }: CoupleMember,
    Json(payload): Json<MemoryRequest>,
) -> Result<Json<ApiResponse<MemoryView>>, AppError> {
    let input = to_input(couple_id, payload)?;
    let memory = repo::create(
        &state.pool,
        state.storage.as_ref(),
        couple_id,
        user_id,
        &input,
    )
    .await?;

    // 알림은 곁가지다. 전송이 늦거나 실패해도 추억 저장 응답을 붙잡으면 안 된다.
    let pool = state.pool.clone();
    let title = memory.memory.title.clone();
    let memory_id = memory.memory.id;
    tokio::spawn(async move {
        push::send::notify_partner(
            &pool,
            couple_id,
            user_id,
            "새 추억이 등록됐어요".to_string(),
            title,
            serde_json::json!({ "memoryId": memory_id }),
        )
        .await;
    });

    Ok(Json(ApiResponse::ok(memory)))
}

pub async fn list(
    State(state): State<AppState>,
    CoupleMember { couple_id, .. }: CoupleMember,
) -> Result<Json<ApiResponse<Vec<MemoryView>>>, AppError> {
    let memories = repo::list(&state.pool, state.storage.as_ref(), couple_id).await?;
    Ok(Json(ApiResponse::ok(memories)))
}

pub async fn find(
    State(state): State<AppState>,
    CoupleMember { couple_id, .. }: CoupleMember,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<MemoryView>>, AppError> {
    let memory = repo::find(&state.pool, state.storage.as_ref(), couple_id, id).await?;
    Ok(Json(ApiResponse::ok(memory)))
}

pub async fn update(
    State(state): State<AppState>,
    CoupleMember { couple_id, .. }: CoupleMember,
    Path(id): Path<Uuid>,
    Json(payload): Json<MemoryRequest>,
) -> Result<Json<ApiResponse<MemoryView>>, AppError> {
    let input = to_input(couple_id, payload)?;
    let memory = repo::update(&state.pool, state.storage.as_ref(), couple_id, id, &input).await?;
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

/// 추억 ID를 요구하지 않는다. 신규 작성 화면에는 추억이 아직 없으므로,
/// ID를 요구하면 "추억 먼저 만들고 → 업로드 → 다시 수정" 3단이 된다.
/// 커플 스코프 키만 있으면 신규와 수정이 같은 경로를 쓴다.
pub async fn upload_url(
    State(state): State<AppState>,
    CoupleMember { couple_id, .. }: CoupleMember,
    Json(payload): Json<UploadUrlRequest>,
) -> Result<Json<ApiResponse<UploadUrlResponse>>, AppError> {
    let storage = state.storage.as_ref().ok_or(AppError::StorageUnavailable)?;

    let key = storage::image_key(couple_id, payload.content_type.trim())?;
    let upload_url = storage.presign_put(&key);

    Ok(Json(ApiResponse::ok(UploadUrlResponse {
        key,
        upload_url,
        expires_in_seconds: Storage::put_url_ttl_seconds(),
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn couple() -> Uuid {
        Uuid::parse_str("11111111-1111-4111-8111-111111111111").unwrap()
    }

    fn request(title: &str) -> MemoryRequest {
        MemoryRequest {
            title: title.into(),
            description: None,
            place_name: None,
            latitude: None,
            longitude: None,
            image_keys: None,
            visited_at: NaiveDate::from_ymd_opt(2026, 8, 26).unwrap(),
        }
    }

    #[test]
    fn rejects_blank_title() {
        assert!(to_input(couple(), request("   ")).is_err());
    }

    #[test]
    fn accepts_memory_without_location() {
        assert!(to_input(couple(), request("첫 데이트")).is_ok());
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
    fn accepts_own_couples_image_keys() {
        let key = storage::image_key(couple(), "image/jpeg").unwrap();
        assert_eq!(
            validate_image_keys(couple(), Some(vec![key.clone()])).unwrap(),
            vec![key]
        );
    }

    #[test]
    fn rejects_another_couples_image_key() {
        let other = Uuid::parse_str("22222222-2222-4222-8222-222222222222").unwrap();
        let theirs = storage::image_key(other, "image/jpeg").unwrap();
        assert!(validate_image_keys(couple(), Some(vec![theirs])).is_err());
    }

    #[test]
    fn rejects_one_bad_key_among_good_ones() {
        let other = Uuid::parse_str("22222222-2222-4222-8222-222222222222").unwrap();
        let keys = vec![
            storage::image_key(couple(), "image/jpeg").unwrap(),
            storage::image_key(other, "image/png").unwrap(),
            storage::image_key(couple(), "image/webp").unwrap(),
        ];
        assert!(validate_image_keys(couple(), Some(keys)).is_err());
    }

    #[test]
    fn rejects_more_images_than_the_limit() {
        let keys = (0..=MAX_IMAGES)
            .map(|_| storage::image_key(couple(), "image/jpeg").unwrap())
            .collect();
        assert!(validate_image_keys(couple(), Some(keys)).is_err());
    }

    #[test]
    fn treats_missing_image_keys_as_none_selected() {
        assert_eq!(
            validate_image_keys(couple(), None).unwrap(),
            Vec::<String>::new()
        );
    }

    #[test]
    fn counts_description_length_in_characters_not_bytes() {
        let korean = "가".repeat(DESCRIPTION_MAX_LEN);
        assert!(optional_text(Some(korean), DESCRIPTION_MAX_LEN, "설명").is_ok());
    }
}

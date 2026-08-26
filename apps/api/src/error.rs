use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};

use crate::response::ApiResponse;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Validation(String),
    #[error("invalid credentials")]
    InvalidCredentials,
    #[error("email already registered")]
    EmailTaken,
    #[error("커플에 소속되어 있지 않습니다.")]
    NoCouple,
    #[error("이미 커플에 소속되어 있습니다.")]
    AlreadyInCouple,
    #[error("초대 코드를 찾을 수 없습니다.")]
    InviteNotFound,
    #[error("이미 두 명이 참여한 커플입니다.")]
    CoupleFull,
    #[error("대상을 찾을 수 없습니다.")]
    NotFound,
    #[error("이미지 저장소가 설정되지 않았습니다.")]
    StorageUnavailable,
    #[error("지원하지 않는 이미지 형식입니다.")]
    UnsupportedImageType,
    #[error("다른 커플의 이미지는 사용할 수 없습니다.")]
    ForeignImageKey,
    #[error("internal error: {0}")]
    Internal(String),
    #[error(transparent)]
    Database(#[from] sqlx::Error),
    #[error(transparent)]
    Token(#[from] jsonwebtoken::errors::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = match &self {
            AppError::Validation(_) | AppError::UnsupportedImageType => StatusCode::BAD_REQUEST,
            AppError::InvalidCredentials => StatusCode::UNAUTHORIZED,
            AppError::NoCouple | AppError::ForeignImageKey => StatusCode::FORBIDDEN,
            AppError::EmailTaken | AppError::AlreadyInCouple | AppError::CoupleFull => {
                StatusCode::CONFLICT
            }
            AppError::InviteNotFound | AppError::NotFound => StatusCode::NOT_FOUND,
            AppError::StorageUnavailable => StatusCode::SERVICE_UNAVAILABLE,
            AppError::Internal(_) | AppError::Database(_) | AppError::Token(_) => {
                StatusCode::INTERNAL_SERVER_ERROR
            }
        };

        let message = match &self {
            AppError::Internal(_) | AppError::Database(_) | AppError::Token(_) => {
                tracing::error!(error = %self, "internal error");
                "internal server error".to_string()
            }
            other => other.to_string(),
        };

        (status, Json(ApiResponse::<()>::err(message))).into_response()
    }
}

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
            AppError::Validation(_) => StatusCode::BAD_REQUEST,
            AppError::InvalidCredentials => StatusCode::UNAUTHORIZED,
            AppError::EmailTaken => StatusCode::CONFLICT,
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

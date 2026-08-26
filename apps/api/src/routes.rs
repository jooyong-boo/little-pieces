use axum::{
    Json, Router,
    routing::{get, post},
};
use tower_http::cors::CorsLayer;

use crate::{auth::handlers, response::ApiResponse, state::AppState};

async fn health() -> Json<ApiResponse<&'static str>> {
    Json(ApiResponse::ok("ok"))
}

pub fn build(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/auth/signup", post(handlers::signup))
        .route("/auth/login", post(handlers::login))
        .route("/auth/me", get(handlers::me))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

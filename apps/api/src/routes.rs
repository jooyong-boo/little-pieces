use axum::{
    Json, Router,
    routing::{get, post},
};
use tower_http::cors::CorsLayer;

use crate::{
    auth::handlers as auth, couples::handlers as couples, memories::handlers as memories,
    response::ApiResponse, state::AppState,
};

async fn health() -> Json<ApiResponse<&'static str>> {
    Json(ApiResponse::ok("ok"))
}

pub fn build(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/auth/signup", post(auth::signup))
        .route("/auth/login", post(auth::login))
        .route("/auth/me", get(auth::me))
        .route("/couples", post(couples::create))
        .route(
            "/couples/me",
            get(couples::me).put(couples::update).delete(couples::leave),
        )
        .route("/couples/join", post(couples::join))
        .route("/memories", get(memories::list).post(memories::create))
        .route(
            "/memories/{id}",
            get(memories::find)
                .put(memories::update)
                .delete(memories::delete),
        )
        .layer(CorsLayer::permissive())
        .with_state(state)
}

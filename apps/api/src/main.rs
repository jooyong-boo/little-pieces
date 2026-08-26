mod auth;
mod config;
mod couples;
mod db;
mod error;
mod memories;
mod response;
mod routes;
mod state;
mod users;

use state::AppState;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let config = config::Config::from_env();
    let pool = db::create_pool(&config.database_url)
        .await
        .expect("failed to connect to database");

    sqlx::migrate!()
        .run(&pool)
        .await
        .expect("failed to run migrations");

    let state = AppState {
        pool,
        jwt_secret: config.jwt_secret,
    };
    let app = routes::build(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", config.port))
        .await
        .expect("failed to bind port");

    tracing::info!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.expect("server error");
}

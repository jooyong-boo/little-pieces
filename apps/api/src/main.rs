mod auth;
mod config;
mod couples;
mod db;
mod error;
mod memories;
mod response;
mod routes;
mod state;
mod storage;
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

    // 스토리지 설정이 틀렸으면 알려주되 서버는 띄운다 — 사진만 못 쓰고 나머지는 돈다.
    let storage = config
        .s3
        .as_ref()
        .and_then(|s3| match storage::Storage::new(s3) {
            Ok(storage) => Some(storage),
            Err(message) => {
                tracing::error!("{message} — 이미지 업로드가 비활성화됩니다");
                None
            }
        });
    if storage.is_none() {
        tracing::warn!("S3 설정이 없어 이미지 업로드가 비활성화됩니다");
    }

    let state = AppState {
        pool,
        jwt_secret: config.jwt_secret,
        storage,
    };
    let app = routes::build(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", config.port))
        .await
        .expect("failed to bind port");

    tracing::info!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.expect("server error");
}

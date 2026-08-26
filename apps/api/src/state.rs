use sqlx::PgPool;

use crate::storage::Storage;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub jwt_secret: String,
    /// 스토리지 미설정이면 `None` — 사진 관련 엔드포인트만 503으로 거절한다.
    pub storage: Option<Storage>,
}

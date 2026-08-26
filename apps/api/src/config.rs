pub struct S3Config {
    pub endpoint: String,
    pub region: String,
    pub bucket: String,
    pub access_key_id: String,
    pub secret_access_key: String,
}

pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub port: u16,
    /// 하나라도 빠지면 `None`. 스토리지가 없어도 서버는 뜨고 나머지 기능은 돌아야 한다
    /// — 사진 없이 쓰는 것과 서버가 안 뜨는 건 전혀 다른 문제다.
    pub s3: Option<S3Config>,
}

fn required(key: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| panic!("{key} must be set"))
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: required("DATABASE_URL"),
            jwt_secret: required("JWT_SECRET"),
            port: std::env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3000),
            s3: s3_from_env(),
        }
    }
}

fn s3_from_env() -> Option<S3Config> {
    let config = S3Config {
        endpoint: std::env::var("S3_ENDPOINT").ok()?,
        region: std::env::var("S3_REGION").ok()?,
        bucket: std::env::var("S3_BUCKET").ok()?,
        access_key_id: std::env::var("S3_ACCESS_KEY_ID").ok()?,
        secret_access_key: std::env::var("S3_SECRET_ACCESS_KEY").ok()?,
    };
    Some(config)
}

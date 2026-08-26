use jsonwebtoken::{
    Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode, get_current_timestamp,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

const EXPIRY_SECONDS: u64 = 60 * 60 * 24 * 7; // 7 days

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub exp: u64,
}

pub fn issue(user_id: Uuid, secret: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let claims = Claims {
        sub: user_id,
        exp: get_current_timestamp() + EXPIRY_SECONDS,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn verify(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )?;
    Ok(data.claims)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn issued_token_round_trips() {
        let user_id = Uuid::new_v4();
        let token = issue(user_id, "test-secret").unwrap();
        let claims = verify(&token, "test-secret").unwrap();
        assert_eq!(claims.sub, user_id);
    }

    #[test]
    fn verify_rejects_wrong_secret() {
        let token = issue(Uuid::new_v4(), "secret-a").unwrap();
        assert!(verify(&token, "secret-b").is_err());
    }
}

use std::time::Duration;

use rusty_s3::{Bucket, Credentials, S3Action, UrlStyle};
use uuid::Uuid;

use crate::{config::S3Config, error::AppError};

/// 업로드용 URL은 짧게. 앱이 URL을 받은 직후 바로 PUT한다.
const PUT_URL_TTL: Duration = Duration::from_secs(15 * 60);
/// 조회용은 화면을 띄워둔 동안 유효해야 한다.
const GET_URL_TTL: Duration = Duration::from_secs(60 * 60);

/// 허용하는 이미지 타입과 확장자. content type 검사와 키 형식 검사가
/// 같은 표를 보게 해서 둘이 어긋나지 않게 한다.
const IMAGE_TYPES: &[(&str, &str)] = &[
    ("image/jpeg", "jpg"),
    ("image/png", "png"),
    ("image/webp", "webp"),
    ("image/heic", "heic"),
];

#[derive(Clone)]
pub struct Storage {
    bucket: Bucket,
    credentials: Credentials,
}

impl Storage {
    pub fn new(config: &S3Config) -> Result<Self, String> {
        let endpoint = config
            .endpoint
            .parse()
            .map_err(|e| format!("S3_ENDPOINT is not a valid URL: {e}"))?;

        // MinIO는 path-style이 필요하고 R2도 지원한다 — 한 설정으로 둘 다 커버된다.
        let bucket = Bucket::new(
            endpoint,
            UrlStyle::Path,
            config.bucket.clone(),
            config.region.clone(),
        )
        .map_err(|e| format!("invalid S3 bucket configuration: {e}"))?;

        Ok(Self {
            bucket,
            credentials: Credentials::new(
                config.access_key_id.as_str(),
                config.secret_access_key.as_str(),
            ),
        })
    }

    pub fn presign_put(&self, key: &str) -> String {
        self.bucket
            .put_object(Some(&self.credentials), key)
            .sign(PUT_URL_TTL)
            .to_string()
    }

    pub fn presign_get(&self, key: &str) -> String {
        self.bucket
            .get_object(Some(&self.credentials), key)
            .sign(GET_URL_TTL)
            .to_string()
    }

    pub const fn put_url_ttl_seconds() -> u64 {
        PUT_URL_TTL.as_secs()
    }
}

fn extension_for(content_type: &str) -> Option<&'static str> {
    IMAGE_TYPES
        .iter()
        .find(|(mime, _)| *mime == content_type)
        .map(|(_, ext)| *ext)
}

/// 객체 키는 **서버가 만든다.** 클라이언트가 키를 정하면 남의 객체를 덮어쓸 수 있다.
pub fn image_key(couple_id: Uuid, content_type: &str) -> Result<String, AppError> {
    let extension = extension_for(content_type).ok_or(AppError::UnsupportedImageType)?;
    Ok(format!(
        "couples/{couple_id}/{}.{extension}",
        Uuid::new_v4()
    ))
}

/// 추억을 저장할 때 클라이언트가 보낸 키가 이 커플 것인지 검사한다.
///
/// 이 검사가 없으면 A가 B 커플의 키를 적어 넣고, 우리가 발급하는 presigned GET으로
/// 남의 사진을 읽을 수 있다. `starts_with`로 끝내지 않고 형식을 정확히 맞춰 본다 —
/// 파일명이 UUID 하나로 고정되므로 하위 경로나 `..`가 끼어들 여지가 없다.
pub fn is_owned_by(couple_id: Uuid, key: &str) -> bool {
    let prefix = format!("couples/{couple_id}/");
    let Some(file_name) = key.strip_prefix(&prefix) else {
        return false;
    };
    let Some((stem, extension)) = file_name.rsplit_once('.') else {
        return false;
    };
    Uuid::parse_str(stem).is_ok() && IMAGE_TYPES.iter().any(|(_, ext)| *ext == extension)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn couple() -> Uuid {
        Uuid::parse_str("11111111-1111-4111-8111-111111111111").unwrap()
    }

    fn other_couple() -> Uuid {
        Uuid::parse_str("22222222-2222-4222-8222-222222222222").unwrap()
    }

    #[test]
    fn builds_a_couple_scoped_key_for_each_allowed_type() {
        for (mime, extension) in IMAGE_TYPES {
            let key = image_key(couple(), mime).unwrap();
            assert!(key.starts_with(&format!("couples/{}/", couple())), "{key}");
            assert!(key.ends_with(&format!(".{extension}")), "{key}");
            assert!(is_owned_by(couple(), &key), "{key}");
        }
    }

    #[test]
    fn rejects_content_types_outside_the_allow_list() {
        for mime in ["application/pdf", "text/html", "image/svg+xml", ""] {
            assert!(image_key(couple(), mime).is_err(), "{mime}");
        }
    }

    #[test]
    fn keys_are_unique_per_call() {
        let a = image_key(couple(), "image/jpeg").unwrap();
        let b = image_key(couple(), "image/jpeg").unwrap();
        assert_ne!(a, b);
    }

    #[test]
    fn rejects_another_couples_key() {
        let theirs = image_key(other_couple(), "image/jpeg").unwrap();
        assert!(!is_owned_by(couple(), &theirs));
    }

    #[test]
    fn rejects_prefix_lookalikes_and_traversal() {
        let id = couple();
        let file = format!("{}.jpg", Uuid::new_v4());
        for key in [
            // 접두사만 비슷한 다른 경로
            format!("couples/{id}x/{file}"),
            format!("couples/{id}/../{}/{file}", other_couple()),
            format!("xcouples/{id}/{file}"),
            // 하위 경로를 파고드는 시도
            format!("couples/{id}/nested/{file}"),
            // 확장자가 없거나 허용 목록 밖
            format!("couples/{id}/{}", Uuid::new_v4()),
            format!("couples/{id}/{}.pdf", Uuid::new_v4()),
            // 파일명이 UUID가 아님
            format!("couples/{id}/secret.jpg"),
            format!("couples/{id}/.jpg"),
            String::new(),
        ] {
            assert!(!is_owned_by(id, &key), "허용되면 안 되는 키: {key}");
        }
    }
}

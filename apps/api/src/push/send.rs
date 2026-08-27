use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::push::repo;

const EXPO_PUSH_URL: &str = "https://exp.host/--/api/v2/push/send";
/// Expo가 한 요청에 받는 메시지 수 상한.
const CHUNK_SIZE: usize = 100;

#[derive(Serialize)]
struct ExpoMessage<'a> {
    to: &'a str,
    title: &'a str,
    body: &'a str,
    /// 알림을 눌렀을 때 어디로 갈지. 앱이 그대로 돌려받는다.
    data: serde_json::Value,
    sound: &'a str,
}

/// 파트너에게 알림을 보낸다.
///
/// **실패해도 호출부의 작업을 실패시키지 않는다.** 추억은 저장됐는데 알림 전송이
/// 안 됐다고 500을 돌려주면, 사용자는 저장이 안 된 줄 알고 다시 쓴다.
/// 그래서 결과는 로그로만 남긴다.
pub async fn notify_partner(
    pool: &PgPool,
    couple_id: Uuid,
    actor_user_id: Uuid,
    title: String,
    body: String,
    data: serde_json::Value,
) {
    let tokens = match repo::partner_tokens(pool, couple_id, actor_user_id).await {
        Ok(tokens) => tokens,
        Err(error) => {
            tracing::error!(%error, "푸시 토큰 조회 실패");
            return;
        }
    };

    if tokens.is_empty() {
        // 파트너가 아직 알림을 허용하지 않았거나 혼자인 커플이다. 정상이다.
        return;
    }

    let client = reqwest::Client::new();
    for chunk in tokens.chunks(CHUNK_SIZE) {
        let messages: Vec<ExpoMessage<'_>> = chunk
            .iter()
            .map(|token| ExpoMessage {
                to: token,
                title: &title,
                body: &body,
                data: data.clone(),
                sound: "default",
            })
            .collect();

        match client.post(EXPO_PUSH_URL).json(&messages).send().await {
            Ok(response) => {
                let status = response.status();
                // Expo는 개별 메시지 실패도 200으로 돌려주고 티켓에 담는다.
                // DeviceNotRegistered는 죽은 토큰이라는 뜻 — 지금은 남기기만 한다.
                let ticket = response.text().await.unwrap_or_default();
                tracing::info!(%status, ticket = %ticket, "expo push 전송");
            }
            Err(error) => tracing::error!(%error, "expo push 전송 실패"),
        }
    }
}

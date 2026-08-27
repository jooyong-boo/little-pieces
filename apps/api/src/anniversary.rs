#[cfg(test)]
use chrono::Timelike;
use chrono::{DateTime, Datelike, Duration, FixedOffset, NaiveDate, TimeZone, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::push;

/// 앱의 기준 시간대.
///
/// `visited_at`이 `DATE`라 "오늘"이 어느 날인지가 시간대에 따라 갈린다. 서버가
/// 어디서 돌든 사용자 기준으로 같은 날을 보려면 한 시간대로 못 박아야 한다.
const KST_OFFSET_SECONDS: i32 = 9 * 3600;
/// 아침에 하루를 시작하며 보는 타이밍.
const SEND_HOUR: u32 = 9;

fn kst() -> FixedOffset {
    FixedOffset::east_opt(KST_OFFSET_SECONDS).expect("KST offset is valid")
}

/// 다음 발송 시각. 오늘 발송 시각이 지났으면 내일로 넘긴다.
///
/// 이 계산이 곧 중복 방지다 — 발송 직후 프로세스가 다시 떠도 "오늘 9시"는 이미
/// 지났으므로 다음 차례는 내일이 된다. 별도 발송 기록 테이블이 없는 이유다.
pub fn next_send_time(now: DateTime<FixedOffset>) -> DateTime<FixedOffset> {
    let today = now
        .timezone()
        .with_ymd_and_hms(now.year(), now.month(), now.day(), SEND_HOUR, 0, 0)
        .single()
        .expect("send time exists");

    if now < today {
        today
    } else {
        today + Duration::days(1)
    }
}

/// 오늘 날짜에서 몇 년 전인지. 같은 월/일이 아니면 `None`.
///
/// "정확히 n년 전"만 대상이다. 월/일만 같으면 되는 게 아니라 연도가 달라야 하고,
/// 그 차이가 곧 "n년 전"이 된다.
pub fn years_ago(today: NaiveDate, visited: NaiveDate) -> Option<i32> {
    if today.month() != visited.month() || today.day() != visited.day() {
        return None;
    }
    let years = today.year() - visited.year();
    (years >= 1).then_some(years)
}

pub fn today_in_kst() -> NaiveDate {
    Utc::now().with_timezone(&kst()).date_naive()
}

struct AnniversaryMemory {
    id: Uuid,
    couple_id: Uuid,
    title: String,
    visited_at: NaiveDate,
}

/// 오늘과 월/일이 같고 연도가 이전인 추억.
async fn find_for(pool: &PgPool, today: NaiveDate) -> Result<Vec<AnniversaryMemory>, sqlx::Error> {
    sqlx::query_as!(
        AnniversaryMemory,
        r#"SELECT id AS "id!", couple_id AS "couple_id!", title AS "title!",
                  visited_at AS "visited_at!"
           FROM memories
           -- EXTRACT는 NUMERIC을 돌려준다. int로 캐스팅해야 파라미터 타입이 맞는다.
           WHERE EXTRACT(MONTH FROM visited_at)::int = $1
             AND EXTRACT(DAY   FROM visited_at)::int = $2
             AND EXTRACT(YEAR  FROM visited_at)::int < $3
           ORDER BY visited_at"#,
        today.month() as i32,
        today.day() as i32,
        today.year(),
    )
    .fetch_all(pool)
    .await
}

/// 하루치 발송. 파트너 알림과 달리 **두 사람 모두**에게 보낸다 —
/// 함께 만든 추억이라 작성자도 같이 떠올릴 대상이다.
pub async fn send_today(pool: &PgPool) {
    let today = today_in_kst();
    let memories = match find_for(pool, today).await {
        Ok(memories) => memories,
        Err(error) => {
            tracing::error!(%error, "기념일 추억 조회 실패");
            return;
        }
    };

    for memory in memories {
        let Some(years) = years_ago(today, memory.visited_at) else {
            continue;
        };
        push::send::notify_couple(
            pool,
            memory.couple_id,
            format!("{years}년 전 오늘"),
            memory.title.clone(),
            serde_json::json!({ "memoryId": memory.id }),
        )
        .await;
    }
}

/// 하루 한 번 발송 시각에 깨어난다.
pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            let now = Utc::now().with_timezone(&kst());
            let next = next_send_time(now);
            let wait = (next - now).to_std().unwrap_or_default();
            tracing::info!(next = %next, "다음 기념일 알림 대기");
            tokio::time::sleep(wait).await;
            send_today(&pool).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(hour: u32, minute: u32) -> DateTime<FixedOffset> {
        kst()
            .with_ymd_and_hms(2026, 8, 27, hour, minute, 0)
            .single()
            .unwrap()
    }

    #[test]
    fn waits_for_today_when_send_time_has_not_passed() {
        assert_eq!(next_send_time(at(8, 59)), at(9, 0));
    }

    #[test]
    fn moves_to_tomorrow_once_send_time_has_passed() {
        // 발송 직후 재시작해도 오늘 다시 보내지 않는다 — 이게 중복 방지다.
        let next = next_send_time(at(9, 1));
        assert_eq!(next.day(), 28);
        assert_eq!(next.hour(), SEND_HOUR);
    }

    #[test]
    fn treats_the_exact_send_time_as_already_passed() {
        assert_eq!(next_send_time(at(9, 0)).day(), 28);
    }

    #[test]
    fn counts_whole_years_for_the_same_month_and_day() {
        let today = NaiveDate::from_ymd_opt(2026, 8, 27).unwrap();

        assert_eq!(
            years_ago(today, NaiveDate::from_ymd_opt(2025, 8, 27).unwrap()),
            Some(1)
        );
        assert_eq!(
            years_ago(today, NaiveDate::from_ymd_opt(2020, 8, 27).unwrap()),
            Some(6)
        );
    }

    #[test]
    fn ignores_today_itself_and_the_future() {
        let today = NaiveDate::from_ymd_opt(2026, 8, 27).unwrap();

        assert_eq!(years_ago(today, today), None);
        assert_eq!(
            years_ago(today, NaiveDate::from_ymd_opt(2027, 8, 27).unwrap()),
            None
        );
    }

    #[test]
    fn ignores_a_different_day_or_month() {
        let today = NaiveDate::from_ymd_opt(2026, 8, 27).unwrap();

        assert_eq!(
            years_ago(today, NaiveDate::from_ymd_opt(2025, 8, 26).unwrap()),
            None
        );
        assert_eq!(
            years_ago(today, NaiveDate::from_ymd_opt(2025, 7, 27).unwrap()),
            None
        );
    }
}

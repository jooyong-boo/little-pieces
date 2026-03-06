import Link from 'next/link';
import { APP_ROUTES } from '@little-pieces/shared';

export default function HomePage() {
  return (
    <main className="page">
      <h1>커플 추억 공유 지도</h1>
      <p>초기 개발을 위한 모노레포 뼈대입니다.</p>
      <div className="links">
        <Link href={APP_ROUTES.login}>로그인</Link>
        <Link href={APP_ROUTES.signup}>회원가입</Link>
        <Link href={APP_ROUTES.map}>지도 보기</Link>
      </div>
    </main>
  );
}

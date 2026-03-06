export default function LoginPage() {
  return (
    <main className="page">
      <h1>로그인</h1>
      <p>인증 연결 전 placeholder 화면입니다.</p>
      <form className="panel">
        <label htmlFor="email">이메일</label>
        <input id="email" type="email" placeholder="you@example.com" />
        <label htmlFor="password">비밀번호</label>
        <input id="password" type="password" placeholder="********" />
        <button type="button">로그인</button>
      </form>
    </main>
  );
}

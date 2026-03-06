export default function SignupPage() {
  return (
    <main className="page">
      <h1>회원가입</h1>
      <p>API 연결 전 placeholder 화면입니다.</p>
      <form className="panel">
        <label htmlFor="email">이메일</label>
        <input id="email" type="email" placeholder="you@example.com" />
        <label htmlFor="nickname">닉네임</label>
        <input id="nickname" type="text" placeholder="우리 둘의 이름" />
        <label htmlFor="password">비밀번호</label>
        <input id="password" type="password" placeholder="********" />
        <button type="button">계정 생성</button>
      </form>
    </main>
  );
}

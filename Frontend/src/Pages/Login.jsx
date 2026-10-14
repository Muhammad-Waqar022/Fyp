import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login({ setCurrentPage, setIsLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      alert("Please fill all fields");
      return;
    }

    let savedUser;

    try {
      savedUser = JSON.parse(localStorage.getItem("user"));
    } catch {
      alert("Unable to read account details. Please sign up again.");
      return;
    }

    if (!savedUser) {
      alert("No account found. Please sign up first.");
      return;
    }

    if (
      email.trim().toLowerCase() === savedUser.email?.toLowerCase() &&
      password === savedUser.password
    ) {
      localStorage.setItem("isLoggedIn", "true");
      setIsLoggedIn(true);
      alert(`Welcome ${savedUser.name}!`);
    } else {
      alert("Invalid email or password");
    }
  };

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#f4f2ed] p-3 sm:p-5 lg:h-screen lg:overflow-hidden">
      <section className="mx-auto grid min-h-[calc(100vh-24px)] w-full max-w-[1440px] overflow-hidden rounded-2xl bg-white shadow-[0_20px_70px_rgba(30,25,18,0.08)] sm:min-h-[calc(100vh-40px)] lg:h-full lg:min-h-0 lg:grid-cols-[0.92fr_1.08fr]">

        {/* Left branding panel */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#24251f] p-10 text-[#f7f5ef] md:flex lg:p-12 xl:p-16">
          <div className="pointer-events-none absolute -right-24 top-1/4 h-80 w-80 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-12 top-[30%] h-56 w-56 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute bottom-16 right-10 h-40 w-40 rounded-full bg-[#c6a779]/10 blur-3xl" />

          <div className="relative z-10 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center border border-[#c6a779] font-serif text-xl text-[#c6a779]">
              L
            </span>
            <span className="text-xl font-semibold tracking-[0.3em]">
              LUXE<span className="text-[#c6a779]">.</span>
            </span>
          </div>

          <div className="relative z-10 my-12 max-w-lg">
            <span className="text-[10px] font-semibold tracking-[0.32em] text-[#c6a779]">
              THE EVERYDAY EDIT
            </span>

            <h2 className="mt-6 font-serif text-5xl leading-[1.12] tracking-tight lg:text-6xl xl:text-7xl">
              Good style.
              <br />
              <span className="italic text-[#c6a779]">Less effort.</span>
            </h2>

            <p className="mt-7 max-w-sm text-sm leading-7 text-white/60">
              A considered collection of pieces made for the way you live,
              move, and express yourself.
            </p>

            <div className="mt-10 flex items-center gap-4">
              <span className="h-px w-12 bg-[#c6a779]" />
              <p className="text-xs tracking-wide text-white/75">
                Personal style starts here.
              </p>
            </div>
          </div>

          <div className="relative z-10 flex justify-between border-t border-white/10 pt-5 text-[9px] tracking-[0.2em] text-white/45">
            <span>INDEPENDENTLY YOURS</span>
            <span>EST. 2026</span>
          </div>
        </aside>

        {/* Right login panel */}
        <section className="flex min-w-0 flex-col justify-between px-5 py-6 sm:px-10 sm:py-8 lg:px-12 xl:px-20 xl:py-10">
          <header className="flex items-center justify-between md:hidden">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center border border-[#b69a70] font-serif text-lg text-[#a58a61]">
                L
              </span>
              <span className="text-lg font-semibold tracking-[0.25em] text-[#24251f]">
                LUXE<span className="text-[#b69a70]">.</span>
              </span>
            </div>
            <span className="text-[8px] font-semibold tracking-[0.15em] text-stone-400">
              THE EVERYDAY EDIT
            </span>
          </header>

          <div className="mx-auto my-8 w-full max-w-md lg:my-auto">


            <div className="mb-9">
              <p className="mb-3 text-[10px] font-bold tracking-[0.28em] text-[#a58a61]">
                WELCOME BACK
              </p>
              <h1 className="font-serif text-4xl leading-tight tracking-tight text-[#24251f] sm:text-5xl">
                Good to see you.
              </h1>
              <p className="mt-3 text-sm leading-6 text-stone-500">
                Sign in to pick up where you left off.
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 block text-xs font-semibold text-[#33342d]"
                >
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-stone-200 bg-[#fcfbf9] px-4 py-3.5 text-sm text-[#24251f] outline-none transition placeholder:text-stone-400 focus:border-[#b69a70] focus:bg-white focus:ring-2 focus:ring-[#b69a70]/10"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-2 block text-xs font-semibold text-[#33342d]"
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-stone-200 bg-[#fcfbf9] px-4 py-3.5 text-sm text-[#24251f] outline-none transition placeholder:text-stone-400 focus:border-[#b69a70] focus:bg-white focus:ring-2 focus:ring-[#b69a70]/10"
                />
              </div>

              <button
                className="group flex w-full items-center justify-center rounded-lg bg-[#24251f] px-5 py-4 text-sm font-medium text-white transition hover:bg-[#3a3b33] focus:outline-none focus:ring-2 focus:ring-[#b69a70] focus:ring-offset-2"
                type="submit"
              >
                <span>Sign in to your account</span>
              </button>
            </form>

            <div className="mt-8 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-stone-500">New to LUXE?</span>
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="font-semibold text-[#8d7149] transition hover:text-[#24251f]"
              >
                Create an account <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <footer className="flex justify-between gap-3 border-t border-stone-100 pt-4 text-[9px] tracking-[0.12em] text-stone-400">
            <span>© 2026 LUXE</span>
            <span className="text-right">MADE FOR YOUR EVERYDAY</span>
          </footer>
        </section>
      </section>
    </main>
  );
}

export default Login;

export default function Login() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-6">Login</h1>
      <form className="flex flex-col gap-4 w-80">
        <input
          type="email"
          placeholder="Email"
          className="p-3 rounded bg-gray-800 border border-gray-600"
        />
        <input
          type="password"
          placeholder="Password"
          className="p-3 rounded bg-gray-800 border border-gray-600"
        />
        <button className="p-3 bg-purple-600 hover:bg-purple-700 rounded font-bold">
          Login
        </button>
      </form>
    </div>
  );
}

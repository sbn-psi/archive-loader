import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

export function LoginPage({ onError }: { onError: (message: string | null) => void }) {
  const form = useForm<{ username: string; password: string }>({
    defaultValues: {
      username: "",
      password: "",
    },
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const login = useMutation({
    mutationFn: api.login,
    onSuccess: async (result) => {
      onError(null);
      queryClient.setQueryData(["auth", "user"], result);
      navigate("/datasets/manage");
    },
    onError: (error) => onError(error instanceof Error ? error.message : "Login failed"),
  });

  return (
    <div className="page-shell">
      <div className="page-card" style={{ maxWidth: "480px", margin: "4rem auto" }}>
        <h1 className="page-title">Login</h1>
        <form onSubmit={form.handleSubmit((values) => login.mutate(values))}>
          <div className="field">
            <label>Username</label>
            <input {...form.register("username")} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" {...form.register("password")} />
          </div>
          <div className="button-row">
            <button type="submit" className="button-primary" disabled={login.isPending}>
              {login.isPending ? "Logging in..." : "Log In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

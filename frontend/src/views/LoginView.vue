<template>
  <AuthCard title="Welcome back" subtitle="Sign in to your Lapis account">
    <form class="auth-form" @submit.prevent="handleSubmit">
      <!-- Error banner -->
      <div v-if="errorMsg" class="auth-error">
        <AlertCircle class="w-4 h-4 shrink-0" />
        {{ errorMsg }}
      </div>

      <AuthInput
        v-model="username"
        label="Username"
        placeholder="Enter your username"
        :icon="User"
        :error="errors.username"
        autocomplete="username"
        @submit="handleSubmit"
      />

      <AuthInput
        v-model="password"
        label="Password"
        type="password"
        placeholder="Enter your password"
        :icon="Lock"
        :error="errors.password"
        autocomplete="current-password"
        @submit="handleSubmit"
      />

      <button type="submit" class="auth-btn" :disabled="loading">
        <span v-if="loading" class="btn-loading" />
        {{ loading ? "Signing in…" : "Sign in" }}
      </button>
    </form>

    <template #footer>
      Don't have an account?
      <RouterLink to="/register" class="auth-link">Create one</RouterLink>
    </template>
  </AuthCard>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { User, Lock, AlertCircle } from "lucide-vue-next";
import { useAuth } from "../composables/useAuth.js";
import AuthCard from "../components/auth/AuthCard.vue";
import AuthInput from "../components/auth/AuthInput.vue";

const router = useRouter();
const { login } = useAuth();

const username = ref("");
const password = ref("");
const loading = ref(false);
const errorMsg = ref("");
const errors = ref({ username: "", password: "" });

function validate() {
  errors.value = { username: "", password: "" };
  let valid = true;
  if (!username.value.trim()) {
    errors.value.username = "Username is required";
    valid = false;
  }
  if (!password.value) {
    errors.value.password = "Password is required";
    valid = false;
  }
  return valid;
}

async function handleSubmit() {
  errorMsg.value = "";
  if (!validate()) return;
  loading.value = true;
  try {
    await login(username.value.trim(), password.value);
    router.push("/");
  } catch (err) {
    errorMsg.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.auth-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  color: #f87171;
  font-size: 13px;
}
.auth-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 11px;
  margin-top: 4px;
  border-radius: 8px;
  border: none;
  background: var(--label-to);
  color: var(--bg);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.auth-btn:hover:not(:disabled) {
  opacity: 0.85;
}
.auth-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-loading {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-top-color: var(--bg);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.auth-link {
  color: var(--label-to);
  text-decoration: none;
  font-weight: 500;
  margin-left: 4px;
}
.auth-link:hover {
  text-decoration: underline;
}
</style>

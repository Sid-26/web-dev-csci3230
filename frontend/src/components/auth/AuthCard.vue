<template>
  <div class="auth-page">
    <div class="auth-card">
      <!-- Logo / branding -->
      <div class="auth-brand">
        <div class="brand-icon">
          <component :is="brandIcon" class="w-6 h-6" />
        </div>
        <span class="brand-name">Lapis</span>
      </div>

      <!-- Title + subtitle -->
      <div class="auth-heading">
        <h1 class="auth-title">{{ title }}</h1>
        <p v-if="subtitle" class="auth-subtitle">{{ subtitle }}</p>
      </div>

      <!-- Form content -->
      <slot />

      <!-- Bottom link (e.g. "Already have an account?") -->
      <div v-if="$slots.footer" class="auth-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { BookOpen } from "lucide-vue-next";

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: "" },
  brandIcon: { type: Object, default: () => BookOpen },
});
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 24px;
}
.auth-card {
  width: 100%;
  max-width: 400px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 36px 32px 28px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.auth-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--label-to) 15%, transparent);
  color: var(--label-to);
}
.brand-name {
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(
    90deg,
    var(--label-from) 0%,
    var(--label-to) 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.auth-heading {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.auth-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}
.auth-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}
.auth-footer {
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
  padding-top: 4px;
  border-top: 1px solid var(--border);
}
</style>

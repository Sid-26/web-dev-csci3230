import { createRouter, createWebHashHistory } from "vue-router";
import { useAuth } from "../composables/useAuth.js";
import Dashboard from "../components/Dashboard.vue";
import GraphView from "../views/GraphView.vue";
import CalendarView from "../views/CalendarView.vue";
import EditorView from "../views/EditorView.vue";
import LoginView from "../views/LoginView.vue";
import RegisterView from "../views/RegisterView.vue";

const routes = [
  {
    path: "/login",
    component: LoginView,
    meta: { guestOnly: true, hideNavbar: true },
  },
  {
    path: "/register",
    component: RegisterView,
    meta: { guestOnly: true, hideNavbar: true },
  },
  { path: "/", component: Dashboard, meta: { requiresAuth: true } },
  { path: "/graph", component: GraphView, meta: { requiresAuth: true } },
  { path: "/calendar", component: CalendarView, meta: { requiresAuth: true } },
  {
    path: "/editor",
    component: EditorView,
    meta: { requiresAuth: true, hideNavbar: true },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

function getSessionCookie() {
  return document.cookie.split("; ").reduce((r, v) => {
    const parts = v.split("=");
    return parts[0] === "session"
      ? decodeURIComponent(parts.slice(1).join("="))
      : r;
  }, null);
}

router.beforeEach(async (to) => {
  const { initialAuthCheck } = useAuth();
  await initialAuthCheck;

  const token = getSessionCookie();

  if (to.meta.requiresAuth && !token) {
    return { path: "/login" };
  }

  if (to.meta.guestOnly && token) {
    return { path: "/" };
  }
});

export default router;

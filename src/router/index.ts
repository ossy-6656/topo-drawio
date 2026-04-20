import { createRouter, createWebHistory } from "vue-router";
 
import LOGIN from "../view/login.vue";
import graphLg from "../view/graph/graphLg.vue";
 
const routes = [
  {
    path: "/",
    redirect: '/login'
  },
  {
    path: "/login",
    name: "login",
    component: LOGIN,
  },
  {
    path: "/graphLg",
    name: "graphLg",
    component: graphLg
  }
];
 
const router = createRouter({
    history:createWebHistory(),
    routes
})
 
export default router
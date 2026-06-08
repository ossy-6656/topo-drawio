import { createRouter, createWebHistory } from "vue-router";
 
import LOGIN from "../view/login.vue";
import graphLg from "../view/graph/graphLg.vue";
import inSiteSvg from "../view/graph/inSiteSvg.vue";
import SvgLiaisonDrawio from "../view/liaison/SvgLiaisonDrawio.vue";
 
const routes = [
  {
    path: "/",
    redirect: '/svg-liaison-drawio'
  },
  {
    path: "/login",
    name: "login",
    component: LOGIN,
  },
  {
    path: "/graphLg",
    name: "graphLg",
    component: graphLg,
  },
  {
    path: "/in-site-svg",
    name: "inSiteSvg",
    component: inSiteSvg,
  },
  {
    path: "/svg-liaison-drawio",
    name: "svgLiaisonDrawio",
    component: SvgLiaisonDrawio
  }
];
 
const router = createRouter({
    history:createWebHistory(),
    routes
})
 
export default router
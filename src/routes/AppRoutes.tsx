import { BeakerIcon } from "@heroicons/react/24/solid";
import Dashboard from "@/events/Dashboard";
import SparkFormPage from "@/public/form/FormPage";
import CompanySelector from "@/layout/CompanySelector";

const DashboardLinks = {
  menu: [
    {
      path: "/dashboard/:uuid",
      name: "Dashboard",
      component: <Dashboard />,
      Icon: BeakerIcon,
      isPublic: false,
    },
  ],
  routes: [
    {
      path: "/",
      name: "CompanySelector",
      component: <CompanySelector />,
      isPublic: false,
    },
    {
      path: "/",
      name: "Dashboard",
      component: <Dashboard />,
      isPublic: false,
    },
    // public route
    {
      path: "/spark-form",
      name: "SparkForm",
      component: <SparkFormPage />,
      isPublic: true,
    },
  ],
};

export const navigationMenuRoutes = [
  {
    path: "/",
    title: "Dashboard",
    Icon: BeakerIcon,
    component: <Dashboard />,
  },
  {
    title: "Dashboard Main",
    Icon: BeakerIcon,
    links: DashboardLinks.menu,
  },
];

export const appRoutes = [...DashboardLinks.menu, ...DashboardLinks.routes];

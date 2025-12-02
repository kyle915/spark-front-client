import {
  BeakerIcon,
  EnvelopeIcon,
  ListBulletIcon,
} from "@heroicons/react/24/solid";
import Dashboard from "@/events/Dashboard";
import SparkFormPage from "@/public/form/FormPage";
import CompanySelector from "@/layout/CompanySelector";

// Requests
import RequestsList from "@/requests/RequestsList";
import RequestView from "@/requests/RequestView";
import EditRequest from "@/requests/EditRequest";

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
    // {
    //   path: "/",
    //   name: "Dashboard",
    //   component: <Dashboard />,
    //   isPublic: false,
    // },
    // public route
    {
      path: "/spark-form/:tenantSlug",
      name: "SparkForm",
      component: <SparkFormPage />,
      isPublic: true,
    },
  ],
};

const RequestsLinks = {
  menu: [
    {
      path: "/requests/list",
      name: "List",
      component: <RequestsList />,
      Icon: ListBulletIcon,
    },
  ],
  routes: [
    {
      path: "/",
      name: "Dashboard",
      component: <h1>Requests Dashboard</h1>,
    },
    {
      path: "/request/view/:uuid",
      name: "Request View",
      component: <RequestView />,
    },
    {
      path: "/request/edit/:uuid",
      name: "Edit Request",
      component: <EditRequest />,
    },
  ],
};

export const navigationMenuRoutes = [
  // {
  //   path: "/",
  //   title: "Dashboard",
  //   Icon: BeakerIcon,
  //   component: <Dashboard />,
  // },
  {
    title: "Dashboard Main",
    Icon: BeakerIcon,
    links: DashboardLinks.menu,
  },
  {
    title: "Requests",
    Icon: EnvelopeIcon,
    links: RequestsLinks.menu,
  },
];

export const appRoutes = [
  ...DashboardLinks.menu,
  ...DashboardLinks.routes,
  // Requests
  ...RequestsLinks.menu,
  ...RequestsLinks.routes,
];

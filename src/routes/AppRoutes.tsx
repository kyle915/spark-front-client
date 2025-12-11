import {
  ChartBarIcon,
  QueueListIcon,
  ChartPieIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  Bars4Icon,
  CameraIcon,
  BuildingStorefrontIcon,
  PlusCircleIcon,
  CalendarIcon,
  MapIcon,
} from "@heroicons/react/24/solid";

// Dashboard
import DashboardEvents from "@/components/pages/dashboard-event/DashboardEvent";
import DashboardRetail from "@/components/pages/dashboard-retail/DashboardRetail";
// import DashboardIndex from "@/components/pages/dashboard";

// Requests
import RequestsList from "@/requests/RequestsList";
import RequestView from "@/requests/RequestView";
import EditRequest from "@/requests/EditRequest";
import CreateRequest from "@/requests/CreateRequest";

// Events
import EventsList from "@/events/EventsList";
import CreateEvent from "@/events/CreateEvent";
import EditEvent from "@/events/EditEvent";
import EventView from "@/events/EventView";
import TodayEvents from "@/events/TodayEvents";
import TodayEventsMap from "@/events/TodayEventsMap";

// Tenants
import TenantsList from "@/tenants/TenantsList";
import CreateTenant from "@/tenants/CreateTenant";
import EditTenant from "@/tenants/EditTenant";
import CreateProduct from "@/tenants/CreateProduct";
import ProductsList from "@/tenants/ProductsList";

// Recap
import CreateRecap from "@/recap/CreateRecap";
import RecapList from "@/recap/RecapsList";
import RecapView from "@/recap/RecapView";
import EditRecap from "@/recap/EditRecap";

// Public
import SparkFormPage from "@/public/form/FormPage";

/* -----------------------------------------------------------
   PUBLIC ROUTES (NO AUTH REQUIRED)
----------------------------------------------------------- */
const PublicRoutes = {
  routes: [
    {
      path: "/spark-form/:tenantSlug",
      component: <SparkFormPage />,
      isPublic: true,
    },
  ],
};

/* -----------------------------------------------------------
   DASHBOARD
----------------------------------------------------------- */
const DashboardLinks = {
  menu: [
    { path: "/", name: "Events", Icon: ChartBarIcon },
    { path: "/retail-dashboard", name: "Retail", Icon: QueueListIcon },
  ],

  routes: [
    { path: "/", component: <DashboardEvents />, isPublic: false },
    {
      path: "/retail-dashboard",
      component: <DashboardRetail />,
      isPublic: false,
    },
  ],
};

/* -----------------------------------------------------------
   REQUESTS
----------------------------------------------------------- */
const RequestsLinks = {
  menu: [
    { path: "/requests/list", name: "List", Icon: Bars4Icon },
    { path: "/requests/create", name: "Create", Icon: PlusCircleIcon },
  ],

  routes: [
    {
      path: "/requests/list",
      component: <RequestsList />,
      isPublic: false,
    },
    {
      path: "/requests/create",
      component: <CreateRequest />,
      isPublic: false,
    },
    {
      path: "/request/view/:uuid",
      component: <RequestView />,
      isPublic: false,
    },
    {
      path: "/request/edit/:uuid",
      component: <EditRequest />,
      isPublic: false,
    },
  ],
};

/* -----------------------------------------------------------
   EVENTS
----------------------------------------------------------- */
const EventsLinks = {
  menu: [
    { path: "/events/list", name: "List", Icon: Bars4Icon },
    { path: "/events/today", name: "Today", Icon: CalendarIcon },
    { path: "/events/map", name: "Map", Icon: MapIcon },
  ],

  routes: [
    { path: "/events/list", component: <EventsList />, isPublic: false },
    { path: "/events/today", component: <TodayEvents />, isPublic: false },
    { path: "/events/map", component: <TodayEventsMap />, isPublic: false },

    {
      path: "/event/create/:uuid",
      component: <CreateEvent />,
      isPublic: false,
    },
    { path: "/event/view/:uuid", component: <EventView />, isPublic: false },
    { path: "/event/edit/:uuid", component: <EditEvent />, isPublic: false },
  ],
};

/* -----------------------------------------------------------
   TENANTS
----------------------------------------------------------- */
const TenantsLinks = {
  menu: [
    { path: "/tenants/create", name: "Create", Icon: PlusCircleIcon },
    { path: "/tenants/list", name: "List", Icon: Bars4Icon },
  ],

  routes: [
    { path: "/tenants/create", component: <CreateTenant />, isPublic: false },
    { path: "/tenants/list", component: <TenantsList />, isPublic: false },
    { path: "/tenants/edit/:uuid", component: <EditTenant />, isPublic: false },
  ],
};

/* -----------------------------------------------------------
   PRODUCTS
----------------------------------------------------------- */
const ProductLinks = {
  menu: [
    { path: "/products/create-product", name: "Create", Icon: PlusCircleIcon },
    { path: "/products/products-list", name: "List", Icon: Bars4Icon },
  ],

  routes: [
    {
      path: "/products/create-product",
      component: <CreateProduct />,
      isPublic: false,
    },
    {
      path: "/products/products-list",
      component: <ProductsList />,
      isPublic: false,
    },
  ],
};

/* -----------------------------------------------------------
   RECAPS
----------------------------------------------------------- */
const RecapLinks = {
  menu: [
    { path: "/recap/create", name: "Create", Icon: PlusCircleIcon },
    { path: "/recap/list", name: "List", Icon: Bars4Icon },
  ],

  routes: [
    { path: "/recap/create", component: <CreateRecap />, isPublic: false },
    { path: "/recap/list", component: <RecapList />, isPublic: false },
    { path: "/recap/view/:uuid", component: <RecapView />, isPublic: false },
    { path: "/recap/edit/:uuid", component: <EditRecap />, isPublic: false },
  ],
};

/* -----------------------------------------------------------
   EXPORT: SIDEBAR MENU
----------------------------------------------------------- */
export const navigationMenuRoutes = [
  {
    path: "/",
    title: "Dashboards",
    Icon: ChartPieIcon,
    links: DashboardLinks.menu,
  },
  {
    title: "Requests",
    Icon: ClipboardDocumentListIcon,
    links: RequestsLinks.menu,
  },
  {
    title: "Events",
    Icon: CalendarDaysIcon,
    links: EventsLinks.menu,
  },
  {
    title: "Recaps",
    Icon: CameraIcon,
    links: RecapLinks.menu,
  },
  {
    title: "Product",
    Icon: BuildingStorefrontIcon,
    links: ProductLinks.menu,
  },
];

/* -----------------------------------------------------------
   EXPORT: APP ROUTES (SOLO ROUTES REALES)
----------------------------------------------------------- */
export const appRoutes = [
  ...DashboardLinks.routes,
  ...RequestsLinks.routes,
  ...EventsLinks.routes,
  ...TenantsLinks.routes,
  ...RecapLinks.routes,
  ...ProductLinks.routes,
  ...PublicRoutes.routes,
];

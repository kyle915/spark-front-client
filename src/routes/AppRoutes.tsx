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
  MapPinIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";

// Dashboard
import DashboardEvents from "@/components/pages/dashboard-event/DashboardEvent";
import DashboardRetail from "@/components/pages/dashboard-retail/DashboardRetail";
// import DashboardIndex from "@/components/pages/dashboard";

// Company Selection
import CompanySelector from "@/layout/CompanySelector";

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
import CreateEventWithoutRequest from "@/events/CreateEventWithoutRequest";

// Products
import ProductsList from "@/products/ProductsList";
import CreateProduct from "@/products/CreateProduct";

// Catalogs
import {
  ProductTypesList,
  CreateProductType,
  EditProductType,
} from "@/catalogs/ProductTypes";
import {
  EventTypesList,
  CreateEventType,
  EditEventType,
} from "@/catalogs/EventTypes";
import {
  LocationsList,
  CreateLocation,
  EditLocation,
} from "@/catalogs/Locations";
import {
  RequestTypesList,
  CreateRequestType,
  EditRequestType,
} from "@/catalogs/RequestTypes";
import {
  DistributorsList,
  CreateDistributor,
  EditDistributor,
} from "@/catalogs/Distributors";
import {
  RetailersList,
  CreateRetailer,
  EditRetailer,
} from "@/catalogs/Retailers";

// Recap
import CreateRecap from "@/recap/CreateRecap";
import RecapList from "@/recap/RecapsList";
import RecapView from "@/recap/RecapView";
import EditRecap from "@/recap/EditRecap";

// Public
import SparkFormPage from "@/public/form/FormPage";
import { TagIcon } from "lucide-react";

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

/*  -----------------------------------------------------------
 COMPANY SELECTION ROUTE
----------------------------------------------------------- */
const CompanyRoutes = {
  routes: [
    {
      path: "/select-company",
      component: <CompanySelector />,
      isPublic: false,
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
    {
      path: "/event/create",
      name: "Create",
      component: <CreateEventWithoutRequest />,
      Icon: PlusCircleIcon,
    },
    { path: "/events/list", name: "List", Icon: Bars4Icon },
    { path: "/events/today", name: "Today", Icon: CalendarIcon },
    { path: "/events/map", name: "Map", Icon: MapIcon },
  ],

  routes: [
    { path: "/events/list", component: <EventsList />, isPublic: false },
    { path: "/events/today", component: <TodayEvents />, isPublic: false },
    { path: "/events/map", component: <TodayEventsMap />, isPublic: false },
    {
      path: "/event/create",
      name: "Create Event",
      component: <CreateEventWithoutRequest />,
    },
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
   Catalogs
----------------------------------------------------------- */
const CatalogsLinks = {
  menu: [
    {
      name: "Product Types",
      Icon: TagIcon,
      links: [
        {
          path: "/catalogs/product-types/list",
          name: "List",
          component: <ProductTypesList />,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/product-types/create",
          name: "Create",
          component: <CreateProductType />,
          Icon: PlusCircleIcon,
        },
      ],
    },
    {
      name: "Event Types",
      Icon: CalendarDaysIcon,
      links: [
        {
          path: "/catalogs/event-types/list",
          name: "List",
          component: <EventTypesList />,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/event-types/create",
          name: "Create",
          component: <CreateEventType />,
          Icon: PlusCircleIcon,
        },
      ],
    },
    {
      name: "Locations",
      Icon: MapPinIcon,
      links: [
        {
          path: "/catalogs/locations/list",
          name: "List",
          component: <LocationsList />,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/locations/create",
          name: "Create",
          component: <CreateLocation />,
          Icon: PlusCircleIcon,
        },
      ],
    },

    {
      name: "Request Types",
      Icon: ClipboardDocumentListIcon,
      links: [
        {
          path: "/catalogs/request-types/list",
          name: "List",
          component: <RequestTypesList />,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/request-types/create",
          name: "Create",
          component: <CreateRequestType />,
          Icon: PlusCircleIcon,
        },
      ],
    },

    {
      name: "Distributors",
      Icon: UserGroupIcon,
      links: [
        {
          path: "/catalogs/distributors/list",
          name: "List",
          component: <DistributorsList />,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/distributors/create",
          name: "Create",
          component: <CreateDistributor />,
          Icon: PlusCircleIcon,
        },
      ],
    },

    {
      name: "Retailers",
      Icon: BuildingStorefrontIcon,
      links: [
        {
          path: "/catalogs/retailers/list",
          name: "List",
          component: <RetailersList />,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/retailers/create",
          name: "Create",
          component: <CreateRetailer />,
          Icon: PlusCircleIcon,
        },
      ],
    },
  ],
  routes: [
    // products types
    {
      path: "/catalogs/product-types/edit/:uuid",
      name: "Edit Product Type",
      component: <EditProductType />,
    },
    {
      path: "/catalogs/product-types/create",
      name: "Create Product Type",
      component: <CreateProductType />,
    },
    {
      path: "/catalogs/product-types/list",
      name: "List Product Types",
      component: <ProductTypesList />,
    },

    // event types
    {
      path: "/catalogs/event-types/edit/:uuid",
      name: "Edit Event Type",
      component: <EditEventType />,
    },
    {
      path: "/catalogs/event-types/create",
      name: "Create Event Type",
      component: <CreateEventType />,
    },
    {
      path: "/catalogs/event-types/list",
      name: "List Event Types",
      component: <EventTypesList />,
    },

    // locations
    {
      path: "/catalogs/locations/edit/:uuid",
      name: "Edit Location",
      component: <EditLocation />,
    },
    {
      path: "/catalogs/locations/create",
      name: "Create Location",
      component: <CreateLocation />,
    },
    {
      path: "/catalogs/locations/list",
      name: "List Locations",
      component: <LocationsList />,
    },
    // request types
    {
      path: "/catalogs/request-types/edit/:uuid",
      name: "Edit Request Type",
      component: <EditRequestType />,
    },
    {
      path: "/catalogs/request-types/create",
      name: "Create Request Type",
      component: <CreateRequestType />,
    },
    {
      path: "/catalogs/request-types/list",
      name: "List Request Types",
      component: <RequestTypesList />,
    },

    // distributors
    {
      path: "/catalogs/distributors/edit/:uuid",
      name: "Edit Distributor",
      component: <EditDistributor />,
    },
    {
      path: "/catalogs/distributors/create",
      name: "Create Distributor",
      component: <CreateDistributor />,
    },
    {
      path: "/catalogs/distributors/list",
      name: "List Distributors",
      component: <DistributorsList />,
    },

    // retailers
    {
      path: "/catalogs/retailers/edit/:uuid",
      name: "Edit Retailer",
      component: <EditRetailer />,
    },
    {
      path: "/catalogs/retailers/create",
      name: "Create Retailer",
      component: <CreateRetailer />,
    },
    {
      path: "/catalogs/retailers/list",
      name: "List Retailers",
      component: <RetailersList />,
    },
  ],
};

const CatalogsRoutes = [
  // Flattened leaf routes for router consumption
  ...CatalogsLinks.menu.flatMap((group) => group.links ?? []),
  ...CatalogsLinks.routes,
];

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
  {
    title: "Catalogs",
    Icon: TagIcon,
    links: CatalogsLinks.menu,
  },
];

/* -----------------------------------------------------------
   EXPORT: APP ROUTES (SOLO ROUTES REALES)
----------------------------------------------------------- */
export const appRoutes = [
  ...DashboardLinks.routes,
  ...RequestsLinks.routes,
  ...EventsLinks.routes,
  // ...TenantsLinks.routes,
  ...RecapLinks.routes,
  ...ProductLinks.routes,
  ...CatalogsRoutes,
  ...CompanyRoutes.routes,
  ...PublicRoutes.routes,
];

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
  AdjustmentsHorizontalIcon,
  FlagIcon,
} from "@heroicons/react/24/solid";
import { Palette, PencilIcon, TagIcon, Archive } from "lucide-react";

// Dashboard
import DashboardEvents from "@/components/pages/dashboard-event/DashboardEvent";
import DashboardRetail from "@/components/pages/dashboard-retail/DashboardRetail";
// import DashboardIndex from "@/components/pages/dashboard";

// Company Selection
import CompanySelector from "@/layout/CompanySelector";

// Requests
import RequestsList from "@/requests/RequestsList";
import MasterTracker from "@/requests/MasterTracker";
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
// import CreateRecap from "@/recap/CreateRecap";
import RecapList from "@/recap/RecapsList";
import SparkRecapsList from "@/recap/SparkRecapsList";
import SparkRecapView from "@/recap/SparkRecapView";
import SparkCalendar from "@/components/pages/calendar/SparkCalendar";
import SparkApprovals from "@/components/pages/approvals/SparkApprovals";
import SparkSettings from "@/components/pages/settings/SparkSettings";
import SparkJobs from "@/components/pages/jobs/SparkJobs";
import SparkRequestCreate from "@/requests/SparkRequestCreate";
import RecapCustomList from "@/recap/RecapCustomList";
import RecapView from "@/recap/RecapView";
// import EditRecap from "@/recap/EditRecap";

// User
import UsersList from "@/users/UsersList";
import CreateUser from "@/users/CreateUser";

// Public
import SparkFormPage from "@/public/form/FormPage";
import PrivacyPolicyView from "@/utils/PrivacyPolicyView";
import TermsOfServiceView from "@/utils/TermsOfServiceView";
import IndependentContractorAgreementPage from "@/utils/IndependentContractorAgreement";

// Calendar
import CalendarConnection from "@/calendar/CalendarConnection";

// Settings
import ThemePage from "@/theme/ThemePage";
import CreateGoals from "@/goals/CreateGoals";
import GoalsList from "@/goals/GoalsList";
import RecapCustomView from "@/recap/RecapCustomView";

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
    {
      path: "/privacy-policy",
      component: <PrivacyPolicyView />,
      isPublic: true,
    },
    {
      path: "/independent-contractor-agreement",
      component: <IndependentContractorAgreementPage />,
      isPublic: true,
    },
    {
      path: "/terms-of-service",
      component: <TermsOfServiceView />,
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
    { path: "/requests/create", name: "Create", Icon: PlusCircleIcon },
    { path: "/requests/list", name: "List", Icon: Bars4Icon },
    { path: "/requests/edited", name: "Edited Requests", Icon: PencilIcon },
  ],

  routes: [
    {
      path: "/requests/list",
      component: <MasterTracker />,
      isPublic: false,
    },
    {
      path: "/requests/legacy",
      component: <RequestsList />,
      isPublic: false,
    },
    {
      path: "/requests/create",
      component: <SparkRequestCreate />,
      isPublic: false,
    },
    {
      path: "/requests/create-detailed",
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
    {
      path: "/requests/edited",
      component: <RequestsList fixedFilters={{ edited: true }} />,
      isPublic: false,
    },
    {
      path: "/approvals",
      component: <SparkApprovals />,
      isPublic: false,
    },
    {
      path: "/jobs",
      component: <SparkJobs />,
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
    { path: "/events/edited", name: "Edited Events", Icon: PencilIcon },
    { path: "/events/today", name: "Today", Icon: CalendarIcon },
    { path: "/events/map", name: "Map", Icon: MapIcon },
    { path: "/events/archived", name: "Archived", Icon: Archive },
  ],

  routes: [
    { path: "/events/list", component: <EventsList />, isPublic: false },
    {
      path: "/events/edited",
      component: <EventsList fixedFilters={{ edited: true }} />,
      isPublic: false,
    },
    { path: "/events/today", component: <TodayEvents />, isPublic: false },
    { path: "/events/map", component: <TodayEventsMap />, isPublic: false },
    {
      path: "/events/archived",
      component: <EventsList fixedFilters={{ archived: true }} />,
      isPublic: false,
    },
    {
      path: "/event/create",
      name: "Create Event",
      component: <CreateEventWithoutRequest />,
      isPublic: false,
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
 USERS
----------------------------------------------------------- */
const UsersLinks = {
  menu: [
    {
      path: "/users/list",
      name: "List",
      component: <UsersList />,
      Icon: Bars4Icon,
    },
    {
      path: "/users/create",
      name: "Create",
      component: <CreateUser />,
      Icon: PlusCircleIcon,
    },
  ],
  routes: [
    {
      path: "/users/list",
      component: <UsersList />,
      isPublic: false,
    },
    {
      path: "/users/create",
      component: <CreateUser />,
      isPublic: false,
    },
  ],
};

/* -----------------------------------------------------------
   PRODUCTS
----------------------------------------------------------- */
const ProductLinks = {
  menu: [
    { path: "/products/products-list", name: "List", Icon: Bars4Icon },
    { path: "/products/create-product", name: "Create", Icon: PlusCircleIcon },
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
    { path: "/recap/list", name: "List", Icon: Bars4Icon },
    { path: "/recaps/custom-list", name: "Custom List", Icon: QueueListIcon },
    // { path: "/recap/create", name: "Create", Icon: PlusCircleIcon },
  ],

  routes: [
    // { path: "/recap/create", component: <CreateRecap />, isPublic: false },
    { path: "/recap/list", component: <SparkRecapsList />, isPublic: false },
    { path: "/recaps/list", component: <SparkRecapsList />, isPublic: false },
    { path: "/recap/legacy", component: <RecapList />, isPublic: false },
    {
      path: "/recaps/custom-list",
      component: <RecapCustomList />,
      isPublic: false,
    },
    { path: "/recap/view/:uuid", component: <SparkRecapView />, isPublic: false },
    { path: "/recap/view-legacy/:uuid", component: <RecapView />, isPublic: false },
    {
      path: "/recap/view-custom/:uuid",
      component: <RecapCustomView />,
      isPublic: false,
    },
    // { path: "/recap/edit/:uuid", component: <EditRecap />, isPublic: false },
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
          isPublic: false,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/product-types/create",
          name: "Create",
          component: <CreateProductType />,
          isPublic: false,
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
          isPublic: false,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/event-types/create",
          name: "Create",
          component: <CreateEventType />,
          isPublic: false,
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
          isPublic: false,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/locations/create",
          name: "Create",
          component: <CreateLocation />,
          isPublic: false,
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
          isPublic: false,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/request-types/create",
          name: "Create",
          component: <CreateRequestType />,
          isPublic: false,
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
          isPublic: false,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/distributors/create",
          name: "Create",
          component: <CreateDistributor />,
          isPublic: false,
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
          isPublic: false,
          Icon: Bars4Icon,
        },
        {
          path: "/catalogs/retailers/create",
          name: "Create",
          component: <CreateRetailer />,
          isPublic: false,
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
      isPublic: false,
    },
    {
      path: "/catalogs/product-types/create",
      name: "Create Product Type",
      component: <CreateProductType />,
      isPublic: false,
    },
    {
      path: "/catalogs/product-types/list",
      name: "List Product Types",
      component: <ProductTypesList />,
      isPublic: false,
    },

    // event types
    {
      path: "/catalogs/event-types/edit/:uuid",
      name: "Edit Event Type",
      component: <EditEventType />,
      isPublic: false,
    },
    {
      path: "/catalogs/event-types/create",
      name: "Create Event Type",
      component: <CreateEventType />,
      isPublic: false,
    },
    {
      path: "/catalogs/event-types/list",
      name: "List Event Types",
      component: <EventTypesList />,
      isPublic: false,
    },

    // locations
    {
      path: "/catalogs/locations/edit/:uuid",
      name: "Edit Location",
      component: <EditLocation />,
      isPublic: false,
    },
    {
      path: "/catalogs/locations/create",
      name: "Create Location",
      component: <CreateLocation />,
      isPublic: false,
    },
    {
      path: "/catalogs/locations/list",
      name: "List Locations",
      component: <LocationsList />,
      isPublic: false,
    },
    // request types
    {
      path: "/catalogs/request-types/edit/:uuid",
      name: "Edit Request Type",
      component: <EditRequestType />,
      isPublic: false,
    },
    {
      path: "/catalogs/request-types/create",
      name: "Create Request Type",
      component: <CreateRequestType />,
      isPublic: false,
    },
    {
      path: "/catalogs/request-types/list",
      name: "List Request Types",
      component: <RequestTypesList />,
      isPublic: false,
    },

    // distributors
    {
      path: "/catalogs/distributors/edit/:uuid",
      name: "Edit Distributor",
      component: <EditDistributor />,
      isPublic: false,
    },
    {
      path: "/catalogs/distributors/create",
      name: "Create Distributor",
      component: <CreateDistributor />,
      isPublic: false,
    },
    {
      path: "/catalogs/distributors/list",
      name: "List Distributors",
      component: <DistributorsList />,
      isPublic: false,
    },

    // retailers
    {
      path: "/catalogs/retailers/edit/:uuid",
      name: "Edit Retailer",
      component: <EditRetailer />,
      isPublic: false,
    },
    {
      path: "/catalogs/retailers/create",
      name: "Create Retailer",
      component: <CreateRetailer />,
      isPublic: false,
    },
    {
      path: "/catalogs/retailers/list",
      name: "List Retailers",
      component: <RetailersList />,
      isPublic: false,
    },
  ],
};

const CatalogsRoutes = [
  // Flattened leaf routes for router consumption
  ...CatalogsLinks.menu.flatMap((group) => group.links ?? []),
  ...CatalogsLinks.routes,
];

/* -----------------------------------------------------------
    CALENDAR
----------------------------------------------------------- */
const CalendarLinks = {
  menu: [
    {
      path: "/connect-calendar",
      name: "Calendar",
      component: <SparkCalendar />,
      Icon: CalendarIcon,
    },
  ],
  routes: [
    // Spark v2: /connect-calendar shows the wireframe Shifts Board.
    // The Google Calendar integration UI moves to /settings/calendar
    // (sidebar Settings group).
    {
      path: "/connect-calendar",
      component: <SparkCalendar />,
      isPublic: false,
    },
    {
      path: "/settings/calendar",
      component: <CalendarConnection />,
      isPublic: false,
    },
  ],
};

/* -----------------------------------------------------------
  SETTINGS
----------------------------------------------------------- */
const SettingsLinks = {
  menu: [
    {
      path: "/settings",
      name: "Workspace",
      component: <SparkSettings />,
      Icon: Palette,
    },
    {
      path: "/customize-theme",
      name: "Customize Theme",
      component: <ThemePage />,
      Icon: Palette,
    },
  ],
  routes: [
    {
      path: "/settings",
      component: <SparkSettings />,
      isPublic: false,
    },
    {
      path: "/customize-theme",
      component: <ThemePage />,
      isPublic: false,
    },
  ],
};

/* -----------------------------------------------------------
  GOALS
----------------------------------------------------------- */
const GoalsLinks = {
  menu: [
    {
      path: "/goals/list",
      name: "List",
      component: <GoalsList />,
      Icon: Bars4Icon,
    },
    {
      path: "/goals/create",
      name: "Create",
      component: <CreateGoals />,
      Icon: PlusCircleIcon,
    },
  ],
  routes: [
    {
      path: "/goals/list",
      component: <GoalsList />,
      isPublic: false,
    },
    {
      path: "/goals/create",
      component: <CreateGoals />,
      isPublic: false,
    },
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
    title: "Users",
    Icon: UserGroupIcon,
    links: UsersLinks.menu,
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
  {
    title: "Connect Calendar",
    path: "/connect-calendar", // Solo link, no submenu
    Icon: CalendarIcon,
  },
  {
    title: "Settings",
    Icon: AdjustmentsHorizontalIcon,
    links: SettingsLinks.menu,
  },
  {
    title: "Goals",
    Icon: FlagIcon,
    links: GoalsLinks.menu,
  },
];

/* -----------------------------------------------------------
   EXPORT: APP ROUTES (SOLO ROUTES REALES)
----------------------------------------------------------- */
export const appRoutes = [
  ...DashboardLinks.routes,
  ...RequestsLinks.routes,
  ...EventsLinks.routes,
  ...UsersLinks.routes,
  ...RecapLinks.routes,
  ...ProductLinks.routes,
  ...CatalogsRoutes,
  //Calendar
  ...CalendarLinks.routes,
  ...CompanyRoutes.routes,
  ...PublicRoutes.routes,
  ...SettingsLinks.routes,
  ...GoalsLinks.routes,
];

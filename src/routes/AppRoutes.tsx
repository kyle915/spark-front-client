import { BeakerIcon } from '@heroicons/react/24/solid';
import Dashboard from '@/events/Dashboard';
import CompanySelector from '@/layout/CompanySelector';

const DashboardLinks = {
    menu: [
        {
            path: "/dashboard/:uuid",
            name: "Dashboard",
            component: <Dashboard />,
            Icon: BeakerIcon,
        },
    ],
    routes: [
        {
            path: "/",
            name: "CompanySelector",
            component: <CompanySelector />,
        },
        {
            path: "/",
            name: "Dashboard",
            component: <Dashboard />,
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


export const appRoutes = [
    ...DashboardLinks.menu,
    ...DashboardLinks.routes,
];
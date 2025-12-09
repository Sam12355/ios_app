import { UserRole } from '../models';

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  PendingAccess: undefined;
};

export type MainStackParamList = {
  DrawerNav: undefined;
  Chat: { userId?: string; threadId?: string };
  Inbox: undefined;
};

export type DrawerParamList = {
  Dashboard: undefined;
  BranchManagement: undefined;
  Staff: undefined;
  Items: undefined;
  StockOut: undefined;
  ICADelivery: undefined;
  StockIn: undefined;
  RecordStockIn: undefined;
  Reports: undefined;
  Analytics: undefined;
  ActivityLogs: undefined;
  RegionManagement: undefined;
  DistrictManagement: undefined;
  MoveoutList: undefined;
  Notifications: undefined;
  Settings: undefined;
};

export interface NavigationItem {
  title: string;
  route: keyof DrawerParamList;
  icon: string;
  allowedRoles: UserRole[];
  description?: string;
}

export const navigationItems: NavigationItem[] = [
  {
    title: 'Dashboard',
    route: 'Dashboard',
    icon: 'home',
    allowedRoles: ['manager', 'assistant_manager', 'staff'],
    description: 'Overview of branch operations',
  },
  {
    title: 'Branch Management',
    route: 'BranchManagement',
    icon: 'business',
    allowedRoles: ['admin'],
    description: 'Manage branches across regions',
  },
  {
    title: 'Manage Staff',
    route: 'Staff',
    icon: 'people',
    allowedRoles: ['admin', 'manager', 'assistant_manager'],
    description: 'Manage staff members and assignments',
  },
  {
    title: 'Manage Items',
    route: 'Items',
    icon: 'inventory',
    allowedRoles: ['manager', 'assistant_manager'],
    description: 'Manage inventory items and categories',
  },
  {
    title: 'Stock Out',
    route: 'Stock',
    icon: 'remove-shopping-cart',
    allowedRoles: ['manager', 'assistant_manager', 'staff'],
    description: 'Record stock outgoing transactions',
  },
  {
    title: 'ICA Delivery',
    route: 'ICADelivery',
    icon: 'local-shipping',
    allowedRoles: ['manager', 'assistant_manager'],
    description: 'Manage ICA delivery lists',
  },
  {
    title: 'Stock In',
    route: 'StockIn',
    icon: 'add-box',
    allowedRoles: ['manager', 'assistant_manager'],
    description: 'Record stock incoming transactions',
  },
  {
    title: 'Record Stock In',
    route: 'RecordStockIn',
    icon: 'upload',
    allowedRoles: ['staff'],
    description: 'Record new stock arrivals',
  },
  {
    title: 'Reports',
    route: 'Reports',
    icon: 'assessment',
    allowedRoles: ['manager', 'assistant_manager'],
    description: 'Generate and view reports',
  },
  {
    title: 'Analytics',
    route: 'Analytics',
    icon: 'bar-chart',
    allowedRoles: ['manager', 'assistant_manager'],
    description: 'View analytics and trends',
  },
  {
    title: 'Activity Logs',
    route: 'ActivityLogs',
    icon: 'history',
    allowedRoles: ['admin', 'manager'],
    description: 'View system activity logs',
  },
  {
    title: 'Region Management',
    route: 'RegionManagement',
    icon: 'public',
    allowedRoles: ['admin'],
    description: 'Manage regions and territories',
  },
  {
    title: 'District Management',
    route: 'DistrictManagement',
    icon: 'location-city',
    allowedRoles: ['admin'],
    description: 'Manage districts within regions',
  },
  {
    title: 'Moveout Lists',
    route: 'MoveoutList',
    icon: 'list',
    allowedRoles: ['admin', 'assistant_manager'],
    description: 'View and manage moveout lists',
  },
];

export const getNavigationItemsForRole = (userRole: UserRole): NavigationItem[] => {
  return navigationItems.filter(item => item.allowedRoles.includes(userRole));
};

export const hasAccessToRoute = (userRole: UserRole, route: keyof DrawerParamList): boolean => {
  const item = navigationItems.find(i => i.route === route);
  return item?.allowedRoles.includes(userRole) ?? false;
};

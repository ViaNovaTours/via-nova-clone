/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import About from './pages/About';
import AdSpend from './pages/AdSpend';
import Calendar from './pages/Calendar';
import Completed from './pages/Completed';
import Contact from './pages/Contact';
import Costs from './pages/Costs';
import Dashboard from './pages/Dashboard';
import ExportOrders from './pages/ExportOrders';
import Home from './pages/Home';
import NewOrder from './pages/NewOrder';
import OrderDetail from './pages/OrderDetail';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Profits from './pages/Profits';
import RefundPolicy from './pages/RefundPolicy';
import Robots from './pages/Robots';
import RootRedirect from './pages/RootRedirect';
import Sitemap from './pages/Sitemap';
import TermsAndConditions from './pages/TermsAndConditions';
import TestAdSpend from './pages/TestAdSpend';
import TourLanding from './pages/TourLanding';
import TourLandingAdmin from './pages/TourLandingAdmin';
import TourPreview from './pages/TourPreview';
import TourSetup from './pages/TourSetup';
import Tours from './pages/Tours';
import privacyPolicy from './pages/privacy-policy';
import refundPolicy from './pages/refund-policy';
import termsAndConditions from './pages/terms-and-conditions';
import __Layout from './Layout.jsx';


export const PAGES = {
    "About": About,
    "AdSpend": AdSpend,
    "Calendar": Calendar,
    "Completed": Completed,
    "Contact": Contact,
    "Costs": Costs,
    "Dashboard": Dashboard,
    "ExportOrders": ExportOrders,
    "Home": Home,
    "NewOrder": NewOrder,
    "OrderDetail": OrderDetail,
    "PrivacyPolicy": PrivacyPolicy,
    "Profits": Profits,
    "RefundPolicy": RefundPolicy,
    "Robots": Robots,
    "RootRedirect": RootRedirect,
    "Sitemap": Sitemap,
    "TermsAndConditions": TermsAndConditions,
    "TestAdSpend": TestAdSpend,
    "TourLanding": TourLanding,
    "TourLandingAdmin": TourLandingAdmin,
    "TourPreview": TourPreview,
    "TourSetup": TourSetup,
    "Tours": Tours,
    "privacy-policy": privacyPolicy,
    "refund-policy": refundPolicy,
    "terms-and-conditions": termsAndConditions,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};
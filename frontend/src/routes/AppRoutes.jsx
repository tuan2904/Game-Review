import { Route, Routes } from "react-router-dom";
import AppLayout from "../components/layouts/AppLayout";
import AdminRoute from "../components/routes/AdminRoute";
import ProtectedRoute from "../components/routes/ProtectedRoute";
import { FavoritesProvider } from "../contexts/FavoritesContext";
import Favorites from "../pages/Favorites";
import GameDetail from "../pages/GameDetail";
import Games from "../pages/Games";
import Home from "../pages/Home";
import Login from "../pages/Login";
import NotFound from "../pages/NotFound";
import Profile from "../pages/Profile";
import Register from "../pages/Register";
import AdminCategories from "../pages/admin/AdminCategories";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminGameForm from "../pages/admin/AdminGameForm";
import AdminGames from "../pages/admin/AdminGames";

/**
 * Route table.
 *
 * Public:  / /games /games/:slug /login /register
 * Protected (auth required): /profile /favorites  → redirect to /login
 *                            preserving the destination in location.state.from
 * Admin (auth + `is_staff`): /admin /admin/games /admin/games/new
 *                            /admin/games/:slug/edit /admin/categories
 *                            → unauthenticated to /login (same convention),
 *                            authenticated non-admin to an access-denied state
 * Unknown paths → NotFound.
 *
 * Frontend gating is a UX boundary only; the backend enforces every admin
 * write with `IsAdmin`/`IsAdminOrReadOnly` (401 anon / 403 non-admin).
 */
export default function AppRoutes() {
  return (
    /* FavoritesProvider must sit inside AuthProvider (main.jsx / tests) —
       it keeps the shared favorite-status set used by the listing, detail
       and favorites pages. */
    <FavoritesProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="games" element={<Games />} />
          <Route path="games/:slug" element={<GameDetail />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route path="profile" element={<Profile />} />
            <Route path="favorites" element={<Favorites />} />
          </Route>
          <Route path="admin" element={<AdminRoute />}>
            <Route index element={<AdminDashboard />} />
            <Route path="games" element={<AdminGames />} />
            <Route path="games/new" element={<AdminGameForm />} />
            <Route path="games/:slug/edit" element={<AdminGameForm />} />
            <Route path="categories" element={<AdminCategories />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </FavoritesProvider>
  );
}

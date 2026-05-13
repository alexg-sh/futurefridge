import Link from "next/link";
import { getCurrentUser, canAccess } from "../lib/auth";

export async function Navbar() {
  const user = await getCurrentUser();
  return (
    <nav className="navbar">
      <Link className="navbar-brand" href={user ? "/dashboard" : "/"}>
        FutureFridges
      </Link>
      <ul className="navbar-nav">
        <li>
          <Link className="nav-link" href="/dashboard">
            Dashboard
          </Link>
        </li>
        {canAccess(user, ["admin"]) ? (
          <li>
            <Link className="nav-link" href="/admin">
              Admin
            </Link>
          </li>
        ) : null}
        {canAccess(user, ["manager", "chef", "admin"]) ? (
          <li>
            <Link className="nav-link" href="/fridge">
              Fridge
            </Link>
          </li>
        ) : null}
        {canAccess(user, ["chef", "provider", "admin", "delivery", "supplier", "manager"]) ? (
          <li>
            <Link className="nav-link" href="/track">
              Track Order
            </Link>
          </li>
        ) : null}
        {canAccess(user, ["manager", "chef", "admin"]) ? (
          <li>
            <Link className="nav-link" href="/reports">
              Reports
            </Link>
          </li>
        ) : null}
        <li>
          <Link className="nav-link" href="/faq">
            FAQ
          </Link>
        </li>
        <li>
          <Link className="nav-link" href="/tos">
            Terms of Service
          </Link>
        </li>
      </ul>
      <ul className="navbar-nav right">
        {user ? (
          <>
            <li>
              <Link className="nav-link" href="/settings">
                Settings
              </Link>
            </li>
            <li>
              <Link className="nav-link" href="/api/auth/logout">
                Logout
              </Link>
            </li>
          </>
        ) : (
          <li>
            <Link className="nav-link" href="/login">
              Login
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}

"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button className="logout-button" type="button" onClick={() => void signOut({ callbackUrl: "/signin" })}>
      <span aria-hidden="true">↪</span>
      Sign out
    </button>
  );
}
